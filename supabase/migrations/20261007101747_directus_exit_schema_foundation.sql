-- Stage 1: Directus → Supabase schema foundation (27 application tables).
-- DDL only. No data migration. customers is untouched.

-- 1. Enum / stable business types
CREATE TYPE public.order_status AS ENUM ('new', 'in_progress', 'done', 'cancelled');
CREATE TYPE public.delivery_method AS ENUM ('BRANCH', 'POSTOMAT', 'COURIER');
CREATE TYPE public.contact_method AS ENUM ('phone', 'telegram', 'viber', 'whatsapp');

-- 2. Shared updated_at trigger (no SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;

-- 3. Catalog — independent tables
CREATE TABLE public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  version text,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  selector_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT designs_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  content_group text,
  height_cm integer,
  width_cm integer,
  depth_cm integer,
  shipping_length_cm integer,
  shipping_width_cm integer,
  shipping_height_cm integer,
  shipping_weight_kg numeric(6,2),
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sizes_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text,
  flag text,
  logo_extra integer NOT NULL DEFAULT 0,
  logo_image_url text,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brands_logo_extra_non_negative CHECK (logo_extra >= 0),
  CONSTRAINT brands_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.fixations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  extra integer NOT NULL DEFAULT 0,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fixations_extra_non_negative CHECK (extra >= 0),
  CONSTRAINT fixations_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.discount_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  min_quantity integer NOT NULL,
  amount integer NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_tiers_min_quantity_positive CHECK (min_quantity > 0),
  CONSTRAINT discount_tiers_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT discount_tiers_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

-- 4. Catalog — FK children
CREATE TABLE public.variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE RESTRICT,
  size_id uuid NOT NULL REFERENCES public.sizes(id) ON DELETE RESTRICT,
  price integer NOT NULL,
  old_price integer,
  in_stock boolean NOT NULL DEFAULT true,
  quantity_discount_eligible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variants_design_size_unique UNIQUE (design_id, size_id),
  CONSTRAINT variants_price_non_negative CHECK (price >= 0),
  CONSTRAINT variants_old_price_non_negative CHECK (old_price IS NULL OR old_price >= 0),
  CONSTRAINT variants_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.fixation_size_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixation_id uuid NOT NULL REFERENCES public.fixations(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES public.sizes(id) ON DELETE RESTRICT,
  extra integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fixation_size_extras_unique UNIQUE (fixation_id, size_id),
  CONSTRAINT fixation_size_extras_extra_non_negative CHECK (extra >= 0)
);

-- 5. Content parents
CREATE TABLE public.content_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  kind text NOT NULL,
  design_id uuid REFERENCES public.designs(id) ON DELETE SET NULL,
  size_id uuid REFERENCES public.sizes(id) ON DELETE SET NULL,
  size_group text,
  title text,
  content_tab_label text,
  faq_tab_label text,
  info_box text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_sets_kind_check CHECK (kind IN ('inside', 'fixation')),
  CONSTRAINT content_sets_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.rich_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text,
  subtitle text,
  description text,
  additional_title text,
  additional_text text,
  additional_list jsonb,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rich_sections_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  faq_group text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT faq_items_group_check CHECK (faq_group IN ('inside', 'fixation', 'logo')),
  CONSTRAINT faq_items_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.benefit_modals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  card_label text,
  subtitle text,
  content jsonb,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benefit_modals_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

-- 6. Content children
CREATE TABLE public.gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  design_id uuid REFERENCES public.designs(id) ON DELETE SET NULL,
  size_id uuid REFERENCES public.sizes(id) ON DELETE SET NULL,
  media_url text NOT NULL,
  alt text,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_images_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.content_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  content_set_id uuid NOT NULL REFERENCES public.content_sets(id) ON DELETE CASCADE,
  title text,
  text text,
  media_url text,
  image_placeholder text,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_sections_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.rich_section_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  section_id uuid NOT NULL REFERENCES public.rich_sections(id) ON DELETE CASCADE,
  design_id uuid REFERENCES public.designs(id) ON DELETE CASCADE,
  media_url text,
  alt text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rich_section_images_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

-- 7. Media / site / settings
CREATE TABLE public.logo_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  info_text text,
  specs jsonb,
  fallback_image_url text,
  placement_video_url text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT logo_settings_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL UNIQUE,
  media_url text NOT NULL,
  alt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_flag_url text,
  checkout_payment_details text,
  rich_signoff text,
  design_info_text text,
  feature_magnetic_text text,
  feature_material_flag text,
  feature_material_text text,
  loyalty_discount_percent integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_loyalty_percent_check CHECK (loyalty_discount_percent >= 0 AND loyalty_discount_percent <= 100),
  CONSTRAINT site_settings_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.homepage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homepage_hero_eyebrow text,
  homepage_hero_title text,
  homepage_hero_lead text,
  homepage_hero_material_tag text,
  homepage_hero_products jsonb,
  homepage_badges_eyebrow text,
  homepage_badges_title text,
  homepage_badges_description text,
  homepage_badges_size_label text,
  homepage_badges_features jsonb,
  homepage_badges_video_url text,
  homepage_quality_eyebrow text,
  homepage_quality_title text,
  homepage_quality_stats jsonb,
  homepage_logo_video_url text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homepage_settings_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.about_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  about_hero_eyebrow text,
  about_hero_title text,
  about_hero_paragraph_1 text,
  about_hero_paragraph_2 text,
  about_process_blocks jsonb,
  about_process_image_1_url text,
  about_process_image_2_url text,
  about_process_image_3_url text,
  about_principles_eyebrow text,
  about_principles_title text,
  about_principles_items jsonb,
  about_development_title text,
  about_development_text text,
  about_statement_text text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT about_settings_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.review_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviews_enabled boolean NOT NULL DEFAULT true,
  reviews_title text,
  reviews_description_line_1 text,
  reviews_description_line_2 text,
  reviews_cta_label text,
  reviews_instagram_handle text,
  reviews_items jsonb,
  reviews_screenshots jsonb,
  reviews_modal_title text,
  reviews_modal_description text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_settings_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.video_review_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_reviews_enabled boolean NOT NULL DEFAULT true,
  video_reviews_title text,
  video_reviews jsonb,
  video_reviews_social_badge_url text,
  video_reviews_social_handle text,
  video_reviews_social_text text,
  video_reviews_social_verified boolean NOT NULL DEFAULT true,
  video_reviews_stat_1_value text,
  video_reviews_stat_1_text text,
  video_reviews_stat_2_value text,
  video_reviews_stat_2_text text,
  video_reviews_stat_3_value text,
  video_reviews_stat_3_text text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_review_settings_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.car_mat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_mat_designs jsonb,
  car_mat_modal_title text,
  car_mat_modal_description text,
  car_mat_promo_video_url text,
  car_mat_promo_cover_url text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT car_mat_settings_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

-- 8. CMS
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  page_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  no_index boolean NOT NULL DEFAULT false,
  show_header boolean NOT NULL DEFAULT true,
  show_footer boolean NOT NULL DEFAULT true,
  seo_title text,
  seo_description text,
  seo_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pages_page_type_check CHECK (page_type IN ('landing', 'legal', 'content')),
  CONSTRAINT pages_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE public.page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  block_type text NOT NULL DEFAULT 'rich_text',
  title text,
  eyebrow text,
  subtitle text,
  body text,
  items jsonb,
  image_url text,
  image_alt text,
  image_position text,
  theme text,
  primary_label text,
  primary_url text,
  secondary_label text,
  secondary_url text,
  anchor text,
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_blocks_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

-- 9. Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  checkout_attempt_id uuid UNIQUE,
  status public.order_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text NOT NULL,
  customer_email text,
  customer_comment text,
  contact_method public.contact_method NOT NULL,
  delivery_method public.delivery_method NOT NULL,
  delivery_city_ref text,
  delivery_city_name text,
  delivery_point_ref text,
  delivery_point_number text,
  delivery_point_name text,
  delivery_point_address text,
  delivery_point_type text,
  delivery_street_ref text,
  delivery_street_name text,
  delivery_street_type text,
  delivery_house text,
  delivery_apartment text,
  items_quantity integer NOT NULL,
  subtotal integer NOT NULL,
  quantity_discount integer NOT NULL DEFAULT 0,
  loyalty_phone text,
  loyalty_eligible boolean NOT NULL DEFAULT false,
  loyalty_discount_percent integer NOT NULL DEFAULT 0,
  loyalty_discount_amount integer NOT NULL DEFAULT 0,
  loyalty_phone_mismatch boolean NOT NULL DEFAULT false,
  total integer NOT NULL,
  discount_tier_key text,
  manager_note text,
  CONSTRAINT orders_items_quantity_non_negative CHECK (items_quantity >= 0),
  CONSTRAINT orders_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT orders_quantity_discount_non_negative CHECK (quantity_discount >= 0),
  CONSTRAINT orders_loyalty_discount_percent_non_negative CHECK (loyalty_discount_percent >= 0),
  CONSTRAINT orders_loyalty_discount_amount_non_negative CHECK (loyalty_discount_amount >= 0),
  CONSTRAINT orders_total_non_negative CHECK (total >= 0)
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  item_key text,
  title text,
  design_slug text,
  design_label text,
  size_code text,
  size_label text,
  brand_slug text,
  brand_name text,
  fixation_key text,
  fixation_label text,
  unit_price integer NOT NULL,
  quantity integer NOT NULL,
  line_total integer NOT NULL,
  quantity_discount_eligible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT order_items_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT order_items_line_total_non_negative CHECK (line_total >= 0)
);

