# CARZO: Meta Pixel and direct Conversions API

The feature remains disabled unless Production configuration explicitly enables it.
The owned domain, authenticated recovery worker and minute-based Cron job are live.
The controlled order `CZ-20261127-A0FFC5` produced one server Purchase for 2649 UAH,
accepted by Meta on its first attempt. Actual browser/server deduplication and campaign
attribution still need confirmation in Events Manager.

On 2026-11-28 the owner requested automatic tracking without an initial cookie notice.
The provider now stores `enabled` for automatic initialization, preserving `granted`
for explicit user opt-in. A prior `denied` choice and DNT/GPC still disable collection
and cancel pending events. The footer settings remain available on demand; no panel
opens automatically, including on the first visit. The anonymous `consentId` field
is retained for queue cancellation compatibility, not as proof of explicit consent.

The code itself does not switch DNS, disable Tilda,
create Meta assets, apply the SQL migration to a hosted project, install a scheduler,
or send events to the existing production Dataset by itself.

## Implemented scope

- Browser PageView (App Router navigation), ViewContent (visible configurator only),
  AddToCart (actual added quantity), InitiateCheckout (first verified quote on opening),
  and Purchase paired with the server receipt. Tracking starts automatically; refusal,
  DNT/GPC and technical deployment hosts block tracking.
- Browser Lead after the existing car-mat quote action reports success. Server-side
  Lead is not yet enabled: the current action's success boundary is Telegram delivery,
  with no durable lead ID. It needs a separate persistent intake design; this change
  deliberately preserves that business workflow.
- Server Purchase comes from the authoritative saved order, never keyCRM, Telegram,
  payment intent or a browser-posted price. It includes quantity/loyalty discounts;
  selecting a 200 UAH deposit still reports the full discounted order value.
- `create_order_with_meta` calls the unchanged `create_order_with_items` RPC and
  inserts outbox events in the same transaction. Disabled/opted-out checkout keeps
  using the original RPC and works before the migration is applied.
- Original event IDs, timestamps and payloads survive retries. Public browser
  receipts contain only pixel ID, event ID, event name and whitelisted custom data.
  Replay of a lost checkout response can emit the first browser Purchase without
  creating a new server event. Browser receipts are guarded in memory/sessionStorage.
- A lease-based worker retries transient errors for at most 24 hours/12 attempts.
  Permanent errors require intervention; no indefinite replay beyond Meta deduplication
  windows. At-least-once transport plus stable IDs is not an exactly-once guarantee.
- Phone matching uses only the contact phone, normalized and SHA-256 hashed. It never
  uses the separate loyalty phone. Comments, address, name and personalization are
  excluded. Real IP/UA/fbp/fbc remain unhashed as required by Meta.
- Delivery/cancellation immediately scrubs stored matching data. Scheduled purge
  expires pending data at 24 hours and removes advertising receipts at 30 days.
  Revocation cancels queued events; it cannot recall an already in-flight/accepted
  request. Network-failed revocation is retried on reload using only an anonymous ID.

## Configuration

Production-only Vercel variables (redeploy after configuring):

| Variable | Value |
| --- | --- |
| `META_ENABLED` | `false` until all checks below pass, then `true` |
| `META_ALLOWED_HOSTS` | `carzo.com.ua,www.carzo.com.ua` (exact HTTPS hosts) |
| `META_DESTINATIONS` | JSON below, public IDs/routing only |
| `META_CARZO_ACCESS_TOKEN` | Secret with permission to upload to the existing Dataset |
| `META_DELIVERY_SECRET` | Independent random secret, at least 32 characters |

```json
[{"key":"carzo","pixelId":"449610966173734","productTypes":["case","car-mat"],"pagePaths":["/","/about","/catalog-carmat"],"pathPrefixes":["/case/"]}]
```

No tokens enter browser props, event payloads, URLs, repository files or logs.
Preview/Development and `*.vercel.app`/loopback hosts are blocked, even if accidentally
listed. Absent/invalid configuration fails closed for analytics, not for checkout.
Use a separate test Dataset and synthetic credentials/fixtures for integration tests.
Meta's `test_event_code` must not be assumed to isolate measurement.

## Activation and Tilda cutover

1. Review the PR and run `pnpm run test:meta`, the checkout/commerce/safety suites,
   TypeScript, lint, production build and browser consent/funnel checks.
