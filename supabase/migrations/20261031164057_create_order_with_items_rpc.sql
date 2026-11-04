-- Stage 6: atomic order creation RPC for the Supabase order writer.
-- SECURITY INVOKER (service_role executes with its existing table grants).
-- Additive only: one nullable column + one function + function grants.
-- Never mutates historical order rows.

-- 1. Request fingerprint for replay binding (nullable; legacy rows keep NULL).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS request_fingerprint text;

-- 2. Atomic create-order RPC.
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_checkout_attempt_id uuid,
  p_request_fingerprint text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_comment text,
  p_contact_method public.contact_method,
  p_delivery_method public.delivery_method,
  p_delivery_city_ref text,
  p_delivery_city_name text,
  p_delivery_point_ref text,
  p_delivery_point_number text,
  p_delivery_point_name text,
  p_delivery_point_address text,
  p_delivery_point_type text,
  p_delivery_street_ref text,
  p_delivery_street_name text,
  p_delivery_street_type text,
  p_delivery_house text,
  p_delivery_apartment text,
  p_items_quantity integer,
  p_subtotal integer,
  p_quantity_discount integer,
  p_loyalty_phone text,
  p_loyalty_eligible boolean,
  p_loyalty_discount_percent integer,
  p_loyalty_discount_amount integer,
  p_loyalty_phone_mismatch boolean,
  p_total integer,
  p_discount_tier_key text,
  p_manager_note text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_number text;
  v_existing_total integer;
  v_existing_fingerprint text;
  v_order_id uuid;
  v_order_number text;
  v_item_count integer;
  v_sum_qty bigint;
  v_sum_line bigint;
  v_bad_qty integer;
  v_bad_price integer;
  v_bad_line integer;
  v_loop_done boolean := false;
  v_constraint text;
  v_attempt integer;
