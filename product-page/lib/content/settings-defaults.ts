/**
 * Backend-neutral defaults + parsers for homepage / about / car-mat editorial
 * settings. Leaf module: must not import from lib/data/* or the loaders, so
 * both the Directus and Supabase adapters can share it without cycles.
 */
import { resolveJsonMediaUrl } from '@/lib/media';

type RecordValue = Record<string, unknown>;

export function string(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
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
    logoVideoUrl: string;
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

export interface AboutProcessBlock {
  index: string;
  title: string;
  paragraph1: string;
  paragraph2: string;
}

export interface AboutPrincipleItem {
  index: string;
  title: string;
  description: string;
}

export interface AboutData {
  hero: {
    eyebrow: string;
    title: string;
    paragraph1: string;
    paragraph2: string;
  };
  processBlocks: AboutProcessBlock[];
  processImage1: string;
  processImage2: string;
  processImage3: string;
  principles: {
    eyebrow: string;
    title: string;
    items: AboutPrincipleItem[];
  };
  development: {
    title: string;
    text: string;
  };
  statement: {
    text: string;
  };
}

export interface CarMatDesign {
  code: string;
  title: string;
  altText: string;
  image: string;
}

export interface CarMatPromoMedia {
  videoUrl: string;
  coverUrl: string;
}

/** Car-mat editorial payload served through the content facade. */
export interface CarMatContent {
  designs: CarMatDesign[];
  promoMedia: CarMatPromoMedia;
  modalTitle: string;
  modalDescription: string;
}

export const DEFAULT_HOMEPAGE: HomepageData = {
  hero: {
    eyebrow: 'Стабільно якісно з 2020 року',
    title: 'Преміальні\nавтоаксесуари Carzo',
    lead: 'Німецька автомобільна еко-шкіра створена для авто',
    materialTag: 'ВИСОКОЯКІСНА ТА ЗНОСОСТІЙКА',
    products: [
      { image: '/case.jpg', alt: 'Чорний автокейс Carzo у багажнику', href: '/case/design/l/4-0', tag: 'Магнітна система', title: 'Premium автокейси' },
      { image: '/mats.png', alt: 'Комплект чорних автокилимків Carzo', href: '/catalog-carmat', tag: 'Точність лекал', title: 'Premium автокилимки' },
    ],
    logoVideoUrl: '',
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
      { value: '22K', suffix: '+', description: 'задоволених клієнтів\nзі всієї країни' },
      { value: '27', suffix: '%', description: 'клієнтів здійснюють\nповторну покупку' },
      { value: '<1', suffix: '%', description: 'звернень із проханням\nповернути або обміняти товар' },
    ],
  },
};

export const DEFAULT_ABOUT: AboutData = {
  hero: {
    eyebrow: 'Про нас',
    title: 'Робимо добре те,\nза що беремося',
    paragraph1: 'Carzo — український бренд автомобільних аксесуарів, який ми розвиваємо з 2020 року.',
    paragraph2: 'Розробляємо продукцію та відповідаємо за її якість на всіх етапах — від задуму до готового виробу. Для нас важливі якісні матеріали, продумані рішення, акуратне виконання й увага до деталей.',
  },
  processBlocks: [
    {
      index: '01',
      title: 'Розробляємо самостійно',
      paragraph1: 'Ми не працюємо з готовими типовими рішеннями. Конструкції, лекала та ключові елементи продуктів розробляємо самостійно.',
      paragraph2: 'Для автомобільних килимків створюємо власні лекала під конкретні моделі авто, приділяючи увагу точності геометрії та посадки. Для автокейсів розробляємо конструкцію, розміри й функціональні елементи.',
    },
    {
      index: '02',
      title: 'Виготовляємо на власному виробництві',
      paragraph1: 'Власне виробництво дає змогу контролювати всі етапи роботи: поведінку матеріалів, точність виготовлення та поєднання деталей, якість виконання й можливості для вдосконалення технології.',
      paragraph2: 'Це також дозволяє оперативно впроваджувати зміни, коли вони роблять продукт кращим.',
    },
    {
      index: '03',
      title: 'Перевіряємо на практиці',
      paragraph1: 'Перед запуском у продаж нові продукти тестуємо самостійно — оцінюємо зручність, надійність, зносостійкість і поведінку матеріалів у щоденній експлуатації.',
      paragraph2: 'Автомобільні килимки Carzo протягом пів року тестували у власному автомобілі: перевіряли точність посадки, зручність користування та стійкість до різних умов. Лише після цього продукт запустили в продаж.',
    },
  ],
  processImage1: '/about-design.png',
  processImage2: '/about-production.png',
  processImage3: '/about-testing.png',
  principles: {
    eyebrow: 'Наш підхід',
    title: 'Наші принципи',
    items: [
      {
        index: '01',
        title: 'Відповідальність за результат',
        description: 'Клієнт обирає Carzo — отже, відповідальність за якість продукту лежить на нас, незалежно від матеріалів, постачальників чи окремих виробничих процесів.',
      },
      {
        index: '02',
        title: 'Практичність у кожному рішенні',
        description: 'Кожен елемент має зрозуміле призначення. Якщо рішення не робить продукт зручнішим, надійнішим або функціональнішим, у ньому немає потреби.',
      },
      {
        index: '03',
        title: 'Увага до деталей',
        description: 'Точність посадки, геометрія, шви, краї, кріплення та інші конструктивні елементи формують загальне враження від продукту. Тому деталям ми приділяємо таку саму увагу, як і конструкції загалом.',
      },
      {
        index: '04',
        title: 'Постійне вдосконалення',
        description: 'Власний досвід, тестування та відгуки клієнтів допомагають знаходити рішення, які можна зробити точнішими, зручнішими й надійнішими. Жоден продукт ми не сприймаємо як остаточно завершений.',
      },
    ],
  },
  development: {
    title: 'Розвиток Carzo з 2020 року',
    text: 'Для нас розвиток — це не лише роки роботи чи кількість проданих виробів, а передусім те, як змінюється продукт і наскільки кращою стає кожна його наступна версія.',
  },
  statement: {
    text: 'Ми самостійно розробляємо та виготовляємо продукцію Carzo й відповідаємо за кожен продукт, що виходить під нашим брендом.',
  },
};

