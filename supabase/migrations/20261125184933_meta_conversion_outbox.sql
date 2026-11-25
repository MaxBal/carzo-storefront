-- Additive advertising delivery. Existing order RPC, orders, customers and integrations stay unchanged.
-- No scheduler or outbound network requests are enabled by this migration.
BEGIN;

CREATE TABLE public.meta_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  consent_id uuid NOT NULL,
  destination text NOT NULL CHECK (destination ~ '^[a-z][a-z0-9_]{0,39}$'),
  pixel_id text NOT NULL CHECK (pixel_id ~ '^[0-9]{5,20}$'),
  event_id text NOT NULL,
  custom_data jsonb NOT NULL CHECK (jsonb_typeof(custom_data) = 'object'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 12),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_id uuid,
  locked_until timestamptz,
  last_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  delivered_at timestamptz,
  UNIQUE (pixel_id, event_id),
  UNIQUE (order_id, destination)
);
CREATE INDEX meta_outbox_order_idx ON public.meta_event_outbox(order_id);
CREATE INDEX meta_outbox_due_idx ON public.meta_event_outbox(next_attempt_at) WHERE status IN ('pending','processing');
CREATE INDEX meta_outbox_consent_idx ON public.meta_event_outbox(consent_id) WHERE status IN ('pending','processing');
CREATE INDEX meta_outbox_expiry_idx ON public.meta_event_outbox(expires_at);
ALTER TABLE public.meta_event_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_event_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_event_outbox TO service_role;

CREATE FUNCTION public.create_order_with_meta(p_order jsonb, p_events jsonb, p_consent_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $fn$
DECLARE
  result jsonb;
  event jsonb;
  event_id text;
  event_time bigint := floor(extract(epoch FROM now()))::bigint;
  browser_events jsonb;
BEGIN
  IF p_consent_id IS NULL OR jsonb_typeof(p_events) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_events) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_META_EVENTS' USING ERRCODE='22023';
  END IF;
  FOR event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    IF jsonb_typeof(event) IS DISTINCT FROM 'object'
      OR coalesce(event->>'destination','') !~ '^[a-z][a-z0-9_]{0,39}$'
      OR coalesce(event->>'pixel_id','') !~ '^[0-9]{5,20}$'
      OR coalesce(event->>'event_source_url','') !~ '^https://'
      OR jsonb_typeof(event->'user_data') IS DISTINCT FROM 'object'
      OR jsonb_typeof(event->'custom_data') IS DISTINCT FROM 'object'
      OR event->'custom_data'->>'currency' IS DISTINCT FROM 'UAH'
      OR coalesce(event->'custom_data'->>'value','') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'INVALID_META_EVENT' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF (SELECT sum((value->'custom_data'->>'value')::bigint) FROM jsonb_array_elements(p_events)) > (p_order->>'p_total')::bigint THEN
    RAISE EXCEPTION 'INVALID_META_VALUE' USING ERRCODE='22023';
  END IF;

  -- Calls the unmodified business RPC in this SAME transaction.
  result := public.create_order_with_items(
    p_checkout_attempt_id => (p_order->>'p_checkout_attempt_id')::uuid,
    p_request_fingerprint => p_order->>'p_request_fingerprint',
    p_customer_name => p_order->>'p_customer_name',
    p_customer_phone => p_order->>'p_customer_phone',
    p_customer_comment => p_order->>'p_customer_comment',
    p_contact_method => (p_order->>'p_contact_method')::public.contact_method,
    p_delivery_method => (p_order->>'p_delivery_method')::public.delivery_method,
    p_delivery_city_ref => p_order->>'p_delivery_city_ref',
    p_delivery_city_name => p_order->>'p_delivery_city_name',
    p_delivery_point_ref => p_order->>'p_delivery_point_ref',
    p_delivery_point_number => p_order->>'p_delivery_point_number',
    p_delivery_point_name => p_order->>'p_delivery_point_name',
    p_delivery_point_address => p_order->>'p_delivery_point_address',
    p_delivery_point_type => p_order->>'p_delivery_point_type',
    p_delivery_street_ref => p_order->>'p_delivery_street_ref',
    p_delivery_street_name => p_order->>'p_delivery_street_name',
    p_delivery_street_type => p_order->>'p_delivery_street_type',
    p_delivery_house => p_order->>'p_delivery_house',
    p_delivery_apartment => p_order->>'p_delivery_apartment',
    p_items_quantity => (p_order->>'p_items_quantity')::integer,
    p_subtotal => (p_order->>'p_subtotal')::integer,
    p_quantity_discount => (p_order->>'p_quantity_discount')::integer,
    p_loyalty_phone => p_order->>'p_loyalty_phone',
    p_loyalty_eligible => (p_order->>'p_loyalty_eligible')::boolean,
    p_loyalty_discount_percent => (p_order->>'p_loyalty_discount_percent')::integer,
    p_loyalty_discount_amount => (p_order->>'p_loyalty_discount_amount')::integer,
    p_loyalty_phone_mismatch => (p_order->>'p_loyalty_phone_mismatch')::boolean,
    p_total => (p_order->>'p_total')::integer,
    p_discount_tier_key => p_order->>'p_discount_tier_key',
    p_manager_note => p_order->>'p_manager_note',
    p_items => p_order->'p_items',
    p_payment_option => p_order->>'p_payment_option'
  );

  IF (result->>'created')::boolean THEN
    FOR event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
      event_id := 'purchase:' || (result->>'id') || ':' || (event->>'destination');
      INSERT INTO public.meta_event_outbox(order_id, consent_id, destination, pixel_id, event_id, custom_data, payload)
      VALUES ((result->>'id')::uuid, p_consent_id, event->>'destination', event->>'pixel_id', event_id, event->'custom_data',
        jsonb_build_object('event_name','Purchase','event_id',event_id,'event_time',event_time,'action_source','website',
          'event_source_url',event->>'event_source_url','user_data',event->'user_data','custom_data',event->'custom_data'));
    END LOOP;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('pixelId',q.pixel_id,'eventId',q.event_id,'name','Purchase','data',q.custom_data)
    ORDER BY q.destination), '[]'::jsonb) INTO browser_events
    FROM public.meta_event_outbox q WHERE q.order_id=(result->>'id')::uuid AND q.status <> 'cancelled';
  RETURN result || jsonb_build_object('meta_events',browser_events);
