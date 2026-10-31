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
