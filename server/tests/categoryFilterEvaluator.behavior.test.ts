/**
 * CategoryFilterEvaluator — Program 10.
 */
import { describe, it, expect } from 'vitest';
import {
  categorizeForPetParent,
  categorizeForProvider,
  matchesFilter,
} from '../services/marketplace/CategoryFilterEvaluator';

describe('CategoryFilterEvaluator — Pet Parent', () => {
  it('booking event → BOOKINGS', () => {
    expect(categorizeForPetParent({ itemKind: 'BOOKING_EVENT', domain: 'BOOKING', workspace: 'PET_PARENT' })).toBe('BOOKINGS');
  });

  it('conversation → MESSAGES', () => {
    expect(categorizeForPetParent({ itemKind: 'CONVERSATION', domain: 'BOOKING', workspace: 'PET_PARENT' })).toBe('MESSAGES');
  });

  it('order event → ORDERS', () => {
    expect(categorizeForPetParent({ itemKind: 'ORDER_EVENT', domain: 'SHOP', workspace: 'PET_PARENT' })).toBe('ORDERS');
  });

  it('payment / document → PAYMENTS_AND_DOCUMENTS', () => {
    expect(categorizeForPetParent({ itemKind: 'PAYMENT_EVENT', domain: 'WALLET', workspace: 'PET_PARENT' })).toBe('PAYMENTS_AND_DOCUMENTS');
    expect(categorizeForPetParent({ itemKind: 'DOCUMENT', domain: 'BOOKING', workspace: 'PET_PARENT' })).toBe('PAYMENTS_AND_DOCUMENTS');
  });

  it('support case → SUPPORT', () => {
    expect(categorizeForPetParent({ itemKind: 'SUPPORT_CASE', domain: 'BOOKING', workspace: 'PET_PARENT' })).toBe('SUPPORT');
  });

  it('ATTENTION on WALLET → PAYMENTS_AND_DOCUMENTS (money attention lives with money)', () => {
    expect(categorizeForPetParent({ itemKind: 'ATTENTION', domain: 'WALLET', workspace: 'PET_PARENT' })).toBe('PAYMENTS_AND_DOCUMENTS');
  });
});

describe('CategoryFilterEvaluator — Provider', () => {
  it('provider request → REQUESTS', () => {
    expect(categorizeForProvider({ itemKind: 'PROVIDER_REQUEST', domain: 'BOOKING', workspace: 'PROVIDER' })).toBe('REQUESTS');
  });

  it('payout attention → EARNINGS', () => {
    expect(categorizeForProvider({ itemKind: 'ATTENTION', domain: 'PAYOUT', workspace: 'PROVIDER' })).toBe('EARNINGS');
  });

  it('compliance event → COMPLIANCE', () => {
    expect(categorizeForProvider({ itemKind: 'COMPLIANCE_EVENT', domain: 'PROVIDER', workspace: 'PROVIDER' })).toBe('COMPLIANCE');
  });

  it('booking event → ACTIVE_JOBS (provider treats it as active work)', () => {
    expect(categorizeForProvider({ itemKind: 'BOOKING_EVENT', domain: 'BOOKING', workspace: 'PROVIDER' })).toBe('ACTIVE_JOBS');
  });

  it('support case → SUPPORT', () => {
    expect(categorizeForProvider({ itemKind: 'SUPPORT_CASE', domain: 'BOOKING', workspace: 'PROVIDER' })).toBe('SUPPORT');
  });
});

describe('matchesFilter', () => {
  it('ALL matches any category', () => {
    expect(matchesFilter('BOOKINGS', 'ALL')).toBe(true);
    expect(matchesFilter('SUPPORT', 'ALL')).toBe(true);
  });

  it('exact match only otherwise', () => {
    expect(matchesFilter('BOOKINGS', 'BOOKINGS')).toBe(true);
    expect(matchesFilter('BOOKINGS', 'ORDERS')).toBe(false);
  });
});
