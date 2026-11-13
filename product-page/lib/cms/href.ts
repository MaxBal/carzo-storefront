/**
 * Allowlist sanitizer for CMS-supplied link hrefs (page_blocks primary/secondary URLs).
 * Keeps safe internal relative links, HTTPS/HTTP, mailto, tel and hash anchors;
 * collapses everything else (javascript:, data:, vbscript:, protocol-relative,
 * backslash tricks, bare slugs) to '#'.
 */
export function sanitizeCmsHref(href: string): string {
  const value = href.trim();
  if (!value || value.includes('\\')) return '#';
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith('#')) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '#';
}
