import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  APPROVED_SIZE_SHIPPING,
  calculateOrderPackage,
  checkPostomatPackage,
  checkWarehousePackage,
  packageLineParts,
  formatNumberUk,
  type WarehouseLimits,
} from '../lib/cart/shipping';

function line(size: string, quantity: number) {
  return { size, quantity, shippingProfile: null };
}

describe('calculateOrderPackage — approved transport packaging', () => {
  it('1 x S → 40 × 28 × 7 cm, 2 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('S', 1)]), {
      lengthCm: 40, widthCm: 28, heightCm: 7, weightKg: 2,
    });
  });

  it('1 x M → 50 × 28 × 7 cm, 2,5 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('M', 1)]), {
      lengthCm: 50, widthCm: 28, heightCm: 7, weightKg: 2.5,
    });
  });

  it('1 x L → 60 × 28 × 7 cm, 3 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('L', 1)]), {
      lengthCm: 60, widthCm: 28, heightCm: 7, weightKg: 3,
    });
  });

  it('1 x XL → 80 × 28 × 7 cm, 4 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('XL', 1)]), {
      lengthCm: 80, widthCm: 28, heightCm: 7, weightKg: 4,
    });
  });

  it('2 x M → 50 × 28 × 14 cm, 5 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('M', 2)]), {
      lengthCm: 50, widthCm: 28, heightCm: 14, weightKg: 5,
    });
  });

  it('M + L → 60 × 28 × 14 cm, 5,5 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('M', 1), line('L', 1)]), {
      lengthCm: 60, widthCm: 28, heightCm: 14, weightKg: 5.5,
    });
  });

  it('S + M + L → 60 × 28 × 21 cm, 7,5 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('S', 1), line('M', 1), line('L', 1)]), {
      lengthCm: 60, widthCm: 28, heightCm: 21, weightKg: 7.5,
    });
  });

  it('3 x XL → 80 × 28 × 21 cm, 12 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('XL', 3)]), {
      lengthCm: 80, widthCm: 28, heightCm: 21, weightKg: 12,
    });
  });

  it('4 x L → 60 × 28 × 28 cm, 12 kg', () => {
    assert.deepEqual(calculateOrderPackage([line('L', 4)]), {
      lengthCm: 60, widthCm: 28, heightCm: 28, weightKg: 12,
    });
  });

  it('empty cart has no package', () => {
    assert.equal(calculateOrderPackage([]), null);
    assert.equal(calculateOrderPackage([line('M', 0)]), null);
  });

  it('DB shippingProfile overrides the approved fallback', () => {
    const pkg = calculateOrderPackage([{
      size: 'S',
      quantity: 1,
      shippingProfile: { lengthCm: 41, widthCm: 29, heightCm: 8, weightKg: 2.2 },
    }]);
    assert.deepEqual(pkg, { lengthCm: 41, widthCm: 29, heightCm: 8, weightKg: 2.2 });
  });

  it('badges and fixations do not change the package', () => {
    const pkg = calculateOrderPackage([
      { size: 'M', quantity: 1, shippingProfile: APPROVED_SIZE_SHIPPING.M },
    ]);
    assert.deepEqual(pkg, { lengthCm: 50, widthCm: 28, heightCm: 7, weightKg: 2.5 });
  });
});

describe('checkPostomatPackage — 60 × 40 × 30 cm, 20 kg', () => {
  it('fits: 2 x M (50 × 28 × 14, 5 kg)', () => {
    const check = checkPostomatPackage(calculateOrderPackage([line('M', 2)])!);
    assert.equal(check.status, 'fits');
    assert.deepEqual(check.exceeded, []);
  });

  it('fits: M + L (60 × 28 × 14, 5,5 kg)', () => {
    assert.equal(checkPostomatPackage(calculateOrderPackage([line('M', 1), line('L', 1)])!).status, 'fits');
  });

  it('fits: 1 x S — postomat is allowed for any case count that fits', () => {
    assert.equal(checkPostomatPackage(calculateOrderPackage([line('S', 1)])!).status, 'fits');
    assert.equal(checkPostomatPackage(calculateOrderPackage([line('S', 3)])!).status, 'fits');
  });

  it('exceeds length: 1 x XL (80 cm)', () => {
    const check = checkPostomatPackage(calculateOrderPackage([line('XL', 1)])!);
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded, ['lengthCm']);
  });

  it('stacked cases can still fit by side order (no box rotation needed)', () => {
    // 5 x L → 60 × 28 × 35 cm: sides 60/35/28 map onto 60/40/30 — fits.
    assert.equal(checkPostomatPackage(calculateOrderPackage([line('L', 5)])!).status, 'fits');
  });

  it('exceeds when the second-largest side is over the limit', () => {
    // 6 x L → 60 × 28 × 42 cm: 42 > 40 in the largest-to-largest match.
    const check = checkPostomatPackage(calculateOrderPackage([line('L', 6)])!);
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded, ['heightCm']);
  });

  it('exceeds weight while the sides still fit', () => {
    const check = checkPostomatPackage({
      lengthCm: 50, widthCm: 28, heightCm: 14, weightKg: 22.5,
    });
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded, ['weightKg']);
  });

  it('weight exactly at 20 kg still fits', () => {
    assert.equal(checkPostomatPackage({
      lengthCm: 50, widthCm: 28, heightCm: 14, weightKg: 20,
    }).status, 'fits');
  });

  it('highlights multiple exceeded parameters', () => {
    // 3 x XL → 80 × 28 × 21, 12 kg: only length exceeds side limits
    // 8 x XL → 80 × 28 × 56, 32 kg: length + height + weight
    const check = checkPostomatPackage(calculateOrderPackage([line('XL', 8)])!);
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded.sort(), ['heightCm', 'lengthCm', 'weightKg']);
  });

  it('stricter per-postomat API limits apply on top of the standard ones', () => {
    const pkg = calculateOrderPackage([line('M', 2)])!; // 50 × 28 × 14, 5 kg — fits standard
    const limits: WarehouseLimits = {
      totalMaxWeightKg: 3,
      placeMaxWeightKg: null,
      sendingMaxDimensionsCm: null,
      denyToSelect: false,
    };
    const check = checkPostomatPackage(pkg, limits);
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded, ['weightKg']);
  });

  it('denyToSelect marks the point unusable', () => {
    const pkg = calculateOrderPackage([line('S', 1)])!;
    const check = checkPostomatPackage(pkg, {
      totalMaxWeightKg: null,
      placeMaxWeightKg: null,
      sendingMaxDimensionsCm: null,
      denyToSelect: true,
    });
    assert.equal(check.status, 'exceeds');
  });
});

