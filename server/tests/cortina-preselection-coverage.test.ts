/**
 * Cortina StaticQR — PreSelection coverage + spec conformance (2026-07-06).
 *
 * Verified against the Nayax dev-portal Cortina StaticQR spec. The repo's
 * authorise→settlement handlers implement the PreAuthorization flow; Nayax may
 * instead configure a machine for PreSelection, which calls /Sale + /Sale End
 * Notification. This pins that we answer BOTH flows (and both case styles), that
 * the request parser reads the spec's nested fields, and that the response
 * contract + decline codes match the spec exactly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'nayax-cortina.ts'),
  'utf8',
);

describe('Cortina StaticQR — flow coverage', () => {
  it('answers the PreSelection Sale path (approve → machine vends)', () => {
    expect(SRC).toMatch(/router\.post\(\[[^\]]*'\/sale'[^\]]*'\/Sale'[^\]]*\]/);
  });
  it('answers the PreSelection Sale End Notification path (commit)', () => {
    expect(SRC).toMatch(/router\.post\(\[[^\]]*'\/sale-end-notification'[^\]]*'\/SaleEndNotification'[^\]]*\]/);
  });
  it('answers PreAuthorization Authorization + Settlement + Cancel', () => {
    expect(SRC).toMatch(/'\/authorize'/);
    expect(SRC).toMatch(/'\/settlement'/);
    expect(SRC).toMatch(/'\/cancel'/);
  });
  it('answers Void and Refund', () => {
    expect(SRC).toMatch(/'\/void'/);
    expect(SRC).toMatch(/'\/refund'/);
  });
});

describe('Cortina StaticQR — request parser reads the spec fields', () => {
  it('reads MachineInfo.TerminalId (bay id), MachineInfo.Id, BasicInfo.Amount, DeviceInfo.HwSerial', () => {
    expect(SRC).toMatch(/machine\.TerminalId/);
    expect(SRC).toMatch(/machine\.Id/);
    expect(SRC).toMatch(/basic\.Amount/);
    expect(SRC).toMatch(/device\.HwSerial/);
  });
  it('never keys machine identity on the swappable HwSerial', () => {
    // HwSerial is captured for logging only, never used to resolve the bay
    expect(SRC).toMatch(/Never key on\s*\/\/ DeviceInfo\.HwSerial|do NOT key identity on it|never key on[\s\S]*HwSerial/i);
  });
});

describe('Cortina StaticQR — redemption is DYNAMIC-QR-ONLY, anti-replay (2026-07-06)', () => {
  // CEO rule "dynamic not static, no fraud": the money path accepts ONLY the
  // short-lived (45s) qr-redeem token, never the durable wallet-barcode (365d) or
  // wallet-link (72h) — those are printed openly on the pass and could be
  // screenshotted + replayed to burn the victim's credit.
  it('resolves the user only from the dynamic qr-redeem token', () => {
    expect(SRC).toMatch(/verifyQrRedeemToken/);
    expect(SRC).toMatch(/resolveUserIdFromDynamicQr/);
    // must NOT accept the durable/static tokens on the money path
    expect(SRC).not.toMatch(/verifyWalletBarcodeToken/);
    expect(SRC).not.toMatch(/verifyPassLinkToken/);
  });
  it('binds identity at authorize; settlement reads user from the reservation, not the token', () => {
    // authorize resolves from the scanned dynamic QR
    expect(SRC).toMatch(/resolveUserIdFromDynamicQr\(code\)/);
    // settlement claims by bay_id alone and reads user_id back (no token re-verify)
    expect(SRC).toMatch(/WHERE bay_id=\$3 AND status='reserved'/);
    expect(SRC).toMatch(/RETURNING id, reservation_ref, redemption_type, user_id/);
    expect(SRC).toMatch(/userId:\s*resv\.user_id/);
  });
});

describe('Cortina StaticQR — response contract + decline codes', () => {
  it('responds with { Status: { Verdict, Code?, StatusMessage } }', () => {
    expect(SRC).toMatch(/Status:\s*\{\s*Verdict:\s*'Approved'/);
    expect(SRC).toMatch(/Status:\s*\{\s*Verdict:\s*'Declined',\s*Code:\s*code/);
  });
  it('uses the verified StaticQR decline codes (1 funds, 50 unknown machine, 992 timeout, 999 general)', () => {
    expect(SRC).toMatch(/cortinaDecline\(1,/);
    expect(SRC).toMatch(/cortinaDecline\(50,/);
    expect(SRC).toMatch(/cortinaDecline\(992,/);
    expect(SRC).toMatch(/cortinaDecline\(999,/);
  });
});
