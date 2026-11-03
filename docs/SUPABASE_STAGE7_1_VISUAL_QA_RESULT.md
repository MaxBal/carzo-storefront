# Supabase Stage 7.1 — Visual & Interactive QA Result (Preview / Dev only)

Date: 2026-11-03 (UTC+2)
Scope: `CARZO_STAGE_7_1_VISUAL_INTERACTIVE_QA.md` — remaining visual/browser
acceptance gate of Stage 7. **QA only.** No code/schema/data/env changes, no
order submission, no Stage 8 work.

---

## 0. STATUS

**`STAGE 7.1 VISUAL = PARTIAL`**

A real authorized browser session exercised the full interaction matrix
(V1–V9) against the current `dev` Preview. Everything that could be driven at
the available viewport passed with witnessed interactions and screenshots —
including the price/extras/discount contract, all modals, the car-mat D-1
design state, Nova Poshta lookups and the sticky CTA. No P0/P1 defect was
found.

Three required-evidence items remain `NOT VERIFIED` and keep the gate at
PARTIAL rather than PASS:

1. **Exact viewport targets** Desktop ≈1440×900 and Mobile ≈390×844 could not
   be reproduced: the authorized browser surface (MiMo Desktop IAB) has a
   fixed 675×782 CSS viewport (DPR 2) with no viewport-emulation API. All
   interactions ran at 675×782 (mobile-ish breakpoint, < 768 px). Tablet
   768×1024 likewise not reproduced.
2. **Positive authorized draft preview** — still requires the owner to open a
   draft through the normal CMS/Preview UI. Negative checks re-verified.
3. **Browser Network-panel criteria** — the automation surface exposes console
   logs but no network panel; those criteria are backed by HTTP-level evidence
   only and are marked `NOT VERIFIED` at browser level (see §6).

**Overall Stage 7 = BLOCKED / PARTIAL** — D-1 and D-2 remain closed and no
new P0/P1 exists, but Stage 7 may not be recorded PASS while required visual
criteria are `NOT VERIFIED`. The remaining items are small and listed in §8.

---

## 1. TARGET — baseline and deployment identity

| Item | Value |
|---|---|
| Branch | `dev` |
| Local HEAD | `63201c283f55ca4b3d79d37b3f966b08dff12cb3` — `docs: close D-1 by placeholder removal per owner decision` |
| Expected HEAD (brief) | `63201c283f55ca4b3d79d37b3f966b08dff12cb3` — **match** |
| Remote `origin/dev` | `63201c283f55ca4b3d79d37b3f966b08dff12cb3` — **identical to local** |
| Remote `origin/main` | `df8f3531ff9de2408525ac5caf6844d8c6e4d340` — unchanged from Stage 7.x |
| Worktree | clean except untracked `.DS_Store` / `.playwright-cli/` / `qa-artifacts/` (never staged) |
| Current `dev` Preview deployment | `dpl_DNfa81XyDfSEbp8jNrmcwqnxni5w` → `carzo-storefront-ptfsvcedp-yevgens-projects.vercel.app`, **READY**, created 2026-11-03 15:10:58+02:00, build 35s |
| Preview build provenance | build log: `Cloning github.com/MaxBal/carzo-storefront (Branch: dev, Commit: 63201c2)` — matches HEAD |
| Preview Git alias | `carzo-storefront-git-dev-yevgens-projects.vercel.app` → resolves to `dpl_DNfa81Xy…` |
| Previous Preview (Stage 7.x) | `dpl_89sGuJHKcbhsUtT1UiQj4C3Z7jJS` (oftz3ocn6, commit `02f3eaa`) — superseded by the above docs-commit rebuild; both READY |
| Production deployment | `dpl_Br5LtGjBeKtiKUeAiexjyUXE7rQ9` → `carzo-storefront-f3up8jypj-yevgens-projects.vercel.app`, READY, created 2026-10-31 12:33:30Z |
| Production alias | `https://carzo-storefront.vercel.app` — observed only |
| Production unchanged proof | Deployment ID **identical** to the ID recorded before/after in Stage 7.x and Stage 7 QA (`dpl_Br5LtGj…`); `main` SHA unchanged; no `main` push performed |

### Preview store flags (names / non-secret values only)

Pulled via `vercel env pull --environment preview --git-branch dev`; secret
values were never printed (3 values remain `[SENSITIVE]` placeholders; temp
file deleted immediately after reading the six flags).

| Flag | Effective value | Expected | Result |
|---|---|---|---|
| `CATALOG_STORE` | `supabase` | supabase | PASS |
| `CONTENT_STORE` | `supabase` | supabase | PASS |
| `PAGE_STORE` | `supabase` | supabase | PASS |
| `ORDER_STORE` | `supabase` | supabase | PASS |
| `NOTIFICATION_SETTINGS_STORE` | `supabase` | supabase | PASS |
| `CUSTOMER_STORE` | `directus` | directus (intentional) | PASS |

