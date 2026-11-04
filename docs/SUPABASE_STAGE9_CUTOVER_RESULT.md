# SUPABASE STAGE 9 — CUTOVER RESULT (attempt 2)

**STATUS: `BLOCKED` — token could not be transferred programmatically;
manual owner action required.**

The blocker from attempt 1 is **not a missing token** — the token exists in the
Vercel Preview scope. The blocker is that **Vercel does not return Secret-type
values** through the CLI or API, so the Preview → Production transfer cannot be
performed safely by automation. Per the operation instruction (*"Если
невозможно безопасно перенести существующее значение из Preview в Production —
остановиться и сообщить владельцу, какое действие нужно выполнить вручную"*)
the migration window was **not** opened.

- Date: 2026-11-04 (UTC)
- Phase reached: **PHASE 1 / token transfer** — stopped before any Production write
- Freeze enabled: **no** · Stage 8B apply: **not run** · Cutover: **not run**

---

## 1. TELEGRAM_BOT_TOKEN — Production: **BLOCKED (manual action required)**

| item | value |
|---|---|
| Variable in Preview scope | **present** (Secret type) |
| Variable in Production scope | **absent** |
| Local `.env.local` copy | **absent** |
| Value printed anywhere | **no** |
| Value written to disk / git / logs | **no** |

### What was attempted

| method | result |
|---|---|
| `vercel env pull --environment preview /dev/stdout` | **impossible** — the CLI refuses to write a Secret value: *"1 Secret value cannot be pulled from the `preview` Environment"*; `/dev/stdout` is also rejected (`EACCES`) |
| `vercel env run -e preview -- node …` (token injected into a child process) | **impossible** — the same restriction: Secret values are not injected |
| local `.env.local` as a source | **no copy present** |
| Vercel REST/CLI read-back of a Secret | **not supported by design** (Secrets are write-only) |

Vercel's Secret-type variables are write-only by platform design. No
programmatic path exists to read the Preview value back. This is not a
permissions problem and cannot be worked around by another API.

### Manual action required from the owner (2 minutes)

Pick **one**:

**A — Vercel dashboard (simplest)**
1. Open <https://vercel.com/yevgens-projects/carzo-storefront/settings/environment-variables>
2. Find `TELEGRAM_BOT_TOKEN` in the **Preview** scope → **copy the value**.
3. **Add** a new variable `TELEGRAM_BOT_TOKEN`, scope **Production**, type
   **Secret**, and paste the value.
4. Save. Tell me when it is done.

**B — terminal**
```bash
cd product-page && npx vercel env add TELEGRAM_BOT_TOKEN --environment production --sensitive
# paste the value at the prompt (it is not echoed to the shell history)
```

**C — alternative source, needs explicit owner authorization**
The token that sends **work** notifications today lives in Directus
(`carzo_telegram_bot_settings.bot_token`) and is therefore proven to belong to
the correct bot and to reach the work recipients. If the owner explicitly
authorizes that source in place of the Preview value, I can move it with the
same no-leak method (stdin only, no files, no output) and verify the bot
identity via `getMe` before using it. **I will not do this without that
explicit authorization**, since the instruction named Preview as the source.

### Verification that will run once the variable exists

- `vercel env ls production` shows `TELEGRAM_BOT_TOKEN` (name only).
- `getMe` against the bot → bot username/id only (no token, no chat content),
  confirming it is a bot and identifying which one.
- `notification_settings` recipients already verified: `channel='telegram'`,
  `telegram_chat_ids` populated (work recipients).
- Then the full migration window proceeds as authorized.

---

## 2. INCIDENT — accidental Vercel project, created and removed

While testing a stdin-based transfer, one CLI invocation ran without the
project link and **Vercel created a new empty project
`telegram-token-move2`** (named after the helper script) and made an initial
deployment to it.

**Containment performed immediately:**

| action | result |
|---|---|
| `vercel project rm telegram-token-move2` | **✓ Deleted** |
| project list re-checked | only `carzo-storefront` remains |
| helper scripts in `/tmp` | **removed** |
| `carzo-storefront` Production env | **unchanged** (11 vars, no new ones) |
| `carzo-storefront` Production deployment | **unchanged** — `dpl_FrgBnmhaoTdUEspRpW1NYMXxHRJx`, ● Ready |
| data in Directus / Supabase | **untouched** |

No storefront code, domain, secret, or customer/order data was involved in the
stray project. Nothing from it can affect `carzo-storefront`.

---

## 3. PRODUCTION

| item | value |
|---|---|
| Git SHA (`main`) | `6ec7d61` (unchanged) |
| Git SHA (`dev`) | `b91589b` |
| Vercel deployment ID | `dpl_FrgBnmhaoTdUEspRpW1NYMXxHRJx` |
| Deployment status | ● Ready |
| URL | `https://carzo-storefront.vercel.app` → HTTP 200 |
| Active backend | **Directus** (all six STORE flags absent → `directus`) |
| Maintenance status | **off** (`CHECKOUT_MAINTENANCE` absent) |

---

## 4. PREFLIGHT — all green except the token

| # | check | result |
|---|---|---|
| 1 | Runbook docs read | OK |
| 2 | Production deployment | `dpl_FrgBnmhaoTdUEspRpW1NYMXxHRJx`, ● Ready |
| 3 | Stage A code present | OK (footer marker) |
| 4 | Six STORE flags → Directus | OK — all absent → `directus` |
| 5 | Directus works | OK — GET 200, registry readable |
| 5 | Supabase works | OK |
| 6 | Production secrets | 5/6 present — **`TELEGRAM_BOT_TOKEN` pending owner action** |
| 7 | Supabase RPC `create_order_with_items` | OK — full 30-arg signature present |
| 8 | `notification_settings` + Telegram recipients | OK — `channel='telegram'`, chat_ids populated |
| 9 | Maintenance gate | OK — `CHECKOUT_MAINTENANCE` absent → off |
| 10 | Fast rollback | OK — instant redeploy of `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` or `git revert -m 1 6ec7d61` |

No secret value and no customer PII was printed at any point.

---

## 5. STAGE 8B — NOT RUN

| item | value |
|---|---|
| Supabase customers before / after | 5,994 / 5,994 |
| Supabase orders before / after | 10 / 10 |
| Supabase order_items before / after | 17 / 17 |
| Customers inserted / skipped | 0 / 0 |
| Orders inserted / skipped | 0 / 0 |
| Conflicts | 0 |

Control values re-verified after the stop — exactly 5,994 / 10 / 17.

## 6. STAGE 9 — NOT RUN

All six STORE flags remain **unset**. No domain switched to Supabase. No
Production redeploy was triggered.

---

## 7. DATA SAFETY

| action | count |
|---|---:|
| T0 backup created | 0 — window not opened |
| Stage 8B SQL executed | 0 |
| Supabase writes | 0 |
| Directus writes | 0 |
| Orders created | 0 |
| Customers changed | 0 |
| Telegram sends | 0 |
| Nova Poshta shipments | 0 |
| `carzo-storefront` env changes | 0 |
| STORE flag changes | 0 |
| `CHECKOUT_MAINTENANCE` toggles | 0 |
| `carzo-storefront` deploys | 0 |
| `main` commits | 0 |
| Stray Vercel projects created | 1 (immediately deleted, §2) |

---

## 8. LIVE SMOKE — not applicable

No test order was created and no Telegram notification was sent.

---

## 9. ROLLBACK — not required

Nothing on `carzo-storefront` changed. Standing plan unchanged.

---

## 10. NEXT

**One owner action unblocks everything:**

1. Owner: put `TELEGRAM_BOT_TOKEN` into the Vercel **Production** scope
   (dashboard or `vercel env add`, see §1). — **or** explicitly authorize the
   Directus-sourced alternative (§1C).
2. Then re-authorize; I will run the full sequence: T0 backup → freeze →
   delta rescan → historical import → flag switch + redeploy → read-only smoke
   → unfreeze → one test order + one Telegram notification → post-cutover
   verification → Directus retention.

**Still deferred by owner decision (not migration blockers):**
`privacy-policy` / `public-offer` publication, cosmetic design, extra SEO,
Supabase Pro, paid monitoring.

**Not started:** Stage 10, Directus removal, Railway teardown. Directus remains
live and is still the active backend.
