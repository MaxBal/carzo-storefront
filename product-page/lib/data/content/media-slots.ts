export const MAGNETIC_POSTER_SLOTS = [
  { designSlug: '2-0', size: 'S', slot: 'magnetic_system_cover_2_0_s' },
  { designSlug: '2-0', size: 'M', slot: 'magnetic_system_cover_2_0_m' },
  { designSlug: '2-0', size: 'L', slot: 'magnetic_system_cover_2_0_l' },
  { designSlug: '2-0', size: 'XL', slot: 'magnetic_system_cover_2_0_xl' },
  { designSlug: '3-0', size: 'S', slot: 'magnetic_system_cover_3_0_s' },
  { designSlug: '3-0', size: 'M', slot: 'magnetic_system_cover_3_0_m' },
  { designSlug: '3-0', size: 'L', slot: 'magnetic_system_cover_3_0_l' },
  { designSlug: '3-0', size: 'XL', slot: 'magnetic_system_cover_3_0_xl' },
  { designSlug: '4-0', size: 'S', slot: 'magnetic_system_cover_4_0_s' },
  { designSlug: '4-0', size: 'M', slot: 'magnetic_system_cover_4_0_m' },
  { designSlug: '4-0', size: 'L', slot: 'magnetic_system_cover_4_0_l' },
  { designSlug: '4-0', size: 'XL', slot: 'magnetic_system_cover_4_0_xl' },
] as const;

/** Stage 2A verified 17/17 product_media canonical slots. */
export const PRODUCT_MEDIA_REQUIRED_SLOTS = [
  'magnetic_system_video',
  'magnetic_system_default_cover',
  ...MAGNETIC_POSTER_SLOTS.map(item => item.slot),
  'materials_video',
  'edging_video',
  'fixation_video',
] as const;
