/**
 * ProviderPayoutDestinationValidator — CEO PROGRAM 41 (Security) + Program 12.
 *
 * Pure evaluator. Israeli bank routing shape validator + payout
 * destination policy. Doctrine: no raw bank exposure in responses,
 * no engineer default for account-status heuristics — the
 * evaluator only shapes + validates. Real activation always requires
 * a human-approved KYC lift.
 */

export interface IlBankAccount {
  bankCode: string;                         // 2- or 3-digit Israeli bank code
  branchCode: string;                       // 3-digit branch
  accountNumber: string;                    // 5-9 digits
}

export type ValidationOutcome =
  | { code: 'OK' }
  | { code: 'INVALID'; reasonCode:
      | 'BANK_CODE_INVALID'
      | 'BRANCH_CODE_INVALID'
      | 'ACCOUNT_NUMBER_INVALID'
      | 'MISSING_FIELD' };

const RE_BANK = /^\d{2,3}$/;
const RE_BRANCH = /^\d{3}$/;
const RE_ACCOUNT = /^\d{5,9}$/;

export function validateIlBankAccount(input: Partial<IlBankAccount>): ValidationOutcome {
  if (!input.bankCode || !input.branchCode || !input.accountNumber) {
    return { code: 'INVALID', reasonCode: 'MISSING_FIELD' };
  }
  if (!RE_BANK.test(input.bankCode)) return { code: 'INVALID', reasonCode: 'BANK_CODE_INVALID' };
  if (!RE_BRANCH.test(input.branchCode)) return { code: 'INVALID', reasonCode: 'BRANCH_CODE_INVALID' };
  if (!RE_ACCOUNT.test(input.accountNumber)) return { code: 'INVALID', reasonCode: 'ACCOUNT_NUMBER_INVALID' };
  return { code: 'OK' };
}

/**
 * Safe-to-return projection of a bank account for the provider's
 * own view. NEVER include the full account number in any surface
 * the provider does not own directly.
 */
export interface BankAccountMasked {
  bankCode: string;
  branchCode: string;
  accountLast4: string;
}

export function maskBankAccount(input: IlBankAccount): BankAccountMasked {
  const acc = input.accountNumber;
  const last4 = acc.length >= 4 ? acc.slice(-4) : acc.padStart(4, '•');
  return { bankCode: input.bankCode, branchCode: input.branchCode, accountLast4: last4 };
}
