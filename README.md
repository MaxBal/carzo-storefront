# CARZO Storefront

Public storefront and product configurator for CARZO. The application lives in
`product-page` and uses Next.js, Directus, and the Nova Poshta API.

## Branches

- `main` contains the source currently treated as the stable production baseline.
- `dev` contains the integration version published to the staging environment.
- Short-lived work should use `feature/*` branches and merge into `dev` through a pull request.
- A release is promoted by merging `dev` into `main` after staging verification.

Current deployment mapping:

- Production: <https://carzo-eight.vercel.app>
- Staging: <https://carzo-eight-staging.vercel.app>

The Vercel projects are currently deployed manually and are not yet connected to
GitHub branches.

## Local development

```bash
cd product-page
pnpm install
pnpm dev
```

Copy `product-page/.env.example` to `product-page/.env.local` and provide the
required values locally. Environment files, Vercel state, generated Directus
snapshots, build output, and dependencies are intentionally excluded from Git.

## Validation

```bash
cd product-page
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm run test:customer-store
pnpm run test:loyalty
pnpm run test:checkout-reliability
pnpm run test:order-notifications
```

The `PR validation` workflow runs on every pull request targeting `dev` or
`main`, using Node.js 22, pnpm 11.25.0, and `product-page/pnpm-lock.yaml` with
`--frozen-lockfile`. Its `Storefront validation` job must pass typecheck, lint,
all four test suites, and `pnpm run build` before merge. The tests use
`node:test`, mock clients, and local spies; they do not require live writes to
Directus, Supabase, or Telegram.

CI explicitly clears integration URLs, tokens, and keys and uses
`https://staging.carzo.invalid` as the site origin. The build uses the existing
local content fallbacks without production endpoints or secrets. Do not copy
`.env.example` into CI: it includes production URLs. Next.js may download the
Inter font from Google during the build. This fallback build validates compilation
and prerendering; it does not validate live CMS data or staging integrations.

Release gate:

1. Open a `feature/*` → `dev` PR and require a passing `Storefront validation` job.
2. Verify the integrated version on staging, including the changed storefront
   behavior and relevant checkout/integration flows.
3. Open a `dev` → `main` PR with the staging verification results recorded in its
   description and require the same passing CI job before merge.

Branch protection/rulesets must separately mark `Storefront validation` as a
required status check to enforce this gate in GitHub; the workflow alone does
not prevent merging. CI performs validation only. Production/staging deployment
remains manual and is not configured by this workflow.

Project decisions and the domain model are documented in `docs/adr` and
`CONTEXT.md`.
