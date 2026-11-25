-- Platform capabilities for the reviewed Meta recovery job. No job or HTTP call
-- is created here. Portable PGlite tests do not provide these Supabase extensions.
DO $platform$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_cron')
    OR NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_net') THEN
    RAISE NOTICE 'Meta recovery extensions unavailable on this local PostgreSQL runtime';
    RETURN;
  END IF;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
END
$platform$;