Credential **names** present on Preview (values never reproduced):
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DIRECTUS_URL`, `DIRECTUS_READ_TOKEN`,
`NOVA_POSHTA_API_KEY`, `PREVIEW_SECRET`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_TEST_CHAT_IDS` — same inventory as Stage 7 §2.

### Read-only data smoke (Supabase)

SELECT-only counts via the Supabase MCP connector:

| Entity | Count | Stage 6 checkpoint | Result |
|---|---|---|---|
| `orders` | 10 | 10 | no drift |
| `order_items` | 17 | 17 | no drift |
| `customers` | 5994 | 5994 | no drift |

---

## 2. Browser / access method

- **Authorized browser surface used:** MiMo Desktop in-app browser
  (`mimo-desktop-iab`) — the session's documented Browser Use channel. The
  Preview was reached through the **normal authorized Vercel login/session**
  path (the protected Preview rendered the storefront; no protection bypass
  secret, no debug endpoint, no credential extraction).
- **Permitted sequence honored.** The earlier Stage 7 rejection
  ("inspecting the local/browser session was considered high risk") was **not**
  repeated and no variant of it was attempted. No cookie/SSO/token harvesting,
  no Deployment-Protection changes.
- **Supplemental HTTP QA** used the official `vercel curl` CLI path
  (account-scoped, same method as Stage 7/7.x) for route/HTML evidence. HTTP
  evidence is explicitly **not** counted as visual proof; it supplements the
  browser matrix.
- **Access blockers encountered:** Vercel CLI was initially absent from PATH
  (`npx vercel` used instead; existing account auth, no login flow run).
  Mid-run the IAB screenshot compositor failed intermittently
  (`capture tab … timed out` / `UnknownVizError`); DOM inspection and further
  screenshots continued after it recovered. A tab binding was lost once after
  an instrumented reload; a fresh tab was created per the runtime recovery
  rules.
- **Owner-assisted fallback was not required** for the interaction matrix; the
  final PARTIAL remainder (§8) is a short owner-assisted/top-up list.

---

## 3. Viewports and evidence index

| Viewport | Target | Reproduced | Notes |
|---|---|---|---|
| Desktop | ≈1440×900 | **NOT VERIFIED** | IAB fixed at 675×782 CSS @ DPR2; no viewport emulation API on this backend |
| Mobile | ≈390×844 | **NOT VERIFIED** (nearest 675×782 used) | 675 px < 768 px breakpoint, so mobile layout (hamburger menu, single-column, mobile sticky CTA) was the layout under test |
| Tablet | 768×1024 | NOT VERIFIED | supplemental target |

**Screenshot artifacts** (local QA dir `qa-artifacts/stage7.1/`, **not
committed**; DPR 2 → 1350×1564 px images):

| Evidence ID | File | Shows |
|---|---|---|
| E-01 | `V1-home-top-verify.png` | homepage top: header, hero, product card |
| E-02 | `V1-home-badges.png` / `V1-home-sections-mid.png` | badge/quality sections, shields photo |
| E-03 | `V1-home-stats.png` | statistics section (22K+/27%/<1%) |
| E-04 | `V1-mobile-menu-open.png` | mobile hamburger menu with accordion |
| E-05 | `V2-pdp-m20-top.png` / `V2-pdp-m20-config.png` | PDP M/2.0 gallery + full config block |
| E-06 | `V2-pdp-s20-selected.png` / `V2-pdp-s20-thumbs-now.png` | PDP S/2.0 after size switch; design previews |
| E-07 | `V2-design-selector-close.png` / `V2-design-selector-v2.png` | design selector thumbs (R2 previews) |
| E-08 | `V3-fixation-modal-open.png` / `V3-fixation-faq-tab.png` | fixation modal, tabs, photos, FAQ tab |
| E-09 | `V3-logo-modal-bmw.png` | BMW logo modal: badge photo, specs, tabs |
| E-10 | `V3-benefit-warranty.png` | warranty benefit modal |
| E-11 | `V4-reviews-section.png` | video reviews + social block + sticky Buy CTA |
| E-12 | `V4-video-review-playing.png` | video review player open |
| E-13 | `V7-cart-drawer.png` | cart drawer with line item + totals + loyalty |
| E-14 | `V7-checkout-form.png` / `V7-checkout-lookups.png` | checkout form + Nova Poshta selectors |
| E-15 | `V6-carmat-top.png` | car-mat page: promo video + design block |
| E-16 | `V6-carmat-design-modal-noimg.png` | car-mat design modal, **no image block** (D-1 state) |
| E-17 | `V6-quote-form-open.png` | car-mat quote form (not submitted) |
| — | `V2-pdp-s20-fullpage.png` | full-page stitch of PDP (stitching artifact repeats sticky layout; used only as auxiliary) |

About / CMS page screenshots were blocked by the compositor outage window;
those sections carry DOM-level evidence instead (§4 V5/V8). 29 screenshot
files total.

---

## 4. Matrix V1–V9

