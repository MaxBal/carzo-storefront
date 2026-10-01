-- PHASE 2 correction: least-privilege grants for service_role on customers.
-- Backend needs SELECT/INSERT/UPDATE/DELETE only.
-- TRUNCATE / REFERENCES / TRIGGER are not required.
-- postgres grants and RLS architecture are intentionally unchanged.

REVOKE ALL ON public.customers FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.customers
  TO service_role;
