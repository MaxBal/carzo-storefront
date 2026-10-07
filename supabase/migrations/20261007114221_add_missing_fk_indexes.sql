-- Stage 1.1: covering indexes for 6 unindexed foreign keys (Performance Advisor).
-- DDL only. No table/column/RLS/grant/data changes.

CREATE INDEX content_sets_design_id_idx
  ON public.content_sets (design_id);

CREATE INDEX content_sets_size_id_idx
  ON public.content_sets (size_id);

CREATE INDEX fixation_size_extras_size_id_idx
  ON public.fixation_size_extras (size_id);

CREATE INDEX gallery_images_size_id_idx
  ON public.gallery_images (size_id);

CREATE INDEX rich_section_images_design_id_idx
  ON public.rich_section_images (design_id);

CREATE INDEX variants_size_id_idx
  ON public.variants (size_id);
