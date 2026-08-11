/**
 * users.firebaseUid is a PHANTOM column (CEO audit 2026-08-11).
 *
 * The `users` table (shared/schema.ts) has NO firebase_uid column — the Firebase
 * uid IS `users.id`. (`firebase_uid` exists only on `privilege_members`.) Yet five
 * SOLE lookups queried `eq(users.firebaseUid, <uid>)`; Drizzle resolves the missing
 * property to `undefined` and builds a DEGENERATE clause that matches nobody — so
 * each silently found no user:
 *   · sitter-suite receipt customer      → no fiscal receipt issued
 *   · nayax-monyx-events loyalty mirror  → users.loyaltyPoints never credited/reversed
 *   · walk-my-pet walker SMS             → walker never notified
 *   · PaymentGatewayService customer SMS → confirmation never sent
 * All now use `eq(users.id, ...)`. (`or(eq(users.id,...), eq(users.firebaseUid,...))`
 * fallbacks survived on the id branch and are out of scope here.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { users } from '@shared/schema';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('users has no firebaseUid column (Firebase uid == users.id)', () => {
  it('the phantom column really is absent from the Drizzle table', () => {
    expect((users as any).firebaseUid).toBeUndefined();
    expect((users as any).id).toBeDefined();
  });

  const files = [
    'server/routes/sitter-suite.ts',
    'server/routes/nayax-monyx-events.ts',
    'server/routes/walk-my-pet.ts',
    'server/services/PaymentGatewayService.ts',
  ];

  it('none of the fixed files still perform a SOLE eq(users.firebaseUid, ...) lookup', () => {
    for (const f of files) {
      const src = R(f);
      // A sole lookup is `.where(eq(users.firebaseUid, ...))` NOT wrapped in or(eq(users.id...)).
      const soleMatches = [...src.matchAll(/eq\(users\.firebaseUid,/g)].filter((m) => {
        const around = src.slice(Math.max(0, m.index! - 40), m.index!);
        return !/or\(\s*eq\(users\.id,/.test(around);
      });
      expect(soleMatches, `${f} still has a sole users.firebaseUid lookup`).toHaveLength(0);
    }
  });
});