BEGIN
  -- Idempotency key: mandatory for every new order. Legacy NULL rows are
  -- unreachable through this RPC.
  IF p_checkout_attempt_id IS NULL THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_ATTEMPT_ID'
      USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_ITEMS'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent calls with the same attempt id (transaction-scoped).
  PERFORM pg_advisory_xact_lock(
    hashtextextended('create_order_with_items:' || p_checkout_attempt_id::text, 0)
  );

  -- Replay path: the attempt already created an order.
  SELECT id, order_number, total, request_fingerprint
    INTO v_existing_id, v_existing_number, v_existing_total, v_existing_fingerprint
  FROM public.orders
  WHERE checkout_attempt_id = p_checkout_attempt_id;

  IF FOUND THEN
    -- A reused attempt id with materially different checkout intent is
    -- rejected without leaking any order data.
    IF v_existing_fingerprint IS NOT NULL
      AND p_request_fingerprint IS NOT NULL
      AND v_existing_fingerprint <> p_request_fingerprint
    THEN
      RAISE EXCEPTION 'create_order_with_items: ATTEMPT_FINGERPRINT_MISMATCH'
        USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'id', v_existing_id,
      'order_number', v_existing_number,
      'total', v_existing_total,
      'created', false
    );
  END IF;

  -- ---- Arithmetic validation (server snapshot must be internally consistent) ----
  IF p_items_quantity IS NULL OR p_items_quantity < 1 THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_ITEMS_QUANTITY'
      USING ERRCODE = '22023';
  END IF;
  IF p_subtotal IS NULL OR p_subtotal < 0
    OR p_quantity_discount IS NULL OR p_quantity_discount < 0
    OR p_loyalty_discount_percent IS NULL OR p_loyalty_discount_percent < 0
    OR p_loyalty_discount_amount IS NULL OR p_loyalty_discount_amount < 0
    OR p_total IS NULL OR p_total < 0
  THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_AMOUNTS'
      USING ERRCODE = '22023';
  END IF;
  IF p_customer_phone IS NULL OR length(btrim(p_customer_phone)) = 0 THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_PHONE'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(SUM((item ->> 'quantity')::integer), 0),
    COALESCE(SUM((item ->> 'line_total')::integer), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE (item ->> 'quantity')::integer IS NULL OR (item ->> 'quantity')::integer < 1),
    COUNT(*) FILTER (WHERE (item ->> 'unit_price')::integer IS NULL OR (item ->> 'unit_price')::integer < 0),
    COUNT(*) FILTER (
      WHERE (item ->> 'line_total')::integer IS NULL
        OR (item ->> 'line_total')::bigint
           <> (item ->> 'unit_price')::bigint * (item ->> 'quantity')::bigint
    )
  INTO v_sum_qty, v_sum_line, v_item_count, v_bad_qty, v_bad_price, v_bad_line
  FROM jsonb_array_elements(p_items) AS item;

  IF v_item_count < 1 THEN
    RAISE EXCEPTION 'create_order_with_items: EMPTY_ITEMS'
      USING ERRCODE = '22023';
  END IF;
  IF v_bad_qty > 0 OR v_bad_price > 0 OR v_bad_line > 0 THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_ITEM_ARITHMETIC'
      USING ERRCODE = '22023';
  END IF;
  IF v_sum_qty <> p_items_quantity OR v_sum_line <> p_subtotal THEN
    RAISE EXCEPTION 'create_order_with_items: TOTALS_MISMATCH'
      USING ERRCODE = '22023';
  END IF;
  IF p_total <> p_subtotal - p_quantity_discount - p_loyalty_discount_amount THEN
    RAISE EXCEPTION 'create_order_with_items: TOTAL_FORMULA_MISMATCH'
      USING ERRCODE = '22023';
  END IF;

  -- ---- Insert one order + all items in this transaction ----
  -- Order number is generated here with a bounded collision retry. The
  -- checkout_attempt_id conflict cannot occur under the advisory lock; if it
  -- ever does, it is surfaced as a deterministic replay.
  FOR v_attempt IN 1 .. 12 LOOP
    v_order_number := 'CZ-'
      || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD')
      || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    BEGIN
      INSERT INTO public.orders (
        order_number,
        checkout_attempt_id,
        request_fingerprint,
        status,
        customer_name,
        customer_phone,
        customer_comment,
        contact_method,
        delivery_method,
        delivery_city_ref,
        delivery_city_name,
        delivery_point_ref,
        delivery_point_number,
        delivery_point_name,
        delivery_point_address,
        delivery_point_type,
        delivery_street_ref,
        delivery_street_name,
        delivery_street_type,
        delivery_house,
        delivery_apartment,
        items_quantity,
        subtotal,
        quantity_discount,
        loyalty_phone,
        loyalty_eligible,
        loyalty_discount_percent,
        loyalty_discount_amount,
        loyalty_phone_mismatch,
        total,
        discount_tier_key,
        manager_note
      ) VALUES (
        v_order_number,
        p_checkout_attempt_id,
        p_request_fingerprint,
        'new',
        p_customer_name,
        p_customer_phone,
        p_customer_comment,
        p_contact_method,
        p_delivery_method,
        p_delivery_city_ref,
        p_delivery_city_name,
        p_delivery_point_ref,
        p_delivery_point_number,
        p_delivery_point_name,
        p_delivery_point_address,
        p_delivery_point_type,
        p_delivery_street_ref,
        p_delivery_street_name,
        p_delivery_street_type,
        p_delivery_house,
        p_delivery_apartment,
        p_items_quantity,
        p_subtotal,
        p_quantity_discount,
        p_loyalty_phone,
        p_loyalty_eligible,
        p_loyalty_discount_percent,
        p_loyalty_discount_amount,
        p_loyalty_phone_mismatch,
        p_total,
        p_discount_tier_key,
        p_manager_note
      )
      RETURNING id INTO v_order_id;
      v_loop_done := true;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'orders_checkout_attempt_id_key' THEN
        SELECT id, order_number, total, request_fingerprint
          INTO v_existing_id, v_existing_number, v_existing_total, v_existing_fingerprint
        FROM public.orders
        WHERE checkout_attempt_id = p_checkout_attempt_id;
        IF FOUND THEN
          IF v_existing_fingerprint IS NOT NULL
            AND p_request_fingerprint IS NOT NULL
            AND v_existing_fingerprint <> p_request_fingerprint
          THEN
            RAISE EXCEPTION 'create_order_with_items: ATTEMPT_FINGERPRINT_MISMATCH'
              USING ERRCODE = '22023';
          END IF;
          RETURN jsonb_build_object(
            'id', v_existing_id,
            'order_number', v_existing_number,
            'total', v_existing_total,
            'created', false
          );
        END IF;
        RAISE;
      ELSIF v_constraint = 'orders_order_number_key' THEN
        CONTINUE;
      ELSE
        RAISE;
      END IF;
    END;
  END LOOP;

  IF NOT v_loop_done THEN
    RAISE EXCEPTION 'create_order_with_items: ORDER_NUMBER_CONTENTION'
      USING ERRCODE = '55P03';
  END IF;

  -- Item insert failure rolls back the order insert too (single transaction).
  INSERT INTO public.order_items (
    order_id,
    sort,
    item_key,
    title,
    design_slug,
    design_label,
    size_code,
    size_label,
    brand_slug,
    brand_name,
    fixation_key,
    fixation_label,
    unit_price,
    quantity,
    line_total,
    quantity_discount_eligible
  )
  SELECT
    v_order_id,
    (item ->> 'sort')::integer,
    item ->> 'item_key',
    item ->> 'title',
    item ->> 'design_slug',
    item ->> 'design_label',
    item ->> 'size_code',
    item ->> 'size_label',
    item ->> 'brand_slug',
    item ->> 'brand_name',
    item ->> 'fixation_key',
    item ->> 'fixation_label',
    (item ->> 'unit_price')::integer,
    (item ->> 'quantity')::integer,
    (item ->> 'line_total')::integer,
    COALESCE((item ->> 'quantity_discount_eligible')::boolean, true)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total', p_total,
    'created', true
  );
END;
$$;

-- 3. Function grants: PostgreSQL grants EXECUTE to PUBLIC by default.
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(
  uuid, text, text, text, text,
  public.contact_method, public.delivery_method,
  text, text, text, text, text, text, text,
  text, text, text, text, text,
  integer, integer, integer,
  text, boolean, integer, integer, boolean,
  integer, text, text, jsonb
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(
  uuid, text, text, text, text,
  public.contact_method, public.delivery_method,
  text, text, text, text, text, text, text,
  text, text, text, text, text,
  integer, integer, integer,
  text, boolean, integer, integer, boolean,
  integer, text, text, jsonb
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(
  uuid, text, text, text, text,
  public.contact_method, public.delivery_method,
  text, text, text, text, text, text, text,
  text, text, text, text, text,
  integer, integer, integer,
  text, boolean, integer, integer, boolean,
  integer, text, text, jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  uuid, text, text, text, text,
  public.contact_method, public.delivery_method,
  text, text, text, text, text, text, text,
  text, text, text, text, text,
  integer, integer, integer,
  text, boolean, integer, integer, boolean,
  integer, text, text, jsonb
) TO service_role;
