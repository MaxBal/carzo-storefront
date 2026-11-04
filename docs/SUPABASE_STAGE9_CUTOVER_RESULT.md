# SUPABASE STAGE 9 — CUTOVER RESULT

**STATUS: `BLOCKED` — stopped at PHASE 1 (PREFLIGHT), before any Production
write.**

A mandatory Production secret is missing. Per the operation rules — *"Если
критический Production secret отсутствует, не пытайся компенсировать это
несанкционированной заменой — STOP"* and *"Если обязательная техническая
проверка не проходит — STOP, даже если владелец разрешил миграцию"* — the
migration window was **not** opened.

- Date: 2026-11-04 (UTC)
- Phase reached: **PHASE 1 — PREFLIGHT** (item 6 failed)
- Freeze enabled: **no** · Stage 8B apply: **not run** · Cutover: **not run**

---

## 1. THE BLOCKER

### `TELEGRAM_BOT_TOKEN` is absent from Vercel **Production**

Phase 1 item 6 requires these Production secrets to be present before any
Production write. Five of six are present; one is not:

| required secret | Production | status |
|---|---|---|
| `SUPABASE_URL` | present | OK |
| `SUPABASE_SECRET_KEY` | present | OK |
| **`TELEGRAM_BOT_TOKEN`** | **absent** | **BLOCKER** |
| `NOVA_POSHTA_API_KEY` | present | OK |
| `DIRECTUS_URL` | present | OK |
| `DIRECTUS_READ_TOKEN` | present | OK |

The variable exists only in the **Preview (dev)** scope of the project — it was
never added to Production. (Value not printed.)

### Why this is fatal after the cutover

The bot token source changes with the `NOTIFICATION_SETTINGS_STORE` flag:

| flag state | notification settings | bot token source | Telegram works? |
|---|---|---|---|
| `directus` (Production **today**) | Directus `carzo_notification_settings` | Directus `carzo_telegram_bot_settings.bot_token` | **yes** |
| `supabase` (Stage 9 **target**) | Supabase `notification_settings` | **`TELEGRAM_BOT_TOKEN` env only** | **no — token missing** |

The Supabase path deliberately never reads a token from the database
(`notification_settings` has **no** `bot_token` column — verified in
`information_schema`; tokens are kept out of the DB by design). Its only source
is the env var:

```ts
// lib/data/notifications/supabase.ts
token: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',

// lib/order-notifications.ts — notifyNewOrderSupabase
const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || credentials.token; // credentials.token is '' here
if (!token) {
  console.error('Order notification telegram token missing on Supabase path', …);
  return;   // ← silently skips the send
}
```

Consequences if the cutover had proceeded:

1. **Order Telegram notifications would silently stop** — the stated main goal
   *"Telegram продолжал уведомлять о заказах"* would be violated.
2. **PHASE 6** — the one authorized test-order Telegram notification would not
   be delivered, so the live smoke would fail.
3. **PHASE 7 check 8** — *"Telegram работает"* would fail.
4. No user-visible error: the order is still created; only the notification is
   dropped, with a server log line.

This is exactly the regression the preflight exists to catch.

### Why it was not compensated

- The operation scope for environment changes is *"Изменить все шесть
  Production STORE-флагов … Не менять посторонние переменные окружения"* —
  adding `TELEGRAM_BOT_TOKEN` is outside that scope.
- The instructions explicitly forbid compensating a missing critical secret
  with an unauthorized replacement.
- Setting `NOTIFICATION_SETTINGS_STORE=directus` for the cutover would
  contradict the cutover definition and still leave the six-flag target
  unmet.

### Minimal fix (requires owner action or explicit owner authorization)

1. Copy the existing `TELEGRAM_BOT_TOKEN` value from the **Preview (dev)**
   scope into the **Production** scope of the Vercel project
   `yevgens-projects/carzo-storefront` (dashboard → Settings → Environment
   Variables, or `vercel env add TELEGRAM_BOT_TOKEN production`).
2. Confirm it appears in `vercel env ls production`.
3. Re-authorize the window — the rest of preflight is green and ready.

No code change is required.

---

## 2. PRODUCTION

| item | value |
|---|---|
| Git SHA (`main`) | `6ec7d61` |
| Git SHA (`dev`) | `733b420` |
| Vercel deployment ID | `dpl_FrgBnmhaoTdUEspRpW1NYMXxHRJx` |
| Deployment status | ● Ready |
| URL | `https://carzo-storefront.vercel.app` → HTTP 200 |
| Active backend | **Directus** (all six STORE flags absent → `directus`) |
| Maintenance status | **off** (`CHECKOUT_MAINTENANCE` absent) |

