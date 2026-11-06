-- PREPARED — NOT APPLIED. Do not run against Production without owner approval.
--
-- CARZO: fill approved transport packaging parameters for public.sizes.
-- Source of truth: owner-approved table (transport box, not assembled case):
--   S  40 x 28 x 7 cm, 2 kg
--   M  50 x 28 x 7 cm, 2.5 kg
--   L  60 x 28 x 7 cm, 3 kg
--   XL 80 x 28 x 7 cm, 4 kg
--
-- Only shipping_* columns are touched. Physical size columns
-- (width_cm, height_cm, depth_cm) must stay as they are.
--
-- Current state (read-only check on 2026-11-24): all shipping_* columns are NULL,
-- so the app falls back to the same approved values in
-- product-page/lib/cart/shipping.ts (APPROVED_SIZE_SHIPPING) until this is applied.

BEGIN;

UPDATE public.sizes
SET shipping_length_cm = 40,
    shipping_width_cm = 28,
    shipping_height_cm = 7,
    shipping_weight_kg = 2
WHERE code = 'S'
  AND (shipping_length_cm IS DISTINCT FROM 40
    OR shipping_width_cm IS DISTINCT FROM 28
    OR shipping_height_cm IS DISTINCT FROM 7
    OR shipping_weight_kg IS DISTINCT FROM 2);

UPDATE public.sizes
SET shipping_length_cm = 50,
    shipping_width_cm = 28,
    shipping_height_cm = 7,
    shipping_weight_kg = 2.5
WHERE code = 'M'
  AND (shipping_length_cm IS DISTINCT FROM 50
    OR shipping_width_cm IS DISTINCT FROM 28
    OR shipping_height_cm IS DISTINCT FROM 7
    OR shipping_weight_kg IS DISTINCT FROM 2.5);

UPDATE public.sizes
SET shipping_length_cm = 60,
    shipping_width_cm = 28,
    shipping_height_cm = 7,
    shipping_weight_kg = 3
WHERE code = 'L'
  AND (shipping_length_cm IS DISTINCT FROM 60
    OR shipping_width_cm IS DISTINCT FROM 28
    OR shipping_height_cm IS DISTINCT FROM 7
    OR shipping_weight_kg IS DISTINCT FROM 3);

UPDATE public.sizes
SET shipping_length_cm = 80,
    shipping_width_cm = 28,
    shipping_height_cm = 7,
    shipping_weight_kg = 4
WHERE code = 'XL'
  AND (shipping_length_cm IS DISTINCT FROM 80
    OR shipping_width_cm IS DISTINCT FROM 28
    OR shipping_height_cm IS DISTINCT FROM 7
    OR shipping_weight_kg IS DISTINCT FROM 4);

COMMIT;

-- Verification after apply:
-- SELECT code, width_cm, height_cm, depth_cm,
--        shipping_length_cm, shipping_width_cm, shipping_height_cm, shipping_weight_kg
-- FROM public.sizes ORDER BY sort, code;
