# Stage 6 Design — Supabase Atomic Order Writes (staging first)

Implementation note for Stage 6 of the Directus → Supabase migration.
Baseline: `dev` @ `36b00315001f97e63c420460593fd7314c80e758` (Stage 5 PASS).

## 1. RPC contract — `create_order_with_items`

One PL/pgSQL function, **SECURITY INVOKER** (service_role executes with its own
table grants), exposed via PostgREST RPC. The Next.js writer calls
`supabase.rpc('create_order_with_items', …)` exclusively — zero direct
`.from('orders').insert()` / `.from('order_items').insert()`.

Signature (typed parameters + `p_items jsonb` array):

- `p_checkout_attempt_id uuid` — **NOT NULL enforced in the body** (legacy rows
  with NULL are unreachable through this RPC).
- `p_request_fingerprint text` — canonical hash of material checkout intent
  (see §3). Stored on insert, compared on replay.
- Order snapshot columns (customer name/phone/comment, `contact_method`,
  `delivery_method`, delivery refs/names/street/house/apartment,
  `items_quantity`, `subtotal`, `quantity_discount`, five `loyalty_*` fields,
  `total`, `discount_tier_key`, `manager_note`).
- `p_items jsonb` — array of item snapshots (`sort`, `item_key`, title,
  design/size/brand/fixation labels + keys, `unit_price`, `quantity`,
  `line_total`, `quantity_discount_eligible`).

Returns `jsonb`: `{ id, order_number, total, created }` — minimum needed for the
client and notifications. No PII.

Arithmetic re-checked inside the RPC before any insert:
`line_total = unit_price * quantity` per item, `items_quantity = Σ quantity`,
`subtotal = Σ line_total`, `total = subtotal − quantity_discount −
loyalty_discount_amount`, all non-negative. Enum values are cast to
`public.contact_method` / `public.delivery_method` (bad values fail the cast).
Empty items array rejected. Server pricing remains the authority; the RPC only
verifies internal consistency of the snapshot it was handed.

Order number generated **inside the RPC** (`CZ-YYYYMMDD-XXXXXX`, 6 uppercase hex
chars — same presentation as the legacy TS generator) with a bounded retry loop
on `unique_violation` of `orders_order_number_key`. `created_at` uses the column
default (`now()`).

Loyalty: all five structured `loyalty_*` columns are written. `manager_note`
carries only the human freeform note (currently always NULL on the Supabase
path) — **never** loyalty JSON (that remains a Directus-only serialization in
`buildLoyaltyAuditNote` for the rollback writer).

### Security

- `SECURITY INVOKER` (default) — no `SECURITY DEFINER`.
- `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` and
  `GRANT EXECUTE … TO service_role` for the exact signature (PostgreSQL grants
  EXECUTE to PUBLIC by default).
- RLS stays enabled with no policies (server-only posture); table grants
  unchanged (`service_role` only).
- `SUPABASE_SECRET_KEY` stays server-side (`lib/supabase/server.ts`,
  `import 'server-only'`).

## 2. Uniqueness / locking strategy

Three layers, in order:

1. **Advisory transaction lock** on the attempt ID
   (`pg_advisory_xact_lock(ns, hashtext(attempt_id))`) serializes concurrent
   calls with the same attempt within the DB.
2. **Lookup under the lock** — if `orders.checkout_attempt_id` already has a
   row, this is a replay → return the persisted `{id, order_number, total,
   created:false}` (after fingerprint check, §3). No items re-inserted, no new
   order number.
3. **Unique constraints as backstop** — `orders_checkout_attempt_id_key`
   (already present) + `ON CONFLICT (checkout_attempt_id) DO NOTHING` on the
   insert path; `orders_order_number_key` retries the number loop.

Additive schema change: `ALTER TABLE public.orders ADD COLUMN
request_fingerprint text` (nullable; legacy rows keep NULL). Nothing else.

## 3. Client attempt lifecycle + replay security

- The client generates a cryptographically random `crypto.randomUUID()`
  **once per logical checkout attempt** (stored in `CartProvider`). It is stable
  across pending submits, network errors, timeouts, UI retries and double-clicks.
- The attempt ID is regenerated **only** when (a) an order is confirmed
  (`completeOrder` → cart cleared) or (b) the cart contents change (different
  purchase intent). Contact and delivery corrections keep the same attempt ID —
  a landed order is protected by the request fingerprint, and keeping the ID
  stable avoids the double-order hazard (lost response → resend).