Statuses: `PASS` / `FAIL` / `NOT VERIFIED` / `NOT APPLICABLE`. All interactions
at 675×782 unless noted.

### V1 — Homepage (`/`) — **PASS** (exact desktop/mobile viewports NOT VERIFIED)

| Check | Actual | Result |
|---|---|---|
| Header/logo/cart/hamburger | renders; hamburger opens full menu with accordion (E-04) | PASS |
| Menu navigation | «Автокейси» → `/case/design/m/2-0`, «Автокилимки»/«Про нас» routes present; back navigation works (tested PDP→PDP) | PASS |
| Hero heading/subtitle/badges | «Преміальні автоаксесуари Carzo» + mint accent line render (E-01) | PASS |
| Product cards | case card + car-mat card with real R2 imagery, arrows, crop sane at 675 px (E-01) | PASS |
| Badge/quality section | «Високоякісні шильди» + real badge photo (Mercedes/BMW/Audi) + 20×80 мм chip (E-02) | PASS |
| Statistics | 22K+ / 27% / <1% (E-03) | PASS |
| Logo video | `content/pages/home/logo-video.mp4` referenced; HTTP 200 on R2 | PASS (render) / play NOT VERIFIED |
| R2 images | all referenced homepage media HTTP 200 | PASS |
| Horizontal overflow | `scrollWidth == clientWidth` (675) | PASS |
| Desktop/mobile/tablet viewports | see §3 | NOT VERIFIED |

### V2 — PDP / configurations — **PASS** (exact viewports NOT VERIFIED)

Canonical URLs: all 12 combinations (`s/m/l/xl` × `2-0/3-0/4-0`) inspected in
a sequential browser pass — each renders a coherent title, loaded gallery
(`…фото 1..4/5`, `naturalWidth=1080`) and Buy CTA. Detailed evidence:
S/2.0, S/3.0 (via switch), M/2.0, M/3.0, L/4.0, XL/4.0 (E-05–E-07). One
fast-loop miss on XL/2.0 gallery was a lazy-load timing artifact — re-checked
with all 4 photos loaded.

| Check | Actual | Result |
|---|---|---|
| Gallery first/next/thumbs | photos 1–5 controls; real `design-x/size-y/0N.webp` R2 URLs | PASS |
| Size switch + URL/title | S→M/L/XL updates URL `/case/design/{size}/{design}` and title coherently | PASS |
| Design switch + previews | 2.0↔3.0↔4.0 updates URL/title; selector previews are genuine R2 media (E-07) | PASS |
| Prices new | S 1790 / M 2249 / L 2590 / XL 2990 — live in size table + Buy (E-05, E-06) | PASS |
| Prices old | S 2100 / M 2600 / L 2900 / XL 3400 — strikethrough present | PASS |
| Brand surcharge | `none` +0; BMW/Audi/… +290 (selector labels `+290 ₴`); selecting BMW raised Buy 1790 → **2080** | PASS |
| Fixation extras | `both` = S +60 (labels in select: дно+стінка +60 ₴); selecting it raised Buy → **2140** (1790+290+60). bottom/wall/none +0 | PASS |
| Fixation modal | opens («фіксації»): title «Фіксація з багажником», tabs «Типи фіксації» (active underline) / «Часті питання» (switch → Q&A content), explanatory photos (E-08) | PASS |
| Logo selection + modal | brand select; mint CTA «Переглянути BMW» appears; modal: tabs Про лого/Фото/Розміщення/FAQ, real `logo/brands/bmw.webp` (naturalWidth 1254), specs (нержавіюча сталь, 82×18 мм, 1.5 мм) (E-09) | PASS |
| Placement media | «в середині» modal «Що в середині в розмірі L?» with 3 real R2 photos (partitions, side-door-elastics, trunk-protection) | PASS |
| Content tabs | «Опис»/«Відгуки» = sticky sub-nav with `[active]` tracking that scrolls to sections (0→5109 px) — witnessed | PASS |
| Rich content | articles «Основні матеріали», «Магнітна система», … each with poster + «Відтворити відео» control | PASS (present) |
| FAQ expansion | standalone PDP FAQ accordion **not present** in current DOM; Q&A lives in modal FAQ tabs (verified expand/switch in fixation + logo modals) | NOT APPLICABLE (grounded in live UI) |
| Mobile sticky Buy | appears at bottom when main CTA leaves viewport (E-11); in-flow duplicate CTA far below config is separate; no competing duplicate at top (hidden twin config block is a responsive dual-render, `hiddenByAncestor`) | PASS |
| Add to cart | «Купити» → cart badge `Кошик, товарів: 1` | PASS (no purchase) |

### V3 — Benefit / other modals — **PASS**

All six benefit cards on the PDP config block were opened and their content
read (open by card, close by `Закрити`/`modal-close`, DOM `role=dialog`
verified gone after close):

