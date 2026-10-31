import Image from 'next/image';

const RETURN_MESSAGE = 'Повернення та обмін на протязі 14 днів безкоштовно';

export default function NovaPoshtaTrustRow() {
  return (
    <div data-nova-poshta-trust className="mt-3 flex min-w-0 items-center justify-center gap-2 text-xs font-normal leading-4 text-gray-500">
      <Image
        src="/nova-poshta-logomark-red.svg"
        alt="Нова пошта"
        width={20}
        height={20}
        className="h-5 w-5 shrink-0"
      />
      <span className="min-w-0 max-w-[23rem] break-words text-left">{RETURN_MESSAGE}</span>
    </div>
  );
}
