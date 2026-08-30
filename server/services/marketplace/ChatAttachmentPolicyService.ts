/**
 * ChatAttachmentPolicyService — CEO PROGRAM 8 (Chat Attachments).
 *
 * Pure evaluator. Given a proposed attachment (mime + byteSize +
 * declared purpose), decides whether the chat may accept it.
 * Doctrine: only "approved attachments" — the evaluator is the
 * approval list.
 */

export type AttachmentPurpose =
  | 'PHOTO_OF_PET'
  | 'PHOTO_OF_HANDOFF'
  | 'PROOF_OF_DAMAGE'
  | 'ID_DOCUMENT'                            // NEVER for chat — KYC upload path only
  | 'BANK_STATEMENT'                         // NEVER for chat
  | 'GENERIC_IMAGE'
  | 'GENERIC_DOCUMENT';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const DOC_MIMES = new Set(['application/pdf']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;    // 8 MiB
const MAX_DOC_BYTES = 4 * 1024 * 1024;      // 4 MiB

const CHAT_FORBIDDEN_PURPOSES: ReadonlySet<AttachmentPurpose> = new Set<AttachmentPurpose>([
  'ID_DOCUMENT',
  'BANK_STATEMENT',
]);

export type AttachmentOutcome =
  | { code: 'ALLOWED' }
  | { code: 'BLOCKED'; reasonCode:
      | 'PURPOSE_FORBIDDEN_IN_CHAT'
      | 'MIME_NOT_ALLOWED'
      | 'FILE_TOO_LARGE'
      | 'INVALID_INPUT' };

export interface AttachmentInput {
  mime: string;
  byteSize: number;
  purpose: AttachmentPurpose;
}

export function evaluateAttachment(input: AttachmentInput): AttachmentOutcome {
  if (!input.mime || !Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return { code: 'BLOCKED', reasonCode: 'INVALID_INPUT' };
  }
  if (CHAT_FORBIDDEN_PURPOSES.has(input.purpose)) {
    return { code: 'BLOCKED', reasonCode: 'PURPOSE_FORBIDDEN_IN_CHAT' };
  }
  const mime = input.mime.toLowerCase();
  const isImage = IMAGE_MIMES.has(mime);
  const isDoc = DOC_MIMES.has(mime);
  if (!isImage && !isDoc) return { code: 'BLOCKED', reasonCode: 'MIME_NOT_ALLOWED' };
  if (isImage && input.byteSize > MAX_IMAGE_BYTES) return { code: 'BLOCKED', reasonCode: 'FILE_TOO_LARGE' };
  if (isDoc && input.byteSize > MAX_DOC_BYTES) return { code: 'BLOCKED', reasonCode: 'FILE_TOO_LARGE' };
  return { code: 'ALLOWED' };
}
