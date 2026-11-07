import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { itemsCountLabel, money } from '../components/cart/CartLineItems';

describe('itemsCountLabel', () => {
  it('uses the singular form for 1', () => {
    assert.equal(itemsCountLabel(1), '1 товар');
  });

  it('uses the paucal form for 2–4', () => {
    assert.equal(itemsCountLabel(2), '2 товари');
    assert.equal(itemsCountLabel(3), '3 товари');
    assert.equal(itemsCountLabel(4), '4 товари');
    assert.equal(itemsCountLabel(22), '22 товари');
  });

  it('uses the genitive plural for 5+ and teen numbers', () => {
    assert.equal(itemsCountLabel(5), '5 товарів');
    assert.equal(itemsCountLabel(11), '11 товарів');
    assert.equal(itemsCountLabel(12), '12 товарів');
    assert.equal(itemsCountLabel(14), '14 товарів');
    assert.equal(itemsCountLabel(20), '20 товарів');
  });
});

describe('money', () => {
  it('formats whole UAH with uk-UA grouping', () => {
    // uk-UA groups thousands with a no-break space — normalize before comparing.
    const normalize = (value: string) => value.replace(/[  \s]/g, ' ');
    assert.equal(normalize(money(4870)), '4 870');
    assert.equal(normalize(money(200)), '200');
    assert.equal(normalize(money(0)), '0');
  });
});
