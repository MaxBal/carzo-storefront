import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatOrderItemsSummary } from '../lib/cart/order-items-summary';

describe('formatOrderItemsSummary', () => {
  it('includes title, quantity, line total and human-readable fixation label', () => {
    const summary = formatOrderItemsSummary([
      {
        title: 'Автокейс M Carzo 3.0 для Volvo',
        quantity: 1,
        lineTotal: 2619,
        fixationLabel: 'На дні + на стінці',
      },
      {
        title: 'Автокейс S Carzo 3.0',
        quantity: 1,
        lineTotal: 1790,
        fixationLabel: 'На дні',
      },
    ]);

    assert.equal(
      summary,
      [
        '• Автокейс M Carzo 3.0 для Volvo × 1 — 2619 ₴',
        '  Фіксація: На дні + на стінці',
        '• Автокейс S Carzo 3.0 × 1 — 1790 ₴',
        '  Фіксація: На дні',
      ].join('\n'),
    );
  });

  it('keeps the bullet line when fixation label is empty', () => {
    const summary = formatOrderItemsSummary([
      {
        title: 'Автокейс S Carzo 3.0',
        quantity: 2,
        lineTotal: 3580,
        fixationLabel: '   ',
      },
    ]);
    assert.equal(summary, '• Автокейс S Carzo 3.0 × 2 — 3580 ₴');
  });

  it('returns empty string for no items', () => {
    assert.equal(formatOrderItemsSummary([]), '');
  });
});
