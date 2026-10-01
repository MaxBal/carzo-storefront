import { NextResponse } from 'next/server';
import { findCustomerByPhone, normalizeCustomerPhone } from '@/lib/cart/customers';

const WINDOW_MS = 60_000;
const MAX_HITS = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = hits.get(ip);
  if (!bucket || bucket.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_HITS;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: { phone?: unknown } = {};
  try {
    body = await request.json() as { phone?: unknown };
  } catch {
    return NextResponse.json({ eligible: false }, { status: 400 });
  }

  const phone = normalizeCustomerPhone(body.phone);
  if (!phone) {
    return NextResponse.json({ eligible: false, discount_percent: 0 });
  }

  try {
    const customer = await findCustomerByPhone(phone);
    if (customer) {
      return NextResponse.json({ eligible: true, discount_percent: 5 });
    }
    return NextResponse.json({ eligible: false, discount_percent: 0 });
  } catch {
    return NextResponse.json({ eligible: false, discount_percent: 0 }, { status: 502 });
  }
}