2. Apply `supabase/migrations/20261125184933_meta_conversion_outbox.sql` through the
   normal hosted migration process. Verify service-role RPCs and denied anon/auth
   access; run Supabase security/performance advisors. No historical orders are changed.
3. Configure the server secrets securely; keep `META_ENABLED=false`. Check the existing
   Dataset's upload permissions, domain/traffic settings, automatic-event and advanced
   matching settings, and current Diagnostics warning. No new production Pixel needed.
4. Review privacy-policy wording and consent UX. Match `content_ids` to any existing
   Meta catalog before catalog advertising. Current case IDs are `case:<design>:<size>`;
   generic products use the immutable SKU. Existing Tilda catalog IDs may differ.
5. Install the recovery/purge job below. The endpoint is POST-only, authenticated and
   host/environment gated. Do not use daily Hobby cron as the only recovery mechanism.
6. Coordinate final-domain cutover and old Tilda sender retirement, including pending
   submissions. Preserve required DNS/MX/R2/verification records. Production tracking
   remains disabled on the technical Vercel URLs.
7. Enable only on the final owned domain, verify a controlled consented order's
   amount, source URL, delivery and deduplication, then start the new campaign.

## Recovery scheduling (not automatically installed)

Supabase Cron + pg_net + Vault can reuse the existing project. Verify extension
availability and quotas before activation. In Vault create `carzo_meta_worker_url`
(the final `https://carzo.com.ua/api/meta/deliver` URL) and
`carzo_meta_delivery_secret` (matching the Vercel secret). Never commit raw values.
The job must continue purging when tracking is disabled. Example, run only during
the reviewed activation step:

Use the reviewed operational script
`supabase/operations/meta-recovery-scheduler.sql` after the extensions and outbox
migration are installed. It always purges expired matching data, and calls the worker
only for due pending/reclaimable events with a valid Vault secret and an exact final
store URL. With an empty queue or missing configuration it makes no HTTP request.
Do not set `carzo_meta_worker_url` until the final domain serves the new worker.
The scheduler body is tested locally with recording stubs for pg_net, Vault and Cron;
installation and extension permissions still need verification on the hosted project.

Monitor only destination/event IDs, status, attempts and sanitized error codes.
Do not log raw payloads, Graph response messages, tokens, phones or cookies. A Graph
acceptance response confirms receipt, not advertising attribution or deduplication;
confirm those separately in Events Manager. Alert on failed/expired events and queue age.

## Additional independent owners

Add a destination with a distinct key/Pixel ID, product types, page scopes and its own
`META_<KEY>_ACCESS_TOKEN` secret. Duplicate product-type ownership or Pixel IDs fail
configuration validation. Unmapped types are not silently sent to another owner.
Quantity discounts are allocated over eligible lines first; loyalty over the remaining
line values, using deterministic whole-UAH largest remainders. Each owner receives
only its lines and net value. One mixed order can produce one Purchase per owner;
their purchase counts are not unique store-order counts.

For multiple owners this version uses CAPI-only Purchase on the shared modal checkout,
and route-scoped manual browser events with automatic Pixel configuration disabled.
Before adding an owner, review the real neutral checkout URL, shared-page metadata,
independent recipient consent/notice, domain/asset permissions and catalog IDs. Separate
Datasets do not provide a separate DOM or protect data from Meta/the store operator.
Do not enable a partner merely by adding a token without that review.
New product-page templates must also wire the manual product events; the current
browser hooks cover the case configurator and car-mat quote flow.

## Local validation

Validated against the production build with synthetic credentials and a GET-only
catalog/content fixture. Chromium checks at 390px and 1280px cover opt-in, refusal
with usable checkout, one visible ViewContent, quantity selection without AddToCart,
four-unit AddToCart and the discounted InitiateCheckout, withdrawal/cookie cleanup,
technical-host blocking and GPC. The Meta SDK was replaced by a local recording stub;
no test traffic was sent to the real Dataset. Client bundles contain no synthetic
server token. Unit/SQL/action tests cover atomic persistence, replay, mixed discounts,
leases, retry classification, RLS, cancellation and retention. Hosted migration,
scheduler, actual Graph acceptance and Events Manager diagnostics remain activation checks.

## Rollback

Set `META_ENABLED=false` and redeploy to stop new collection and delivery. Keep the
purge job until all pending matching data is scrubbed; inspect/cancel the queue with
service-role access. The old order RPC and all checkout business data remain usable.
Do not blindly revoke Tilda's shared credentials or drop tables to roll back analytics.
