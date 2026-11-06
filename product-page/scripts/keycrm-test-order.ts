/**
 * One-shot REAL keyCRM test order (Phase 2A).
 *
 * Default mode is DRY RUN: builds and prints the payload, sends nothing.
 * A real POST happens only when BOTH gates are set:
 *   1. CLI flag:            --send
 *   2. Environment confirm: KEYCRM_TEST_POST_CONFIRM=yes
 * plus KEYCRM_API_KEY in the environment (or product-page/.env.local via --env-file).
 *
 * The script talks ONLY to openapi.keycrm.app — it never touches Supabase,
 * Telegram or the storefront checkout. Buyer data below is test placeholder
 * data, not a real customer.
 *
 * Usage (dry run):
 *   pnpm exec tsx scripts/keycrm-test-order.ts
 * Real send (only with explicit owner approval):
 *   KEYCRM_TEST_POST_CONFIRM=yes pnpm exec tsx scripts/keycrm-test-order.ts --send
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildKeyCrmOrder } from '../lib/keycrm/order-payload';
import type { KeyCrmOrderPayload } from '../lib/keycrm/types';

// ---- Approved Phase 2A configuration (from the live keyCRM cabinet) ----
const CONFIG = {
  sourceId: 6, // "Сайт Carzo"
  deliveryServiceId: 1, // "Нова Пошта"
  contactMethodFieldUuid: 'OR_1007',
};

const SOURCE_UUID = 'CZ-TEST-2A-0001';

/**
 * Test composition (per owner spec):
 *   M4.0 × 2 — 1 шт. BMW + фікс.на стінці, 1 шт. Toyota + фікс.дно+стінка
 *   BMW-ST × 1, TOYOTA-ST × 1, FIX-M-DW × 1
 *   Sum before discounts: 2249×2 + 290 + 290 + 80 = 5158 ₴
 */
function buildTestPayload(): KeyCrmOrderPayload {
  return buildKeyCrmOrder({
    orderNumber: SOURCE_UUID,
    customerName: 'ТЕСТ Carzo — не відправляти',
    customerPhone: '+380000000000',
    customerComment: 'Фаза 2A — інтеграційний тест keyCRM. Скасувати після перевірки.',
    contactMethod: 'telegram',
    deliveryMethod: 'BRANCH',
    deliveryCityName: 'Київ',
    deliveryPointRef: null,
    deliveryPointNumber: '999',
    deliveryPointName: 'ТЕСТОВЕ відділення',
    deliveryPointAddress: 'вул. Тестова, 1',
    subtotal: 5158,
    quantityDiscount: 0,
    loyaltyDiscountAmount: 0,
    total: 5158,
    lines: [
      {
        sizeCode: 'M',
        designSlug: '4-0',
        brandSlug: 'bmw',
        brandName: 'BMW',
        fixationKey: 'wall',
        fixationLabel: 'фікс.на стінці',
        quantity: 1,
        unitPrice: 2539,
        basePrice: 2249,
        logoExtra: 290,
        fixationExtra: 0,
      },
      {
        sizeCode: 'M',
        designSlug: '4-0',
        brandSlug: 'toyota',
        brandName: 'Toyota',
        fixationKey: 'both',
        fixationLabel: 'фікс.дно+стінка',
        quantity: 1,
        unitPrice: 2619,
        basePrice: 2249,
        logoExtra: 290,
        fixationExtra: 80,
      },
    ],
  }, CONFIG);
}

function loadApiKey(): string | null {
  if (process.env.KEYCRM_API_KEY?.trim()) return process.env.KEYCRM_API_KEY.trim();
  try {
    const envLocal = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
    const match = envLocal.match(/^KEYCRM_API_KEY=(.*)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

async function main() {
  const payload = buildTestPayload();

  const sum = payload.products.reduce((total, item) => total + item.price * item.quantity, 0);
  console.log('--- payload (dry run) ---');
  console.log(JSON.stringify(payload, null, 2));
  console.log(`--- checks: source_id=${payload.source_id} source_uuid=${payload.source_uuid} positions_sum=${sum} discount=${payload.discount_amount ?? 0} ---`);

  const wantsSend = process.argv.includes('--send');
  const confirmed = process.env.KEYCRM_TEST_POST_CONFIRM === 'yes';
  if (!wantsSend || !confirmed) {
    console.log('DRY RUN only — nothing was sent. To send one real POST: pass --send AND KEYCRM_TEST_POST_CONFIRM=yes.');
    return;
  }

  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error('KEYCRM_API_KEY is missing — aborting.');
    process.exitCode = 1;
    return;
  }

  console.log('Sending ONE real POST to keyCRM…');
  const response = await fetch('https://openapi.keycrm.app/v1/order', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  console.log(`HTTP ${response.status}`);
  console.log(`created order id: ${parsed.id ?? '(none)'}, source_uuid: ${parsed.source_uuid ?? SOURCE_UUID}`);
  if (!response.ok) {
    console.log('response body:', text.slice(0, 500));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('test order script failed:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
});
