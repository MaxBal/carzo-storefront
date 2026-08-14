import Link from 'next/link';
import Image from 'next/image';

const footerLinks = [
  { href: '/public-offer', label: 'Публічна оферта' },
  { href: '/delivery-and-payment', label: 'Доставка та оплата' },
  { href: '/privacy-policy', label: 'Політика конфіденційності' },
];

export default function PageFooter() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center">
            <Image src="/carzo-logo-tight.svg" alt="CARZO" width={110} height={20} />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-gray-400">
            Автомобільні органайзери, створені для порядку, комфорту та довгої експлуатації.
          </p>
        </div>
        <nav className="flex flex-col gap-3 text-sm text-gray-300" aria-label="Юридична інформація">
          {footerLinks.map(link => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} CARZO. Designed and manufactured in Ukraine.
      </div>
    </footer>
  );
}
