import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Про нас — Carzo",
  description:
    "Carzo — український бренд автомобільних аксесуарів. Розробляємо, виготовляємо та тестуємо продукцію самостійно.",
};

export default function AboutPage() {
  return (
    <main className="about">
      {/* Hero */}
      <section className="about-hero">
        <div className="about-container">
          <p className="eyebrow">Про нас</p>
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
            <p className="eyebrow">Наш підхід</p>
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
  );
}
