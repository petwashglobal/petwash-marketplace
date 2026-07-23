/**
 * Shop stays CLOSED (CEO 2026-07-23: supplier signed, no prices yet) but the
 * browse page must be READY: real supplier items appear automatically —
 * WITHOUT prices — the moment they're loaded via the admin API. Example
 * seed products (EX-* / tag "example") must never show.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const page = readFileSync(resolve(ROOT, 'client/src/pages/Shop.tsx'), 'utf8');

describe('closed-shop items preview', () => {
  it('fetches the real catalog and filters example seeds out', () => {
    expect(page).toMatch(/\/api\/shop\/products/);
    expect(page).toMatch(/startsWith\('EX-'\)/);
    expect(page).toMatch(/includes\('example'\)/);
  });

  it('renders items with NO price fields anywhere in the grid', () => {
    const grid = page.slice(page.indexOf('sh-collection'), page.indexOf('── Categories'));
    expect(grid.length).toBeGreaterThan(100);
    expect(grid).not.toMatch(/price_cents|priceCents|₪\s*\{/);
  });

  it('states purchases open later (honest gate, both languages)', () => {
    expect(page).toContain('Opening soon · בקרוב');
    expect(page).toMatch(/מחירים יפורסמו בפתיחה/);
  });
});
