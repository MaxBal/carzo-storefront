// Redirect Next.js-only 'server-only' to a no-op so tsx/node tests can import
// server modules without the react-server export condition.
const Module = require('node:module');
const path = require('node:path');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'server-only') {
    return path.join(__dirname, 'server-only-empty.cjs');
  }
  return originalResolveFilename.call(this, request, ...args);
};

// React's request-scoped `cache()` only exists under the react-server export
// condition. Provide a pass-through shim so modules using `cache(fn)` can load
// in node --test runs. Memoization is intentionally not simulated.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const exported = originalLoad.call(this, request, parent, isMain);
  if (request === 'react' && exported && typeof exported.cache !== 'function') {
    return new Proxy(exported, {
      get(target, prop, receiver) {
        if (prop === 'cache') return (fn) => fn;
        return Reflect.get(target, prop, receiver);
      },
    });
  }
  return exported;
};