- `CheckoutInput.checkoutAttemptId` (optional in the zod schema for backward
  compatibility; required in practice when `ORDER_STORE=supabase` — the server
  rejects a missing/non-UUID value with `INVALID`).

**Replay-before-pricing:** when `ORDER_STORE=supabase` and an attempt ID is
present, `createOrder` first does a read-only `findOrderByAttemptId`. If a row
exists:

- fingerprint matches (or stored fingerprint is NULL) → return the persisted
  success `{ ok:true, orderNumber, total }` immediately, **before** the pricing
  gate, so later catalog/loyalty drift cannot block retrieval of a successful
  prior order. No side effects are re-run.
- fingerprint differs → reject with `INVALID` and a truthful message; no order
  data leaked. The client resets the attempt ID so the next submit is a fresh
  attempt.

**Request fingerprint** (computed server-side from raw input, before pricing):
SHA-256 over a canonical string of normalized `customer_phone`,
`contact_method`, `delivery_method`, and the sorted item tuples
(`size|designSlug|brandId|fixation|quantity`). **Prices are excluded** so a
successful prior order remains retrievable after price changes (contract §6.7).

Race fallback: if the order is created concurrently between the pre-check and
the RPC call, the RPC's lock + lookup returns `created:false` — same replay
semantics.

## 4. Side-effect boundary

`runPostOrderSideEffects` (notification + customer upsert) runs **only** when
the repository reports `created:true`. Replays never re-send Telegram or
re-upsert customers. A notification/upsert failure never flips a committed order
to `FAILED` (unchanged `runPostOrderSideEffects` semantics). Best-effort
delivery can be lost after a process crash — documented gap; no durable outbox
in this stage (would be a separate reviewed design).

## 5. Notification + customer sourcing

- **Notifications (Supabase orders):** settings/templates/chat IDs from
  `notification_settings` via `lib/data/notifications/supabase.ts`; bot token
  **only** from server-side `TELEGRAM_BOT_TOKEN`. No Directus inbox, no Directus
  bot-token table, no Directus admin URL (the message references the order
  number only). Channel `email`/`both` has no email provider on this path →
  Telegram-only delivery + explicit `UNSUPPORTED` log; never claim emails sent.
- **Notifications (Directus orders):** existing `notifyNewOrder` path unchanged
  (rollback + production).
- **`notifyNewCarMatQuote`:** remains on its Directus settings path in this
  stage — documented remaining Directus notification dependency.
- **Customers:** `CUSTOMER_STORE` stays **`directus`** on Preview (matches
  master-plan sequencing — the plan moves customer store to Supabase at
  Stage 9). Consequences documented: loyalty lookup reads Directus customers
  (policy unchanged), post-order upsert writes Directus (cross-store
  dependency), the 5,994-row Supabase customer import (Oct 13 snapshot) is not
  authoritative for loyalty. A later delta-reconciliation obligation is
  recorded. No cross-store silent failover.

## 6. Staging test isolation

- The shared Supabase project (`kmhegysmtsjqtwwaacht`) is referenced by both
  Preview and Production. No paid branch/project is created.
- Integration tests run as **transaction-wrapped SQL** (`BEGIN … ROLLBACK`)
  against the real database — the real RPC, constraints and locking are
  exercised, all rows are rolled back. No persistent test orders.
- Live Preview E2E checkout requires explicit authorization for a traceable
  synthetic order + controlled cleanup (contract §2.4). Until then the write
  acceptance gate stays `BLOCKED` — no fabricated customer data, no silent
  cleanup of historical rows.
- Pre/post snapshots: non-PII counts only (baseline: 10 orders / 17
  order_items / 5,994 customers / 1 notification_settings).

## 7. Environment (Preview/dev only, after tests)

```env
CATALOG_STORE=supabase
CONTENT_STORE=supabase
PAGE_STORE=supabase
ORDER_STORE=supabase
CUSTOMER_STORE=directus          # explicit: see §5
NOTIFICATION_SETTINGS_STORE=supabase  # explicit: Supabase path for order notifications
```

Production `main` flags and secrets unchanged. `TELEGRAM_BOT_TOKEN` presence on
Preview is an explicit acceptance gate; if absent, live Telegram delivery is not
claimed.
