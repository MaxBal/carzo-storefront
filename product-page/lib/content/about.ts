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

export interface AboutProcessBlock {
  index: string;
  title: string;
  paragraph1: string;
  paragraph2: string;
  imageField: string;
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

const DEFAULT_ABOUT: AboutData = {
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
      imageField: '/about-design.png',
    },
    {
      index: '02',
      title: 'Виготовляємо на власному виробництві',
      paragraph1: 'Власне виробництво дає змогу контролювати всі етапи роботи: поведінку матеріалів, точність виготовлення та поєднання деталей, якість виконання й можливості для вдосконалення технології.',
      paragraph2: 'Це також дозволяє оперативно впроваджувати зміни, коли вони роблять продукт кращим.',
      imageField: '/about-production.png',
    },
    {
      index: '03',
      title: 'Перевіряємо на практиці',
      paragraph1: 'Перед запуском у продаж нові продукти тестуємо самостійно — оцінюємо зручність, надійність, зносостійкість і поведінку матеріалів у щоденній експлуатації.',
      paragraph2: 'Автомобільні килимки Carzo протягом пів року тестували у власному автомобілі: перевіряли точність посадки, зручність користування та стійкість до різних умов. Лише після цього продукт запустили в продаж.',
      imageField: '/about-testing.png',
    },
  ],
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

function parseProcessBlocks(raw: unknown): AboutProcessBlock[] {
  if (!Array.isArray(raw)) return DEFAULT_ABOUT.processBlocks;
  return raw.map((item, index) => ({
    index: string(item.index) || DEFAULT_ABOUT.processBlocks[index]?.index || '',
    title: string(item.title) || DEFAULT_ABOUT.processBlocks[index]?.title || '',
    paragraph1: string(item.paragraph1) || DEFAULT_ABOUT.processBlocks[index]?.paragraph1 || '',
    paragraph2: string(item.paragraph2) || DEFAULT_ABOUT.processBlocks[index]?.paragraph2 || '',
    imageField: string(item.imageField) || DEFAULT_ABOUT.processBlocks[index]?.imageField || '',
  }));
}

function parsePrinciplesItems(raw: unknown): AboutPrincipleItem[] {
  if (!Array.isArray(raw)) return DEFAULT_ABOUT.principles.items;
  return raw.map((item, index) => ({
    index: string(item.index) || DEFAULT_ABOUT.principles.items[index]?.index || '',
    title: string(item.title) || DEFAULT_ABOUT.principles.items[index]?.title || '',
    description: string(item.description) || DEFAULT_ABOUT.principles.items[index]?.description || '',
  }));
}

export const getAboutData = cache(async (): Promise<AboutData> => {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return DEFAULT_ABOUT;

  try {
    const query = new URLSearchParams({ fields: '*' });
    const response = await fetch(`${directusUrl}/items/carzo_site_settings?${query}`, {
      headers: directusHeaders(),
      next: { revalidate: 60 },
    });

    if (!response.ok) return DEFAULT_ABOUT;

    const payload = await response.json() as { data?: RecordValue };
    const data = payload.data;
    if (!data) return DEFAULT_ABOUT;

    return {
      hero: {
        eyebrow: string(data.about_hero_eyebrow, DEFAULT_ABOUT.hero.eyebrow),
        title: string(data.about_hero_title, DEFAULT_ABOUT.hero.title),
        paragraph1: string(data.about_hero_paragraph_1, DEFAULT_ABOUT.hero.paragraph1),
        paragraph2: string(data.about_hero_paragraph_2, DEFAULT_ABOUT.hero.paragraph2),
      },
      processBlocks: parseProcessBlocks(data.about_process_blocks),
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
  } catch {
    return DEFAULT_ABOUT;
  }
});
