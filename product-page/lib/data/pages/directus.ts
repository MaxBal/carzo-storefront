import 'server-only';

import {
  getPublishedPage as directusGetPublishedPage,
  getPublishedPageSummaries as directusGetPublishedPageSummaries,
  getPreviewPage as directusGetPreviewPage,
} from '@/lib/pages/directus';
import type { PageRepository } from './types';

/** Directus pages adapter — wraps existing lib/pages/directus.ts. */
export function createDirectusPageRepository(): PageRepository {
  return {
    getPublishedPage: directusGetPublishedPage,
    getPublishedPageSummaries: directusGetPublishedPageSummaries,
    getPreviewPage: directusGetPreviewPage,
  };
}
