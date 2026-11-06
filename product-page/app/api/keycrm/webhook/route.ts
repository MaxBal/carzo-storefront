import { NextResponse } from 'next/server';

import { upsertCustomerByPhone } from '@/lib/cart/customers';
import { getKeyCrmOrder } from '@/lib/keycrm/client';
import { handleKeyCrmOrderStatusWebhook } from '@/lib/keycrm/webhook';

const WINDOW_MS = 60_000;
const MAX_HITS = 30;
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

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');

  const result = await handleKeyCrmOrderStatusWebhook(body, secret, {
    getOrder: async (orderId) => {
      const order = await getKeyCrmOrder(orderId, 'buyer');
      return {
        id: Number(order.id ?? orderId),
        status_id: Number(order.status_id ?? 0),
        buyer: (order.buyer ?? null) as { phone?: string | null; full_name?: string | null } | null,
      };
    },
    upsertCustomer: async (input) => upsertCustomerByPhone({
      phone: input.phone,
      fullName: input.fullName,
      source: input.source,
      imported: input.imported,
    }),
    logError: (message, detail) => {
      console.error(message, { detail });
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
