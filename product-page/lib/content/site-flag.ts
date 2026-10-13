import 'server-only';
import { cache } from 'react';
import { getContentSource } from '@/lib/data/content';

export const getSiteFlag = cache(async (): Promise<string> => {
  try {
    const source = await getContentSource();
    return source.siteSettings.siteFlag || '/flag-ua.svg';
  } catch {
    return '/flag-ua.svg';
  }
});
