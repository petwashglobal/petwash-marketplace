/**
 * MerchantConfigSpec — CEO P0-NAYAX task #170.
 *
 * The audited state of the Pet Wash Nayax merchant account
 * (2026-08-30 read-only audit). This spec is CANONICAL — every
 * server surface that reasons about "does Pet Wash's Nayax
 * operator have X enabled?" reads from this file instead of
 * inventing its own answer.
 *
 * NEVER mutate this spec in a code path. It is a compile-time
 * record of what Nayax has (or hasn't) enabled for us. When
 * Nayax's account manager enables a module or corrects the MCC,
 * this file is updated by hand, referenced in a commit that also
 * flips the matching BusinessDecisionRegistry entry to APPROVED
 * with decidedBy + decidedAt.
 *
 * NOT PII. Machine ids + operator id are commercial identifiers
 * Nayax itself surfaces in DTM.
 */

export type NayaxMachineKind = 'K9000_MDB_AUTO_SPA';
export type NayaxPaymentMethod = 'CREDIT_CARD' | 'MONYX_BALANCE' | 'PREPAID_CREDIT';

export interface NayaxMachineSpec {
  machineId: string;                        // e.g. '182374'
  deviceId: string;                         // e.g. '854470209'
  displayName: string;                      // stable slug (Hebrew label kept as data)
  kind: NayaxMachineKind;
  cashless: boolean;
  telemetry: boolean;
  currency: 'ILS';
  paymentMethods: NayaxPaymentMethod[];
  group: string;                            // e.g. 'PetWash_KfarSaba'
}

export interface NayaxOperatorSpec {
  operatorId: string;                       // '2002942146'
  internalCode: string;                     // '30230'
  legalName: string;                        // 'Pet Wash Ltd'
  parent: 'NAYAX_ISRAEL_DUALLY';
  status: 'ACTIVE' | 'DISABLED';
  addressCode: string;                      // stable slug
  culture: 'he-IL';
  timeZone: 'Asia/Jerusalem';
  currency: 'ILS';
  billingGateway: 'ASHRAIT';
  mcc: string;                              // '5814' at audit time
  mccIsCorrect: boolean;                    // false at audit time
  eReceiptModuleEnabled: boolean;           // false at audit time
  eReceiptOnTransactionEnd: boolean;        // false at audit time
  dynamicReceiptEnabled: boolean;           // false at audit time
  scheduledReportsEnabled: boolean;         // false at audit time
}

export const PETWASH_NAYAX_OPERATOR: NayaxOperatorSpec = {
  operatorId: '2002942146',
  internalCode: '30230',
  legalName: 'Pet Wash Ltd',
  parent: 'NAYAX_ISRAEL_DUALLY',
  status: 'ACTIVE',
  addressCode: 'ADDR_UZI_CHITMAN_8_ROSH_HAAYIN',
  culture: 'he-IL',
  timeZone: 'Asia/Jerusalem',
  currency: 'ILS',
  billingGateway: 'ASHRAIT',
  mcc: '5814',
  mccIsCorrect: false,
  eReceiptModuleEnabled: false,
  eReceiptOnTransactionEnd: false,
  dynamicReceiptEnabled: false,
  scheduledReportsEnabled: false,
};

export const PETWASH_NAYAX_MACHINES: readonly NayaxMachineSpec[] = [
  {
    machineId: '182374',
    deviceId: '854470209',
    displayName: 'KFAR_SABA_PARK_80_GREEN_LEFT_002',
    kind: 'K9000_MDB_AUTO_SPA',
    cashless: true,
    telemetry: true,
    currency: 'ILS',
    paymentMethods: ['CREDIT_CARD', 'MONYX_BALANCE', 'PREPAID_CREDIT'],
    group: 'PetWash_KfarSaba',
  },
  {
    machineId: '182403',
    deviceId: '671709106',
    displayName: 'KFAR_SABA_PARK_80_GREEN_RIGHT_002',
    kind: 'K9000_MDB_AUTO_SPA',
    cashless: true,
    telemetry: true,
    currency: 'ILS',
    paymentMethods: ['CREDIT_CARD', 'MONYX_BALANCE', 'PREPAID_CREDIT'],
    group: 'PetWash_KfarSaba',
  },
  {
    machineId: '182443',
    deviceId: '369617593',
    displayName: 'KFAR_SABA_PARK_WARD_RIGHT',
    kind: 'K9000_MDB_AUTO_SPA',
    cashless: true,
    telemetry: true,
    currency: 'ILS',
    paymentMethods: ['CREDIT_CARD', 'MONYX_BALANCE', 'PREPAID_CREDIT'],
    group: 'PetWash_KfarSaba',
  },
  {
    machineId: '182462',
    deviceId: '188843334',
    displayName: 'KFAR_SABA_PARK_WARD_LEFT',
    kind: 'K9000_MDB_AUTO_SPA',
    cashless: true,
    telemetry: true,
    currency: 'ILS',
    paymentMethods: ['CREDIT_CARD', 'MONYX_BALANCE', 'PREPAID_CREDIT'],
    group: 'PetWash_KfarSaba',
  },
];

/** Utility guards used by NayaxFiscalDocumentGuard and admin surfaces. */
/**
 * Resolve a Nayax identifier (either the audited machineId like
 * '182374' OR the physical deviceId like '854470209') to the
 * canonical machineId. Returns undefined if neither form matches
 * any of the four audited machines.
 *
 * Callers (fiscal composer, guard wire) use this because the
 * runtime write-side may store either form on the K9000 event; the
 * guard operates on the canonical machineId regardless.
 */
export function resolveMachineId(candidate: string | null | undefined): string | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  if (!trimmed) return undefined;
  const hit = PETWASH_NAYAX_MACHINES.find(
    (m) => m.machineId === trimmed || m.deviceId === trimmed,
  );
  return hit?.machineId;
}

export function isKnownMachineId(machineId: string): boolean {
  return PETWASH_NAYAX_MACHINES.some((m) => m.machineId === machineId);
}
export function operatorHasEReceiptModule(op: NayaxOperatorSpec = PETWASH_NAYAX_OPERATOR): boolean {
  return op.eReceiptModuleEnabled;
}
export function operatorMccIsCorrect(op: NayaxOperatorSpec = PETWASH_NAYAX_OPERATOR): boolean {
  return op.mccIsCorrect;
}
