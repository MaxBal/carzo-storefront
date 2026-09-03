import type { ResolvedProductContent } from '@/lib/content/types';
import ManagedProductImage from '@/components/ManagedProductImage';
import MagneticSystemVideo from '@/components/MagneticSystemVideo';

interface ProductRichContentProps {
  data: ResolvedProductContent['richContent'];
}

export default function ProductRichContent({ data }: ProductRichContentProps) {
  return (
    <section
      className="mt-16 bg-[#0a0a0a] px-4 py-[90px] text-white sm:px-[2.5vw] lg:px-[3vw] lg:py-[140px]"
      aria-label="Особливості автокейсу"
    >
      <div className="mx-auto max-w-[1450px]">
        <div className="space-y-[90px] lg:space-y-[140px]">
          {data.sections.map((feature, index) => (
            <article
              key={feature.key}
              className={`flex flex-col items-center gap-8 lg:gap-16 ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              }`}
            >
              <div className="w-full lg:w-1/2">
                <div className="aspect-[4/3] overflow-hidden rounded-[18px] border border-[#282828]">
                  {feature.key === 'rich-magnets' ? (
                    <MagneticSystemVideo
                      key={`${data.magneticSystemMedia.video}:${data.magneticSystemMedia.poster}`}
                      videoSrc={data.magneticSystemMedia.video}
                      posterSrc={data.magneticSystemMedia.poster}
                      fallbackPosterSrc={data.magneticSystemMedia.fallbackPoster}
                      isPosterPlaceholder={data.magneticSystemMedia.isPosterPlaceholder}
                      alt={feature.imageAlt}
                    />
                  ) : (
                    <ManagedProductImage
                      src={feature.image}
                      fallbackSrc={feature.fallbackSrc}
                      isPlaceholder={feature.isPlaceholder}
                      alt={feature.imageAlt}
                      width={1200}
                      height={900}
                      sizes="(max-width: 1023px) 100vw, 50vw"
                      className="h-full w-full"
                    />
                  )}
                </div>
              </div>

              <div className="w-full lg:w-1/2">
                <div>
                  <h3 className="mb-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.045em] text-white lg:text-[34px]">
                    {feature.title}
                  </h3>
                  <div className="mb-4 inline-flex items-center rounded-full border border-[#333333] px-3 py-1 text-[11px] font-extralight uppercase tracking-[0.14em] text-[#5ce4ab]">
                    {feature.subtitle}
                  </div>
                  <p className="text-[16px] leading-[1.6] text-[#a2a2a2]">{feature.description}</p>
                </div>

                {feature.additionalInfo && (
                  <div className="mt-6 rounded-[16px] border border-[#292929] bg-[#141414] p-6">
                    <h4 className="mb-2 text-[16px] font-semibold tracking-[-0.02em] text-white">{feature.additionalInfo.title}</h4>
                    <p className={`text-[14px] leading-[1.55] text-[#888888] ${feature.additionalInfo.list ? 'mb-3' : ''}`}>
                      {feature.additionalInfo.text}
                    </p>
                    {feature.additionalInfo.list && (
                      <ul className="space-y-2">
                        {feature.additionalInfo.list.map(item => (
                          <li key={item} className="flex items-start text-[14px] leading-[1.55] text-[#888888]">
                            <span className="mr-3 mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#5ce4ab]" aria-hidden="true" />
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
