/**
 * TranslationSlugCatalog — the every-string-is-a-slug contract.
 */
import { describe, it, expect } from 'vitest';
import {
  REASON_CODES,
  TITLE_CODES,
  MONEY_LABEL_CODES,
  isKnownReasonCode,
  isKnownTitleCode,
  isKnownMoneyLabelCode,
  isKnownSubtitleCode,
  isKnownAttentionDomainCode,
} from '@shared/marketplace/translationSlugCatalog';

describe('TranslationSlugCatalog', () => {
  it('every reason code is unique (no duplicates crept into the list)', () => {
    const set = new Set(REASON_CODES);
    expect(set.size).toBe(REASON_CODES.length);
  });

  it('every title code is unique', () => {
    const set = new Set(TITLE_CODES);
    expect(set.size).toBe(TITLE_CODES.length);
  });

  it('every money label code is unique', () => {
    const set = new Set(MONEY_LABEL_CODES);
    expect(set.size).toBe(MONEY_LABEL_CODES.length);
  });

  it('isKnown* guards accept declared slugs', () => {
    expect(isKnownReasonCode('CONFIRMED')).toBe(true);
    expect(isKnownReasonCode('POLICY_NOT_CONFIGURED')).toBe(true);
    expect(isKnownTitleCode('DOCUMENT_RECEIPT')).toBe(true);
    expect(isKnownMoneyLabelCode('REFUND_AMOUNT')).toBe(true);
    expect(isKnownSubtitleCode('ISSUER_SUMIT')).toBe(true);
    expect(isKnownAttentionDomainCode('BOOKING')).toBe(true);
  });

  it('isKnown* guards reject unknown slugs (catches accidental new slugs)', () => {
    expect(isKnownReasonCode('SOMETHING_NOT_IN_CATALOG')).toBe(false);
    expect(isKnownTitleCode('MADE_UP_TITLE')).toBe(false);
    expect(isKnownMoneyLabelCode('MADE_UP_LABEL')).toBe(false);
  });

  it('catalog covers the critical §12 payment-uncertainty codes', () => {
    // These slugs must exist because the doctrine explicitly forbids
    // inventing user-facing copy for payment uncertainty.
    expect(isKnownReasonCode('PAYMENT_PENDING')).toBe(true);
    expect(isKnownReasonCode('PAYMENT_FAILED')).toBe(true);
  });

  it('catalog covers §21-§22 POLICY_NOT_CONFIGURED discipline', () => {
    expect(isKnownReasonCode('POLICY_NOT_CONFIGURED')).toBe(true);
  });
});
