'use client';

import '@/app/about.css';
import type { AboutData } from '@/lib/content/about';

interface AboutPageContentProps {
  data: AboutData;
}

export default function AboutPageContent({ data }: AboutPageContentProps) {
  return (
    <main className="about-page">
      {/* Hero */}
      <section className="about-hero">
        <div className="about-container">
          <p className="about-eyebrow">{data.hero.eyebrow}</p>
          <h1>
            {data.hero.title.split('\n').map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>
          <div className="about-hero-copy">
            <p>{data.hero.paragraph1}</p>
            <p>{data.hero.paragraph2}</p>
          </div>
        </div>
      </section>

      {/* Three key blocks */}
      <section className="about-process">
        <div className="about-container">
          {data.processBlocks.map((block, i) => {
            const processImages = [data.processImage1, data.processImage2, data.processImage3];
            return (
              <div
                key={block.index}
                className={`process-block${i % 2 === 1 ? ' process-block--reversed' : ''}`}
              >
                <div className="process-text">
                  <span className="process-index">{block.index}</span>
                  <h2>{block.title}</h2>
                  <p>{block.paragraph1}</p>
                  <p>{block.paragraph2}</p>
                </div>
                <div className="process-media">
                  <img
                    src={processImages[i]}
                    alt={block.title}
                    width={1672}
                    height={941}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Principles */}
      <section className="about-principles">
        <div className="about-container">
          <div className="about-section-header">
            <p className="about-eyebrow">{data.principles.eyebrow}</p>
            <h2>{data.principles.title}</h2>
          </div>
          <div className="principles-grid">
            {data.principles.items.map((item) => (
              <article key={item.index} className="principle">
                <span className="principle-index">{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Development since 2020 */}
      <section className="about-development">
        <div className="about-container">
          <div className="development-inner">
            <div className="development-year">
              <span className="year-start">2020</span>
              <span className="year-arrow">&rarr;</span>
            </div>
            <div className="development-copy">
              <h2>{data.development.title}</h2>
              <p>{data.development.text}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final statement */}
      <section className="about-statement">
        <div className="about-container">
          <p className="statement-text">
            {data.statement.text.replace(
              /під нашим брендом\.?$/,
              '',
            )}
            <span className="statement-accent">під&nbsp;нашим брендом.</span>
          </p>
        </div>
      </section>
    </main>
  );
}