-- 10. Notifications
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'telegram',
  subject_template text,
  message_template text,
  telegram_chat_ids jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. Indexes (non-redundant)
CREATE INDEX designs_status_sort_idx ON public.designs (status, sort);
CREATE INDEX sizes_status_sort_idx ON public.sizes (status, sort);
CREATE INDEX brands_status_sort_idx ON public.brands (status, sort);
CREATE INDEX fixations_status_sort_idx ON public.fixations (status, sort);
CREATE INDEX discount_tiers_min_quantity_idx ON public.discount_tiers (min_quantity);
CREATE INDEX variants_status_idx ON public.variants (status);
CREATE INDEX gallery_images_design_size_sort_idx ON public.gallery_images (design_id, size_id, sort);
CREATE INDEX content_sections_content_set_sort_idx ON public.content_sections (content_set_id, sort);
CREATE INDEX faq_items_group_sort_idx ON public.faq_items (faq_group, sort);
CREATE INDEX rich_section_images_section_id_idx ON public.rich_section_images (section_id);
CREATE INDEX pages_status_idx ON public.pages (status);
CREATE INDEX page_blocks_page_sort_idx ON public.page_blocks (page_id, sort);
CREATE INDEX orders_created_at_idx ON public.orders (created_at);
CREATE INDEX orders_status_idx ON public.orders (status);
CREATE INDEX orders_customer_phone_idx ON public.orders (customer_phone);
CREATE INDEX orders_customer_id_idx ON public.orders (customer_id);
CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);

