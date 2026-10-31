import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DataStoreConfigError,
  getPreviewSecret,
  resolveCatalogStoreBackend,
  resolveContentStoreBackend,
  resolveDataStoreFlags,
  resolveOrderStoreBackend,
  resolvePageStoreBackend,
} from '../lib/data/config';

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe('Stage 4 store flags', () => {
  it('all new flags missing → directus', () => {
    assert.equal(resolveCatalogStoreBackend(env({})), 'directus');
    assert.equal(resolveContentStoreBackend(env({})), 'directus');
    assert.equal(resolvePageStoreBackend(env({})), 'directus');
    assert.equal(resolveOrderStoreBackend(env({})), 'directus');
  });

  it('blank values → directus', () => {
    assert.equal(resolveCatalogStoreBackend(env({ CATALOG_STORE: '   ' })), 'directus');
    assert.equal(resolveContentStoreBackend(env({ CONTENT_STORE: '' })), 'directus');
  });

  it('explicit directus / supabase with case normalization', () => {
    assert.equal(resolveCatalogStoreBackend(env({ CATALOG_STORE: 'directus' })), 'directus');
    assert.equal(resolveCatalogStoreBackend(env({ CATALOG_STORE: 'SUPABASE' })), 'supabase');
    assert.equal(resolveContentStoreBackend(env({ CONTENT_STORE: 'Supabase' })), 'supabase');
    assert.equal(resolvePageStoreBackend(env({ PAGE_STORE: 'directus' })), 'directus');
    assert.equal(resolveOrderStoreBackend(env({ ORDER_STORE: 'supabase' })), 'supabase');
  });

  it('invalid value → CONFIG error', () => {
    assert.throws(
      () => resolveCatalogStoreBackend(env({ CATALOG_STORE: 'firebase' })),
      (error: unknown) => error instanceof DataStoreConfigError && error.code === 'CONFIG',
    );
    assert.throws(
      () => resolveContentStoreBackend(env({ CONTENT_STORE: 'x' })),
      DataStoreConfigError,
    );
  });

  it('domains resolve independently', () => {
    const flags = resolveDataStoreFlags(env({
      CATALOG_STORE: 'supabase',
      CONTENT_STORE: 'directus',
      PAGE_STORE: 'supabase',
      ORDER_STORE: 'directus',
    }));
    assert.deepEqual(flags, {
      catalog: 'supabase',
      content: 'directus',
      pages: 'supabase',
      orders: 'directus',
    });
  });
});

describe('PREVIEW_SECRET backward compatibility', () => {
  it('prefers PREVIEW_SECRET, falls back to DIRECTUS_PREVIEW_SECRET', () => {
    assert.equal(getPreviewSecret(env({ PREVIEW_SECRET: 'new' })), 'new');
    assert.equal(getPreviewSecret(env({ DIRECTUS_PREVIEW_SECRET: 'legacy' })), 'legacy');
    assert.equal(
      getPreviewSecret(env({ PREVIEW_SECRET: 'new', DIRECTUS_PREVIEW_SECRET: 'legacy' })),
      'new',
    );
    assert.equal(getPreviewSecret(env({})), null);
  });
});
