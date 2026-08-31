/**
 * Regression pin — PetWash Nayax merchant spec matches the
 * 2026-08-30 audit. If a value is flipped (e.g. mccIsCorrect to
 * true) it MUST be paired with the matching BusinessDecisionRegistry
 * key flipping to APPROVED with decidedBy + decidedAt evidence.
 */
import { describe, it, expect } from 'vitest';
import {
  PETWASH_NAYAX_OPERATOR,
  PETWASH_NAYAX_MACHINES,
  isKnownMachineId,
  operatorHasEReceiptModule,
  operatorMccIsCorrect,
} from '@shared/nayax/merchantConfigSpec';

describe('PETWASH_NAYAX_OPERATOR — audited baseline', () => {
  it('operator identity matches the audit record', () => {
    expect(PETWASH_NAYAX_OPERATOR.operatorId).toBe('2002942146');
    expect(PETWASH_NAYAX_OPERATOR.internalCode).toBe('30230');
    expect(PETWASH_NAYAX_OPERATOR.legalName).toBe('Pet Wash Ltd');
    expect(PETWASH_NAYAX_OPERATOR.parent).toBe('NAYAX_ISRAEL_DUALLY');
    expect(PETWASH_NAYAX_OPERATOR.billingGateway).toBe('ASHRAIT');
  });

  it('MCC currently 5814 (Fast Food) and marked wrong until Nayax fixes it', () => {
    expect(PETWASH_NAYAX_OPERATOR.mcc).toBe('5814');
    expect(PETWASH_NAYAX_OPERATOR.mccIsCorrect).toBe(false);
    expect(operatorMccIsCorrect()).toBe(false);
  });

  it('eReceipt module + on-transaction flag are OFF until Nayax provisions', () => {
    expect(PETWASH_NAYAX_OPERATOR.eReceiptModuleEnabled).toBe(false);
    expect(PETWASH_NAYAX_OPERATOR.eReceiptOnTransactionEnd).toBe(false);
    expect(operatorHasEReceiptModule()).toBe(false);
  });

  it('Dynamic Receipt + Scheduled Reports are OFF', () => {
    expect(PETWASH_NAYAX_OPERATOR.dynamicReceiptEnabled).toBe(false);
    expect(PETWASH_NAYAX_OPERATOR.scheduledReportsEnabled).toBe(false);
  });
});

describe('PETWASH_NAYAX_MACHINES — 4 audited K9000 devices', () => {
  it('exactly 4 machines', () => {
    expect(PETWASH_NAYAX_MACHINES).toHaveLength(4);
  });

  it('every audited machineId is recognised', () => {
    for (const id of ['182374', '182403', '182443', '182462']) {
      expect(isKnownMachineId(id)).toBe(true);
    }
  });

  it('unknown machineId → false (never fabricates a device)', () => {
    expect(isKnownMachineId('999999')).toBe(false);
    expect(isKnownMachineId('')).toBe(false);
  });

  it('every machine is K9000_MDB_AUTO_SPA + ILS + cashless + telemetry', () => {
    for (const m of PETWASH_NAYAX_MACHINES) {
      expect(m.kind).toBe('K9000_MDB_AUTO_SPA');
      expect(m.currency).toBe('ILS');
      expect(m.cashless).toBe(true);
      expect(m.telemetry).toBe(true);
    }
  });

  it('every machine accepts CREDIT_CARD + MONYX_BALANCE + PREPAID_CREDIT', () => {
    for (const m of PETWASH_NAYAX_MACHINES) {
      expect(m.paymentMethods.sort()).toEqual(['CREDIT_CARD', 'MONYX_BALANCE', 'PREPAID_CREDIT']);
    }
  });

  it('device ids match the audit record', () => {
    const map = Object.fromEntries(PETWASH_NAYAX_MACHINES.map((m) => [m.machineId, m.deviceId]));
    expect(map).toEqual({
      '182374': '854470209',
      '182403': '671709106',
      '182443': '369617593',
      '182462': '188843334',
    });
  });
});