-- 12. updated_at triggers on mutable tables
CREATE TRIGGER designs_set_updated_at BEFORE UPDATE ON public.designs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sizes_set_updated_at BEFORE UPDATE ON public.sizes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER brands_set_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER fixations_set_updated_at BEFORE UPDATE ON public.fixations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER discount_tiers_set_updated_at BEFORE UPDATE ON public.discount_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER variants_set_updated_at BEFORE UPDATE ON public.variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER fixation_size_extras_set_updated_at BEFORE UPDATE ON public.fixation_size_extras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER content_sets_set_updated_at BEFORE UPDATE ON public.content_sets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER content_sections_set_updated_at BEFORE UPDATE ON public.content_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER faq_items_set_updated_at BEFORE UPDATE ON public.faq_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rich_sections_set_updated_at BEFORE UPDATE ON public.rich_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rich_section_images_set_updated_at BEFORE UPDATE ON public.rich_section_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER benefit_modals_set_updated_at BEFORE UPDATE ON public.benefit_modals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER gallery_images_set_updated_at BEFORE UPDATE ON public.gallery_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER logo_settings_set_updated_at BEFORE UPDATE ON public.logo_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_media_set_updated_at BEFORE UPDATE ON public.product_media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER site_settings_set_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER homepage_settings_set_updated_at BEFORE UPDATE ON public.homepage_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER about_settings_set_updated_at BEFORE UPDATE ON public.about_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER review_settings_set_updated_at BEFORE UPDATE ON public.review_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER video_review_settings_set_updated_at BEFORE UPDATE ON public.video_review_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER car_mat_settings_set_updated_at BEFORE UPDATE ON public.car_mat_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pages_set_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER page_blocks_set_updated_at BEFORE UPDATE ON public.page_blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER notification_settings_set_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. RLS enablement (server-only; no policies)
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixation_size_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rich_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rich_section_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_modals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_review_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_mat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- 14. Grants: server-only (mirror customers pattern)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'designs','sizes','brands','variants','fixations','fixation_size_extras','discount_tiers',
    'gallery_images','content_sets','content_sections','faq_items','rich_sections','rich_section_images','benefit_modals',
    'logo_settings','product_media','site_settings',
    'homepage_settings','about_settings','review_settings','video_review_settings','car_mat_settings',
    'pages','page_blocks','orders','order_items','notification_settings'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO postgres', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END;
$$;