export const DEFAULT_CAR_MAT_DESIGNS: CarMatDesign[] = [
  { code: '2.0', title: 'Дизайн Carzo 2.0', altText: 'Автокилимки Carzo дизайн 2.0', image: 'https://media.carzo.com.ua/content/products/car-mats/modal/design-2.0.webp' },
  { code: '3.0', title: 'Дизайн Carzo 3.0', altText: 'Автокилимки Carzo дизайн 3.0', image: 'https://media.carzo.com.ua/content/products/car-mats/modal/design-3.0.webp' },
  { code: '4.0', title: 'Дизайн Carzo 4.0', altText: 'Автокилимки Carzo дизайн 4.0', image: 'https://media.carzo.com.ua/content/products/car-mats/modal/design-4.0.webp' },
];

export const DEFAULT_CAR_MAT_PROMO_MEDIA: CarMatPromoMedia = {
  videoUrl: 'https://media.carzo.com.ua/content/products/car-mats/promo-video.webm',
  coverUrl: 'https://media.carzo.com.ua/content/products/car-mats/cover-video.webp',
};

export function parseProducts(raw: unknown): HomepageProduct[] {
  if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE.hero.products;
  return raw.map((item, index) => {
    const imageValue = resolveJsonMediaUrl(
      item as { image?: unknown; imageUrl?: unknown },
      DEFAULT_HOMEPAGE.hero.products[index]?.image || '/case.jpg',
    );
    return {
      image: imageValue,
      alt: string(item.alt) || DEFAULT_HOMEPAGE.hero.products[index]?.alt || '',
      href: string(item.href) || DEFAULT_HOMEPAGE.hero.products[index]?.href || '#',
      tag: string(item.tag) || DEFAULT_HOMEPAGE.hero.products[index]?.tag || '',
      title: string(item.title) || DEFAULT_HOMEPAGE.hero.products[index]?.title || '',
    };
  });
}

export function parseFeatures(raw: unknown): HomepageFeature[] {
  if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE.badges.features;
  return raw.map((item, index) => ({
    number: string(item.number) || DEFAULT_HOMEPAGE.badges.features[index]?.number || '',
    title: string(item.title) || DEFAULT_HOMEPAGE.badges.features[index]?.title || '',
    description: string(item.description) || DEFAULT_HOMEPAGE.badges.features[index]?.description || '',
  }));
}

export function parseStats(raw: unknown): HomepageStat[] {
  if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE.quality.stats;
  return raw.map((item, index) => ({
    value: string(item.value) || DEFAULT_HOMEPAGE.quality.stats[index]?.value || '',
    suffix: string(item.suffix) || DEFAULT_HOMEPAGE.quality.stats[index]?.suffix || '',
    description: string(item.description) || DEFAULT_HOMEPAGE.quality.stats[index]?.description || '',
  }));
}

export function parseProcessBlocks(raw: unknown): AboutProcessBlock[] {
  if (!Array.isArray(raw)) return DEFAULT_ABOUT.processBlocks;
  return raw.map((item, index) => ({
    index: string(item.index) || DEFAULT_ABOUT.processBlocks[index]?.index || '',
    title: string(item.title) || DEFAULT_ABOUT.processBlocks[index]?.title || '',
    paragraph1: string(item.paragraph1) || DEFAULT_ABOUT.processBlocks[index]?.paragraph1 || '',
    paragraph2: string(item.paragraph2) || DEFAULT_ABOUT.processBlocks[index]?.paragraph2 || '',
  }));
}

