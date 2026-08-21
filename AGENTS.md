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
- `app/page.tsx` — Homepage (CMS page with slug `home`)
- `app/case/design/[...slug]/page.tsx` — Product page (main business logic)
- `app/[...slug]/page.tsx` — CMS pages catch-all
- `app/actions/checkout.ts` — Server action for order creation

### Content System
- `lib/content/resolver.ts` — Centralized content resolver (ADR-0001)
- `lib/content/directus.ts` — Directus data fetcher with local fallback
- `lib/content/default-source.ts` — Hardcoded fallback content
- `lib/content/types.ts` — All content type definitions

Content resolution uses a matrix pattern: exact match → design fallback → global fallback → placeholder.

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

## Branches

- `main` — Production baseline
- `dev` — Staging integration
- `feature/*` — Work branches, merge to `dev` via PR

Deployments are manual via Vercel dashboard (not connected to GitHub).
