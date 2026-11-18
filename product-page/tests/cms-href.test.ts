/**
 * NEW-06: CMS link hrefs must be restricted to an allowlist.
 * javascript:, data:, vbscript:, protocol-relative, backslash forms,
 * scheme-without-slashes, credentialed URLs, and control/whitespace chars collapse to '#'.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isExternalHttpHref, sanitizeCmsHref } from '../lib/cms/href';

describe('sanitizeCmsHref — allowed hrefs pass through', () => {
  const allowed = [
    'https://example.com',
    'HTTPS://example.com',
    'Http://Example.com/path',
    'https://example.com/path?x=1#frag',
    'http://example.com',
    'mailto:a@b.c',
    'mailto:support@carzo.ua?subject=Order',
    'MAILTO:info@carzo.ua',
    'tel:+380441234567',
    'tel:044-123-45-67',
    'TEL:+380501112233',
    '/about',
    '/case/design/m/2-0',
    '/case/design/l/4-0',
    '/about?tab=1#team',
    '/about#team',
    '#top',
    '#advantages',
  ];

  for (const href of allowed) {
    it(`keeps ${href}`, () => {
      assert.equal(sanitizeCmsHref(href), href);
    });
  }

  it('trims surrounding whitespace on safe hrefs', () => {
    assert.equal(sanitizeCmsHref('  /about  '), '/about');
    assert.equal(sanitizeCmsHref('  https://example.com/path  '), 'https://example.com/path');
  });
});

describe('isExternalHttpHref — case-insensitive HTTP/HTTPS detection', () => {
  it('identifies lowercase and uppercase http/https URLs', () => {
    assert.equal(isExternalHttpHref('https://example.com'), true);
    assert.equal(isExternalHttpHref('HTTPS://example.com'), true);
    assert.equal(isExternalHttpHref('http://example.com'), true);
    assert.equal(isExternalHttpHref('HTTP://example.com'), true);
  });

  it('returns false for mailto, tel, relative paths, and anchors', () => {
    assert.equal(isExternalHttpHref('mailto:a@b.c'), false);
    assert.equal(isExternalHttpHref('tel:+380441234567'), false);
    assert.equal(isExternalHttpHref('/about'), false);
    assert.equal(isExternalHttpHref('#top'), false);
  });
});

describe('sanitizeCmsHref — dangerous or malformed hrefs collapse to #', () => {
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
    // Scheme without double-slash or empty host
    'https:example.com',
    'HTTPS:example.com',
    'http:alert(1)',
    'http:/example.com',
    'https://',
    'http:///',
    // Embedded credentials
    'https://user:pass@evil.com',
    'https://carzo.ua@evil.com',
    'http://:pass@evil.com',
    // Embedded whitespace or ASCII control characters
    'https://example.com/foo bar',
    'https://example.com/foo\nbar',
    'https://example.com/foo\rbar',
    'https://example.com/foo\tbar',
    'https://example.com/foo\u0000bar',
    '/path with spaces',
    '/path\u0000',
    '#anchor with space',
    '#anchor\u001f',
    // Malformed mailto / tel
    'mailto:',
    'mailto://evil.com',
    'mailto:not-an-email',
    'tel:',
    'tel://evil.com',
    'tel:abc',
  ];

  for (const href of forbidden) {
    it(`blocks ${JSON.stringify(href)}`, () => {
      assert.equal(sanitizeCmsHref(href), '#');
    });
  }
});
