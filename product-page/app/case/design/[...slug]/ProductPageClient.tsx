import Header from '@/components/Header';
import ProductSubheader from '@/components/ProductSubheader';
import ProductGallery from '@/components/ProductGallery';
import ProductOptions from '@/components/ProductOptions';
import ProductRichContent from '@/components/ProductRichContent';
import type { ProductParams, ResolvedProductContent } from '@/lib/content/types';

interface ProductPageClientProps {
  params: ProductParams;
  content: ResolvedProductContent;
}

export default function ProductPageClient({ params, content }: ProductPageClientProps) {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Desktop subheader: sticky/fixed scroll behavior */}
      <div className="hidden md:block">
        <ProductSubheader
          designSlug={params.designSlug}
          designs={content.catalog.designs}
          designInfoText={content.siteSettings.designInfoText}
        />
      </div>

      <main>
        {/* Desktop: padded container with two columns */}
        <div className="hidden md:block max-w-[1280px] mx-auto px-4 pb-12 pt-6">
          <div className="flex gap-8">
            <div className="flex-[0_0_60%] max-w-[60%]">
              <ProductGallery images={content.gallery} />
            </div>
            <div className="flex-1 min-w-0">
              <ProductOptions params={params} content={content} />
            </div>
          </div>
        </div>

        {/* Mobile: gallery → subheader → content, all in normal flow */}
        <div className="md:hidden pb-10">
          <ProductGallery images={content.gallery} />
          <ProductSubheader
            inFlow
            designSlug={params.designSlug}
            designs={content.catalog.designs}
            designInfoText={content.siteSettings.designInfoText}
          />
          <div className="px-3 pt-4">
            <ProductOptions params={params} content={content} />
          </div>
        </div>

        <ProductRichContent data={content.richContent} />
      </main>
    </div>
  );
}
