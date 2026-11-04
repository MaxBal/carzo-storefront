-- Stage 7.x D-1 (owner decision): the car-mat landscape placeholder is removed
-- from the product entirely, so the dedicated column added in
-- stage7x_add_editorial_media_urls is dropped again. The column is NULL in
-- every row (no data update ever ran), so this is lossless.
-- site_settings.media_placeholder_url is intentionally KEPT: it feeds the
-- PDP gallery/rich/magnetic fallback chain (lib/content/resolver.ts).
alter table public.car_mat_settings
  drop column if exists placeholder_image_url;
