export type CmsPageType = 'landing' | 'content' | 'legal';
export type CmsBlockType = 'hero' | 'rich_text' | 'image_text' | 'feature_grid' | 'faq' | 'cta';
export type CmsBlockTheme = 'light' | 'dark' | 'soft' | 'mint';

export interface CmsBlockItem {
  title?: string;
  text?: string;
  question?: string;
  answer?: string;
}

export interface CmsPageBlock {
  id: string;
  key: string;
  type: CmsBlockType;
  theme: CmsBlockTheme;
  sort: number;
  anchor: string | null;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  image: string | null;
  imageAlt: string;
  imagePosition: 'left' | 'right';
  primaryLabel: string | null;
  primaryUrl: string | null;
  secondaryLabel: string | null;
  secondaryUrl: string | null;
  items: CmsBlockItem[];
}

export interface CmsPage {
  id: string;
  status: 'draft' | 'published' | 'archived';
  key: string;
  title: string;
  slug: string;
  pageType: CmsPageType;
  seoTitle: string;
  seoDescription: string;
  seoImage: string | null;
  showHeader: boolean;
  showFooter: boolean;
  noIndex: boolean;
  blocks: CmsPageBlock[];
}

export interface CmsPageSummary {
  id: string;
  key: string;
  title: string;
  slug: string;
  seoDescription: string;
  noIndex: boolean;
}
