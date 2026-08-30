/**
 * ChatAttachmentPolicyService — Program 8.
 */
import { describe, it, expect } from 'vitest';
import { evaluateAttachment } from '../services/marketplace/ChatAttachmentPolicyService';

describe('ChatAttachmentPolicyService', () => {
  it('a small pet photo → ALLOWED', () => {
    expect(evaluateAttachment({ mime: 'image/jpeg', byteSize: 500_000, purpose: 'PHOTO_OF_PET' }).code).toBe('ALLOWED');
  });

  it('handoff photo (heic) → ALLOWED', () => {
    expect(evaluateAttachment({ mime: 'image/heic', byteSize: 1_000_000, purpose: 'PHOTO_OF_HANDOFF' }).code).toBe('ALLOWED');
  });

  it('PDF up to 4 MiB → ALLOWED', () => {
    expect(evaluateAttachment({ mime: 'application/pdf', byteSize: 3_000_000, purpose: 'PROOF_OF_DAMAGE' }).code).toBe('ALLOWED');
  });

  it('9 MiB image → BLOCKED with FILE_TOO_LARGE', () => {
    const out = evaluateAttachment({ mime: 'image/jpeg', byteSize: 9 * 1024 * 1024, purpose: 'PHOTO_OF_PET' });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('FILE_TOO_LARGE');
  });

  it('unsupported mime (mp4) → BLOCKED with MIME_NOT_ALLOWED', () => {
    const out = evaluateAttachment({ mime: 'video/mp4', byteSize: 100, purpose: 'GENERIC_IMAGE' });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('MIME_NOT_ALLOWED');
  });

  it('ID_DOCUMENT purpose in chat → BLOCKED (never over chat)', () => {
    const out = evaluateAttachment({ mime: 'image/jpeg', byteSize: 500_000, purpose: 'ID_DOCUMENT' });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('PURPOSE_FORBIDDEN_IN_CHAT');
  });

  it('BANK_STATEMENT purpose in chat → BLOCKED', () => {
    const out = evaluateAttachment({ mime: 'application/pdf', byteSize: 1000, purpose: 'BANK_STATEMENT' });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('PURPOSE_FORBIDDEN_IN_CHAT');
  });

  it('missing mime / zero bytes → BLOCKED with INVALID_INPUT', () => {
    expect(evaluateAttachment({ mime: '', byteSize: 100, purpose: 'GENERIC_IMAGE' }).code).toBe('BLOCKED');
    expect(evaluateAttachment({ mime: 'image/jpeg', byteSize: 0, purpose: 'GENERIC_IMAGE' }).code).toBe('BLOCKED');
  });
});
