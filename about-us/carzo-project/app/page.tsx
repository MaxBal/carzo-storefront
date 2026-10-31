const Arrow = () => <svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>;

export default function Home() {
  return <main>
    <section className="hero" id="catalog">
      <div className="intro">
        <p className="eyebrow hero-kicker"><span aria-hidden="true">🇺🇦</span><span>Виготовляємо стабільно якісно з 2020 року</span></p>
        <h1>Преміальні<br/>автоаксесуари Carzo</h1>
        <div className="material-copy">
          <p className="lead">Німецька автомобільна еко-шкіра створена для авто</p>
          <p className="material-details"><span>ВИСОКОЯКІСНА ТА ЗНОСОСТІЙКА</span></p>
        </div>
      </div>
      <div className="products">
        <a className="product product-case" href="https://carzo-eight.vercel.app/case/design/l/4-0">
          <img src="/case.jpg" alt="Чорний автокейс Carzo у багажнику"/>
          <i/><small>Магнітна система</small><strong>Premium автокейси</strong><b><Arrow/></b>
        </a>
        <a className="product product-mats" href="https://carzo-eight.vercel.app/catalog-carmat">
          <img src="/mats.png" alt="Комплект чорних автокилимків Carzo"/>
          <i/><small>Точність лекал</small><strong>Premium автокилимки</strong><b><Arrow/></b>
        </a>
      </div>
    </section>

    <section className="badges" id="badges">
      <div className="title light"><p className="eyebrow">Власне виробництво</p><h2>Високоякісні<br/>шильди</h2><p>Від фрезування металу до готової деталі — усе контролюємо самі.</p></div>
      <div className="badge-scene">
        <video className="badge-video" autoPlay muted loop playsInline preload="metadata" aria-label="Металеві автомобільні шильди Carzo">
          <source src="/carzo-badges.mp4" type="video/mp4"/>
        </video>
        <span className="video-gradient"/>
        <em>20 × 80 мм</em>
      </div>
      <div className="features">
        <article><span>01</span><h3>Фрезування металу</h3><p>Основний процес виготовлення — точне фрезування металевої основи.</p></article>
        <article><span>02</span><h3>Для виробів Carzo</h3><p>Додайте фірмовий шильд до автокейса за привабливою ціною.</p></article>
        <article><span>03</span><h3>Стандартні та індивідуальні</h3><p>Готові рішення для популярних марок та виготовлення за вашим дизайном.</p></article>
      </div>
    </section>

    <section className="quality" id="quality">
      <div className="title"><p className="eyebrow">Carzo у цифрах</p><h2>Відмінна якість<br/>продукту та обслуговування</h2></div>
      <div className="stats">
        <article><strong>15K<sup>+</sup></strong><p>задоволених клієнтів<br/>зі всієї країни</p></article>
        <article><strong>24<sup>%</sup></strong><p>клієнтів здійснюють<br/>повторну покупку</p></article>
        <article><strong>&lt;1<sup>%</sup></strong><p>звернень із проханням<br/>повернути або обміняти товар</p></article>
      </div>
    </section>
  </main>;
}
