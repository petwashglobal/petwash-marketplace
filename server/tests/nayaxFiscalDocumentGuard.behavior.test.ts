/**
 * NayaxFiscalDocumentGuard — CEO P0-NAYAX task #168.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the registry so we can flip engine-known / engine-unknown
// per test without touching the real UNDECIDED entries.
const state = vi.hoisted(() => ({ engineApproved: false }));

vi.mock('@shared/marketplace/businessDecisionRegistry', () => ({
  isPolicyConfigured: (key: string) =>
    key === 'NAYAX_FISCAL_ENGINE_IDENTITY' ? state.engineApproved : false,
  getBusinessDecision: () => undefined,
  BUSINESS_DECISIONS: [],
}));

const { guardFiscalDocument } = await import('../services/marketplace/NayaxFiscalDocumentGuard');
const { PETWASH_NAYAX_OPERATOR } = await import('@shared/nayax/merchantConfigSpec');

describe('NayaxFiscalDocumentGuard', () => {
  it('audited baseline (module OFF) → REFUSE(NO_MODULE) even with a known machine', () => {
    state.engineApproved = false;
    const out = guardFiscalDocument({ machineId: '182374' });
    expect(out.code).toBe('REFUSE');
    if (out.code !== 'REFUSE') throw new Error();
    expect(out.reasonCode).toBe('NO_MODULE');
  });

  it('unknown machine → REFUSE(UNKNOWN_MACHINE) regardless of module state', () => {
    state.engineApproved = true;
    const out = guardFiscalDocument({
      machineId: '999999',
      operator: { ...PETWASH_NAYAX_OPERATOR, eReceiptModuleEnabled: true, eReceiptOnTransactionEnd: true },
    });
    expect(out.code).toBe('REFUSE');
    if (out.code !== 'REFUSE') throw new Error();
    expect(out.reasonCode).toBe('UNKNOWN_MACHINE');
  });

  it('module ON + engine UNDECIDED → REFUSE(ENGINE_UNKNOWN)', () => {
    state.engineApproved = false;
    const out = guardFiscalDocument({
      machineId: '182374',
      operator: { ...PETWASH_NAYAX_OPERATOR, eReceiptModuleEnabled: true, eReceiptOnTransactionEnd: true },
    });
    expect(out.code).toBe('REFUSE');
    if (out.code !== 'REFUSE') throw new Error();
    expect(out.reasonCode).toBe('ENGINE_UNKNOWN');
  });

  it('module ON + engine APPROVED + per-tx flag OFF → REFUSE(TRANSACTION_END_FLAG_OFF)', () => {
    state.engineApproved = true;
    const out = guardFiscalDocument({
      machineId: '182374',
      operator: { ...PETWASH_NAYAX_OPERATOR, eReceiptModuleEnabled: true, eReceiptOnTransactionEnd: false },
    });
    expect(out.code).toBe('REFUSE');
    if (out.code !== 'REFUSE') throw new Error();
    expect(out.reasonCode).toBe('TRANSACTION_END_FLAG_OFF');
  });

  it('ALL conditions met → ASSUME_ISSUED with MODULE_AND_ENGINE_APPROVED', () => {
    state.engineApproved = true;
    const out = guardFiscalDocument({
      machineId: '182462',
      operator: { ...PETWASH_NAYAX_OPERATOR, eReceiptModuleEnabled: true, eReceiptOnTransactionEnd: true },
    });
    expect(out.code).toBe('ASSUME_ISSUED');
    if (out.code !== 'ASSUME_ISSUED') throw new Error();
    expect(out.reasonCode).toBe('MODULE_AND_ENGINE_APPROVED');
  });

  it('empty machineId → REFUSE(UNKNOWN_MACHINE)', () => {
    const out = guardFiscalDocument({ machineId: '' });
    expect(out.code).toBe('REFUSE');
    if (out.code !== 'REFUSE') throw new Error();
    expect(out.reasonCode).toBe('UNKNOWN_MACHINE');
  });

  it('all four audited machines are recognised (module-off still refuses, but for the RIGHT reason)', () => {
    state.engineApproved = false;
    for (const id of ['182374', '182403', '182443', '182462']) {
      const out = guardFiscalDocument({ machineId: id });
      expect(out.code).toBe('REFUSE');
      if (out.code !== 'REFUSE') throw new Error();
      expect(out.reasonCode).toBe('NO_MODULE');
    }
  });
});
