/**
 * NayaxFiscalDocumentGuard — CEO P0-NAYAX task #168.
 *
 * Pure evaluator. Decides whether any surface may TREAT a Nayax
 * K9000 transaction as having an auto-issued Israeli fiscal
 * document (חשבונית מס / קבלה).
 *
 * Doctrine (auditor 2026-08-30):
 *   • eReceipt module screen doesn't exist in this operator yet.
 *   • The document you saw was generated MANUALLY via DTM →
 *     Generate Receipt.
 *   • Until Nayax answers WHICH fiscal engine backs that manual
 *     generation AND enables the E-Receipt module, code MUST NOT
 *     claim a Nayax transaction has an automatic Israeli tax
 *     invoice.
 *
 * Verdicts:
 *   ASSUME_ISSUED               → BOTH the module is enabled AND
 *                                  the fiscal engine is APPROVED in
 *                                  the BusinessDecisionRegistry.
 *   REFUSE_NO_MODULE             → operator.eReceiptModuleEnabled=false
 *   REFUSE_ENGINE_UNKNOWN        → NAYAX_FISCAL_ENGINE_IDENTITY
 *                                  is UNDECIDED in the registry.
 *   REFUSE_TRANSACTION_END_FLAG  → module is on but the operator's
 *                                  "Enable eReceipt on Transaction
 *                                  end" checkbox is still off (per
 *                                  auditor step 5 discipline).
 *   REFUSE_UNKNOWN_MACHINE       → machineId is not one of the four
 *                                  audited devices — never assume
 *                                  a receipt for a machine the
 *                                  spec doesn't recognise.
 */
import {
  isPolicyConfigured,
} from '@shared/marketplace/businessDecisionRegistry';
import {
  PETWASH_NAYAX_OPERATOR,
  isKnownMachineId,
  type NayaxOperatorSpec,
} from '@shared/nayax/merchantConfigSpec';

export interface FiscalGuardInput {
  machineId: string;
  operator?: NayaxOperatorSpec;             // defaults to the audited PetWash operator
  /**
   * The BusinessDecisionRegistry key for the fiscal engine identity
   * — kept injectable so tests can flip a mock registry without
   * touching the real one.
   */
  fiscalEngineIdentityKey?: string;
}

export type FiscalGuardOutcome =
  | { code: 'ASSUME_ISSUED'; reasonCode: 'MODULE_AND_ENGINE_APPROVED' }
  | { code: 'REFUSE'; reasonCode:
      | 'NO_MODULE'
      | 'ENGINE_UNKNOWN'
      | 'TRANSACTION_END_FLAG_OFF'
      | 'UNKNOWN_MACHINE' };

export function guardFiscalDocument(input: FiscalGuardInput): FiscalGuardOutcome {
  const operator = input.operator ?? PETWASH_NAYAX_OPERATOR;

  if (!isKnownMachineId(input.machineId)) {
    return { code: 'REFUSE', reasonCode: 'UNKNOWN_MACHINE' };
  }
  if (!operator.eReceiptModuleEnabled) {
    return { code: 'REFUSE', reasonCode: 'NO_MODULE' };
  }
  const engineKey = input.fiscalEngineIdentityKey ?? 'NAYAX_FISCAL_ENGINE_IDENTITY';
  if (!isPolicyConfigured(engineKey)) {
    return { code: 'REFUSE', reasonCode: 'ENGINE_UNKNOWN' };
  }
  if (!operator.eReceiptOnTransactionEnd) {
    return { code: 'REFUSE', reasonCode: 'TRANSACTION_END_FLAG_OFF' };
  }
  return { code: 'ASSUME_ISSUED', reasonCode: 'MODULE_AND_ENGINE_APPROVED' };
}
