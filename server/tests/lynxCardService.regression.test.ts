/**
 * LynxCardService — single-use prepaid wash-card mint (Cortina-free redeem rail).
 * Pins the money-safety invariants: doubly gated, single-use, exact amount, and
 * the correct Nayax card shape (prepaid + QR physical type). 2026-07-06.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, '..', 'services', 'LynxCardService.ts'), 'utf8');

describe('LynxCardService — money-safe mint', () => {
  it('is gated on Lynx auth + explicit LYNX_CARD_MINT_ENABLED; admin test can bypass the flag', () => {
    expect(SRC).toMatch(/LYNX_CARD_MINT_ENABLED/);
    expect(SRC).toMatch(/return lynxIsWired\(\) && cfg\(\)\.mintEnabled/);
    expect(SRC).toMatch(/if \(!lynxIsWired\(\)\)/);                     // always needs auth
    expect(SRC).toMatch(/if \(!opts\?\.adminTest && !c\.mintEnabled\)/); // customer needs flag; adminTest bypasses
  });

  it('auto-discovers the operator ActorID (env override, else from the actor hierarchy)', () => {
    expect(SRC).toMatch(/getActorHierarchy/);
    expect(SRC).toMatch(/resolveOperatorId/);
    expect(SRC).toMatch(/const operatorId = await resolveOperatorId\(\)/);
    expect(SRC).toMatch(/if \(!operatorId\)/); // fail-closed when it can't be resolved
    expect(SRC).toMatch(/ActorID: Number\(operatorId\)/);
  });

  it('mints a PREPAID card of QR physical type', () => {
    expect(SRC).toMatch(/CARD_TYPE_PREPAID = 33/);
    expect(SRC).toMatch(/PHYSICAL_TYPE_QR = 943237560/);
    expect(SRC).toMatch(/CardTypeID: CARD_TYPE_PREPAID/);
    expect(SRC).toMatch(/PhysicalTypeID: PHYSICAL_TYPE_QR/);
  });

  it('is SINGLE-USE (anti-replay) and money-credit for the EXACT amount', () => {
    expect(SRC).toMatch(/CreditSingleUseBit: true/);
    expect(SRC).toMatch(/CreditTypeMoneyBit: true/);
    expect(SRC).toMatch(/Credit: p\.amountIls/);
    expect(SRC).toMatch(/if \(!\(p\.amountIls > 0\)\)/); // rejects non-positive amounts
  });

  it('reuses LynxClient auth (no re-implemented auth) and never logs card internals', () => {
    expect(SRC).toMatch(/import \{ lynxRequest, lynxIsWired, getActorHierarchy \} from '\.\/LynxClient'/);
    expect(SRC).not.toMatch(/logger\.[a-z]+\([^)]*CardUniqueIdentifier/);
    expect(SRC).toMatch(/cardUidTail: cardUid\.slice\(-6\)/); // only a tail is logged
  });

  it('exposes reconciliation (getPrepaidCard) + pre-flight (validateForMachine)', () => {
    expect(SRC).toMatch(/\/operational\/v1\/cards\/\$\{encodeURIComponent\(cardId\)\}\/prepaid/);
    expect(SRC).toMatch(/validate-machine\/\$\{encodeURIComponent\(machineId\)\}/);
  });
});