export function parsePrinciplesItems(raw: unknown): AboutPrincipleItem[] {
  if (!Array.isArray(raw)) return DEFAULT_ABOUT.principles.items;
  return raw.map((item, index) => ({
    index: string(item.index) || DEFAULT_ABOUT.principles.items[index]?.index || '',
    title: string(item.title) || DEFAULT_ABOUT.principles.items[index]?.title || '',
    description: string(item.description) || DEFAULT_ABOUT.principles.items[index]?.description || '',
  }));
}

export function parseCarMatDesigns(raw: unknown): CarMatDesign[] {
  if (!Array.isArray(raw)) return DEFAULT_CAR_MAT_DESIGNS;
  return raw.map((item, index) => ({
    code: string(item.code) || DEFAULT_CAR_MAT_DESIGNS[index]?.code || '',
    title: string(item.title) || DEFAULT_CAR_MAT_DESIGNS[index]?.title || '',
    altText: string(item.altText) || DEFAULT_CAR_MAT_DESIGNS[index]?.altText || '',
    image: resolveJsonMediaUrl(item as { image?: unknown; imageUrl?: unknown }),
  }));
}

export function parseHomepageSettings(
  data: RecordValue,
  mediaUrl: (external: unknown, file: unknown, fallback: string) => string,
): HomepageData {
  return {
    hero: {
      eyebrow: string(data.homepage_hero_eyebrow, DEFAULT_HOMEPAGE.hero.eyebrow),
      title: string(data.homepage_hero_title, DEFAULT_HOMEPAGE.hero.title),
      lead: string(data.homepage_hero_lead, DEFAULT_HOMEPAGE.hero.lead),
      materialTag: string(data.homepage_hero_material_tag, DEFAULT_HOMEPAGE.hero.materialTag),
      products: parseProducts(data.homepage_hero_products),
      logoVideoUrl: mediaUrl(data.homepage_logo_video_url, data.homepage_logo_video, ''),
    },
    badges: {
      eyebrow: string(data.homepage_badges_eyebrow, DEFAULT_HOMEPAGE.badges.eyebrow),
      title: string(data.homepage_badges_title, DEFAULT_HOMEPAGE.badges.title),
      description: string(data.homepage_badges_description, DEFAULT_HOMEPAGE.badges.description),
      videoUrl: mediaUrl(data.homepage_badges_video_url, data.homepage_badges_video, DEFAULT_HOMEPAGE.badges.videoUrl),
      sizeLabel: string(data.homepage_badges_size_label, DEFAULT_HOMEPAGE.badges.sizeLabel),
      features: parseFeatures(data.homepage_badges_features),
    },
    quality: {
      eyebrow: string(data.homepage_quality_eyebrow, DEFAULT_HOMEPAGE.quality.eyebrow),
      title: string(data.homepage_quality_title, DEFAULT_HOMEPAGE.quality.title),
      stats: parseStats(data.homepage_quality_stats),
    },
  };
}

export function parseAboutSettings(
  data: RecordValue,
  mediaUrl: (external: unknown, file: unknown, fallback: string) => string,
): AboutData {
  return {
    hero: {
      eyebrow: string(data.about_hero_eyebrow, DEFAULT_ABOUT.hero.eyebrow),
      title: string(data.about_hero_title, DEFAULT_ABOUT.hero.title),
      paragraph1: string(data.about_hero_paragraph_1, DEFAULT_ABOUT.hero.paragraph1),
      paragraph2: string(data.about_hero_paragraph_2, DEFAULT_ABOUT.hero.paragraph2),
    },
    processBlocks: parseProcessBlocks(data.about_process_blocks),
    processImage1: mediaUrl(data.about_process_image_1_url, data.about_process_image_1, DEFAULT_ABOUT.processImage1),
    processImage2: mediaUrl(data.about_process_image_2_url, data.about_process_image_2, DEFAULT_ABOUT.processImage2),
    processImage3: mediaUrl(data.about_process_image_3_url, data.about_process_image_3, DEFAULT_ABOUT.processImage3),
    principles: {
      eyebrow: string(data.about_principles_eyebrow, DEFAULT_ABOUT.principles.eyebrow),
      title: string(data.about_principles_title, DEFAULT_ABOUT.principles.title),
      items: parsePrinciplesItems(data.about_principles_items),
    },
    development: {
      title: string(data.about_development_title, DEFAULT_ABOUT.development.title),
      text: string(data.about_development_text, DEFAULT_ABOUT.development.text),
    },
    statement: {
      text: string(data.about_statement_text, DEFAULT_ABOUT.statement.text),
    },
  };
}

export function parseCarMatPromoMedia(
  data: RecordValue,
  mediaUrl: (external: unknown, file: unknown, fallback: string) => string,
): CarMatPromoMedia {
  return {
    videoUrl: mediaUrl(data.car_mat_promo_video_url, data.car_mat_promo_video, DEFAULT_CAR_MAT_PROMO_MEDIA.videoUrl),
    coverUrl: mediaUrl(data.car_mat_promo_cover_url, data.car_mat_promo_cover, DEFAULT_CAR_MAT_PROMO_MEDIA.coverUrl),
  };
}
