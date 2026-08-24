import Image from 'next/image';
import Link from 'next/link';
import sanitizeHtml from 'sanitize-html';
import Header from '@/components/Header';
import type { CmsPage, CmsPageBlock } from '@/lib/pages/types';

const themeClasses = {
  light: 'bg-white text-gray-950',
  dark: 'bg-black text-white',
  soft: 'bg-[#f5f5f3] text-gray-950',
  mint: 'bg-[#dff8f2] text-gray-950',
} as const;

function safeHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
        },
      }),
    },
  });
}

function CmsLink({ href, children, className }: {
  href: string;
  children: React.ReactNode;
  className: string;
}) {
  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    return <a href={href} className={className} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

function Buttons({ block, inverse = false }: { block: CmsPageBlock; inverse?: boolean }) {
  if ((!block.primaryLabel || !block.primaryUrl) && (!block.secondaryLabel || !block.secondaryUrl)) return null;
  const primary = inverse
    ? 'bg-white text-black hover:bg-gray-100'
    : 'bg-black text-white hover:bg-gray-800';
  const secondary = inverse
    ? 'border-white/40 text-white hover:border-white'
    : 'border-gray-300 text-gray-900 hover:border-gray-900';

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {block.primaryLabel && block.primaryUrl && (
        <CmsLink href={block.primaryUrl} className={`inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors ${primary}`}>
          {block.primaryLabel}
        </CmsLink>
      )}
      {block.secondaryLabel && block.secondaryUrl && (
        <CmsLink href={block.secondaryUrl} className={`inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-semibold transition-colors ${secondary}`}>
          {block.secondaryLabel}
        </CmsLink>
      )}
    </div>
  );
}

