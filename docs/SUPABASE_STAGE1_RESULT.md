# SUPABASE STAGE 1 RESULT

## Baseline

- date: 2026-10-07
- branch: `dev`
- baseline Git SHA: `b3812e6d7d2cde3ec90a37838e2335597952ff11`
- Supabase project: `Carzo` / `kmhegysmtsjqtwwaacht`
- pre-migration migrations: `20261001203704_rls_auto_enable`, `20261001211849_create_customers`, `20261001213417_tighten_customers_service_role_grants`
- pre-migration application tables: 1 (`customers`)
- pre-migration customer rows: 5994

## Migration

- migration filename/version: `supabase/migrations/20261007150000_directus_exit_schema_foundation.sql` / name `directus_exit_schema_foundation`
- purpose: Stage 1 schema foundation only (27 new application tables, empty of app data)
- enum types: `order_status`, `delivery_method`, `contact_method`
- helper: `public.set_updated_at()` (plpgsql, no SECURITY DEFINER)
- created tables (27):
  - catalog: designs, sizes, brands, variants, fixations, fixation_size_extras, discount_tiers
  - content: gallery_images, content_sets, content_sections, faq_items, rich_sections, rich_section_images, benefit_modals
  - media/site: logo_settings, product_media, site_settings
  - settings split: homepage_settings, about_settings, review_settings, video_review_settings, car_mat_settings
  - cms: pages, page_blocks
  - orders: orders, order_items
  - notifications: notification_settings
- RLS: ENABLED on all 27 new tables, no policies (server-only)
- grants: revoke PUBLIC/anon/authenticated; postgres ALL; service_role SELECT/INSERT/UPDATE/DELETE only

## Verification

- application table count after: **28** (customers + 27 new)
- forbidden tables absent: yes (no brand_logo_pricing, logo_placements, size_shipping, media_settings)
- all 27 new tables empty: yes (0 rows each)
- customers unchanged: 5994 rows; phone UNIQUE; phone CHECK `^\+380[0-9]{9}$`; RLS on; no policies
- enums verified: order_status(new/in_progress/done/cancelled), delivery_method(BRANCH/POSTOMAT/COURIER), contact_method(phone/telegram/viber/whatsapp)
- FK delete policy verified: variants→designs/sizes RESTRICT; fixation_size_extras→fixations CASCADE / →sizes RESTRICT; gallery_images→designs/sizes SET NULL; content_sections→content_sets CASCADE; rich_section_images→rich_sections CASCADE / →designs CASCADE; page_blocks→pages CASCADE; orders→customers SET NULL; order_items→orders CASCADE; order_items catalog FKs: none
- `rich_section_images.design_id` nullable; `media_url` nullable (Stage 2/2A)
- `product_media.slot` UNIQUE NOT NULL; table empty; 17 canonical slots not inserted
- indexes verified (designs/sizes/brands/fixations/discount_tiers/variants/gallery/content_sections/faq/rich_section_images/pages/page_blocks/orders/order_items)
- `set_updated_at()` present; triggers on mutable tables
- RLS enabled on all 27 new tables
- anon/authenticated grants: none on application tables
- service-role access: DML only (SELECT/INSERT/UPDATE/DELETE), matching customers least-privilege pattern
- advisors: only expected INFO `rls_enabled_no_policy` (28 tables, intentional server-only)

## Safety

- Directus mutations: none
- Directus data migration: none
- R2 mutations: none
- media copy: none
- runtime app changes: none
- env changes: none
- deploy: none
- cutover: none

## Next stage

Stage 2 is NOT started.
