/**
 * Funding-aware CPA mapping pins — CEO 2026-08-27 §18-20 continuous
 * execution directive.
 *
 * The CEO's explicit rules on eGift as a FUNDING SOURCE (not a
 * commercial event):
 *   §18 — Shop towel ₪50 funded by eGift ₪20 + card ₪30 → sale stays
 *         SHOP_ITEM ₪50. Do NOT reclassify as EGIFT_REDEMPTION ₪20 +
 *         SHOP_ITEM ₪30 just because eGift covered part of it.
 *   §19 — Provider marketplace booking funded by eGift must stay
 *         disclosed-agent (VAT_ON_COMMISSION_ONLY). Do NOT convert to
 *         PetWash-principal (FULL_VAT / VAT_AT_REDEMPTION) because
 *         customer used gift value.
 *   §20 — Universal eGift × marketplace fiscal activation is BLOCKED
 *         until CEO explicitly approves the new mapping. Callers may
 *         PREVIEW the answer but the money path must not act on it.
 */
import { describe, it, expect } from 'vitest';
import {
  getSumitDocumentMapping,
  getFundingAwareSumitMapping,
} from '../services/sumitDocumentMapping';

describe('§18 funding source does not reclassify Shop / K9000 commercial sales', () => {
  it('SHOP_ITEM funded by eGift + card stays SHOP_ITEM (FULL_VAT, principal)', () => {
    const m = getFundingAwareSumitMapping({
      commercialClass: 'SHOP_ITEM',
      fundingRails: ['EGIFT', 'CARD'],
    });
    expect(m.documentType).toBe('InvoiceAndReceipt');
    expect(m.vatMode).toBe('FULL_VAT');
    expect(m.issuer).toBe('PETWASH_PRINCIPAL');
    expect(m.activationBlocked).toBeUndefined();
  });

  it('K9000_WASH funded by eGift stays K9000_WASH (FULL_VAT, principal)', () => {
    const m = getFundingAwareSumitMapping({
      commercialClass: 'K9000_WASH',
      fundingRails: ['EGIFT'],
    });
    expect(m).toEqual(getSumitDocumentMapping('K9000_WASH'));
  });

  it('WALLET_TOPUP funded by card is unchanged — stored value, no VAT', () => {
    const m = getFundingAwareSumitMapping({
      commercialClass: 'WALLET_TOPUP',
      fundingRails: ['CARD'],
    });
    expect(m.vatMode).toBe('NO_VAT_STORED_VALUE');
  });
});

describe('§19 marketplace bookings stay disclosed-agent regardless of funding rail', () => {
  it('PROVIDER_BOOKING_COMMISSION funded by CARD only — clean pass-through', () => {
    const m = getFundingAwareSumitMapping({
      commercialClass: 'PROVIDER_BOOKING_COMMISSION',
      fundingRails: ['CARD'],
    });
    expect(m.vatMode).toBe('VAT_ON_COMMISSION_ONLY');
    expect(m.issuer).toBe('PETWASH_DISCLOSED_AGENT');
    expect(m.activationBlocked).toBeUndefined();
  });

  it('PROVIDER_BOOKING_COMMISSION funded by eGift — same mapping AND activationBlocked', () => {
    const m = getFundingAwareSumitMapping({
      commercialClass: 'PROVIDER_BOOKING_COMMISSION',
      fundingRails: ['EGIFT', 'CARD'],
    });
    // The COMMERCIAL answer is unchanged — never reclassified as
    // principal/EGIFT_REDEMPTION just because eGift covered a leg.
    expect(m.vatMode).toBe('VAT_ON_COMMISSION_ONLY');
    expect(m.issuer).toBe('PETWASH_DISCLOSED_AGENT');
    expect(m.documentType).toBe('Invoice');
    // §20 activation gate — callers can PREVIEW but not ACT.
    expect(m.activationBlocked).toBe('MARKETPLACE_EGIFT_FISCAL_ACTIVATION');
  });

  it('PROVIDER_BOOKING_PRINCIPAL funded by eGift — same rule (principal-model marketplace)', () => {
    const m = getFundingAwareSumitMapping({
      commercialClass: 'PROVIDER_BOOKING_PRINCIPAL',
      fundingRails: ['EGIFT'],
    });
    expect(m.vatMode).toBe('FULL_VAT');
    expect(m.issuer).toBe('PETWASH_PRINCIPAL');
    expect(m.activationBlocked).toBe('MARKETPLACE_EGIFT_FISCAL_ACTIVATION');
  });
});

describe('§20 activation gate is a preview-only flag — not a hard error', () => {
  it('the function still returns the full mapping when activationBlocked is set', () => {
    const m = getFundingAwareSumitMapping({
      commercialClass: 'PROVIDER_BOOKING_COMMISSION',
      fundingRails: ['EGIFT'],
    });
    expect(m.documentType).toBeDefined();
    expect(m.vatMode).toBeDefined();
    expect(m.issuer).toBeDefined();
  });

  it('The base mapping is unchanged — activationBlocked is added, not swapped', () => {
    const base = getSumitDocumentMapping('PROVIDER_BOOKING_COMMISSION');
    const funded = getFundingAwareSumitMapping({
      commercialClass: 'PROVIDER_BOOKING_COMMISSION',
      fundingRails: ['EGIFT'],
    });
    expect(funded.documentType).toBe(base.documentType);
    expect(funded.vatMode).toBe(base.vatMode);
    expect(funded.issuer).toBe(base.issuer);
  });
});

describe('EGIFT_REDEMPTION remains principal — the standalone consumption case', () => {
  it('is untouched by the funding-aware helper', () => {
    // EGIFT_REDEMPTION is not a commercial-plus-funding call; the pair
    // that would produce it is 'principal service consumed entirely from
    // stored value' — an existing decision the CPA already made. The
    // helper doesn't invent a new answer here.
    const m = getFundingAwareSumitMapping({
      commercialClass: 'EGIFT_REDEMPTION',
      fundingRails: ['EGIFT'],
    });
    expect(m.vatMode).toBe('VAT_AT_REDEMPTION');
    expect(m.issuer).toBe('PETWASH_PRINCIPAL');
    // Non-marketplace class — no activation gate.
    expect(m.activationBlocked).toBeUndefined();
  });
});
