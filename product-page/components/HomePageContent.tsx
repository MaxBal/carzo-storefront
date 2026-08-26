'use client';

import '@/app/homepage.css';
import type { HomepageData } from '@/lib/content/homepage';

const Arrow = () => <svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>;

interface HomePageContentProps {
  data: HomepageData;
}

export default function HomePageContent({ data }: HomePageContentProps) {
  return (
    <div className="hp-root">
      <section className="hp-hero" id="catalog">
        <div className="hp-intro">
          <p className="hp-eyebrow hp-hero-kicker">
            <span aria-hidden="true">🇺🇦</span>
            <span>{data.hero.eyebrow}</span>
          </p>
          <h1>{data.hero.title}</h1>
          <div className="hp-material-copy">
            <p className="hp-lead">{data.hero.lead}</p>
            <p className="hp-material-details"><span>{data.hero.materialTag}</span></p>
          </div>
        </div>
        <div className="hp-products">
          {data.hero.products.map((product, index) => (
            <a
              key={product.href}
              className={`hp-product ${index === 0 ? 'hp-product-case' : 'hp-product-mats'}`}
              href={product.href}
            >
              <img src={product.image} alt={product.alt}/>
              <i/><small>{product.tag}</small><strong>{product.title}</strong><b><Arrow/></b>
            </a>
          ))}
        </div>
      </section>

      <section className="hp-badges" id="badges">
        <div className="hp-title hp-light"><p className="hp-eyebrow">{data.badges.eyebrow}</p><h2>{data.badges.title}</h2><p>{data.badges.description}</p></div>
        <div className="hp-badge-scene">
          <video className="hp-badge-video" autoPlay muted loop playsInline preload="metadata" aria-label="Металеві автомобільні шильди Carzo">
            <source src={data.badges.videoUrl} type="video/mp4"/>
          </video>
          <span className="hp-video-gradient"/>
          <em>{data.badges.sizeLabel}</em>
        </div>
        <div className="hp-features">
          {data.badges.features.map(feature => (
            <article key={feature.number}><span>{feature.number}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>
          ))}
        </div>
      </section>

      <section className="hp-quality" id="quality">
        <div className="hp-title"><p className="hp-eyebrow">{data.quality.eyebrow}</p><h2>{data.quality.title}</h2></div>
        <div className="hp-stats">
          {data.quality.stats.map((stat, index) => (
            <article key={index}><strong>{stat.value}<sup>{stat.suffix}</sup></strong><p>{stat.description}</p></article>
          ))}
        </div>
      </section>
    </div>
  );
}