| Modal | Content witnessed | Result |
|---|---|---|
| Гарантія 12 місяців | «12 місяців гарантії…» + scope Q&A (E-10) | PASS |
| Варіанти оплати | «Прозорі умови…»; передоплата 200 UAH Q&A | PASS |
| Доставка 1-2 дні | «Відправляємо швидко…» + строки доставки | PASS |
| Обмін та повернення | «14 днів на повернення», «Легке повернення» | PASS |
| Разом дешевше | «2 товари −200 грн», «3 товари −500 грн», Як працює знижка | PASS |
| Клієнтська програма | «−5% на всі товари назавжди» + steps | PASS |
| Logo modal | see V2 | PASS |
| Fixation modal | see V2 | PASS |
| Placement modal | see V2 | PASS |
| Car-mat design modal | see V6 | PASS |
| Close / overlay / Esc | close button works (force-click needed mid-animation once); Escape closes cart drawer; focus-return not instrumented | PASS (close) / focus-return NOT VERIFIED |
| Scroll within long modal | fixation/logo modals scrollable (content below fold reached) | PASS |
| Mobile clipping of footer/buttons | none observed at 675×782 | PASS (this viewport) |

### V4 — Reviews and video — **PASS**

| Check | Actual | Result |
|---|---|---|
| Text reviews / CTA | social proof block «carzo.ua ✓ / 22 000+ клієнтів обрали Carzo» + stats (22K/27%/<1%/100%) in intended order after rich content (E-11) | PASS |
| Video reviews open/play/close | «Відеовідгук 01–05» with posters; open → `<video>` from `reviews/video/01.mp4`, `paused:false` (user-initiated), `controls:true`, close removes player (E-12) | PASS |
| Vertical player dims | 387×688 CSS at 675 px viewport — sensible vertical | PASS |
| Video/cover URLs valid R2 | all `reviews/video/*.mp4` + `reviews/cover/*.webp` HTTP 200 | PASS |
| Autoplay vs user-initiated | user-initiated open plays; no autoplay claims made | N/A |

### V5 — About (`/about`) — **PASS** (screenshot gap noted)

| Check | Actual | Result |
|---|---|---|
| Hero | «ПРО НАС / Робимо добре те, за що беремося» + intro | PASS |
| Process blocks | 01 Розробляємо самостійно / 02 Виготовляємо… / 03 Перевіряємо… | PASS |
| Process media | `about/develop.webp`, `about/production.webp`, `about/testing.webp` — all `naturalWidth=800` loaded from R2 | PASS |
| Principles / development / statement | section text present in DOM | PASS |
| Layout / overflow | `scrollWidth == clientWidth`; text wrapping normal at 675 px | PASS |
| Screenshot | compositor outage window — DOM evidence only | NOT VERIFIED (recording only) |

### V6 — Car mats (`/catalog-carmat`) — **PASS**

D-1 owner decision (placeholder removed, not replaced) validated visually:

| Check | Actual | Result |
|---|---|---|
| Design modal open/close | «див. фото» → bottom sheet with 3 design rows (2.0 selected), closes | PASS |
| Design with real image | **none of the 3 car-mat designs currently has a published image** — with-image path has no live subject | NOT APPLICABLE (grounded: zero images in modal data) |
| Design without image | clean text/selector rows only — **no image block, no empty frame, no fake replacement, no `landscape-placeholder.svg`** (E-16) | PASS |
| Promo video + cover | cover `car-mats/cover-video.webp` renders (E-15); promo `car-mats/promo-video.mp4` loads (`readyState:4`, no media error); sustained playback under automation stopped by IAB user-activation policy (brief `t` advance observed) — real play controls present (`controls:true` + custom play button) | PASS (load/cover) / sustained play NOT VERIFIED (env limit) |
| No `/api/directus-assets/` / placeholder / Directus refs | DOM innerHTML scan 0 hits; HTTP HTML scan 0 hits | PASS |
| Quote form | «Розрахувати вартість» opens fields (Ім'я, телефон, Модель авто, Рік, Тип кузова, тип килимків, канал зв'язку); **never submitted** (E-17) | PASS |

### V7 — Cart and checkout — **PASS** (no order submission)