describe('checkWarehousePackage — branch limitations', () => {
  const pkg = calculateOrderPackage([line('L', 2)])!; // 60 × 28 × 14, 6 kg

  it('fits a branch that allows the max side and the weight', () => {
    const check = checkWarehousePackage(pkg, {
      totalMaxWeightKg: 300,
      placeMaxWeightKg: 30,
      sendingMaxDimensionsCm: { lengthCm: 120, widthCm: 100, heightCm: 100 },
      denyToSelect: false,
    });
    assert.equal(check.status, 'fits');
  });

  it('exceeds when the longest side is over the limit and highlights only that side', () => {
    const check = checkWarehousePackage(pkg, {
      totalMaxWeightKg: 300,
      placeMaxWeightKg: 30,
      sendingMaxDimensionsCm: { lengthCm: 50, widthCm: 40, heightCm: 30 },
      denyToSelect: false,
    });
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded, ['lengthCm']);
  });

  it('exceeds weight against the stricter of total/place limits', () => {
    const check = checkWarehousePackage(pkg, {
      totalMaxWeightKg: 300,
      placeMaxWeightKg: 5,
      sendingMaxDimensionsCm: null,
      denyToSelect: false,
    });
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded, ['weightKg']);
  });

  it('highlights side and weight together', () => {
    const check = checkWarehousePackage(pkg, {
      totalMaxWeightKg: 1,
      placeMaxWeightKg: null,
      sendingMaxDimensionsCm: { lengthCm: 50, widthCm: 40, heightCm: 30 },
      denyToSelect: false,
    });
    assert.equal(check.status, 'exceeds');
    assert.deepEqual(check.exceeded.sort(), ['lengthCm', 'weightKg']);
  });

  it('missing API limits are unknown — never a fake green and never a block', () => {
    assert.equal(checkWarehousePackage(pkg, null).status, 'unknown');
    assert.equal(checkWarehousePackage(pkg, {
      totalMaxWeightKg: null,
      placeMaxWeightKg: null,
      sendingMaxDimensionsCm: null,
      denyToSelect: false,
    }).status, 'unknown');
  });

  it('zero limits from the API are not treated as real limits', () => {
    assert.equal(checkWarehousePackage(pkg, {
      totalMaxWeightKg: 0,
      placeMaxWeightKg: 0,
      sendingMaxDimensionsCm: { lengthCm: 0, widthCm: 0, heightCm: 0 },
      denyToSelect: false,
    }).status, 'unknown');
  });

  it('partial limits: weight confirmed and passing → fits without dimension data', () => {
    assert.equal(checkWarehousePackage(pkg, {
      totalMaxWeightKg: 10,
      placeMaxWeightKg: 10,
      sendingMaxDimensionsCm: null,
      denyToSelect: false,
    }).status, 'fits');
  });

  it('denyToSelect blocks the branch', () => {
    assert.equal(checkWarehousePackage(pkg, {
      totalMaxWeightKg: 300,
      placeMaxWeightKg: 30,
      sendingMaxDimensionsCm: { lengthCm: 120, widthCm: 100, heightCm: 100 },
      denyToSelect: true,
    }).status, 'exceeds');
  });
});

describe('packageLineParts — display with per-value highlighting', () => {
  it('formats the plain line', () => {
    const text = packageLineParts({ lengthCm: 40, widthCm: 28, heightCm: 7, weightKg: 2 })
      .map(part => part.text).join('');
    assert.equal(text, 'Габарити пакування: 40 × 28 × 7 см (2 кг)');
  });

  it('formats weight with a Ukrainian decimal comma', () => {
    const text = packageLineParts({ lengthCm: 60, widthCm: 28, heightCm: 14, weightKg: 5.5 })
      .map(part => part.text).join('');
    assert.equal(text, 'Габарити пакування: 60 × 28 × 14 см (5,5 кг)');
    assert.equal(formatNumberUk(5.5), '5,5');
    assert.equal(formatNumberUk(2), '2');
  });

  it('marks only the exceeded values', () => {
    const parts = packageLineParts(
      { lengthCm: 80, widthCm: 28, heightCm: 7, weightKg: 4 },
      ['lengthCm'],
    );
    assert.deepEqual(
      parts.map(part => (part.field ? `[${part.text}]` : part.text)).join(''),
      'Габарити пакування: [80] × 28 × 7 см (4 кг)',
    );
  });

  it('marks weight and multiple sides at once', () => {
    const parts = packageLineParts(
      { lengthCm: 80, widthCm: 28, heightCm: 56, weightKg: 32 },
      ['lengthCm', 'heightCm', 'weightKg'],
    );
    assert.deepEqual(
      parts.map(part => (part.field ? `[${part.text}]` : part.text)).join(''),
      'Габарити пакування: [80] × 28 × [56] см ([32 кг])',
    );
  });
});
