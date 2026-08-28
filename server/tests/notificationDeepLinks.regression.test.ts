/**
 * Family sweep of notification/email ctaUrls (CEO §23 + §46).
 *
 * A deep link that lands on a route that isn't mounted is a silent
 * broken promise — the customer or provider taps a notification and
 * hits a 404. This test extracts every hard-coded ctaUrl pattern
 * across the server (notification dispatcher calls, cron jobs,
 * automated recovery, walk-my-pet, sitter-suite, gcs backup emails,
 * welcome emails) and asserts each one resolves to a mounted client
 * route in App.tsx.
 *
 * External absolute URLs (petwash.co.il/…) are normalised to their
 * pathname before checking so the same discipline applies whether
 * the notification uses a base env var or a hard-coded host.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER_DIR = path.resolve(__dirname, '..');
const APP = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'App.tsx'),
  'utf8',
);

/** Walk the server tree and collect every file that mentions ctaUrl. */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'tests' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectSourceFiles(full));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) results.push(full);
  }
  return results;
}

const ctaUrls = new Set<string>();

for (const file of collectSourceFiles(SERVER_DIR)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('ctaUrl')) continue;
  // Match template literals: ctaUrl: `${base}/foo/${id}` or `https://…/foo/${id}`.
  const tmpl = /ctaUrl:\s*`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = tmpl.exec(src)) !== null) {
    ctaUrls.add(m[1]);
  }
  // Match plain string literals: ctaUrl: 'https://…/foo'.
  const lit = /ctaUrl:\s*['"]([^'"]+)['"]/g;
  while ((m = lit.exec(src)) !== null) {
    ctaUrls.add(m[1]);
  }
}

function normalisePath(raw: string): string {
  // Drop scheme + host so `https://petwash.co.il/x`, `${base}/x`, and
  // plain `/x` all resolve to the same `/x` pattern.
  let out = raw
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\$\{[^}]+\}/, '');
  // Drop template interpolations — the mounted-route check is prefix-based.
  out = out.replace(/\$\{[^}]+\}/g, '<id>');
  // Drop query strings — routes match on path only.
  out = out.split('?')[0];
  // Trim trailing slash.
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function extractMountedRoutePrefixes(): string[] {
  const results = new Set<string>();
  const re = /<Route\s+path="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(APP)) !== null) {
    const stripped = m[1].replace(/\/:[a-zA-Z_][a-zA-Z0-9_]*/g, '');
    if (stripped.startsWith('/')) results.add(stripped);
  }
  return [...results];
}

const mountedRoutes = extractMountedRoutePrefixes();
const paths = [...ctaUrls].map(normalisePath).filter((p) => p.startsWith('/'));

describe('notification ctaUrl deep links resolve to mounted routes (§23 + §46)', () => {
  it('sweep found at least one ctaUrl (guards against a silent regex miss)', () => {
    expect(paths.length).toBeGreaterThan(0);
  });

  it('every ctaUrl resolves to a mounted client route prefix', () => {
    const dead: string[] = [];
    for (const raw of paths) {
      // Replace <id> placeholder with anything for prefix-check purposes.
      const check = raw.replace(/<id>/g, 'X');
      const ok = mountedRoutes.some((route) => {
        if (check === route) return true;
        if (check.startsWith(route + '/')) return true;
        // Some ctaUrls point at ${base}/ alone which we already stripped
        // to '/'; treat that as valid (the home page).
        if (check === '' && route === '/') return true;
        return false;
      });
      if (!ok) dead.push(raw);
    }
    expect(dead, `Notification ctaUrls without a mounted client route: ${dead.join(', ')}`).toEqual([]);
  });
});
