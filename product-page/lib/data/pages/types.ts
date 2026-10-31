import type { CmsPage, CmsPageSummary } from '@/lib/pages/types';

export interface PageRepository {
  getPublishedPage(slug: string): Promise<CmsPage | null>;
  getPublishedPageSummaries(): Promise<CmsPageSummary[]>;
  /** Preview may read draft rows and must use no-store semantics. */
  getPreviewPage(id: string): Promise<CmsPage | null>;
}