| Check | Actual | Result |
|---|---|---|
| Add / open drawer | item «Автокейс S Carzo 3.0 для BMW / S · BMW / фікс.дно+стінка» @ 2140 ₴ (E-13) | PASS |
| Qty stepper | 1→2→3: totals 4280 / 6420; 3→1: back to 2140 | PASS |
| Quantity discount | auto «Разом дешевше» **−200 ₴ @ 2**, **−500 ₴ @ 3**; totals 4080 / 5920; recedes at qty 1 | PASS |
| Mixed-cart surcharges | line carries brand +290 and fixation +60 inside 2140 total | PASS |
| Totals summary | Товари (n) / Разом читаемы | PASS |
| Remove item / close-reopen | delete control present; drawer close (Esc) then state persists (badge) | PASS (delete control) / full remove-reopen NOT VERIFIED (kept demo item) |
| Checkout opens | «Оформити замовлення» → form (E-14) | PASS |
| Delivery switch | radio «У відділення» / «Кур'єром» / «У поштомат» — all three switch fields (branch select vs street+Будинок+Квартира vs postomat select) | PASS |
| Nova Poshta city | type «Київ» → listbox «Міста Нової пошти» (місто Київ / село Київець); select via keyboard applies («Київ, Київська обл.») | PASS |
| Branch search | list for Kyiv: «Відділення №1: вул. Пирогівський шлях, 135», №2 Богатирська, №3 Слобожанська…; in-list search («Пирогівський») selects №1; empty-state for branchless city («Нічого не знайдено…») | PASS |
| Postomat search | «Поштомат №1001: вул. Сім'ї Кульженків, 31а…», №1010 Політехнічний… | PASS |
| Street search | «Шевченка» → «вул. Шевченка» option | PASS |
| Contact methods | Зателефонувати / Telegram / Viber / WhatsApp | PASS |
| Field validation | `required` on name/phone; submit `type=submit` present; **submit never clicked** | PASS (states) |
| Price-change warning UI | not exercised (requires server re-quote paths tied to order intent) | NOT VERIFIED |
| Order submission | **none** — see §9 | PASS (safety) |

### V8 — CMS / draft / navigation — **FAIL (content) + partial PASS**

| Check | Actual | Result |
|---|---|---|
| `/delivery-and-payment` published | renders legibly (title «Доставка та оплата», header/footer intact) but the body is the editor placeholder **«Додайте блоки цієї сторінки у Directus.»** — no delivery/payment content for end users | **FAIL** (new P2-a) |
| `/privacy-policy` draft | 404 «ПОМИЛКА 404 / Сторінку не знайдено» + robots noindex (HTTP + browser) | PASS |
| Positive authorized draft preview | not exercised (would require `PREVIEW_SECRET`; no secret use permitted) | NOT VERIFIED |
| Header nav | menu routes work (V1) | PASS |
| Footer nav | known dead routes `/delivery`, `/payment`, … spot-checked `/delivery` → 404 — **previously classified P2-1, not a new regression** | PASS (unchanged) |
| Legacy canonical/OG | `robots.txt` still points to `carzo-eight.vercel.app` — **known P2-2** | recorded |
| CMS page title metadata | «Доставка та оплата \| CARZO \| CARZO» — duplicated suffix | new P2-b |

### V9 — Media / network / console — **PARTIAL**

| Check | Actual | Result |
|---|---|---|
| Published R2 media health | **103/103 unique R2 URLs** extracted from rendered pages respond 200 (HEAD; one transient 000 retried to 200/206) | PASS |
| No Directus host / `/api/directus-assets/` in switched domains | 0 refs in served HTML of `/`, `/about`, `/catalog-carmat`, 12 PDPs (HTTP); 0 refs in live DOM scans (car-mat modal included) | PASS (HTTP+DOM) |
| Intentional `CUSTOMER_STORE=directus` calls | not present on the public pages under test; not mislabeled | PASS |
| Console exceptions / hydration errors | `tab.dev.logs` over about + CMS + PDP loop routes: **0 error/warn entries**; no visible breakage during the full interactive session | PASS (observed routes) |
| Browser Network panel | **not exposed** by the automation backend | NOT VERIFIED (browser-level) |
| Synthetic/test images in car-mat | none (E-15, E-16) | PASS |

Browser evidence and HTTP/fixture evidence are kept separate throughout: every
`PASS` labeled (DOM/interaction) was witnessed in the browser; `vercel curl`
and R2 HEAD results are recorded as HTTP-level only.

---

## 5. D-1 / D-2 closure re-verification

| Defect | Evidence this run | State |
|---|---|---|
| **D-1** car-mat placeholder | Code: zero `placeholderImage` / `landscape-placeholder` / `EMERGENCY_PLACEHOLDER` refs in `components/` + `app/` (only PDP `fallbackSrc` chain in `lib/content/default-source.ts`, per owner decision). Runtime: 0 placeholder/`directus-assets` refs on `/catalog-carmat` HTML + live DOM. Visual: design modal shows clean text/selector rows only (E-16). **No `landscape-placeholder.svg` was uploaded to R2** (confirmed by design — not present, not expected). | **CLOSED** |
| **D-2** Directus reads in switched content paths | Code: `lib/content/{homepage,about,car-mat-designs}.ts` are thin `cache()` wrappers over the `lib/data/content` facade; Directus path only behind `CONTENT_STORE=directus` rollback. Runtime: 0 `directus` strings in served HTML of switched routes. | **CLOSED** |

---

## 6. Network / console findings (separation of evidence)

- **Browser-level:** console logs clean on inspected routes (V9); Network panel
  unavailable → network-only criteria `NOT VERIFIED` at browser level.
