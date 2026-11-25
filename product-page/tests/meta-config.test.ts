import assert from 'node:assert/strict';
import { it } from 'node:test';
import { getMetaPublicConfig, metaHostAllowed } from '../lib/meta/config';
import { readMetaContext } from '../lib/meta/context';
import { metaEnv, metaContext } from './fixtures/meta';

it('requires explicit enablement, production, credentials and exact owned hosts; never serializes tokens', () => {
  const env = metaEnv();
  const config = getMetaPublicConfig(env)!;
  assert.equal(config.destinations.length, 2);
  assert.equal(JSON.stringify(config).includes('synthetic-carzo-token'), false);
  assert.equal(metaHostAllowed('https://carzo.test/case/?fbclid=example', config), true);
  assert.equal(metaHostAllowed('https://carzo.test.evil.test', config), false);
  assert.equal(metaHostAllowed('http://carzo.test', config), false);
  assert.equal(getMetaPublicConfig({ ...env, META_ENABLED: 'false' }), null);
  assert.equal(getMetaPublicConfig({ ...env, VERCEL_ENV: 'preview' }), null);
  assert.equal(getMetaPublicConfig({ ...env, VERCEL_ENV: 'development' }), null);
  assert.equal(getMetaPublicConfig({ ...env, META_CARZO_ACCESS_TOKEN: '' }), null);
  for (const host of ['localhost', '127.0.0.1', '*.carzo.test', 'preview.vercel.app']) assert.equal(getMetaPublicConfig({ ...env, META_ALLOWED_HOSTS: host }), null);
  const duplicate = config.destinations.map(item => ({ ...item, productTypes: ['case'] }));
  assert.equal(getMetaPublicConfig({ ...env, META_DESTINATIONS: JSON.stringify(duplicate) }), null);
});

it('requires affirmative consent and real same-origin request context; strips query data and rejects opt-out', () => {
  const env = metaEnv();
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    const headers = new Headers({ origin: 'https://carzo.test', referer: 'https://carzo.test/case/design/l/4-0?phone=PRIVATE#fragment',
      'user-agent': 'Synthetic browser', 'x-forwarded-for': '192.0.2.1',
      cookie: `carzo_marketing_v1=granted; carzo_marketing_id=${metaContext.consentId}; _fbp=${metaContext.fbp}; _fbc=${metaContext.fbc}` });
    const context = readMetaContext(headers)!;
    assert.equal(context.sourceUrl, metaContext.sourceUrl);
    assert.equal(context.fbc, metaContext.fbc);
    assert.equal(context.ip, '192.0.2.1');
    for (const key of ['sec-gpc', 'dnt']) { headers.set(key, '1'); assert.equal(readMetaContext(headers), null); headers.delete(key); }
    headers.set('origin', 'https://evil.test'); assert.equal(readMetaContext(headers), null);
    headers.set('origin', 'https://carzo.test'); headers.delete('cookie'); assert.equal(readMetaContext(headers), null);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