function Heading({ block, centered = false }: { block: CmsPageBlock; centered?: boolean }) {
  const muted = block.theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  return (
    <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {block.eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#159e85]">{block.eyebrow}</p>}
      {block.title && <h2 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">{block.title}</h2>}
      {block.subtitle && <p className={`mt-5 text-base leading-7 sm:text-lg ${muted}`}>{block.subtitle}</p>}
    </div>
  );
}

function RichBody({ html }: { html: string | null }) {
  if (!html) return null;
  return (
    <div
      className="cms-rich-text mt-7 text-base leading-8"
      dangerouslySetInnerHTML={{ __html: safeHtml(html) }}
    />
  );
}

function HeroBlock({ block }: { block: CmsPageBlock }) {
  const inverse = block.theme === 'dark';
  return (
    <section id={block.anchor || undefined} className={`${themeClasses[block.theme]} overflow-hidden`}>
      <div className="mx-auto grid min-h-[580px] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div className="max-w-xl">
          {block.eyebrow && <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-[#5ce4ab]">{block.eyebrow}</p>}
          {block.title && <h1 className="text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">{block.title}</h1>}
          {block.subtitle && <p className={`mt-6 text-lg leading-8 ${inverse ? 'text-gray-300' : 'text-gray-600'}`}>{block.subtitle}</p>}
          <RichBody html={block.body} />
          <Buttons block={block} inverse={inverse} />
        </div>
        {block.image && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-white/5 shadow-2xl">
            <Image src={block.image} alt={block.imageAlt} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}

function RichTextBlock({ block }: { block: CmsPageBlock }) {
  return (
    <section id={block.anchor || undefined} className={`${themeClasses[block.theme]} px-4 py-16 sm:px-6 lg:px-8 lg:py-24`}>
      <div className="mx-auto max-w-4xl">
        <Heading block={block} />
        <RichBody html={block.body} />
        <Buttons block={block} inverse={block.theme === 'dark'} />
      </div>
    </section>
  );
}

function ImageTextBlock({ block }: { block: CmsPageBlock }) {
  const imageFirst = block.imagePosition === 'left';
  return (
    <section id={block.anchor || undefined} className={`${themeClasses[block.theme]} px-4 py-16 sm:px-6 lg:px-8 lg:py-24`}>
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {block.image && (
          <div className={`relative aspect-[4/3] overflow-hidden rounded-3xl bg-gray-200 ${imageFirst ? 'lg:order-1' : 'lg:order-2'}`}>
            <Image src={block.image} alt={block.imageAlt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
        )}
        <div className={imageFirst ? 'lg:order-2' : 'lg:order-1'}>
          <Heading block={block} />
          <RichBody html={block.body} />
          <Buttons block={block} inverse={block.theme === 'dark'} />
        </div>
      </div>
    </section>
  );
}

function FeatureGridBlock({ block }: { block: CmsPageBlock }) {
  return (
    <section id={block.anchor || undefined} className={`${themeClasses[block.theme]} px-4 py-16 sm:px-6 lg:px-8 lg:py-24`}>
      <div className="mx-auto max-w-7xl">
        <Heading block={block} centered />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {block.items.map((item, index) => (
            <article key={`${item.title || 'feature'}-${index}`} className="rounded-2xl border border-black/10 bg-white p-7 shadow-sm">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#dff8f2] text-sm font-bold text-[#159e85]">{index + 1}</div>
              {item.title && <h3 className="text-xl font-bold">{item.title}</h3>}
              {item.text && <p className="mt-3 leading-7 text-gray-600">{item.text}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqBlock({ block }: { block: CmsPageBlock }) {
  return (
    <section id={block.anchor || undefined} className={`${themeClasses[block.theme]} px-4 py-16 sm:px-6 lg:px-8 lg:py-24`}>
      <div className="mx-auto max-w-4xl">
        <Heading block={block} />
        <div className="mt-10 divide-y divide-black/10 border-y border-black/10">
          {block.items.map((item, index) => (
            <details key={`${item.question || 'question'}-${index}`} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {item.question || item.title}
                <span className="text-2xl font-light transition-transform group-open:rotate-45">+</span>
              </summary>
              {(item.answer || item.text) && <p className="max-w-3xl pt-4 leading-7 text-gray-600">{item.answer || item.text}</p>}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ block }: { block: CmsPageBlock }) {
  return (
    <section id={block.anchor || undefined} className={`${themeClasses[block.theme]} px-4 py-16 sm:px-6 lg:px-8 lg:py-20`}>
      <div className="mx-auto max-w-5xl rounded-[32px] border border-black/10 bg-white/70 px-6 py-12 text-center shadow-sm backdrop-blur sm:px-12">
        <Heading block={block} centered />
        <div className="flex justify-center"><Buttons block={block} inverse={false} /></div>
      </div>
    </section>
  );
}

function PageBlock({ block }: { block: CmsPageBlock }) {
  switch (block.type) {
    case 'hero': return <HeroBlock block={block} />;
    case 'rich_text': return <RichTextBlock block={block} />;
    case 'image_text': return <ImageTextBlock block={block} />;
    case 'feature_grid': return <FeatureGridBlock block={block} />;
    case 'faq': return <FaqBlock block={block} />;
    case 'cta': return <CtaBlock block={block} />;
    default: return null;
  }
}

export default function PageRenderer({ page, preview = false }: { page: CmsPage; preview?: boolean }) {
  return (
    <div className="min-h-screen bg-white">
      {preview && (
        <div className="sticky top-0 z-[200] flex items-center justify-center gap-4 bg-amber-300 px-4 py-2 text-center text-xs font-semibold text-black">
          Режим попереднього перегляду: неопубліковані зміни видимі лише вам.
          <a href="/api/draft/disable" className="underline">Вийти</a>
        </div>
      )}
      {page.showHeader && <Header />}
      <main>
        {page.blocks.length > 0 ? page.blocks.map(block => <PageBlock key={block.id || block.key} block={block} />) : (
          <section className="px-4 py-24 text-center">
            <h1 className="text-4xl font-bold">{page.title}</h1>
            <p className="mt-4 text-gray-600">Додайте блоки цієї сторінки у Directus.</p>
          </section>
        )}
      </main>
    </div>
  );
}
