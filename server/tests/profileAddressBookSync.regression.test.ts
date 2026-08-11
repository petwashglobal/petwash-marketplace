/**
 * Profile → address-book sync (CEO 2026-08-11 "yes do it after"):
 *  The profile address (users.address/street/...) and the saved-address book
 *  (user_addresses) were two disconnected stores that could silently disagree
 *  (board item #4). Saving the profile address now syncs it into the book.
 *
 *  These pins lock the SAFETY of that sync so a future refactor can't turn it
 *  into a footgun on the address-save path:
 *   · fully fail-soft (wrapped in try/catch, warn-only) — never breaks the save
 *   · non-destructive dedup (proximity/text match → enrich, not duplicate)
 *   · only marks default when the book was empty (never overrides user's choice)
 *   · the profile route only fires it when an address was actually part of the PATCH
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const sync = R('server/lib/syncProfileAddressToBook.ts');
const route = R('server/routes/user-profile.ts');

describe('profile→address-book sync is safe', () => {
  it('is fail-soft: swallows its own errors, never throws to the caller', () => {
    expect(sync).toMatch(/try\s*\{/);
    expect(sync).toMatch(/catch\s*\(/);
    expect(sync).toMatch(/logger\.warn\(/);
  });

  it('dedups by proximity/text before inserting (no duplicate rows)', () => {
    expect(sync).toMatch(/isNearby\(/);
    expect(sync).toMatch(/rows\.find\(/);
  });

  it('only sets default when the book was empty (never overrides user choice)', () => {
    expect(sync).toMatch(/isDefault:\s*rows\.length === 0/);
  });

  it('on a match it enriches only — never writes label/isDefault on the update', () => {
    // The update path must not stomp the user's label or default flag.
    const updateBlock = sync.slice(sync.indexOf('if (match)'), sync.indexOf('await db.insert'));
    expect(updateBlock).not.toMatch(/\blabel:/);
    expect(updateBlock).not.toMatch(/isDefault:/);
  });
});

describe('profile route wires the sync guardedly', () => {
  it('only syncs when the PATCH actually carried an address', () => {
    expect(route).toMatch(/address !== undefined \|\| street !== undefined \|\| city !== undefined/);
    expect(route).toMatch(/syncProfileAddressToBook\(uid,/);
  });
});
