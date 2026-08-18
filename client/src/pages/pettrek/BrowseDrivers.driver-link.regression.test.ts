/**
 * PR-PETTREK-DRIVER-LINK-PLURAL — regression pin for the one-char fix on
 * BrowseDrivers.tsx.
 *
 * Registered route is /pettrek/drivers/:id (plural — App.tsx:1994).
 * Before: BrowseDrivers navigated to /pettrek/driver/:id (singular) →
 * every "View Profile" tap returned a 404 fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'BrowseDrivers.tsx'),
  'utf8',
);

describe('BrowseDrivers — "View Profile" link uses the plural /drivers route', () => {
  it('setLocation targets /pettrek/drivers/${driver.id} (plural)', () => {
    expect(SRC).toMatch(/setLocation\(\s*`\/pettrek\/drivers\/\$\{driver\.id\}`\s*\)/);
  });

  it('never re-introduces the singular /pettrek/driver/:id path as a live call', () => {
    // Strip line comments so the historical "was ..." note doesn't false-positive.
    const withoutComments = SRC.replace(/\/\/[^\n]*/g, '');
    expect(withoutComments).not.toMatch(/setLocation\(\s*`\/pettrek\/driver\/\$\{driver\.id\}`\s*\)/);
  });
});
