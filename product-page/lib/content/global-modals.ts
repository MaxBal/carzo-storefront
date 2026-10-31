import 'server-only';
import { cache } from 'react';
import { getContentSource } from '@/lib/data/content';
import { DEFAULT_CONTENT_SOURCE } from './default-source';
import type { BenefitModalData } from './types';

export const getBenefitModals = cache(async (): Promise<BenefitModalData[]> => {
  try {
    const source = await getContentSource();
    return source.benefitModals;
  } catch {
    return DEFAULT_CONTENT_SOURCE.benefitModals;
  }
});
