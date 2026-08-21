import type { ResolvedProductContent } from '@/lib/content/types';
import ManagedProductImage from '@/components/ManagedProductImage';

interface ProductRichContentProps {
  data: ResolvedProductContent['richContent'];
}

export default function ProductRichContent({ data }: ProductRichContentProps) {
  return (
    <section className="mt-16 bg-black py-16" aria-label="Особливості автокейсу">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-16">
          {data.sections.map((feature, index) => (
            <article
              key={feature.key}
              className={`flex flex-col items-center gap-8 lg:gap-12 ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              }`}
            >
              <div className="w-full lg:w-1/2">
                <div className="aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
                  <ManagedProductImage
                    src={feature.image}
                    fallbackSrc={feature.fallbackSrc}
                    isPlaceholder={feature.isPlaceholder}
                    alt={feature.imageAlt}
                    width={1200}
                    height={900}
                    className="h-full w-full"
                  />
                </div>
              </div>

              <div className="w-full space-y-6 lg:w-1/2">
                <div>
                  <h3 className="mb-2 text-2xl font-bold text-white">{feature.title}</h3>
                  <div className="mb-4 inline-block rounded-full bg-[#5ce4ab] px-3 py-1 text-sm text-black">
                    {feature.subtitle}
                  </div>
                  <p className="leading-relaxed text-gray-300">{feature.description}</p>
                </div>

                {feature.additionalInfo && (
                  <div className="rounded-2xl border border-[#2a2a2a] bg-[#181818] p-6 shadow-sm">
                    <h4 className="mb-3 font-semibold text-white">{feature.additionalInfo.title}</h4>
                    <p className="mb-3 leading-relaxed text-gray-300">{feature.additionalInfo.text}</p>
                    {feature.additionalInfo.list && (
                      <ul className="space-y-2">
                        {feature.additionalInfo.list.map(item => (
                          <li key={item} className="flex items-start text-sm text-gray-400">
                            <span className="mr-3 mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#5ce4ab]" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>


      </div>
    </section>
  );
}
