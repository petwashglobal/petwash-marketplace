/**
 * ProviderPayoutDestinationValidator — Program 41 + payout policy.
 */
import { describe, it, expect } from 'vitest';
import {
  validateIlBankAccount,
  maskBankAccount,
} from '../services/marketplace/ProviderPayoutDestinationValidator';

describe('validateIlBankAccount', () => {
  it('happy path Bank Leumi 10 / branch 800 / 6-digit account → OK', () => {
    expect(validateIlBankAccount({ bankCode: '10', branchCode: '800', accountNumber: '123456' }).code).toBe('OK');
  });

  it('missing field → MISSING_FIELD', () => {
    expect(validateIlBankAccount({ bankCode: '10' }).code).toBe('INVALID');
  });

  it('bank code 4 digits → BANK_CODE_INVALID', () => {
    const out = validateIlBankAccount({ bankCode: '1234', branchCode: '800', accountNumber: '123456' });
    expect(out.code).toBe('INVALID');
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('BANK_CODE_INVALID');
  });

  it('branch 2 digits → BRANCH_CODE_INVALID', () => {
    const out = validateIlBankAccount({ bankCode: '10', branchCode: '80', accountNumber: '123456' });
    expect(out.code).toBe('INVALID');
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('BRANCH_CODE_INVALID');
  });

  it('account 3 digits → ACCOUNT_NUMBER_INVALID', () => {
    const out = validateIlBankAccount({ bankCode: '10', branchCode: '800', accountNumber: '123' });
    expect(out.code).toBe('INVALID');
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('ACCOUNT_NUMBER_INVALID');
  });

  it('account 9 digits still OK; 10 digits invalid', () => {
    expect(validateIlBankAccount({ bankCode: '10', branchCode: '800', accountNumber: '123456789' }).code).toBe('OK');
    expect(validateIlBankAccount({ bankCode: '10', branchCode: '800', accountNumber: '1234567890' }).code).toBe('INVALID');
  });
});

describe('maskBankAccount', () => {
  it('returns last 4 only + bank + branch', () => {
    const out = maskBankAccount({ bankCode: '12', branchCode: '345', accountNumber: '987654321' });
    expect(out.accountLast4).toBe('4321');
    expect(out.bankCode).toBe('12');
    expect(out.branchCode).toBe('345');
  });

  it('padding when account shorter than 4', () => {
    const out = maskBankAccount({ bankCode: '10', branchCode: '800', accountNumber: '12' });
    expect(out.accountLast4.length).toBe(4);
  });
});
