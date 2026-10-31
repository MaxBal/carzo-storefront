-- PHASE 2: customers schema (loyalty eligibility source of truth).
-- No application cutover, no data migration, no RPC, no phone-normalize trigger.
-- updated_at is managed explicitly by the application (no hidden DB trigger).

CREATE TABLE public.customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                 text NOT NULL UNIQUE,
  full_name             text,
  source                text NOT NULL DEFAULT 'site',
  imported              boolean NOT NULL DEFAULT false,
  legacy_orders_count   integer,
  legacy_products_count integer,
  legacy_city           text,
  legacy_delivery       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_phone_canonical
    CHECK (phone ~ '^\+380[0-9]{9}$'),
  CONSTRAINT customers_legacy_orders_count_non_negative
    CHECK (legacy_orders_count IS NULL OR legacy_orders_count >= 0),
  CONSTRAINT customers_legacy_products_count_non_negative
    CHECK (legacy_products_count IS NULL OR legacy_products_count >= 0)
);

-- RLS: deny-by-default for non-owner roles. No policies on purpose.
-- FORCE is intentionally NOT used: owner/postgres technical operations
-- (migrations, admin) must keep working without BYPASSRLS gymnastics;
-- anon/authenticated are already blocked by RLS + revoked grants.
-- Elevated secret key / service_role uses BYPASSRLS later.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customers FROM PUBLIC;
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.customers FROM authenticated;

GRANT ALL ON public.customers TO postgres;
GRANT ALL ON public.customers TO service_role;
