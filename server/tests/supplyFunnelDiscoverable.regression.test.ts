import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-19: the marketplace had 0 providers, and the two pages that recruit
 * them — /become-provider and /apply — were absent from sitemap.xml while
 * /careers (priority 0.5) was listed. Search engines were never told the
 * supply funnel exists.
 */
const seo = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'seo.ts'),
  'utf8',
);

describe('the provider funnel is discoverable', () => {
  it.each(['/become-provider', '/apply'])('sitemap.xml lists %s', (url) => {
    expect(seo).toContain(`url: '${url}'`);
  });

  it('the provider funnel outranks /careers in the sitemap', () => {
    const pri = (u: string) =>
      Number(seo.match(new RegExp(`url: '${u}', changefreq: '\\w+', priority: '([\\d.]+)'`))?.[1] ?? 0);
    expect(pri('/become-provider')).toBeGreaterThan(pri('/careers'));
    expect(pri('/apply')).toBeGreaterThan(pri('/careers'));
  });
});
