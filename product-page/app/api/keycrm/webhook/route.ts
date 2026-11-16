import { NextResponse } from 'next/server';

import { upsertCustomerByPhone } from '@/lib/cart/customers';
import { getKeyCrmOrder } from '@/lib/keycrm/client';
import {
  extractKeyCrmWebhookSecret,
  handleKeyCrmOrderStatusWebhook,
  isKeyCrmAuthenticatedRateLimited,
  isKeyCrmUnauthorizedFlood,
  verifyKeyCrmWebhookAuth,
} from '@/lib/keycrm/webhook';

export async function POST(request: Request) {
  // Verify webhook secret BEFORE consuming authenticated rate-limit quota or parsing JSON body,
  // so unauthenticated scanners cannot lock out legitimate keyCRM webhook deliveries (C-08).
  const secret = extractKeyCrmWebhookSecret(request);
  const auth = verifyKeyCrmWebhookAuth(secret);
  if (!auth.ok) {
    if (auth.status === 401) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      if (isKeyCrmUnauthorizedFlood(ip)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    }
    return NextResponse.json(auth.body, { status: auth.status });
  }

  if (isKeyCrmAuthenticatedRateLimited()) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

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