Stage A code confirmed live: 7 × `href="#"` in the footer and 0 × the old
`/delivery` / `/payment` 404 hrefs.

---

## 3. PREFLIGHT — full result

| # | check | result |
|---|---|---|
| 1 | Runbook docs read (`SUPABASE_STAGE9_RELEASE_RUNBOOK`, `SUPABASE_STAGE8B_EXECUTION_PLAN`, `SUPABASE_STAGE9_PRE_CUTOVER_READINESS`, `SUPABASE_STAGE9_STAGE_A_RESULT`) | OK |
| 2 | Current Production deployment | `dpl_FrgBnmhaoTdUEspRpW1NYMXxHRJx`, ● Ready |
| 3 | Stage A code present in Production | OK (footer marker) |
| 4 | Six STORE flags → Directus | OK — all **absent** → resolve `directus` (verified against the real env shape) |
| 5 | Directus works | OK — `GET /items/carzo_site_settings` → **200**, customer registry readable |
| 5 | Supabase works | OK — connected; counts readable |
| 6 | Production secrets | **FAIL** — `TELEGRAM_BOT_TOKEN` absent (see §1) |
| 7 | Supabase RPC for orders | OK — `create_order_with_items` present with the full expected signature (30 args incl. `p_items jsonb`) |
| 8 | `notification_settings` + Telegram recipients | OK — `channel='telegram'`, `telegram_chat_ids` populated, subject/message templates present |
| 9 | Maintenance gate | OK — `CHECKOUT_MAINTENANCE` absent → `isCheckoutMaintenance() === false`; gate code verified at the `createOrder` / `submitCarMatQuote` boundary |
| 10 | Fast rollback available | OK — Vercel instant redeploy of `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`, or `git revert -m 1 6ec7d61`; Stage A is code-only, no data restore needed |

No secret values and no customer PII were printed at any point.

---

## 4. STAGE 8B — not run

| item | value |
|---|---|
| Directus customers before | not read (window not opened) |
| Supabase customers before | **5,994** |
| Supabase orders before | **10** |
| Supabase order_items before | **17** |
| Customers inserted / skipped | 0 / 0 |
| Orders inserted / skipped | 0 / 0 |
| Order items before / after | 17 / 17 |
| Conflicts | 0 |
| Final verification | not applicable — no apply performed |

The counters match the control values exactly (5,994 / 10 / 17) and are
unchanged from before this session.

---

## 5. STAGE 9 — not run

All six STORE flags remain **unset** on Production. No redeploy was triggered
beyond the standing Stage A deployment. No domain switched to Supabase.

---

## 6. DATA SAFETY

| action | count |
|---|---:|
| T0 backup created | **0** — blocked before Phase 2 by the preflight failure |
| Stage 8B SQL executed | 0 |
| Supabase writes | 0 |
| Directus writes | 0 |
| Orders created | 0 |
| Customers changed | 0 |
| Telegram sends | 0 |
| Nova Poshta shipments | 0 |
| Vercel env changes | 0 |
| STORE flag changes | 0 |
| `CHECKOUT_MAINTENANCE` toggles | 0 |
| Production deploys | 0 |
| `main` commits | 0 |

Verified after the stop: `customers=5994, orders=10, order_items=17` —
identical to the pre-operation control values. Production env still lists
exactly the 11 pre-existing variables.

Historical data integrity: untouched (nothing was written).

---

## 7. LIVE SMOKE

Not applicable — the window was never opened. No test order was created and no
Telegram notification was sent.

---

## 8. ROLLBACK

Not required — nothing was changed.

Standing plan unchanged: Stage A is code-only, so recovery is an instant Vercel
redeploy of `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` or `git revert -m 1 6ec7d61`.
Post-cutover 9A/9B policy remains in `docs/SUPABASE_STAGE9_RELEASE_RUNBOOK.md`
§7 for when the window actually runs.

---

## 9. NEXT

**Blocking (must be closed before the window can be re-opened):**

1. Owner: add `TELEGRAM_BOT_TOKEN` to the Vercel **Production** scope (copy the
   existing Preview value), confirm it appears in `vercel env ls production`.
2. Owner: re-authorize the combined Stage 8B → Stage 9 window.

**Everything else in preflight is green.** After the token is in place the
window can run end-to-end: T0 export → freeze → delta rescan → historical
import → flag switch + redeploy → read-only smoke → unfreeze → one test order
→ post-cutover verification → Directus retention.

**Still deferred by owner decision (not migration blockers):** `privacy-policy`
/ `public-offer` publication, cosmetic design work, extra SEO, Supabase Pro,
paid monitoring, optional features.

**Not started:** Stage 10, Directus removal, Railway teardown, legacy-code
removal. Directus remains live and is still the active backend.
