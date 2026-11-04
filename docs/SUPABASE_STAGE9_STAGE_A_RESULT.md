# SUPABASE STAGE 9 — STAGE A PRODUCTION PRE-RELEASE RESULT

**STATUS: `PARTIAL`** — the production code update is complete, deployed and
functionally verified; the **interactive/visual** portion of the smoke test
could not be executed in this environment and is therefore not claimed as
passed (see §4).

- Date: 2026-11-04 (UTC) · Branch merged: `release/stage9` → `main`
- Scope actually executed: preflight, Production env verification, RC
  verification, PR merge, Production deployment, HTTP/DOM/API smoke tests.
- Scope explicitly **not** executed: Stage 8B apply, Stage 9 cutover, STORE flag
  changes, maintenance mode, data transfers, Telegram sends, test orders.

---

## 1. GIT

| item | value |
|---|---|
| PR number | [#3](https://github.com/MaxBal/carzo-storefront/pull/3) |
| PR state at merge | `OPEN`, `MERGEABLE`, `CLEAN`, base `main`, head `release/stage9` |
| Merge method | regular merge commit (no squash, no rebase, no force-push) |
| Merge commit | `6ec7d61` — *Merge pull request #3 from MaxBal/release/stage9* |
| Main SHA before | `df8f353` |
| **Main SHA after** | **`6ec7d61`** |
| Release candidate SHA | `1de490b` |
| Merged at | 2026-11-04T17:51:31Z |
| Change set | 72 files: 38 added, 34 modified, **0 deleted** |

Preflight (all nine items) passed before merge:
PR state and control SHAs matched exactly; PR unchanged since the last review;
working tree clean; Vercel Preview deployment `6w7frVHk` **pass**; no critical
CI errors; secret scan of the full diff found **no real secret** (2 fake values
inside test fixtures only — `integration-test-token`,
`stage7x-fallback-test-placeholder`); no `.env*`, no `node_modules`, no
`qa-artifacts`, no `.DS_Store`, no customer/order data dumps in the PR
(migration files contain DDL only, 0 data rows). Stale-file guard passed:
`main` is a strict subset of `dev` (0 main-only files).

---

## 2. VERCEL

| item | value |
|---|---|
| Previous Production deployment | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` (2026-10-31, from `df8f353`) |
| **New Production deployment** | **`dpl_FrgBnmhaoTdUEspRpW1NYMXxHRJx`** |
| Deployment URL | `https://carzo-storefront-45qu2jlkb-yevgens-projects.vercel.app` |
| Status | **● Ready** |
| Target | `production` |
| Trigger | automatic Vercel ↔ GitHub integration on merge (no manual deploy) |
| Production URL | `https://carzo-storefront.vercel.app` → HTTP 200 |

Deployed-code confirmation: the footer now emits **7 × `href="#"`** and **0 ×**
the old 404 routes (`/delivery`, `/payment`, …), which is the P2-1 change
present only in the release candidate. `app/page.tsx` og:image is byte-unchanged
vs `main` (homepage keeps `/case.jpg`; the root-layout default `og-cover.png`
is the new addition) — not a regression.

### Environment verification (names only, values never read)

11 Production variables: `NOVA_POSHTA_API_KEY`, `SUPABASE_SECRET_KEY`,
`SUPABASE_URL`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_PUBLIC_BASE_URL`,
`R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY`, `DIRECTUS_READ_TOKEN`,
`DIRECTUS_ADMIN_TOKEN`, `DIRECTUS_URL`.

| expected | actual |
|---|---|
| `CATALOG_STORE` | **absent** → resolves `directus` |
| `CONTENT_STORE` | **absent** → resolves `directus` |
| `PAGE_STORE` | **absent** → resolves `directus` |
| `ORDER_STORE` | **absent** → resolves `directus` |
| `CUSTOMER_STORE` | **absent** → resolves `directus` |
| `NOTIFICATION_SETTINGS_STORE` | **absent** → resolves `directus` |
| `CHECKOUT_MAINTENANCE` | **absent** → checkout enabled |

No STORE flag points at Supabase. **No env var was modified** (Stage A scope).

`TELEGRAM_BOT_TOKEN` is absent from Vercel env and is **not required** for the
current path: the Directus notification path reads the bot token from Directus
(`carzo_telegram_bot_settings.bot_token`) with env only as a fallback
(`lib/order-notifications.ts:253`). No new mandatory environment variable was
introduced by this release.

---

## 3. BACKEND — still Directus

Resolution was executed against the real Production env shape (all six flags
absent):

```
catalog: directus   content: directus   pages: directus
orders:  directus   customers: directus  notifications: directus
maintenance: false
```

| domain | active backend |
|---|---|
| catalog / pricing | **Directus** |
| content / editorial | **Directus** |
| CMS pages | **Directus** |
| order write | **Directus** (`carzo_orders`) |
| customers / loyalty | **Directus** (`carzo_site_settings.customers`) |
| notification settings | **Directus** |
| media | Cloudflare R2 (`media.carzo.com.ua`) — unchanged |

Supabase adapters remain in the codebase and are **inert** while the flags read
`directus`. `/api/directus-assets/[id]` retained as the rollback path.

**No order write was performed**, so the "new orders land in Directus" property
is asserted from the flag resolution and the code path only — it is **not**
confirmed by a real order, because no test order was authorized.

---

## 4. SMOKE TESTS

### 4.1 Performed and passed

| area | what was checked | result |
|---|---|---|
| **Routing** | `/`, `/about`, `/catalog-carmat`, `/case/design/{s,m,l,xl}/2-0`, `/case/design/l/3-0`, `/case/design/xl/4-0`, `/sitemap.xml`, `/robots.txt`, `/llms.txt` | all **200** |
| **Homepage structure** | header + logo + menu + cart button, hero (`Преміальні автоаксесуари Carzo`), case card → `/case/design/l/4-0`, car-mat card → `/catalog-carmat`, quality stats (22K+/27%/<1%), full footer (Каталог/Покупцеві/B2B/Carzo bonus + socials + phone) | present, correct |
| **PDP — prices** | control table matched exactly | S **1790**/2100 · M **2249**/2600 · L **2590**/2900 · XL **2990**/3400 |
| **PDP — designs & sizes** | Carzo 2.0 / 3.0 / 4.0 selector; S/M/L/XL with dimensions (40×30×30 … 80×30×30) and both prices | present |
| **PDP — fixation** | `без фіксації 0 ₴`, `фікс.на дні 0 ₴`, `фікс.на стінці 0 ₴`, `фікс.дно+стінка +80 ₴` | correct for M |
| **PDP — brand/logo** | `Без лого 0 ₴` + 20 brands all at **+290 ₴** | correct |
| **PDP — gallery** | 4 photos + 4 thumbnail controls + 3 product videos | present |
| **PDP — buy** | `Купити 2249 ₴` button present | present |
| **Pricing (server, authoritative)** | `/api/cart/quote` | 1×M = 2249; 1×M+logo(bmw) = **2539** (2249+290) |
| **Quantity discounts** | `/api/cart/quote` | 2 items: sub 4498, **−200**, total 4298 · 3 items: sub 6747, **−500**, total 6247 · discount applies across separate lines |
| **Fixation surcharges (all sizes)** | `/api/cart/quote` | S **+60** (1790→1850) · M **+80** (2249→2329) · L **+100** (2590→2690) · XL **+120** (2990→3110) |
| **Nova Poshta — cities** | `GET /api/nova-poshta/cities?q=…` | «Київ» → Київ + Київець; «Одес» → Одеса |
| **Nova Poshta — branches** | `GET …/points?method=BRANCH` | 20 branches (№1 Пирогівський шлях …) |
| **Nova Poshta — postomats** | `GET …/points?method=POSTOMAT` | 20 postomats (№1001 Сім'ї Кульженків …) |
| **Loyalty lookup** | `POST /api/customer-discount/check` (read-only) | `{eligible:false, discount_percent:0}` — Directus customer store reachable, no error |
| **Cloudflare R2** | `media.carzo.com.ua` homepage + PDP gallery | `case.webp`, `car-mats.webp`, `logo-video.mp4` all **200**; PDP gallery/webp/mp4 URLs resolve |
| **Modals — presence** | all 6 triggers on PDP + matching content on homepage | `Гарантія 12 місяців`, `Варіанти оплати`, `Доставка 1-2 дні`, `Обмін та повернення`, `Разом дешевше`, `Клієнтська програма` |
| **Car-mat quote form** | `/catalog-carmat` | form present: name, phone `(00) 000-00-00`, car model, year, body type, `Розрахунок` |
| **SEO** | sitemap, canonical, robots | sitemap lists `/`, `/about`, all 12 PDPs; **0 × `delivery-and-payment`** (approved exclusion); canonical = `https://carzo-storefront.vercel.app` |
| **Checkout maintenance** | `CHECKOUT_MAINTENANCE` absent + `isCheckoutMaintenance()` | `false` → checkout **not** blocked |
| **No 500s** | every route above | 0 server errors |

### 4.2 NOT performed — interactive / visual

The available in-app browser has **no rendering layer** in this session
(`screenshot` fails with *"empty compositor frame"*, `get_visible_dom()` returns
empty, and element clicks are rejected as *"not actionable"* despite the
element being visible and enabled). DOM reading works (server-rendered HTML),
but real interaction does not.

Therefore these specific checks were **not executed** and are **not claimed as
passed**:

| check | state | note |
|---|---|---|
| Open cart drawer (click) | **NOT DONE** | click dispatch impossible |
| Quantity recalculation **in the UI** | **NOT DONE** | covered instead by `/api/cart/quote` (authoritative server math) |
| Discount display **in the UI** | **NOT DONE** | covered instead by `/api/cart/quote` |
| Switch delivery method (UI) | **NOT DONE** | selectors verified in DOM |
| Checkout form fill without submit | **NOT DONE** | form fields verified in DOM |
| Open benefit modals (click) | **NOT DONE** | all 6 triggers + content verified in DOM |
| Mobile / desktop layout | **NOT DONE** | requires visual rendering |

**No order was submitted and no Telegram message was sent** — consistent with
the Stage A restriction. Nothing in §4.2 was worked around by another channel.

### 4.3 Pre-existing items (not Stage A regressions)

| item | state |
|---|---|
| `/privacy-policy`, `/public-offer` → 404 | pre-existing: CMS drafts unpublished (owner content decision, readiness §8) |
| homepage og:image = `/case.jpg` | pre-existing (`app/page.tsx` unchanged vs `main`); root-layout default is the new `og-cover.png` |

---

## 5. DATA SAFETY

| action | count |
|---|---:|
| Supabase writes | 0 |
| Directus writes | 0 |
| Orders created | 0 |
| Customers changed | 0 |
| Telegram sends | 0 |
| Nova Poshta shipments | 0 |
| Vercel env changes | 0 |
| STORE flag changes | 0 |
| `CHECKOUT_MAINTENANCE` toggles | 0 |
| Directus shutdown | 0 |
| Stage 8B apply | 0 |
| Stage 9 cutover | 0 |

Only read-only requests were made against Production (GET routes, `POST
/api/cart/quote` which computes prices without persisting, and `POST
/api/customer-discount/check` which is a lookup).

---

## 6. REGRESSION CHECK

| required absence | state |
|---|---|
| 500s on critical routes | **none** — all 200 |
| empty catalog | **no** — full design × size matrix present |
| wrong prices | **no** — control table matched exactly |
| Nova Poshta problems | **no** — cities, branches, postomats all work |
| modals broken | **no** (triggers + content verified; opening untested — §4.2) |
| R2 media load errors | **no** — all checked assets 200 |
| maintenance unexpectedly on | **no** — `CHECKOUT_MAINTENANCE` absent |
| Supabase used in non-switched domains | **no** — all six flags resolve `directus` |
| uncontrolled customer-data changes | **no** — no writes performed |

---

## 7. ROLLBACK

**Not performed** — no critical regression was found.

Plan remains (runbook §7 / §3.3): Stage A is code-only, so rollback is
`git revert -m 1 6ec7d61` on `main` + redeploy, or an instant Vercel redeploy
of the previous Production deployment `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9`. No
data migration ran and no flag changed, so there is nothing to restore in the
database.

---

## 8. NEXT — remaining before the combined Stage 8B → Stage 9 window

1. **Complete §4.2** — the interactive/visual smoke checks need a browser with
   a real rendering layer (or the owner's own visual pass): cart drawer, modal
   opening, checkout form without submit, mobile/desktop layout.
2. Owner decision: publish `privacy-policy` / `public-offer` drafts (footer
   links currently 404).
3. Owner decision: confirm public canonical domain → `SITE_URL` value.
4. Owner: approve Stage 8B plan v2.1 + customer merge precedence +
   STOP-on-name-conflict.
5. Owner: classify order `CZ-20261013-BD3D52`.
6. Owner: propose the combined ≤90 min window (date, on-call) — G2.
7. Owner: secure T0 export location + retention.
8. Owner: confirm Production secrets are complete for the cutover step.
9. **Immediately before cutover:** explicit owner acceptance of Supabase Free
   risks (readiness §8.1/§8.2).
10. Permission for exactly one live test order + one Telegram notification
    (window step 13).

Still forbidden without separate explicit authorization: Stage 8B apply,
Stage 9 cutover, Directus freeze, STORE flag changes, `CHECKOUT_MAINTENANCE`,
Supabase plan change, monitoring/paid services, Directus removal. New real
orders must keep flowing through the existing Directus path.