- **HTTP-level (supplemental, not visual proof):** route matrix `/`, `/about`,
  `/catalog-carmat`, `/delivery-and-payment`, `/privacy-policy`, all 12 PDPs
  fetched via `vercel curl` on the pinned deployment; D-1/D-2 markers absent;
  price contract present in all 12 PDP payloads (active size ×14 occurrences,
  others ×4); `/api/draft?slug=privacy-policy` → `Invalid preview request`
  (401) without secret; `/privacy-policy` → 404 + noindex.
- **Code-level (historical, retained):** Stage 7.x fetch-spy proof of zero
  Directus reads for switched domains (`tests/supabase-editorial-integration`).
  This run did not rerun the 164-test suite (per brief).

---

## 7. Defect register

### P0
None.

### P1
None.

### P2

| ID | Finding | Evidence | Notes |
|---|---|---|---|
| **P2-a (new) — CLOSED 2026-11-03 by owner decision** | `/delivery-and-payment` body is the editor placeholder «Додайте блоки цієї сторінки у Directus.» instead of delivery/payment content | browser DOM + HTTP payload | **CLOSED by removal**: the owner cancelled the standalone CMS page entirely (delivery/payment live in the «Доставка» / «Оплата» benefit modals). The `pages` row was deleted from Supabase — see §12. No content seeding required. |
| **P2-b (new)** | CMS page title duplicates the suffix: «Доставка та оплата \| CARZO \| CARZO» | `document.title` | Cosmetic metadata bug. |
| P2-1 | Footer links 404 (`/delivery`, `/payment`, `/returns`, `/corporate-orders`, `/wholesale`) | `/delivery` spot-check → 404 | Known since Stage 7 §9; unchanged. |
| P2-2 | Legacy `carzo-eight.vercel.app` in robots.txt/sitemap/canonical | `robots.txt` | Known; no SEO changes in QA scope. |
| P2-3..P2-10 | notification outbox, Telegram payload proof, migration filename mismatch, `checkout_payment_details`, Pexels fallbacks, lint warnings, gallery key naming, Free-plan pause risk | from Stage 7 §9 | Unchanged, out of QA scope. |

**No P0/P1 → no BLOCKED-by-defect.** The PARTIAL gate is caused by
NOT-VERIFIED evidence items (§8), not by open defects.

---

## 8. Remaining Stage 7 requirements (not conflated with migration scope)

1. **Exact viewport visual pass** (desktop 1440×900 + mobile 390×844) — smallest
   remaining QA item. Either resize the MiMo Desktop browser window to those
   sizes for a short re-run of the screenshot set (homepage, PDP S/2.0 +
   L/4.0, sticky CTA, one modal, cart), or an owner-assisted screenshot batch.
2. **Positive authorized draft preview** — owner opens a draft via the normal
   CMS preview UI (no secrets to the agent). Otherwise stays `NOT VERIFIED`
   and must be explicitly adjudicated by the owner to close Stage 7.
3. **Browser Network panel zero-Directus confirmation** — can remain
   browser-`NOT VERIFIED` if the owner accepts the HTTP + fetch-spy evidence
   bundle as equivalent (adjudication).
4. ~~**P2-a content decision**~~ — **DONE 2026-11-03**: standalone CMS page cancelled
   by owner and removed from Supabase `pages` (see §12). Delivery/payment remain
   in the «Доставка»/«Оплата» benefit modals, unchanged.
5. Historical/known items already classified (SEO canonical P2-2, migration
   filename mismatch P2-5, customer delta → Stage 8/9 scope, Free-plan pause
   operational decision) — do not block Stage 7.1 but remain on the Stage 7
   ledger.

---

## 9. Mutation inventory (expected zeros — all confirmed)

| Mutation class | Count |
|---|---|
| Supabase writes (DML/DDL) | **0** (SELECT-only: 1 count query) |
| Directus writes | **0** |
| R2 writes | **0** |
| Orders created / `create_order_with_items` calls | **0** (checkout submit never clicked) |
| Customers / CRM records | **0** |
| Nova Poshta shipments booked | **0** (lookups only) |
| Telegram sends | **0** |
| Env / Deployment Protection changes | **0** |
| `main` / Production changes | **0** (Production deployment ID unchanged) |
| Schema / migrations | **0** |
| `landscape-placeholder.svg` uploads | **0** (cancelled by owner; still absent) |

Checkout idempotency/order delivery proof remains the **prior Stage 6**
evidence (3/3 live orders CZ-20261031-*, retries, Telegram acceptance) — not
re-tested by design.

---

## 10. Verdicts

- **`STAGE 7.1 VISUAL = PARTIAL`** — full interactive matrix V1–V9 exercised
  in an authorized browser session at the nearest reproducible viewport
  (675×782) with screenshot/DOM evidence and zero P0/P1; exact
  desktop/mobile viewports, positive draft preview and browser-network
  confirmation remain `NOT VERIFIED` (see §8). **P2-a closed 2026-11-03** by
  owner-directed removal of the unused CMS page (§12).
