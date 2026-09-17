/**
 * Every <Helmet> has a <HelmetProvider> above it — regression pin (2026-09-17).
 *
 * Production crash (Sentry `capacitor`, fatal, iOS Safari; mirrored by the
 * monitoring alert "Fault in client:AppErrorBoundary"):
 *
 *     TypeError: Cannot read properties of undefined (reading 'add')
 *       at jm.init  (vendor-react…js)
 *       at jm.render (vendor-react…js)
 *     url: https://petwash.co.il/marketplace/search
 *
 * `jm` is react-helmet-async's Dispatcher. Its init() does
 *     this.props.context.helmetInstances.add(this)
 * and with no provider that context is empty, so EVERY route rendering
 * <Helmet> was a hard render crash at first paint — not a missing <title>,
 * a white page with only AppErrorBoundary's fallback left.
 *
 * Nothing ever mounted a provider. The routes that died:
 *   /search, /marketplace/search      (BookingSearchPage)
 *   /services/:service, /services/:service/:city  (ServiceLandingPage)
 * The service pages are the SEO landing pages, so Googlebot crawled a crash.
 *
 * Verified in a real browser on all four routes, before and after.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const MAIN = fs.readFileSync(path.join(SRC, 'main.tsx'), 'utf8');

/** Files that render <Helmet> and therefore need a provider above them. */
function helmetConsumers(): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        const body = fs.readFileSync(full, 'utf8');
        if (/from ['"]react-helmet-async['"]/.test(body) && /<Helmet[\s>]/.test(body)) {
          hits.push(path.relative(SRC, full));
        }
      }
    }
  };
  walk(SRC);
  return hits;
}

describe('react-helmet-async has a provider (2026-09-17)', () => {
  it('the app root mounts HelmetProvider', () => {
    expect(MAIN).toMatch(/HelmetProvider/);
    expect(MAIN).toMatch(/<HelmetProvider>/);
    expect(MAIN).toMatch(/<\/HelmetProvider>/);
  });

  it('HelmetProvider wraps <App />', () => {
    const open = MAIN.indexOf('<HelmetProvider>');
    const app = MAIN.indexOf('<App />', open);
    const close = MAIN.indexOf('</HelmetProvider>', app);
    expect(open).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(open);
    expect(close).toBeGreaterThan(app);
  });

  it('it sits INSIDE AppErrorBoundary, so a real render fault is still reported', () => {
    expect(MAIN.indexOf('<AppErrorBoundary>')).toBeLessThan(MAIN.indexOf('<HelmetProvider>'));
  });

  it('every page that renders <Helmet> is covered — the provider may outlive them, never the other way round', () => {
    // Pages are free to move to useSEO() (#2528 moved the two that crashed).
    // Zero consumers is fine; a consumer with no provider is the crash.
    const consumers = helmetConsumers();
    if (consumers.length > 0) expect(MAIN).toMatch(/<HelmetProvider>/);
    expect(Array.isArray(consumers)).toBe(true);
  });
});