END;
$fn$;

CREATE FUNCTION public.purge_meta_events() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $fn$
BEGIN
  UPDATE public.meta_event_outbox SET status='failed', payload='{}', last_code='expired', lease_id=NULL, locked_until=NULL
    WHERE expires_at <= now() AND status IN ('pending','processing');
  DELETE FROM public.meta_event_outbox WHERE created_at < now() - interval '30 days';
END;
$fn$;

CREATE FUNCTION public.claim_meta_events(p_destinations text[], p_limit integer DEFAULT 10)
RETURNS SETOF public.meta_event_outbox
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $fn$
BEGIN
  PERFORM public.purge_meta_events();
  RETURN QUERY
    WITH picked AS (
      SELECT q.id FROM public.meta_event_outbox q
      WHERE q.destination=ANY(p_destinations) AND q.expires_at > now() AND q.attempts < 12
        AND q.next_attempt_at <= now()
        AND (q.status='pending' OR (q.status='processing' AND q.locked_until < now()))
      ORDER BY q.created_at,q.id FOR UPDATE SKIP LOCKED LIMIT greatest(0,least(p_limit,10))
    )
    UPDATE public.meta_event_outbox q SET status='processing', lease_id=gen_random_uuid(),
      locked_until=now()+interval '3 minutes', attempts=q.attempts+1
    FROM picked WHERE q.id=picked.id RETURNING q.*;
END;
$fn$;

CREATE FUNCTION public.finish_meta_event(p_id uuid, p_lease_id uuid, p_outcome text, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF p_outcome NOT IN ('delivered','retry','failed') OR p_code !~ '^[a-zA-Z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'INVALID_META_OUTCOME' USING ERRCODE='22023';
  END IF;
  UPDATE public.meta_event_outbox SET
    status=CASE WHEN p_outcome='delivered' THEN 'delivered'
      WHEN p_outcome='failed' OR attempts>=12 OR expires_at<=now() THEN 'failed' ELSE 'pending' END,
    payload=CASE WHEN p_outcome IN ('delivered','failed') OR attempts>=12 OR expires_at<=now() THEN '{}'::jsonb ELSE payload END,
    delivered_at=CASE WHEN p_outcome='delivered' THEN now() ELSE NULL END,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts-1,7)))::integer),
    last_code=p_code, lease_id=NULL, locked_until=NULL
    WHERE id=p_id AND lease_id=p_lease_id AND status='processing';
END;
$fn$;

CREATE FUNCTION public.cancel_meta_events(p_consent_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $fn$
DECLARE cancelled integer;
BEGIN
  UPDATE public.meta_event_outbox SET status='cancelled', payload='{}', lease_id=NULL, locked_until=NULL, last_code='consent_revoked'
    WHERE consent_id=p_consent_id AND status IN ('pending','processing');
  GET DIAGNOSTICS cancelled=ROW_COUNT;
  RETURN cancelled;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_order_with_meta(jsonb,jsonb,uuid), public.purge_meta_events(),
  public.claim_meta_events(text[],integer), public.finish_meta_event(uuid,uuid,text,text), public.cancel_meta_events(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_meta(jsonb,jsonb,uuid), public.purge_meta_events(),
  public.claim_meta_events(text[],integer), public.finish_meta_event(uuid,uuid,text,text), public.cancel_meta_events(uuid)
  TO service_role;

COMMIT;
