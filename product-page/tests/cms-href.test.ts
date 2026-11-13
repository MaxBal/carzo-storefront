/**
 * NEW-06: CMS link hrefs must be restricted to an allowlist.
 * javascript:, data:, vbscript:, protocol-relative and backslash forms collapse to '#'.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeCmsHref } from '../lib/cms/href';

describe('sanitizeCmsHref — allowed hrefs pass through', () => {
  const allowed = [
    'https://example.com',
    'https://example.com/path?x=1#frag',
    'http://example.com',
    'mailto:a@b.c',
    'tel:+380441234567',
    '/about',
    '/case/design/l/4-0',
    '/about#team',
    '#top',
  ];

  for (const href of allowed) {
    it(`keeps ${href}`, () => {
      assert.equal(sanitizeCmsHref(href), href);
    });
  }

  it('trims surrounding whitespace on safe hrefs', () => {
    assert.equal(sanitizeCmsHref('  /about  '), '/about');
  });
});

describe('sanitizeCmsHref — dangerous hrefs collapse to #', () => {
  const forbidden = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    '//evil.com',
    ' javascript:alert(1)',
    '\tjavascript:alert(1)',
    'java\tscript:alert(1)',
    '/\\evil.com',
    '\\\\evil.com',
    'privacy-policy',
    '',
    '   ',
  ];

  for (const href of forbidden) {
    it(`blocks ${JSON.stringify(href)}`, () => {
      assert.equal(sanitizeCmsHref(href), '#');
    });
  }
});
