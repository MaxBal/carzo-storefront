import type { Metadata } from 'next';
import Header from '@/components/Header';
import CarmatPageContent from './CarmatPageContent';
import { getCarMatDesigns, getCarMatMediaPlaceholder } from '@/lib/content/car-mat-designs';
import { getSiteFlag } from '@/lib/content/site-flag';

export const metadata: Metadata = {
  title: 'Автокилимки Carzo — преміальні автомобільні килимки',
  description: 'Автокилимки Carzo з німецької еко-шкіри. Розраховані для щоденної експлуатації роками.',
};

export default async function CarmatPage() {
  const [designs, placeholderImage, siteFlag] = await Promise.all([
    getCarMatDesigns(),
    getCarMatMediaPlaceholder(),
    getSiteFlag(),
  ]);

  return (
    <>
      <Header siteFlag={siteFlag} />
      <CarmatPageContent designs={designs} placeholderImage={placeholderImage} />
    </>
  );
}
