# Carzo Repository Guide

## Quick Start

```bash
cd product-page
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` and fill in required values.

## Validation Commands

```bash
cd product-page
pnpm exec tsc --noEmit    # typecheck
pnpm run lint             # eslint
pnpm run build            # production build
```

Run these before committing. The build uses `next build` (not Netlify/Vercel CLI locally).

## Architecture

### Directory Structure
- `product-page/` — Next.js 14 App Router application (all code lives here)
- `docs/adr/` — Architecture Decision Records (read these for context)
- `CONTEXT.md` — Domain glossary and terminology

### Key Entry Points
- `app/page.tsx` — Homepage (fetches from Directus `carzo_site_settings` homepage_* fields)
- `app/about/page.tsx` — About page (hardcoded content in `AboutPageContent.tsx`)
- `app/case/design/[...slug]/page.tsx` — Product page (main business logic)
- `app/[...slug]/page.tsx` — CMS pages catch-all
- `app/actions/checkout.ts` — Server action for order creation

### Content System
- `lib/content/resolver.ts` — Centralized content resolver (ADR-0001)
- `lib/content/directus.ts` — Directus data fetcher with local fallback
- `lib/content/default-source.ts` — Hardcoded fallback content
- `lib/content/types.ts` — All content type definitions
- `lib/content/homepage.ts` — Homepage data fetcher (reads from `carzo_site_settings`)
- `lib/content/global-modals.ts` — Benefit modals fetcher for global ModalProvider

Content resolution uses a matrix pattern: exact match → design fallback → global fallback → placeholder.

### Global Modal System
- `components/ModalProvider.tsx` — Wraps entire app in `layout.tsx`, provides `openBenefitModal`, `openB2BModal`, `openBlogModal`
- `components/Footer.tsx` — Uses `useModalContext()` to open modals from any page
- Benefit modals (delivery, payment, returns, loyalty, bundle) work from any page via global context

### Shared Constants
- `lib/links.ts` — `CARZO_LINKS` object with all messenger and social URLs (Telegram, WhatsApp, Viber, Instagram, Facebook, TikTok, YouTube)

### Cart & Checkout
- `lib/cart/server.ts` — Server-side cart quoting (reads live prices from Directus)
- `lib/cart/pricing.ts` — Price calculation logic
- `lib/cart/validation.ts` — Zod schemas for checkout
- Cart is guest-only, stored in browser (no user accounts)
- Prices are verified server-side before order creation

### External Services
- Directus CMS — Content and commerce data (collections prefixed `carzo_`)
- Nova Poshta API — Delivery points (`lib/nova-poshta.ts`)
- Telegram Bot — Order notifications (`lib/order-notifications.ts`)

## Environment Variables

Required in `product-page/.env.local`:
- `DIRECTUS_URL` — Directus instance URL
- `DIRECTUS_READ_TOKEN` — Service user token (server-side only, never prefix with `NEXT_PUBLIC_`)
- `NOVA_POSHTA_API_KEY` — Nova Poshta integration key
- `TELEGRAM_BOT_TOKEN` — Order notification bot

Optional:
- `DIRECTUS_PREVIEW_SECRET` — Enables draft previews
- `SITE_URL` — Public site origin for preview links

## Directus Scripts

```bash
cd product-page
pnpm run directus:setup        # Schema + seed data (requires DIRECTUS_ADMIN_TOKEN)
pnpm run directus:validate     # Check access without env file
pnpm run directus:verify       # Full verification with env
```

Setup script creates snapshots in `directus/snapshots/` before changes.

## Directus Collections

### Singletons
- `carzo_site_settings` — Global settings + homepage content + review settings + about page content
- `carzo_logo_settings` — Logo section texts and specs
- `carzo_media_settings` — Placeholder image for missing media

### Key Collections
- `carzo_designs`, `carzo_sizes`, `carzo_brands`, `carzo_fixations` — Product catalog
- `carzo_variants` — Price/inventory matrix (design × size)
- `carzo_gallery_images` — Product photos by design+size
- `carzo_benefit_modals` — 5 benefit modals (payment, delivery, returns, bundle, loyalty)
- `carzo_review_items`, `carzo_review_screenshots` — Reviews data (limited by Directus collection plan)

### Collection Limit
Directus on Railway has a collection limit. New content fields should be added to existing singletons (especially `carzo_site_settings`) rather than creating new collections.

## URL Structure

