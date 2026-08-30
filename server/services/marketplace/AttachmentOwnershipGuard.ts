/**
 * AttachmentOwnershipGuard — CEO PROGRAM 41 (Security).
 *
 * Pure evaluator. Doctrine: attachment ownership must be enforced
 * server-side. Given (attachment.ownerUid, requesting actorUid,
 * optional shared-with list), decides whether the caller may READ
 * the attachment or whether the request is refused.
 *
 * Attachments MUST NEVER be readable by a third party through URL
 * guessing — the owner and explicit shares are the ONLY read paths.
 */

export type AttachmentReadOutcome =
  | { code: 'ALLOWED' }
  | { code: 'REFUSED'; reasonCode: 'NOT_OWNER_NOT_SHARED' | 'INVALID_INPUT' };

export interface AttachmentReadInput {
  attachmentOwnerUid: string;
  actorUid: string;
  /** Uids the owner has explicitly shared the attachment with. */
  sharedWithUids?: string[];
  /**
   * When the attachment belongs to an entity thread (booking chat,
   * support case chat), the actor being an existing party to that
   * entity satisfies read access.
   */
  actorIsPartyToEntity?: boolean;
}

export function canReadAttachment(input: AttachmentReadInput): AttachmentReadOutcome {
  if (!input.attachmentOwnerUid || !input.actorUid) {
    return { code: 'REFUSED', reasonCode: 'INVALID_INPUT' };
  }
  if (input.actorUid === input.attachmentOwnerUid) return { code: 'ALLOWED' };
  if (input.actorIsPartyToEntity === true) return { code: 'ALLOWED' };
  if ((input.sharedWithUids ?? []).includes(input.actorUid)) return { code: 'ALLOWED' };
  return { code: 'REFUSED', reasonCode: 'NOT_OWNER_NOT_SHARED' };
}
