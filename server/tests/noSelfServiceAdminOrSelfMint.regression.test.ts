/**
 * Two live privilege/money doors, closed 2026-09-13.
 *
 * 1. SELF-SERVICE ADMIN.
 *    firestore.rules:69 — `match /users/{userId} { allow write: if
 *    isAuthenticated() && isOwner(userId); }` — lets a signed-in user write
 *    ANY field on their own user document, and the browser ships the Firestore
 *    SDK. `adminCheck.checkUserIsAdmin()` then READ `role` from that very
 *    document and returned true for 'admin'/'super_admin'. So:
 *
 *        setDoc(doc(db, 'users', uid), { role: 'admin' }, { merge: true })
 *
 *    made any customer an admin to every consumer of that function —
 *    platform revenue, AI insights, event-bus history, marketing campaign
 *    create AND launch (real ad spend), wallet-telemetry purge, Sheets export.
 *
 * 2. SELF-MINTED SPENDABLE CREDIT.
 *    POST /api/unified/wallet/add-funds took `amount` from the body and
 *    credited `promo_credit` behind requireAuth + requireActive only — no
 *    payment, no admin, no ceiling, and requireActive fails OPEN. That balance
 *    buys a wash at a K9000 bay.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('admin authority never comes from a store the subject can write', () => {
  const src = R('server/lib/adminCheck.ts');

  it('the Firestore role fallback is gone', () => {
    expect(src).not.toContain("userData?.role === 'admin'");
    expect(src).not.toContain("collection('users').doc(uid)");
    expect(src).toContain('SELF-SERVICE ADMIN DOOR');
  });

  it('custom claims remain the authority, and the check fails closed', () => {
    expect(src).toContain('ADMIN_ROLES.includes(claims.role)');
    expect(src).toMatch(/return false;/);
  });

  it('the rule that made it exploitable is still there — so the server must never trust that doc', () => {
    // Documents WHY the fix lives on the server: the rule is unchanged, and
    // client writes to /users/{uid} are legitimate for non-privileged fields.
    expect(R('firestore.rules')).toContain('allow write: if isAuthenticated() && isOwner(userId);');
  });
});

describe('no route mints spendable credit on request', () => {
  const src = R('server/routes/unified-platform.ts');

  it('add-funds answers 410 before it can credit anything', () => {
    const at = src.indexOf("router.post('/wallet/add-funds'");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, at + 2600);
    expect(body).toContain("error: 'ENDPOINT_SEALED'");
    expect(body.indexOf('ENDPOINT_SEALED')).toBeLessThan(body.indexOf('const transaction = await unifiedWallet.addFunds('));
  });

  it('nothing in the client called it', () => {
    for (const f of ['client/src/pages/MyWallet.tsx', 'client/src/pages/Dashboard.tsx']) {
      expect(R(f)).not.toContain('add-funds');
    }
  });

  it('the legitimate credit paths are untouched', () => {
    // verified payment, and the audited admin grant
    expect(R('server/routes/credit-wallet.ts')).toContain("router.post('/topup'");
    expect(R('server/services/WalletService.ts')).toContain('async adminInjectCredits(');
  });
});
