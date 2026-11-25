-- Operational setup, run only after Production approval and the outbox migration.
-- Requires Supabase pg_cron + pg_net enabled by the project owner.
-- No credentials are embedded in the job or stored in Git.
select cron.schedule('carzo-meta-delivery', '* * * * *', $job$
do $tick$
declare
  worker_url text;
  worker_secret text;
begin
  perform public.purge_meta_events();
  if not exists (
    select 1 from public.meta_event_outbox
    where expires_at > now() and attempts < 12 and next_attempt_at <= now()
      and (status = 'pending' or (status = 'processing' and locked_until < now()))
  ) then return; end if;

  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'carzo_meta_worker_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'carzo_meta_delivery_secret';
  if worker_url is null or worker_url not in (
    'https://carzo.com.ua/api/meta/deliver', 'https://www.carzo.com.ua/api/meta/deliver'
  ) or worker_secret is null or length(worker_secret) < 32 then return; end if;

  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || worker_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 100000
  );
end
$tick$;
$job$);
