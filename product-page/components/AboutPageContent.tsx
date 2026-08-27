'use client';

export default function AboutPageContent() {
  return (
    <>
      <style jsx global>{`
        /* ── About page ── */
        .about-page {
          background: #080808;
          color: #fff;
        }

        /* Container */
        .about-container {
          max-width: 1550px;
          margin: 0 auto;
          padding: 0 2.2vw;
        }

        /* Hero */
        .about-hero {
          padding: clamp(50px, 5vw, 80px) 0 clamp(80px, 10vw, 160px);
        }

        .about-hero .about-eyebrow {
          color: #5ce4ab;
          font-size: 12px;
          font-weight: 300;
          letter-spacing: .14em;
          line-height: 1.5;
          text-transform: uppercase;
          margin: 0 0 20px;
        }

        .about-hero h1 {
          max-width: 1120px;
          margin: 0;
          font-size: clamp(52px, 6.1vw, 108px);
          font-weight: 700;
          letter-spacing: -.075em;
          line-height: .88;
        }

        .about-hero-copy {
          margin: clamp(28px, 3vw, 48px) 0 0;
          max-width: 820px;
        }

        .about-hero-copy p {
          margin: 0 0 16px;
          color: #aaa;
          font-size: clamp(17px, 1.3vw, 21px);
          font-weight: 400;
          line-height: 1.55;
        }

        .about-hero-copy p:last-child {
          margin-bottom: 0;
        }

        /* Process section */
        .about-process {
          padding: 0 0 clamp(60px, 8vw, 120px);
        }

        /* Process block — editorial alternating layout */
        .process-block {
          display: grid;
          grid-template-columns: 1fr 1.6fr;
          gap: clamp(30px, 4vw, 80px);
          align-items: center;
          padding: clamp(50px, 6vw, 100px) 0;
          border-top: 1px solid #1e1e1e;
        }

        .process-block:last-child {
          border-bottom: 1px solid #1e1e1e;
        }

        /* Reversed block: image left, text right */
        .process-block--reversed {
          grid-template-columns: 1.6fr 1fr;
        }

        .process-block--reversed .process-text {
          order: 2;
        }

        .process-block--reversed .process-media {
          order: 1;
        }

        /* Process text */
        .process-text {
          max-width: 540px;
        }

        .process-index {
          display: block;
          margin-bottom: clamp(24px, 3vw, 48px);
          color: #5ce4ab;
          font-size: 12px;
          font-weight: 300;
          letter-spacing: .12em;
        }

        .process-text h2 {
          margin: 0 0 clamp(18px, 1.8vw, 28px);
          font-size: clamp(30px, 3vw, 48px);
          font-weight: 600;
          letter-spacing: -.05em;
          line-height: 1.05;
        }

        .process-text p {
          margin: 0 0 14px;
          color: #999;
          font-size: clamp(15px, 1.1vw, 17px);
          line-height: 1.6;
        }

        .process-text p:last-child {
          margin-bottom: 0;
        }

        /* Process media */
        .process-media {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #1e1e1e;
        }

        .process-media img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        /* Principles */
        .about-principles {
          padding: clamp(80px, 10vw, 160px) 0;
        }

        .about-section-header {
          max-width: 800px;
          margin: 0 auto clamp(50px, 6vw, 90px);
          text-align: center;
        }

        .about-section-header .about-eyebrow {
          color: #fff;
          font-size: 12px;
          font-weight: 300;
          letter-spacing: .14em;
          margin: 0 0 20px;
          text-transform: uppercase;
        }

        .about-section-header h2 {
          margin: 0;
          font-size: clamp(40px, 5vw, 80px);
          font-weight: 600;
          letter-spacing: -.06em;
          line-height: .96;
        }

        .principles-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          max-width: 1450px;
          margin: 0 auto;
        }

        .principle {
          padding: clamp(28px, 3vw, 44px) clamp(24px, 2.5vw, 40px);
          border: 1px solid #1e1e1e;
          border-right: 0;
          border-bottom: 0;
        }

        .principle:nth-child(2n) {
          border-right: 1px solid #1e1e1e;
        }

        .principle:nth-child(n+3) {
          border-bottom: 1px solid #1e1e1e;
        }

        .principle-index {
          display: block;
          margin-bottom: clamp(20px, 2.5vw, 40px);
          color: #5ce4ab;
          font-size: 11px;
          font-weight: 300;
          letter-spacing: .12em;
        }

        .principle h3 {
          margin: 0 0 14px;
          font-size: clamp(19px, 1.5vw, 24px);
          font-weight: 500;
          letter-spacing: -.03em;
        }

        .principle p {
          max-width: 420px;
          margin: 0;
          color: #8e8e8e;
          font-size: clamp(14px, 1vw, 16px);
          line-height: 1.6;
        }

        /* Development */
        .about-development {
          padding: clamp(80px, 10vw, 160px) 0;
        }

        .development-inner {
          display: flex;
          align-items: flex-start;
          gap: clamp(40px, 5vw, 100px);
          max-width: 1200px;
        }

        .development-year {
          display: flex;
          align-items: baseline;
          gap: 16px;
          flex-shrink: 0;
        }

        .year-start {
          font-size: clamp(60px, 7vw, 120px);
          font-weight: 700;
          letter-spacing: -.06em;
          line-height: .85;
          color: #fff;
        }

        .year-arrow {
          font-size: clamp(32px, 3vw, 56px);
          color: #5ce4ab;
          font-weight: 200;
          line-height: 1;
        }

        .development-copy {
          padding-top: clamp(10px, 1.5vw, 28px);
        }

        .development-copy h2 {
          margin: 0 0 clamp(16px, 1.5vw, 24px);
          font-size: clamp(24px, 2.2vw, 36px);
          font-weight: 600;
          letter-spacing: -.04em;
          line-height: 1.1;
        }

        .development-copy p {
          max-width: 560px;
          margin: 0;
          color: #999;
          font-size: clamp(15px, 1.1vw, 17px);
          line-height: 1.6;
        }

        /* Final statement */
        .about-statement {
          padding: clamp(80px, 10vw, 160px) 0 clamp(100px, 12vw, 200px);
          border-top: 1px solid #1e1e1e;
        }

        .statement-text {
          max-width: 960px;
          margin: 0 auto;
          font-size: clamp(26px, 3.2vw, 52px);
          font-weight: 400;
          letter-spacing: -.05em;
          line-height: 1.12;
          text-align: center;
        }

        .statement-accent {
          color: #5ce4ab;
        }

        /* ── About responsive ── */

        /* Tablet */
        @media (max-width: 900px) {
          .about-container {
            padding: 0 20px;
          }

          .about-hero {
            padding: 50px 0 80px;
          }

          .about-hero h1 {
            font-size: clamp(44px, 11vw, 72px);
          }

          .process-block,
          .process-block--reversed {
            grid-template-columns: 1fr;
            gap: 32px;
          }

          .process-block--reversed .process-text {
            order: 0;
          }

          .process-block--reversed .process-media {
            order: 0;
          }

          .process-text {
            max-width: none;
          }

          .principles-grid {
            grid-template-columns: 1fr;
          }

          .principle {
            border-right: 1px solid #1e1e1e !important;
            border-bottom: 0 !important;
          }

          .principle:last-child {
            border-bottom: 1px solid #1e1e1e !important;
          }

          .development-inner {
            flex-direction: column;
            gap: 24px;
          }
        }

        /* Small mobile */
        @media (max-width: 560px) {
          .about-container {
            padding: 0 16px;
          }

          .about-hero {
            padding: 40px 0 60px;
          }

          .about-hero h1 {
            font-size: clamp(38px, 10.5vw, 56px);
          }

          .about-hero-copy p {
            font-size: 16px;
          }

          .process-block {
            padding: 40px 0;
          }

          .process-media {
            border-radius: 10px;
          }

          .process-text h2 {
            font-size: 26px;
          }

          .about-principles {
            padding: 70px 0;
          }

          .about-section-header {
            text-align: left;
            margin-bottom: 40px;
          }

          .about-section-header h2 {
            font-size: 38px;
          }

          .principle {
            padding: 24px 20px;
          }

          .principle h3 {
            font-size: 18px;
          }

          .principle p {
            font-size: 14px;
          }

          .about-development {
            padding: 70px 0;
          }

          .year-start {
            font-size: 56px;
          }

          .year-arrow {
            font-size: 28px;
          }

          .development-copy h2 {
            font-size: 22px;
          }

          .development-copy p {
            font-size: 15px;
          }

          .about-statement {
            padding: 70px 0 90px;
          }

          .statement-text {
            font-size: 24px;
            text-align: left;
          }
        }
      `}</style>

      <main className="about-page">
        {/* Hero */}
        <section className="about-hero">
          <div className="about-container">
            <p className="about-eyebrow">Про нас</p>
            <h1>
              Робимо добре те,
              <br />
              за&nbsp;що беремося
            </h1>
            <div className="about-hero-copy">
              <p>
                Carzo&nbsp;— український бренд автомобільних аксесуарів, який ми
                розвиваємо з&nbsp;2020&nbsp;року.
              </p>
              <p>
                Розробляємо продукцію та&nbsp;відповідаємо за&nbsp;її якість
                на&nbsp;всіх етапах&nbsp;— від&nbsp;задуму до&nbsp;готового виробу.
                Для нас важливі якісні матеріали, продумані рішення, акуратне
                виконання й&nbsp;увага до&nbsp;деталей.
              </p>
            </div>
          </div>
        </section>

        {/* Three key blocks */}
        <section className="about-process">
          <div className="about-container">
            {/* Block 01 */}
            <div className="process-block">
              <div className="process-text">
                <span className="process-index">01</span>
                <h2>Розробляємо самостійно</h2>
                <p>
                  Ми не працюємо з&nbsp;готовими типовими рішеннями. Конструкції,
                  лекала та&nbsp;ключові елементи продуктів розробляємо самостійно.
                </p>
                <p>
                  Для автомобільних килимків створюємо власні лекала під конкретні
                  моделі авто, приділяючи увагу точності геометрії та&nbsp;посадки.
                  Для автокейсів розробляємо конструкцію, розміри й&nbsp;функціональні
                  елементи.
                </p>
              </div>
              <div className="process-media">
                <img
                  src="/about-design.png"
                  alt="Розробка продукції Carzo"
                  width={1672}
                  height={941}
                />
              </div>
            </div>

            {/* Block 02 — reversed */}
            <div className="process-block process-block--reversed">
              <div className="process-text">
                <span className="process-index">02</span>
                <h2>Виготовляємо на&nbsp;власному виробництві</h2>
                <p>
                  Власне виробництво дає змогу контролювати всі етапи роботи:
                  поведінку матеріалів, точність виготовлення та&nbsp;поєднання
                  деталей, якість виконання й&nbsp;можливості для вдосконалення
                  технології.
                </p>
                <p>
                  Це також дозволяє оперативно впроваджувати зміни, коли вони
                  роблять продукт кращим.
                </p>
              </div>
              <div className="process-media">
                <img
                  src="/about-production.png"
                  alt="Власне виробництво Carzo"
                  width={1672}
                  height={941}
                />
              </div>
            </div>

            {/* Block 03 */}
            <div className="process-block">
              <div className="process-text">
                <span className="process-index">03</span>
                <h2>Перевіряємо на&nbsp;практиці</h2>
                <p>
                  Перед запуском у&nbsp;продаж нові продукти тестуємо
                  самостійно&nbsp;— оцінюємо зручність, надійність, зносостійкість
                  і&nbsp;поведінку матеріалів у&nbsp;щоденній експлуатації.
                </p>
                <p>
                  Автомобільні килимки Carzo протягом пів року тестували у&nbsp;власному
                  автомобілі: перевіряли точність посадки, зручність користування
                  та&nbsp;стійкість до&nbsp;різних умов. Лише після цього продукт
                  запустили в&nbsp;продаж.
                </p>
              </div>
              <div className="process-media">
                <img
                  src="/about-testing.png"
                  alt="Практичне тестування продукції Carzo"
                  width={1672}
                  height={941}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="about-principles">
          <div className="about-container">
            <div className="about-section-header">
              <p className="about-eyebrow">Наш підхід</p>
              <h2>Наші принципи</h2>
            </div>
            <div className="principles-grid">
              <article className="principle">
                <span className="principle-index">01</span>
                <h3>Відповідальність за&nbsp;результат</h3>
                <p>
                  Клієнт обирає Carzo&nbsp;— отже, відповідальність за&nbsp;якість
                  продукту лежить на&nbsp;нас, незалежно від&nbsp;матеріалів,
                  постачальників чи окремих виробничих процесів.
                </p>
              </article>
              <article className="principle">
                <span className="principle-index">02</span>
                <h3>Практичність у&nbsp;кожному рішенні</h3>
                <p>
                  Кожен елемент має зрозуміле призначення. Якщо рішення
                  не&nbsp;робить продукт зручнішим, надійнішим або
                  функціональнішим, у&nbsp;ньому немає потреби.
                </p>
              </article>
              <article className="principle">
                <span className="principle-index">03</span>
                <h3>Увага до&nbsp;деталей</h3>
                <p>
                  Точність посадки, геометрія, шви, краї, кріплення та&nbsp;інші
                  конструктивні елементи формують загальне враження
                  від&nbsp;продукту. Тому деталям ми&nbsp;приділяємо таку саму
                  увагу, як і&nbsp;конструкції загалом.
                </p>
              </article>
              <article className="principle">
                <span className="principle-index">04</span>
                <h3>Постійне вдосконалення</h3>
                <p>
                  Власний досвід, тестування та&nbsp;відгуки клієнтів допомагають
                  знаходити рішення, які можна зробити точнішими, зручнішими
                  й&nbsp;надійнішими. Жоден продукт ми&nbsp;не&nbsp;сприймаємо як
                  остаточно завершений.
                </p>
              </article>
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
                <h2>Розвиток Carzo з&nbsp;2020&nbsp;року</h2>
                <p>
                  Для нас розвиток&nbsp;— це не&nbsp;лише роки роботи чи кількість
                  проданих виробів, а&nbsp;передусім те, як змінюється продукт
                  і&nbsp;наскільки кращою стає кожна його наступна версія.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final statement */}
        <section className="about-statement">
          <div className="about-container">
            <p className="statement-text">
              Ми самостійно розробляємо та&nbsp;виготовляємо продукцію Carzo
              й&nbsp;відповідаємо за&nbsp;кожен продукт, що&nbsp;виходить{" "}
              <span className="statement-accent">під&nbsp;нашим брендом.</span>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
