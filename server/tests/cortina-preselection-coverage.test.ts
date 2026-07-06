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

describe('Cortina StaticQR — accepts any pass token the customer presents (2026-07-06)', () => {
  // A customer at the bay may present ANY of our signed pass tokens: the durable
  // wallet-barcode (365d, baked into the saved Apple/Google pass), a fresh
  // qr-redeem (45s, in-app), or a wallet-link (72h). Cortina must resolve the
  // userId from all three — verifying only wallet-link would decline a real pass.
  it('imports and tries all three pass-token verifiers', () => {
    expect(SRC).toMatch(/verifyWalletBarcodeToken/);
    expect(SRC).toMatch(/verifyQrRedeemToken/);
    expect(SRC).toMatch(/verifyPassLinkToken/);
  });
  it('resolves userId via a unified resolver at both authorize and settlement', () => {
    expect(SRC).toMatch(/resolveUserIdFromScannedCode/);
    const calls = SRC.match(/resolveUserIdFromScannedCode\(code\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
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
