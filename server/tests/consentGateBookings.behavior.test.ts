import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { consentGateEnabled, requireConsentIfEnabled } from '../middleware/requireConsent';

/**
 * Consent audit 2026-09-12 — P0-1 (requireConsent mounted on ZERO routes) and
 * P0-12 (bookings recorded no legal acceptance). The gate now also honours the
 * member's Terms/Privacy on the users row, is mounted DARK on the value-moving
 * routers (LEGAL_CONSENT_GATE_ENABLED), and a booking request records
 * booking_rules + emergency_vet_authorisation when the member ticks the line.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

function fakeReqRes(method: string, uid?: string) {
  const req: any = { method, user: uid ? { uid } : undefined };
  const out: { status?: number; body?: unknown } = {};
  const res: any = { status: (n: number) => { out.status = n; return res; }, json: (b: unknown) => { out.body = b; return res; } };
  return { req, res, out };
}

afterEach(() => { delete process.env.LEGAL_CONSENT_GATE_ENABLED; });

describe('requireConsentIfEnabled', () => {
  it('flag off → pass-through (no lookup, no DB)', async () => {
    const mw = requireConsentIfEnabled('terms', 'privacy');
    const { req, res } = fakeReqRes('POST', 'u1');
    let nexted = false;
    await mw(req, res, () => { nexted = true; });
    expect(nexted).toBe(true);
    expect(consentGateEnabled({} as any)).toBe(false);
    expect(consentGateEnabled({ LEGAL_CONSENT_GATE_ENABLED: 'true' } as any)).toBe(true);
  });
  it('flag on → reads pass, anonymous pass (router auth decides), only mutations are gated', async () => {
    process.env.LEGAL_CONSENT_GATE_ENABLED = 'true';
    const mw = requireConsentIfEnabled('terms');
    let n1 = false; await mw(fakeReqRes('GET', 'u1').req, fakeReqRes('GET').res, () => { n1 = true; });
    expect(n1).toBe(true);
    let n2 = false; await mw(fakeReqRes('POST').req, fakeReqRes('POST').res, () => { n2 = true; });
    expect(n2).toBe(true);
  });
});

describe('the gate honours the member consent on the users row', () => {
  it('legacyMemberConsent is consulted before user_consents; fails closed', () => {
    const s = R('server/middleware/requireConsent.ts');
    expect(s).toContain('const given = (await legacyMemberConsent(uid, type)) || (await verifyConsent(uid, type));');
    expect(s).toContain("return type === 'terms' ? !!u?.terms : !!u?.privacy;");
    expect(s).toContain('CONSENT_CHECK_UNAVAILABLE');
  });
});

describe('mounted dark on the value-moving routers', () => {
  it('bookings, booking-requests, gift-cards, credit-wallet, paw-finder', () => {
    const r = R('server/routes.ts');
    expect(r).toContain("app.use('/api/bookings', apiLimiter, requireOnboardingComplete, requireConsentIfEnabled('terms', 'privacy'), bookingsRoutes);");
    expect(r).toContain("app.use('/api/booking-requests', optionalFirebaseToken, apiLimiter, requireConsentIfEnabled('terms', 'privacy'), bookingRequestsRoutes);");
    expect(r).toContain("requireConsentIfEnabled('terms', 'privacy'), giftCardsRoutes);");
    expect(r).toContain("requireConsentIfEnabled('terms', 'privacy'), creditWalletRoutes.default);");
    expect(r).toContain("requireConsentIfEnabled('terms', 'privacy'), pawFinderRoutes.default);");
  });
});

describe('a booking request records the acceptances the registry requires', () => {
  it('server: records booking_rules + emergency_vet_authorisation; requires the tick when the gate is on', () => {
    const s = R('server/routes/booking-requests.ts');
    expect(s).toContain("const acceptedBookingTerms = req.body?.acceptedBookingTerms === true;");
    expect(s).toContain("error: 'BOOKING_TERMS_REQUIRED'");
    expect(s).toContain("for (const key of ['booking_rules', 'emergency_vet_authorisation'] as const) {");
    expect(s).toContain("documentKey: key,");
  });
  it('client: one explicit tick linking both documents in a new tab; the button waits for it', () => {
    const c = R('client/src/pages/BookingContact.tsx');
    expect(c).toContain('data-testid="booking-terms-checkbox"');
    expect(c).toContain('<a href="/legal/booking-rules" target="_blank" rel="noopener"');
    expect(c).toContain('<a href="/legal/emergency-vet-authorisation" target="_blank" rel="noopener"');
    expect(c).toContain('acceptedBookingTerms,                  // recorded as booking_rules + emergency_vet_authorisation');
    expect(c).toContain('disabled={!canSend || !acceptedBookingTerms || sendMutation.isPending}');
    const app = R('client/src/App.tsx');
    expect(app).toContain('<Route path="/legal/booking-rules">');
    expect(app).toContain('<Route path="/legal/emergency-vet-authorisation">');
  });
});
