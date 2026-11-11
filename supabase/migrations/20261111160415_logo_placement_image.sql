-- Logo placement media is now a single static image shared by all cases
-- (the placement video was removed from R2). Keep one global media slot on
-- logo_settings and point it at the uploaded placement photo.
ALTER TABLE public.logo_settings
  RENAME COLUMN placement_video_url TO placement_image_url;

UPDATE public.logo_settings
SET placement_image_url = 'https://media.carzo.com.ua/content/products/case/logo/placement/logo-oncase.webp';
