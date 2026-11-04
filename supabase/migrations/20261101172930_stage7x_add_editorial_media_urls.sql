-- Stage 7.x (owner-approved): additive nullable media-URL fields for editorial singletons.
-- Adds car_mat_settings.placeholder_image_url (D-1 car-mat placeholder, R2 URL)
-- and site_settings.media_placeholder_url (global media placeholder, R2 URL).
-- No data is updated or removed; existing rows keep NULL until the R2 object
-- is uploaded and the URLs are set explicitly.
alter table public.car_mat_settings
  add column if not exists placeholder_image_url text;

alter table public.site_settings
  add column if not exists media_placeholder_url text;
