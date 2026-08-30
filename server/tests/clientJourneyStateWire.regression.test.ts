/**
 * Regression pin — client-side JourneyState wire.
 *
 * The client hook + badge must:
 *   • hit /api/marketplace/journey/:kind/:id (the CEO DEEP-LOGIC §84
 *     dispatch route),
 *   • distinguish OK / NOT_FOUND / NOT_A_PARTY / NOT_IMPLEMENTED,
 *   • never render a fake OK when the server returned NOT_IMPLEMENTED
 *     (a §72 discipline pin — the honest surface for an unwired
 *     kind is a subdued placeholder, not a green "everything is
 *     fine" badge).
 *
 * Source-anchored so a refactor that breaks the URL, drops the 501
 * branch, or hard-codes a green colour is caught in CI.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CLIENT_ROOT = path.resolve(__dirname, '../../client/src');
const HOOK = fs.readFileSync(path.join(CLIENT_ROOT, 'hooks/useEntityJourneyState.ts'), 'utf8');
const BADGE = fs.readFileSync(path.join(CLIENT_ROOT, 'components/marketplace/JourneyStateBadge.tsx'), 'utf8');

describe('client JourneyState wire', () => {
  it('hook hits the canonical dispatch endpoint', () => {
    expect(HOOK).toMatch(/\/api\/marketplace\/journey\/\$\{kind\}\/\$\{encodeURIComponent\(id!\)\}/);
  });

  it('hook maps 404/403/501 to distinct outcome codes', () => {
    expect(HOOK).toContain("'not_found'");
    expect(HOOK).toContain("'not_a_party'");
    expect(HOOK).toContain("'not_implemented'");
  });

  it('hook enumerates every JourneyKind (must stay in sync with the server whitelist)', () => {
    for (const kind of [
      'booking', 'shop_order', 'gift', 'wallet_topup', 'refund',
      'support_case', 'provider_application', 'prestige_member',
      'k9000_session', 'pet', 'payout',
    ]) {
      expect(HOOK).toContain(`'${kind}'`);
    }
  });

  it('badge surfaces NOT_IMPLEMENTED honestly (subdued placeholder, never OK-styled)', () => {
    expect(BADGE).toMatch(/journey-badge-not-implemented/);
    // The placeholder must NOT reuse the URGENT/HIGH/MEDIUM colours —
    // it lives in the gray/gray-400 band on purpose.
    const notImplementedBlock = BADGE.slice(
      BADGE.indexOf('not_implemented'),
      BADGE.indexOf('const j = journey!;'),
    );
    expect(notImplementedBlock).not.toMatch(/bg-red-600|bg-orange-500|bg-amber-400/);
  });

  it('badge does not render for NOT_A_PARTY or NOT_FOUND (privacy — §72)', () => {
    expect(BADGE).toMatch(/status === 'not_found'.*status === 'not_a_party'|status === 'not_a_party'.*status === 'not_found'/s);
    expect(BADGE).toMatch(/return null/);
  });

  it('badge exposes primary action as a slug, not a translated string (§ every-string-is-a-slug)', () => {
    // The button's rendered text is `{primary}` — the slug itself —
    // and the parent app translates. A regression here means the
    // component is inventing user-facing copy.
    expect(BADGE).toMatch(/data-action-type=\{primary\}/);
    expect(BADGE).toMatch(/\{primary\}\s*<\/button>/);
  });
});
