/**
 * ContactMaskingService — PII display masking.
 */
import { describe, it, expect } from 'vitest';
import {
  maskEmail,
  maskIlPhone,
  maskAccountNumber,
  maskNationalId,
  maskContactBundle,
} from '../services/marketplace/ContactMaskingService';

describe('maskEmail', () => {
  it('normal address → keeps first + last char of local', () => {
    expect(maskEmail('alice@example.com')).toBe('a•••e@example.com');
  });

  it('very short local (2 chars) → only first char shown', () => {
    expect(maskEmail('ab@example.com')).toBe('a•••@example.com');
  });

  it('no @ → empty', () => {
    expect(maskEmail('not-an-email')).toBe('');
  });

  it('empty → empty', () => {
    expect(maskEmail('')).toBe('');
  });
});

describe('maskIlPhone', () => {
  it('strips separators and keeps last 2 digits', () => {
    expect(maskIlPhone('+972 50-123-4567')).toBe('05• ••• •• 67');
  });

  it('local format keeps last 2', () => {
    expect(maskIlPhone('050 987 6543')).toBe('05• ••• •• 43');
  });

  it('too short → empty', () => {
    expect(maskIlPhone('12')).toBe('');
  });
});

describe('maskAccountNumber', () => {
  it('keeps last 4 preceded by masked groups', () => {
    expect(maskAccountNumber('123456789')).toBe('•••• •••• 6789');
  });

  it('short account → padded to 4', () => {
    expect(maskAccountNumber('12')).toBe('••12');
  });
});

describe('maskNationalId', () => {
  it('keeps last 3 digits', () => {
    expect(maskNationalId('123456789')).toBe('••••• 789');
  });

  it('too short → empty', () => {
    expect(maskNationalId('1')).toBe('');
  });
});

describe('maskContactBundle', () => {
  it('projects only the fields provided', () => {
    const out = maskContactBundle({ email: 'x@y.com' });
    expect(out.emailMasked).toBe('x•••@y.com');
    expect(out.phoneMasked).toBeUndefined();
    expect(out.accountLast4Masked).toBeUndefined();
    expect(out.nationalIdMasked).toBeUndefined();
  });
});
