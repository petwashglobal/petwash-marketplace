/**
 * Credit-wallet confirm IDOR guard — regression pin.
 *
 * Security cross-exam 2026-07-05 finding #3 (MEDIUM, 3/3 skeptics confirmed):
 * POST /credits/redemptions/:sessionId/confirm authenticated the caller but
 * never checked the session belonged to them — it passed only sessionId into
 * walletService.confirmRedemption, which looked the session up by session_id
 * alone. Anyone who learned a pending sessionId (shared-kiosk QR, shoulder
 * surf, logs) could force the victim's OWN wallet credits to be spent and
 * bypass the cash-due gate.
 *
 * The sibling /cancel route already bound userId (IDOR fix 2026-06-18); this
 * pins that /confirm now does the same, end to end.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'credit-wallet.ts'),
  'utf8',
);
const SERVICE_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'WalletService.ts'),
  'utf8',
);

describe('credit-wallet /confirm IDOR guard — cross-exam #3', () => {
  it('the confirm route passes userId into confirmRedemption', () => {
    expect(ROUTE_SRC).toMatch(
      /confirmRedemption\(\s*sessionId\s*,\s*paymentConfirmed\s*,\s*idempotencyKey\s*,\s*userId\s*\)/,
    );
  });

  it('confirmRedemption accepts a userId parameter', () => {
    expect(SERVICE_SRC).toMatch(
      /async confirmRedemption\([^)]*userId\?\s*:\s*string[^)]*\)/,
    );
  });

  it('confirmRedemption scopes the session lookup to the owner when userId is given', () => {
    expect(SERVICE_SRC).toMatch(/ownerClause\s*=\s*userId\s*\?\s*sql`AND user_id = \$\{userId\}`/);
    expect(SERVICE_SRC).toMatch(/WHERE session_id = \$\{sessionId\} \$\{ownerClause\}/);
  });

  it('still binds userId on the sibling cancel route (no regression)', () => {
    expect(SERVICE_SRC).toMatch(/async cancelSession\(sessionId: string, userId\?: string\)/);
  });
});
