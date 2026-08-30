/**
 * ReviewSubmissionValidator — CEO PROGRAM 28 (Reviews).
 *
 * Pure evaluator. Given a review submission payload, validates the
 * shape + safety before it lands in the reviews table. Callers wire
 * this AFTER ReviewEligibilityService confirmed the review is
 * allowed at all.
 */
import { classifyMessage } from './MessageSafetyClassifier';

export interface ReviewPayload {
  ratingStars: number;                      // 1..5 integer
  bodyText?: string;
  attachmentCount?: number;
}

export type SubmissionOutcome =
  | { code: 'OK'; normalised: { ratingStars: number; bodyText: string; attachmentCount: number } }
  | { code: 'INVALID'; reasonCode:
      | 'RATING_OUT_OF_RANGE'
      | 'RATING_NOT_INTEGER'
      | 'BODY_TOO_LONG'
      | 'BODY_UNSAFE'
      | 'TOO_MANY_ATTACHMENTS' };

const MAX_BODY_CHARS = 2000;
const MAX_ATTACHMENTS = 6;

export function validateReviewSubmission(payload: ReviewPayload): SubmissionOutcome {
  if (!Number.isInteger(payload.ratingStars)) return { code: 'INVALID', reasonCode: 'RATING_NOT_INTEGER' };
  if (payload.ratingStars < 1 || payload.ratingStars > 5) return { code: 'INVALID', reasonCode: 'RATING_OUT_OF_RANGE' };
  const body = (payload.bodyText ?? '').trim();
  if (body.length > MAX_BODY_CHARS) return { code: 'INVALID', reasonCode: 'BODY_TOO_LONG' };
  if (body) {
    const safety = classifyMessage({ text: body });
    if (safety.verdict === 'BLOCK' || safety.verdict === 'BLOCK_AND_REVIEW' || safety.verdict === 'SAFETY_ESCALATION') {
      return { code: 'INVALID', reasonCode: 'BODY_UNSAFE' };
    }
  }
  const attachments = payload.attachmentCount ?? 0;
  if (attachments < 0 || attachments > MAX_ATTACHMENTS) return { code: 'INVALID', reasonCode: 'TOO_MANY_ATTACHMENTS' };
  return {
    code: 'OK',
    normalised: {
      ratingStars: payload.ratingStars,
      bodyText: body,
      attachmentCount: attachments,
    },
  };
}
