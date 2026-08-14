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
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
```

Project decisions and the domain model are documented in `docs/adr` and
`CONTEXT.md`.
