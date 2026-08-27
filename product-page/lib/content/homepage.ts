import 'server-only';
import { cache } from 'react';

type RecordValue = Record<string, unknown>;

function getDirectusUrl() {
  return process.env.DIRECTUS_URL?.replace(/\/$/, '') || null;
}

function getDirectusToken() {
  return process.env.DIRECTUS_READ_TOKEN?.trim() || null;
}

function directusHeaders() {
  const token = getDirectusToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function string(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function assetUrl(file: unknown, fallback = '') {
  const directusUrl = getDirectusUrl();
  if (!directusUrl || !file) return fallback;
  const id = typeof file === 'string' ? file : (file as RecordValue).id;
  if (typeof id !== 'string') return fallback;
  return getDirectusToken()
    ? `/api/directus-assets/${encodeURIComponent(id)}`
    : `${directusUrl}/assets/${id}`;
}

export interface HomepageProduct {
  image: string;
  alt: string;
  href: string;
  tag: string;
  title: string;
}

export interface HomepageFeature {
  number: string;
  title: string;
  description: string;
}

export interface HomepageStat {
  value: string;
  suffix: string;
  description: string;
}

export interface HomepageData {
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    materialTag: string;
    products: HomepageProduct[];
  };
  badges: {
    eyebrow: string;
    title: string;
    description: string;
    videoUrl: string;
    sizeLabel: string;
    features: HomepageFeature[];
  };
  quality: {
    eyebrow: string;
    title: string;
    stats: HomepageStat[];
  };
}

const DEFAULT_HOMEPAGE: HomepageData = {
  hero: {
    eyebrow: 'Стабільно якісно з 2020 року',
    title: 'Преміальні\nавтоаксесуари Carzo',
    lead: 'Німецька автомобільна еко-шкіра створена для авто',
    materialTag: 'ВИСОКОЯКІСНА ТА ЗНОСОСТІЙКА',
    products: [
      { image: '/case.jpg', alt: 'Чорний автокейс Carzo у багажнику', href: '/case/design/l/4-0', tag: 'Магнітна система', title: 'Premium автокейси' },
      { image: '/mats.png', alt: 'Комплект чорних автокилимків Carzo', href: '/catalog-carmat', tag: 'Точність лекал', title: 'Premium автокилимки' },
    ],
  },
  badges: {
    eyebrow: 'Власне виробництво',
    title: 'Високоякісні\nшильди',
    description: 'Від фрезування металу до готової деталі — усе контролюємо самі.',
    videoUrl: '/carzo-badges.mp4',
    sizeLabel: '20 × 80 мм',
    features: [
      { number: '01', title: 'Фрезування металу', description: 'Основний процес виготовлення — точне фрезування металевої основи.' },
      { number: '02', title: 'Для виробів Carzo', description: 'Додайте фірмовий шильд до автокейса за привабливою ціною.' },
      { number: '03', title: 'Стандартні та індивідуальні', description: 'Готові рішення для популярних марок та виготовлення за вашим дизайном.' },
    ],
  },
  quality: {
    eyebrow: 'Carzo у цифрах',
    title: 'Відмінна якість\nпродукту та обслуговування',
    stats: [
      { value: '15K', suffix: '+', description: 'задоволених клієнтів\nзі всієї країни' },
      { value: '24', suffix: '%', description: 'клієнтів здійснюють\nповторну покупку' },
      { value: '<1', suffix: '%', description: 'звернень із проханням\nповернути або обміняти товар' },
    ],
  },
};

function parseProducts(raw: unknown): HomepageProduct[] {
  if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE.hero.products;
  return raw.map((item, index) => ({
    image: string(item.image) || DEFAULT_HOMEPAGE.hero.products[index]?.image || '/case.jpg',
    alt: string(item.alt) || DEFAULT_HOMEPAGE.hero.products[index]?.alt || '',
    href: string(item.href) || DEFAULT_HOMEPAGE.hero.products[index]?.href || '#',
    tag: string(item.tag) || DEFAULT_HOMEPAGE.hero.products[index]?.tag || '',
    title: string(item.title) || DEFAULT_HOMEPAGE.hero.products[index]?.title || '',
  }));
}

function parseFeatures(raw: unknown): HomepageFeature[] {
  if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE.badges.features;
  return raw.map((item, index) => ({
    number: string(item.number) || DEFAULT_HOMEPAGE.badges.features[index]?.number || '',
    title: string(item.title) || DEFAULT_HOMEPAGE.badges.features[index]?.title || '',
    description: string(item.description) || DEFAULT_HOMEPAGE.badges.features[index]?.description || '',
  }));
}

function parseStats(raw: unknown): HomepageStat[] {
  if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE.quality.stats;
  return raw.map((item, index) => ({
    value: string(item.value) || DEFAULT_HOMEPAGE.quality.stats[index]?.value || '',
    suffix: string(item.suffix) || DEFAULT_HOMEPAGE.quality.stats[index]?.suffix || '',
    description: string(item.description) || DEFAULT_HOMEPAGE.quality.stats[index]?.description || '',
  }));
}

export const getHomepageData = cache(async (): Promise<HomepageData> => {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return DEFAULT_HOMEPAGE;

  try {
    const query = new URLSearchParams({ fields: '*' });
    const response = await fetch(`${directusUrl}/items/carzo_site_settings?${query}`, {
      headers: directusHeaders(),
      next: { revalidate: 60 },
    });

    if (!response.ok) return DEFAULT_HOMEPAGE;

    const payload = await response.json() as { data?: RecordValue };
    const data = payload.data;
    if (!data) return DEFAULT_HOMEPAGE;

    const videoUrl = assetUrl(data.homepage_badges_video, DEFAULT_HOMEPAGE.badges.videoUrl);

    return {
      hero: {
        eyebrow: string(data.homepage_hero_eyebrow, DEFAULT_HOMEPAGE.hero.eyebrow),
        title: string(data.homepage_hero_title, DEFAULT_HOMEPAGE.hero.title),
        lead: string(data.homepage_hero_lead, DEFAULT_HOMEPAGE.hero.lead),
        materialTag: string(data.homepage_hero_material_tag, DEFAULT_HOMEPAGE.hero.materialTag),
        products: parseProducts(data.homepage_hero_products),
      },
      badges: {
        eyebrow: string(data.homepage_badges_eyebrow, DEFAULT_HOMEPAGE.badges.eyebrow),
        title: string(data.homepage_badges_title, DEFAULT_HOMEPAGE.badges.title),
        description: string(data.homepage_badges_description, DEFAULT_HOMEPAGE.badges.description),
        videoUrl,
        sizeLabel: string(data.homepage_badges_size_label, DEFAULT_HOMEPAGE.badges.sizeLabel),
        features: parseFeatures(data.homepage_badges_features),
      },
      quality: {
        eyebrow: string(data.homepage_quality_eyebrow, DEFAULT_HOMEPAGE.quality.eyebrow),
        title: string(data.homepage_quality_title, DEFAULT_HOMEPAGE.quality.title),
        stats: parseStats(data.homepage_quality_stats),
      },
    };
  } catch {
    return DEFAULT_HOMEPAGE;
  }
});
