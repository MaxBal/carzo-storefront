import type { Metadata } from 'next';
import Header from '@/components/Header';
import { Clock, Factory, MessageSquare, Flag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Про нас',
  description: 'Carzo — український бренд автомобільних органайзерів і килимків. Створюємо порядок в автомобілі з 2020 року.',
};

const advantages = [
  {
    icon: Clock,
    title: '5 років досвіду',
    text: 'Розвиваємо продукт та працюємо з клієнтами з 2020 року.',
  },
  {
    icon: Factory,
    title: 'Власне виробництво',
    text: 'Контролюємо кожен етап виготовлення від матеріалів до готового виробу.',
  },
  {
    icon: MessageSquare,
    title: 'Сотні реальних відгуків',
    text: 'Довіра клієнтів — наша найкраща рекомендація.',
  },
  {
    icon: Flag,
    title: 'Зроблено в Україні',
    text: 'Український бренд з виробництвом в Україні.',
  },
];

const principles = [
  {
    title: 'Продумана конструкція',
    text: 'Форма, розміри та внутрішній простір створені для зручного щоденного використання.',
  },
  {
    title: 'Практичні матеріали',
    text: 'Використовуємо автомобільну еко-шкіру та матеріали, які легко очищувати й підтримувати в охайному стані.',
  },
  {
    title: 'Контроль якості',
    text: 'Перевіряємо вироби на ключових етапах, щоб клієнт отримав акуратний і функціональний продукт.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main>
        {/* Hero */}
        <section className="px-4 pt-16 pb-20 sm:px-6 sm:pt-20 sm:pb-24 lg:px-8 lg:pt-28 lg:pb-32">
          <div className="mx-auto max-w-[720px] text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.28em] text-[#5ce4ab]">ПРО CARZO</p>
            <h1 className="mt-5 text-[32px] font-black leading-tight tracking-tight text-black sm:text-[40px] lg:text-[48px]">
              Створюємо порядок в автомобілі з 2020 року
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-[16px] leading-relaxed text-gray-600 sm:text-[17px]">
              Carzo — український бренд автомобільних органайзерів і килимків. Ми поєднуємо практичність, продуману конструкцію та охайний дизайн, щоб кожна поїздка була комфортнішою.
            </p>
          </div>
        </section>

        {/* Advantages */}
        <section className="bg-[#fafafa] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8">
            {advantages.map(item => (
              <div key={item.title} className="rounded-[16px] border border-gray-200 bg-white p-5 sm:p-6">
                <item.icon size={28} strokeWidth={1.5} className="mb-4 text-black" />
                <h3 className="mb-2 text-[15px] font-semibold text-black sm:text-[16px]">{item.title}</h3>
                <p className="text-[13px] leading-relaxed text-gray-500 sm:text-[14px]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Brand story */}
        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-[720px]">
            <h2 className="text-[24px] font-bold leading-tight text-black sm:text-[28px] lg:text-[32px]">
              Від ідеї до продуманого продукту
            </h2>
            <div className="mt-6 space-y-5">
              <p className="text-[15px] leading-relaxed text-gray-600 sm:text-[16px]">
                Carzo з&apos;явився з простого бажання зробити багажник автомобіля охайним і зручним у щоденному використанні. Ми послідовно вдосконалюємо конструкцію, добираємо практичні матеріали та враховуємо реальний досвід власників авто.
              </p>
              <p className="text-[15px] leading-relaxed text-gray-600 sm:text-[16px]">
                Кожен виріб має бути не лише привабливим, а й витримувати повсякденне навантаження, легко встановлюватися та допомагати зберігати речі на своїх місцях.
              </p>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="bg-[#fafafa] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-[1280px]">
            <h2 className="mb-10 text-center text-[24px] font-bold text-black sm:text-[28px] lg:text-[32px]">
              Що для нас важливо
            </h2>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
              {principles.map(item => (
                <div key={item.title} className="rounded-[16px] border border-gray-200 bg-white p-6 sm:p-8">
                  <h3 className="mb-3 text-[16px] font-semibold text-black sm:text-[17px]">{item.title}</h3>
                  <p className="text-[14px] leading-relaxed text-gray-500 sm:text-[15px]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final brand section */}
        <section className="bg-black px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-[720px] text-center">
            <h2 className="text-[24px] font-bold leading-tight text-white sm:text-[28px] lg:text-[32px]">
              Carzo — порядок, що залишається з вами в дорозі
            </h2>
            <p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-relaxed text-gray-400 sm:text-[16px]">
              Ми продовжуємо розвивати продукти для автомобіля, спираючись на досвід клієнтів, якість виконання та чесний український сервіс.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
