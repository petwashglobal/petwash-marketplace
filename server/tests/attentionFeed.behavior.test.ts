/**
 * AttentionFeedItem — behavior pins (business §85, §93).
 */
import { describe, it, expect } from 'vitest';
import {
  CATEGORY_PRIMARY_ACTION,
  DEFAULT_SEVERITY,
  dropExpired,
  rankBySeverity,
  type AttentionFeedItem,
} from '../../shared/marketplace/attentionFeed';
import { getCatalogEntry } from '../../shared/marketplace/actionCatalog';

const it_now = '2026-08-30T12:00:00Z';

function attn(over: Partial<AttentionFeedItem> = {}): AttentionFeedItem {
  return {
    itemId: 'a1',
    category: 'RECEIPT_AVAILABLE',
    domain: 'BOOKING',
    severity: 'INFO',
    title: 'Receipt available',
    primaryActionType: 'SUPPORT_CONTACT_OPEN',
    dismissable: true,
    createdAt: '2026-08-30T00:00:00Z',
    ...over,
  };
}

describe('rankBySeverity (§85 stack-ranking)', () => {
  it('URGENT beats HIGH beats MEDIUM beats INFO', () => {
    const items = [
      attn({ itemId: 'info', severity: 'INFO' }),
      attn({ itemId: 'urgent', severity: 'URGENT' }),
      attn({ itemId: 'medium', severity: 'MEDIUM' }),
      attn({ itemId: 'high', severity: 'HIGH' }),
    ];
    const sorted = rankBySeverity(items);
    expect(sorted.map((i) => i.itemId)).toEqual(['urgent', 'high', 'medium', 'info']);
  });

  it('does not mutate input', () => {
    const items = [attn({ itemId: 'a', severity: 'INFO' }), attn({ itemId: 'b', severity: 'HIGH' })];
    const copy = [...items];
    rankBySeverity(items);
    expect(items).toEqual(copy);
  });
});

describe('dropExpired', () => {
  it('items without expiresAt survive', () => {
    const items = [attn({ itemId: 'a' })];
    expect(dropExpired(items, it_now)).toEqual(items);
  });

  it('items with expiresAt in the past are removed', () => {
    const items = [
      attn({ itemId: 'past', expiresAt: '2026-08-29T00:00:00Z' }),
      attn({ itemId: 'future', expiresAt: '2026-08-31T00:00:00Z' }),
    ];
    const kept = dropExpired(items, it_now);
    expect(kept.map((i) => i.itemId)).toEqual(['future']);
  });
});

describe('DEFAULT_SEVERITY — doctrine priorities (§85)', () => {
  it('provider compliance blockers are URGENT', () => {
    expect(DEFAULT_SEVERITY.PROVIDER_KYC_MISSING).toBe('URGENT');
    expect(DEFAULT_SEVERITY.PROVIDER_INSURANCE_EXPIRING).toBe('URGENT');
    expect(DEFAULT_SEVERITY.PROVIDER_AGREEMENT_REACCEPTANCE_REQUIRED).toBe('URGENT');
    expect(DEFAULT_SEVERITY.PAYMENT_STILL_PROCESSING).toBe('URGENT');
  });

  it('incoming provider requests + start-soon are HIGH', () => {
    expect(DEFAULT_SEVERITY.PROVIDER_REQUEST_INCOMING).toBe('HIGH');
    expect(DEFAULT_SEVERITY.PROVIDER_REQUEST_EXPIRES_SOON).toBe('HIGH');
    expect(DEFAULT_SEVERITY.BOOKING_STARTS_SOON).toBe('HIGH');
    expect(DEFAULT_SEVERITY.PROVIDER_PROPOSED_CHANGE).toBe('HIGH');
  });

  it('friendly nudges are INFO — never gate the user', () => {
    expect(DEFAULT_SEVERITY.PRESTIGE_JOIN_ELIGIBLE).toBe('INFO');
    expect(DEFAULT_SEVERITY.RECEIPT_AVAILABLE).toBe('INFO');
  });
});

describe('CATEGORY_PRIMARY_ACTION — every category points at a real ActionCatalog entry (§93)', () => {
  it('every mapping resolves via getCatalogEntry', () => {
    for (const [cat, actionType] of Object.entries(CATEGORY_PRIMARY_ACTION)) {
      const entry = getCatalogEntry(actionType);
      expect(entry, `category=${cat} → actionType=${actionType} must exist in ACTION_CATALOG`).toBeDefined();
    }
  });

  it('provider compliance items point at provider-catalog actions', () => {
    expect(CATEGORY_PRIMARY_ACTION.PROVIDER_KYC_MISSING).toBe('PROVIDER_APPLICATION_UPLOAD_ID');
    expect(CATEGORY_PRIMARY_ACTION.PROVIDER_AGREEMENT_REACCEPTANCE_REQUIRED).toBe('PROVIDER_AGREEMENT_ACCEPT');
  });

  it('PRESTIGE_JOIN_ELIGIBLE maps to PRESTIGE_JOIN', () => {
    expect(CATEGORY_PRIMARY_ACTION.PRESTIGE_JOIN_ELIGIBLE).toBe('PRESTIGE_JOIN');
  });
});