Product URLs: `/case/design/{size}/{design}/{brand?}`
- Size: `s`, `m`, `l`, `xl` (lowercase)
- Design: slug like `2-0`, `3-0`
- Brand: optional, defaults to `none`

Brand selection doesn't create new canonical pages — it's a client-side parameter.

## Testing

No test framework is configured. `test-checkout.py` is a Playwright smoke test for staging:
```bash
python test-checkout.py  # requires Playwright installed
```

## Key Patterns

1. **Content fallback chain**: Directus → local defaults → placeholder images
2. **Server-only imports**: Files using `import 'server-only'` cannot be client components
3. **React cache**: `getContentSource()` uses `React.cache()` for request deduplication
4. **Image proxy**: Directus assets served through `/api/directus-assets/[id]` when token is set
5. **Price verification**: Cart shows cached prices but verifies server-side before checkout
6. **CSS isolation**: New page sections use prefixed class names (`.hp-*` for homepage, `.about-*` for about) with `<style jsx global>` or separate CSS files
7. **Staging noindex**: `robots.ts` blocks staging from indexing via `VERCEL_URL?.includes('staging')`

## Branches

- `main` — Production baseline
- `dev` — Staging integration
- `feature/*` — Work branches, merge to `dev` via PR

Deployments: `npx vercel --prod --yes` for production, `npx vercel --prod --yes --scope maxbals-projects --project carzo-eight-staging` for staging.

## Implemented Features

### Homepage
- Hero section with product cards (case + mats)
- Badges section with video and features
- Quality stats section
- Content editable via Directus `carzo_site_settings` (homepage_* fields)
- Styles in `app/homepage.css` (loaded synchronously to avoid FOUC)

### About Page
- Hero, 3 process blocks, principles grid, development section, statement
- Images: `about-design.png`, `about-production.png`, `about-testing.png` in `public/`
- Content currently hardcoded in `components/AboutPageContent.tsx`
- **TODO**: Make editable via Directus (add fields to `carzo_site_settings`)

### Reviews Section
- Global on all product pages (CaseReviewsSection)
- 3 review cards + modal with up to 5 screenshots
- Data from `carzo_site_settings` (reviews_* fields)
- CTA button: mint green `#5ae4aa`, pill shape

### Footer
- 5 columns: Каталог, Покупцеві, B2B, Carzo bonus, Контакти
- Mobile: accordion sections
- Social links: Instagram, Facebook, TikTok, YouTube
- Messenger links: Telegram, WhatsApp, Viber (in B2B modal)
- All text/icons white on black background

### Modals
- Benefit modals (5 types): delivery, payment, returns, bundle, loyalty
- B2B modal: "Зазначений розділ у розробці" with email + messengers
- Blog modal: "Розділ сайту в розробці"
- Reviews modal: 5 screenshots at natural aspect ratio
- All use custom CSS classes (`.modal-shell`, `.modal-header`, etc.) in `globals.css`

### Header
- Desktop: horizontal nav with dropdowns
- Mobile: hamburger menu with accordion
- Blog opens modal instead of navigating
- B2B items open modal
- "Контакти" removed from navigation

## Known Limitations

1. **Directus collection limit**: Cannot create new collections. Use existing singletons for new content.
2. **OG image**: Currently `case.jpg`. Should be replaced with proper 1200×630 branded image.
3. **Product alt text**: Uses generated text from resolver, not real photo descriptions.
4. **About page**: Not editable in Directus (hardcoded).
5. **No test framework**: Only Playwright smoke test for staging.

## Design System

### Colors
- Black: `#000000` (header, footer, backgrounds)
- White: `#ffffff` (text on dark, card backgrounds)
- Mint accent: `#5ce4ab` (primary brand color)
- Gray scale: `#111827`, `#4d4d4d`, `#858585`, `#dedede`, `#f0f0f0`, `#fafafa`

### Typography (updated)
- Header nav: 15px, weight 500
- Footer text: 15px, weight 500
- Modal title: 18px/20px, weight 600
- Modal body: 15px
- Product price: 28px/36px, weight 700
- Homepage h1: weight 700
- Homepage h2: weight 600
- Homepage h3: 22px, weight 500

### Spacing
- Container max-width: `max-w-[1280px]` or `max-w-7xl`
- Section padding: `py-[88px]` to `py-[112px]` (desktop), `py-[56px]` to `py-[72px]` (mobile)
