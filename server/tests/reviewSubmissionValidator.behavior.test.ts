/**
 * ReviewSubmissionValidator — Program 28 submission validation.
 */
import { describe, it, expect } from 'vitest';
import { validateReviewSubmission } from '../services/marketplace/ReviewSubmissionValidator';

describe('ReviewSubmissionValidator', () => {
  it('happy path 5-star + body → OK, trims body', () => {
    const out = validateReviewSubmission({ ratingStars: 5, bodyText: '  great walk  ' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.normalised.ratingStars).toBe(5);
    expect(out.normalised.bodyText).toBe('great walk');
    expect(out.normalised.attachmentCount).toBe(0);
  });

  it('rating 0 → RATING_OUT_OF_RANGE', () => {
    const out = validateReviewSubmission({ ratingStars: 0 });
    expect(out.code).toBe('INVALID');
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('RATING_OUT_OF_RANGE');
  });

  it('rating 6 → RATING_OUT_OF_RANGE', () => {
    expect(validateReviewSubmission({ ratingStars: 6 }).code).toBe('INVALID');
  });

  it('rating 3.5 → RATING_NOT_INTEGER', () => {
    const out = validateReviewSubmission({ ratingStars: 3.5 });
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('RATING_NOT_INTEGER');
  });

  it('body over 2000 chars → BODY_TOO_LONG', () => {
    const long = 'a'.repeat(2001);
    const out = validateReviewSubmission({ ratingStars: 5, bodyText: long });
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('BODY_TOO_LONG');
  });

  it('abusive body → BODY_UNSAFE (routes through MessageSafetyClassifier)', () => {
    const out = validateReviewSubmission({ ratingStars: 1, bodyText: 'You are a fucking idiot.' });
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('BODY_UNSAFE');
  });

  it('pet-health language is ALLOW → OK', () => {
    const out = validateReviewSubmission({ ratingStars: 5, bodyText: 'She was gentle even though my dog is in heat.' });
    expect(out.code).toBe('OK');
  });

  it('too many attachments → TOO_MANY_ATTACHMENTS', () => {
    const out = validateReviewSubmission({ ratingStars: 5, attachmentCount: 99 });
    if (out.code !== 'INVALID') throw new Error();
    expect(out.reasonCode).toBe('TOO_MANY_ATTACHMENTS');
  });

  it('negative attachment count → TOO_MANY_ATTACHMENTS (treats as invalid)', () => {
    const out = validateReviewSubmission({ ratingStars: 5, attachmentCount: -1 });
    expect(out.code).toBe('INVALID');
  });
});
