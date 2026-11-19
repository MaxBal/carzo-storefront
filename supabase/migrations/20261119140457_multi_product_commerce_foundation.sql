-- Additive multi-product foundation. No catalog/order/customer data is inserted or rewritten.
BEGIN;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,95}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  product_type text NOT NULL CHECK (product_type ~ '^[a-z][a-z0-9_-]{0,63}$'),
  layout_key text NOT NULL DEFAULT 'product' CHECK (layout_key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  quantity_discount_eligible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  sku text UNIQUE CHECK (sku IS NULL OR sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$'),
  price integer CHECK (price >= 0),
  in_stock boolean NOT NULL DEFAULT false,
  attributes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attributes) = 'object' AND NOT jsonb_path_exists(attributes, '$.* ? (@.type() != "string")')),
  design_id uuid REFERENCES public.designs(id) ON DELETE RESTRICT,
  media_url text CHECK (media_url IS NULL OR media_url ~ '^https://media[.]carzo[.]com[.]ua/[^[:space:]]+$'),
  shipping_length_cm numeric CHECK (shipping_length_cm > 0),
  shipping_width_cm numeric CHECK (shipping_width_cm > 0),
  shipping_height_cm numeric CHECK (shipping_height_cm > 0),
  shipping_weight_kg numeric CHECK (shipping_weight_kg > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  CHECK (status <> 'published' OR (sku IS NOT NULL AND price IS NOT NULL
    AND shipping_length_cm IS NOT NULL AND shipping_width_cm IS NOT NULL
    AND shipping_height_cm IS NOT NULL AND shipping_weight_kg IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  input_type text NOT NULL CHECK (input_type IN ('choice', 'text')),
  required boolean NOT NULL DEFAULT false,
  max_length integer NOT NULL DEFAULT 80 CHECK (max_length BETWEEN 1 AND 120),
  price_extra integer NOT NULL DEFAULT 0 CHECK (price_extra >= 0),
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  UNIQUE (product_id, key),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_option_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_-]{0,63}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  price_extra integer NOT NULL DEFAULT 0 CHECK (price_extra >= 0),
  crm_sku text CHECK (crm_sku IS NULL OR crm_sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$'),
  brand_id uuid REFERENCES public.brands(id) ON DELETE RESTRICT,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  UNIQUE (group_id, key),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_variants_product_idx ON public.product_variants (product_id, status);
CREATE INDEX product_variants_design_idx ON public.product_variants (design_id) WHERE design_id IS NOT NULL;
CREATE INDEX product_option_choices_brand_idx ON public.product_option_choices (brand_id) WHERE brand_id IS NOT NULL;
-- UNIQUE(product_id,key) and UNIQUE(group_id,key) already index the remaining FKs.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_choices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.products, public.product_variants, public.product_option_groups, public.product_option_choices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.products, public.product_variants, public.product_option_groups, public.product_option_choices TO service_role;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_option_groups_updated_at BEFORE UPDATE ON public.product_option_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_option_choices_updated_at BEFORE UPDATE ON public.product_option_choices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- No FK into mutable catalog: historical configurations survive catalog edits/retirement.
ALTER TABLE public.order_items ADD COLUMN catalog_item jsonb
  CHECK (catalog_item IS NULL OR (
    jsonb_typeof(catalog_item) = 'object'
    AND catalog_item ?& ARRAY['productId','variantId','productType','sku','selectedOptions','shippingProfile','attributes']
    AND jsonb_typeof(catalog_item->'selectedOptions') = 'array'
    AND jsonb_typeof(catalog_item->'shippingProfile') = 'object'
    AND jsonb_typeof(catalog_item->'attributes') = 'object'
  ));

-- The RPC below retains the existing signature, arithmetic checks, advisory
-- lock, fingerprint binding and replay behavior. Only the line snapshot insert
-- is extended with catalog_item. Existing case payloads keep NULL metadata.


CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_checkout_attempt_id uuid,
  p_request_fingerprint text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_comment text,
  p_contact_method contact_method,
  p_delivery_method delivery_method,
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
  p_items jsonb,
  p_payment_option text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
  IF p_checkout_attempt_id IS NULL THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_ATTEMPT_ID'
      USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_ITEMS'
      USING ERRCODE = '22023';
  END IF;

  IF p_payment_option IS NOT NULL AND p_payment_option NOT IN ('prepayment_200', 'full') THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_PAYMENT_OPTION'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('create_order_with_items:' || p_checkout_attempt_id::text, 0)
  );

  SELECT id, order_number, total, request_fingerprint
    INTO v_existing_id, v_existing_number, v_existing_total, v_existing_fingerprint
  FROM public.orders
  WHERE checkout_attempt_id = p_checkout_attempt_id;

  IF FOUND THEN
    IF p_request_fingerprint IS NULL
      OR v_existing_fingerprint IS NULL
      OR v_existing_fingerprint <> p_request_fingerprint
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

  IF p_request_fingerprint IS NULL OR length(btrim(p_request_fingerprint)) = 0 THEN
    RAISE EXCEPTION 'create_order_with_items: INVALID_FINGERPRINT'
      USING ERRCODE = '22023';
  END IF;

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
        payment_option,
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
        p_payment_option,
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
          IF p_request_fingerprint IS NULL
            OR v_existing_fingerprint IS NULL
            OR v_existing_fingerprint <> p_request_fingerprint
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
    quantity_discount_eligible,
    catalog_item
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
    COALESCE((item ->> 'quantity_discount_eligible')::boolean, true),
    NULLIF(item -> 'catalog_item', 'null'::jsonb)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total', p_total,
    'created', true
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items(uuid, text, text, text, text, public.contact_method, public.delivery_method, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, integer, text, boolean, integer, integer, boolean, integer, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(uuid, text, text, text, text, public.contact_method, public.delivery_method, text, text, text, text, text, text, text, text, text, text, text, text, integer, integer, integer, text, boolean, integer, integer, boolean, integer, text, text, jsonb, text) TO service_role;

COMMIT;
