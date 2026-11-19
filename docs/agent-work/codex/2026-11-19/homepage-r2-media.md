# Homepage and car-mat R2 media — 2026-11-19

Base: `main` at `7192b10e1243a3025aff6bdd13835de94b21718b`.

The owner supplied these existing public R2 objects:

| Purpose | URL |
|---|---|
| Homepage case card | https://media.carzo.com.ua/content/pages/home/case.webp |
| Homepage car-mat card | https://media.carzo.com.ua/content/pages/home/car-mats.webp |
| Homepage badge video | https://media.carzo.com.ua/content/pages/home/logo-video.mp4 |
| Shared desktop/mobile car-mat cover | https://media.carzo.com.ua/content/products/car-mats/cover-video.webp |

## Code

- The case card has a 1:1 aspect ratio at every breakpoint. The old mobile 4:3 override and framing tied to the previous photo were removed.
- The car-mat landing renders one cover from `promoCoverUrl`, already supplied by the Supabase content loader. Responsive CSS preserves the existing mobile/desktop presentation. No new schema field is needed.
- Homepage fallback media uses the same supplied R2 objects, replacing local JPG/PNG/MP4 defaults. Published Supabase values retain priority.

## Content update already applied

At the owner's request, one published `homepage_settings` row in `kmhegysmtsjqtwwaacht` was updated separately from the code commit:

- Added `imageUrl` to the existing case and car-mat entries in `homepage_hero_products`.
- Filled `homepage_badges_video_url` with the supplied logo video. The existing `homepage_logo_video_url` was preserved; it is a separate field from the one rendered by the badge video component.
- Updated `updated_at`.

The UPDATE matched the row ID, published status, exact prior card JSON and a NULL badge-video URL. It affected exactly one row. A subsequent SELECT and comparison confirmed all other homepage fields and the other properties of both cards were unchanged. Car-mat settings already contained the correct cover URL and did not require a write. No schema migration, orders, integrations, credentials, Production deployment or main merge was involved.

Consequently, homepage media can refresh on the current deployment through its existing data cache. The square card and shared mobile cover require the code release. Closing/reverting the PR does not automatically revert the separately applied content values; the new URLs are supported by the current deployed parser.

## Verification

- TypeScript: exit 0.
- Next lint: exit 0; existing img/alt warnings remain.
- Next production build: exit 0, no editorial-fallback marker. Used a loopback, GET-only PostgREST fixture populated from a read-only snapshot of public catalog/editorial tables, with the intended homepage media values. No Production credentials were used for the build or browser checks.
- Existing `stage4-content` and `preview-backend-safety` suites: 25 tests passed via tsx CLI.
- Chromium on the local production build: square case card at widths 320, 390, 560, 561, 768, 900, 901, 1280, 1440 and 1920 px; measured width and height agree within 1 px.
- Shared car-mat cover at widths 390, 900, 901 and 1440 px: exactly one cover element, expected R2 src, image decoded successfully.
- Homepage case/mat images loaded successfully; the badge-video source matches R2. No requests for the four replaced local media paths and no non-read requests occurred during the browser checks.
- All four supplied URLs returned HTTP 200 with the expected image/webp or video/mp4 MIME. Default Python user-agent requests received Cloudflare 403; the audit user agent and Chromium loaded the public objects successfully. Cloudflare configuration was not changed.
- At width 320, document scrollWidth is 339 on both the existing Production homepage and this branch; the pre-existing overflow is outside this change. The new square card itself fits the viewport.
- Screenshots were visually reviewed at 390 and 1440 px. No Production deployment or merge was performed.
