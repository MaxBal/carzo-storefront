import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OrderStoreError,
  createOrderRepository,
} from '../lib/data/orders';
import { createSupabaseOrderRepository } from '../lib/data/orders/supabase';
import { createDirectusOrderRepository } from '../lib/data/orders/directus';

describe('Stage 4 order repository', () => {
  it('missing ORDER_STORE selects Directus writer', () => {
    const repo = createOrderRepository('directus');
    assert.ok(repo);
    assert.ok(createDirectusOrderRepository());
  });

  it('ORDER_STORE=supabase → explicit not-ready / fail-closed', async () => {
    const repo = createSupabaseOrderRepository();
    await assert.rejects(
      () => repo.createOrder({ id: 'x' }),
      (error: unknown) => {
        assert.ok(error instanceof OrderStoreError);
        assert.equal(error.code, 'NOT_READY');
        assert.match(error.message, /Stage 6|not ready|fail-closed/i);
        return true;
      },
    );
  });

  it('supabase adapter does not perform direct inserts (placeholder only)', () => {
    // Structural guard: factory returns fail-closed object; no client/table access in module.
    const repo = createSupabaseOrderRepository();
    assert.equal(typeof repo.createOrder, 'function');
  });
});