- **`STAGE 7 = PARTIAL / BLOCKED`** — Stage 7.x D-1/D-2 stay closed; no new
  P0/P1; Stage 7 overall may not flip to PASS until §8 items 1–2 (and the
  item-3 adjudication) are closed or explicitly adjudicated by the owner.
- **Stage 8 must not start yet.**

---

## 11. Git / docs

- This report: `docs/SUPABASE_STAGE7_1_VISUAL_QA_RESULT.md`
- Superseding status appended to `docs/SUPABASE_STAGE7_QA_REPORT.md` (original
  findings preserved).
- QA screenshots: `qa-artifacts/stage7.1/` — local only, **not committed**.
- Docs-only commit on `dev` (see final status line); no code/schema/data/env
  changes. A docs push may trigger a fresh Preview build — if so it rebuilds
  the same SHA and is not a new functional test result.

---

## 12. Addendum — 2026-11-03: P2-a closed by removal (owner decision)

Owner decision: the standalone CMS page `/delivery-and-payment` is not needed.
Delivery/payment information lives in the two benefit modals «Доставка» and
«Оплата» (PDP benefit tiles + Footer «Покупцеві»), which must stay unchanged.
This addendum records the deletion of the unused CMS record and its
verification. Defect **P2-a is CLOSED by removal** (same closure style as D-1).

### 12.1 Dependency check before deletion (Supabase)

| Check | Result |
|---|---|
| Target row | `public.pages` — `id=47f9bcb0-fde2-44d7-9c09-a5af1498dae7`, `key=slug=delivery-and-payment`, title «Доставка та оплата», `page_type=legal`, `status=published`, `no_index=true`, created/updated 2026-10-07 |
| Related blocks | `page_blocks` rows with this `page_id`: **0** (full-page inventory: home 4, public-offer 1, privacy-policy 0, delivery-and-payment 0) |
| FK constraints referencing `pages` | only `page_blocks.page_id` → `pages.id` **ON DELETE CASCADE**; with 0 child rows the cascade touches nothing |
| Other CMS pages | untouched: `home` (published), `privacy-policy` (draft), `public-offer` (draft) — 3 rows remain |
| Code references to slug | one: `components/cms/PageFooter.tsx` hardcoded legal link — **orphan component, imported nowhere**; left untouched (out of scope) and noted as dead-code cleanup candidate |
| CMS route / table / system | `app/[...slug]/page.tsx` (`notFound()` on missing page), `pages`/`page_blocks` tables, and the CMS pipeline all kept |

### 12.2 Rollback snapshot (deleted row, for re-INSERT if ever needed)

```json
{
  "id": "47f9bcb0-fde2-44d7-9c09-a5af1498dae7",
  "key": "delivery-and-payment",
  "slug": "delivery-and-payment",
  "title": "Доставка та оплата",
  "page_type": "legal",
  "status": "published",
  "no_index": true,
  "show_header": true,
  "show_footer": true,
  "seo_title": "Доставка та оплата | CARZO",
  "seo_description": "Умови доставки та оплати замовлень CARZO.",
  "seo_image_url": null,
  "created_at": "2026-10-07 13:32:21.121782+00",
  "updated_at": "2026-10-07 13:32:21.121782+00"
}
```

Deletion executed as a guarded DML (`DELETE … WHERE id=… AND slug=… AND
key=… RETURNING …`) — **exactly 1 row** returned. Post-check: `pages` = 3,
`page_blocks` = 5 (unchanged), orphan blocks = 0, target rows left = 0.

### 12.3 Verification after deletion

| Check | Result |
|---|---|
| `/delivery-and-payment` → 404 | **PASS after the scoped CMS-pages cache fix (§12.5)** — final proof on Preview `carzo-storefront-o3n5sdi08-yevgens-projects.vercel.app`: `HTTP/2 404`, body is the 404 page («Сторінку не знайдено»), zero «Додайте блоки» remnants. |
| Sitemap excludes the page | **PASS** — `/sitemap.xml` contains **0** occurrences of `delivery-and-payment` (and was already excluded pre-delete via the `noIndex` filter in `app/sitemap.ts`); sitemap is ISR (`revalidate = 60`) |
| PDP benefit tile «Доставка 1-2 дні» | **PASS** — opens the delivery modal; content byte-identical to Stage 7.1 E-10 evidence («Відправляємо швидко, пакуємо надійно…») |
| PDP benefit tile «Варіанти оплати» | **PASS** — opens the payment modal («Прозорі умови та жодних прихованих платежів…») |
| Footer «Покупцеві» → «Доставка» | **PASS** (mobile accordion at 675 px) — `preventDefault` + `openBenefitModal('delivery')`; modal opens, URL does **not** change to `/delivery` |
| Footer «Покупцеві» → «Оплата» | **PASS** (mobile accordion) — payment modal opens, URL unchanged |
| Desktop footer (≥768 px) | Same `handleAction` wiring (`components/Footer.tsx`); live ≥768 px render **NOT VERIFIED** — same fixed-viewport limitation as §8 item 1 |
| Modal content/design/logic | **unchanged** — only the `pages` row was deleted; `benefit_modals` table and `ModalProvider` untouched |
| Other pages unaffected | `home` renders; `privacy-policy`/`public-offer` remain draft 404s |

