const Module = require('node:module');

// Network-free dependencies for exercising the real server action and waitUntil.
module.exports.install = function install() {
  const gate = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
  };
  const state = { telegram: gate(), crm: gate(), tasks: [], writes: [], notify: 0, crmCalls: 0, existing: null, failWrite: false };
  const item = { size: 'M', designSlug: '4-0', brandId: 'none', fixation: 'none', quantity: 1 };
  const quote = {
    lines: [{ itemKey: 'M:4-0:none:none', item, title: 'Synthetic case', productUrl: '/case/design/m/4-0', designLabel: '4.0', sizeLabel: 'M', brandName: '', fixationLabel: 'none', unitPrice: 2249, basePrice: 2249, logoExtra: 0, fixationExtra: 0, quantity: 1, lineTotal: 2249, inStock: true, quantityDiscountEligible: true }],
    subtotal: 2249, quantityDiscount: 0, total: 2249, itemsQuantity: 1, appliedTier: null, shippingPackage: null, allowPostomat: true, canCheckout: true, checkoutPaymentDetails: '', verifiedAt: new Date().toISOString(),
  };
  const mocks = {
    'next/headers': { headers: () => new Headers({ 'x-forwarded-for': 'synthetic-checkout-test' }) },
    '@/lib/cart/server': { CartQuoteError: class extends Error {}, quoteCartItems: async () => quote },
    '@/lib/cart/customers': { normalizeCustomerPhone: () => '+380000000000', findCustomerByPhone: async () => null },
    '@/lib/nova-poshta': { resolveNovaPoshtaPoint: async (cityRef, pointRef) => ({ cityRef, cityName: 'Synthetic city', point: { ref: pointRef, number: '1', name: 'Synthetic branch', address: 'Synthetic address', type: 'branch' } }) },
    '@/lib/order-notifications': { notifyNewOrder: async () => { state.notify++; await state.telegram.promise; } },
    '@/lib/keycrm/sync': { syncKeyCrmOrder: async () => { state.crmCalls++; await state.crm.promise; } },
    '@/lib/data/orders': {
      OrderStoreError: class extends Error {},
      findOrderByAttemptId: async () => state.existing,
      createOrderRecord: async snapshot => {
        if (state.failWrite) throw new Error('synthetic persistence failure');
        state.writes.push(snapshot);
        return { id: 'synthetic-id', orderNumber: 'CZ-SYNTHETIC', total: snapshot.total, created: true };
      },
    },
  };
  const original = Module._load;
  Module._load = function (request, ...args) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return original.call(this, request, ...args);
  };
  const contextKey = Symbol.for('@vercel/request-context');
  const previous = globalThis[contextKey];
  globalThis[contextKey] = { get: () => ({ waitUntil: task => {
    if (state.writes.length !== 1) throw new Error('background task registered before persistence');
    state.tasks.push(task);
  } }) };
  return {
    state, item,
    restore() {
      Module._load = original;
      if (previous === undefined) delete globalThis[contextKey];
      else globalThis[contextKey] = previous;
      state.telegram.resolve(); state.crm.resolve();
    },
  };
};
