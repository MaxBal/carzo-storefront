const CONTROL_OR_WHITESPACE = /[\u0000-\u001f\u007f\s]/;
const HTTP_PREFIX = /^https?:\/\//i;
const MAILTO_PATTERN = /^mailto:[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+(\?[^\s#]*)?$/i;
const TEL_PATTERN = /^tel:\+?[0-9][0-9()\-]*$/i;

/**
 * Case-insensitive check for external HTTP/HTTPS links after sanitization.
 */
export function isExternalHttpHref(href: string): boolean {
  return HTTP_PREFIX.test(href);
}

/**
 * Allowlist sanitizer for CMS-supplied link hrefs (page_blocks primary/secondary URLs).
 * Keeps safe internal relative links, HTTPS/HTTP, mailto, tel and hash anchors;
 * collapses everything else (javascript:, data:, vbscript:, protocol-relative,
 * backslash tricks, scheme-without-slashes, credentialed URLs, malformed URLs,
 * control/whitespace characters, bare slugs) to '#'.
 */
export function sanitizeCmsHref(href: string): string {
  const value = href.trim();
  if (!value || value.includes('\\') || CONTROL_OR_WHITESPACE.test(value)) {
    return '#';
  }

  if (HTTP_PREFIX.test(value)) {
    try {
      const parsed = new URL(value);
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        Boolean(parsed.hostname) &&
        !parsed.username &&
        !parsed.password
      ) {
        return value;
      }
    } catch {
      return '#';
    }
    return '#';
  }

  if (MAILTO_PATTERN.test(value)) return value;
  if (TEL_PATTERN.test(value)) return value;

  if (value.startsWith('#')) return value;

  if (value.startsWith('/') && !value.startsWith('//')) {
    try {
      const parsed = new URL(value, 'https://carzo.local');
      if (parsed.origin === 'https://carzo.local' && parsed.pathname.startsWith('/')) {
        return value;
      }
    } catch {
      return '#';
    }
  }

  return '#';
}
