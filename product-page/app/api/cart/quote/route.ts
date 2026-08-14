import { cartItemsSchema } from '@/lib/cart/validation';
import { CartQuoteError, quoteCartItems } from '@/lib/cart/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = cartItemsSchema.safeParse((body as { items?: unknown } | null)?.items);
    if (!parsed.success) {
      return Response.json({ error: 'Перевірте товари у кошику.' }, { status: 400 });
    }
    const quote = await quoteCartItems(parsed.data);
    return Response.json(quote, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const unavailable = error instanceof CartQuoteError && error.code === 'UNAVAILABLE';
    const message = error instanceof CartQuoteError
      ? error.message
      : 'Не вдалося перерахувати кошик. Спробуйте ще раз.';
    return Response.json({ error: message }, { status: unavailable ? 503 : 400 });
  }
}
