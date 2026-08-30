/**
 * CategoryFilterEvaluator — CEO PROGRAM 10 (Unified Inbox categories).
 *
 * Pure evaluator. Doctrine: Pet Parent tabs are All / Messages /
 * Bookings / Orders / Payments & Documents / Support; Provider tabs
 * are All / Requests / Messages / Active Jobs / Earnings /
 * Compliance / Support. Given an InboxItem's itemKind + domain +
 * workspaceContext, decides which category tab it belongs to.
 *
 * The evaluator NEVER queries — it only classifies items already
 * loaded. Category ALL is the union of all other categories.
 */

export type Workspace = 'PET_PARENT' | 'PROVIDER';

export type PetParentCategory =
  | 'ALL'
  | 'MESSAGES'
  | 'BOOKINGS'
  | 'ORDERS'
  | 'PAYMENTS_AND_DOCUMENTS'
  | 'SUPPORT';

export type ProviderCategory =
  | 'ALL'
  | 'REQUESTS'
  | 'MESSAGES'
  | 'ACTIVE_JOBS'
  | 'EARNINGS'
  | 'COMPLIANCE'
  | 'SUPPORT';

export type ItemKind =
  | 'CONVERSATION'
  | 'ATTENTION'
  | 'PROVIDER_REQUEST'
  | 'BOOKING_EVENT'
  | 'ORDER_EVENT'
  | 'PAYMENT_EVENT'
  | 'DOCUMENT'
  | 'SUPPORT_CASE'
  | 'EARNINGS_EVENT'
  | 'COMPLIANCE_EVENT';

export type Domain =
  | 'BOOKING'
  | 'SHOP'
  | 'PET'
  | 'PROVIDER'
  | 'PRESTIGE'
  | 'K9000'
  | 'EGIFT'
  | 'WALLET'
  | 'PAYOUT'
  | 'SUPPORT';

export interface CategorizeInput {
  itemKind: ItemKind;
  domain: Domain;
  workspace: Workspace;
}

export function categorizeForPetParent(input: CategorizeInput): PetParentCategory {
  if (input.itemKind === 'SUPPORT_CASE' || input.domain === 'SUPPORT') return 'SUPPORT';
  if (input.itemKind === 'CONVERSATION') return 'MESSAGES';
  if (input.itemKind === 'BOOKING_EVENT') return 'BOOKINGS';
  if (input.itemKind === 'ORDER_EVENT') return 'ORDERS';
  if (input.itemKind === 'PAYMENT_EVENT' || input.itemKind === 'DOCUMENT') return 'PAYMENTS_AND_DOCUMENTS';
  // ATTENTION items route by their domain.
  if (input.itemKind === 'ATTENTION') {
    if (input.domain === 'BOOKING') return 'BOOKINGS';
    if (input.domain === 'SHOP') return 'ORDERS';
    if (input.domain === 'WALLET' || input.domain === 'EGIFT' || input.domain === 'K9000') return 'PAYMENTS_AND_DOCUMENTS';
    return 'MESSAGES';
  }
  return 'MESSAGES';
}

export function categorizeForProvider(input: CategorizeInput): ProviderCategory {
  if (input.itemKind === 'SUPPORT_CASE' || input.domain === 'SUPPORT') return 'SUPPORT';
  if (input.itemKind === 'PROVIDER_REQUEST') return 'REQUESTS';
  if (input.itemKind === 'CONVERSATION') return 'MESSAGES';
  if (input.itemKind === 'EARNINGS_EVENT' || input.domain === 'PAYOUT') return 'EARNINGS';
  if (input.itemKind === 'COMPLIANCE_EVENT') return 'COMPLIANCE';
  if (input.itemKind === 'BOOKING_EVENT') return 'ACTIVE_JOBS';
  if (input.itemKind === 'ATTENTION') {
    // PAYOUT-domain attention was already handled above via the
    // `input.domain === 'PAYOUT'` short-circuit.
    if (input.domain === 'PROVIDER') return 'COMPLIANCE';
    if (input.domain === 'BOOKING') return 'ACTIVE_JOBS';
    return 'MESSAGES';
  }
  return 'MESSAGES';
}

/** ALL matches every non-ALL category — used by the filter to pass-through. */
export function matchesFilter(itemCategory: string, filter: string): boolean {
  return filter === 'ALL' || itemCategory === filter;
}