### 12.4 Directus mirror (recorded, not modified)

The same record exists in Directus collection `carzo_pages`:

| Field | Value |
|---|---|
| id | `47f9bcb0-fde2-44d7-9c09-a5af1498dae7` (identical UUID — migration preserved ids) |
| slug | `delivery-and-payment` |
| status | `published` |
| title | «Доставка та оплата» |

**Fixed here for later deletion** (Directus retirement / Stage 8+ scope).
Directus was **not** modified — read-only GET with the service read token.
Production (which still reads Directus) keeps the record until that later
removal; `/delivery-and-payment` on Production is therefore unchanged and
**was not touched** in Stage 7.1.

### 12.5 Stale-response root cause and the CMS-pages cache fix

**Symptom.** After the Supabase DELETE, `/delivery-and-payment` kept returning
`HTTP/2 200` with the old page shell on *every* Preview deployment, including
fresh builds.

**Diagnosis (hard evidence).** Response headers on deployment `r94h8wez3`:
`x-vercel-cache: MISS`, `cache-control: private, no-cache, no-store`, `x-matched-path: /[...slug]`
— the HTML is re-rendered on each request, so the **Full Route Cache / CDN was
not the carrier**. The stale value lived in the **Next.js fetch Data Cache**:
supabase-js page reads go through the patched global fetch, and in Next 14 a
fetch without cache options resolves to `revalidate = false` — i.e. a
**1-year cache entry** (`patch-fetch.js`, `normalizedRevalidate → CACHE_ONE_YEAR`).
That Data Cache is project-scoped and survives redeploys. Confirmed in the
Next 14.2.35 sources (`server/lib/incremental-cache/index.js`):
`fetchCacheKey` hashes `url, method, headers, init.cache, body…` but **not
`init.next`,** so merely adding `next.revalidate` would not have displaced the
old entry. The unused `__PAGE_CACHE` constant showed the original 60s intent
was never wired.

**Fix (scope: CMS pages only).** `product-page/lib/data/pages/supabase.ts` now
builds two pages-scoped Supabase clients instead of using the shared admin
client:

- published reads: custom fetch with `cache: 'force-cache'` (present in the
  cache key → pre-fix no-TTL entries stop matching) **and**
  `next: { revalidate: 60, tags: [pages] }` (60s TTL, so CMS edits appear
  within a minute — requirement «корректное обновление CMS-страниц»);
- preview reads: `cache: 'no-store'` — draft preview is never cached.

The shared `lib/supabase/server.ts` client is **untouched** — catalog, cart and
orders keep their previous fetch behaviour exactly.

**Code validation.** `tsc --noEmit` clean; `lint` clean (pre-existing `<img>`/alt
warnings only); `pnpm run build` succeeds; bounded suite `test:stage4` **19/19**.
Commits on `dev` only: `3edbacf` (wire `__PAGE_CACHE` revalidate/tags) and
`1413ec8` (explicit `force-cache` in the key to displace stale entries).

**Final verification (deployment `carzo-storefront-o3n5sdi08-yevgens-projects.vercel.app`, commit `1413ec8`):**

| Check | Result |
|---|---|
| `/delivery-and-payment` | **`HTTP/2 404`**, body = «Сторінку не знайдено» / «Помилка 404», no placeholder text | 
| `/sitemap.xml` | 0 occurrences of `delivery-and-payment` |
| `/home` (published CMS page) | `308 → /` (canonical redirect by design), `/` = `HTTP/2 200` |
| `/about` | `HTTP/2 200` |
| `/privacy-policy`, `/public-offer` (drafts) | `HTTP/2 404` each |
| `/api/draft?slug=privacy-policy` (no secret) | `401 Invalid preview request` |
| Benefit modal «Доставка 1-2 дні» (PDP tile) | opens; content identical («Відправляємо швидко, пакуємо надійно…») |
| Benefit modal «Варіанти оплати» (PDP tile) | opens; content identical («Прозорі умови та жодних прихованих платежів…») |
| Footer «Покупцеві» → «Доставка» / «Оплата» | open the same modals via `preventDefault`; URL unchanged |
| Modal texts/buttons/design | **unchanged** — no modal code touched |

### 12.6 Mutations in this addendum (all authorized by the owner decision)

| Mutation | Count |
|---|---|
| Supabase `pages` DELETE (target row only) | **1** |
| Supabase DDL / other tables | 0 |
| Directus writes | 0 |
| Code changes | 2 commits on `dev` only (`3edbacf`, `1413ec8`, `lib/data/pages/supabase.ts`) |
| Schema / env changes | 0 |
| Orders/customers/settings/media | 0 |
| Production / `main` | 0 |
