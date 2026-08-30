/**
 * AttachmentOwnershipGuard — Program 41.
 */
import { describe, it, expect } from 'vitest';
import { canReadAttachment } from '../services/marketplace/AttachmentOwnershipGuard';

describe('AttachmentOwnershipGuard', () => {
  it('owner → ALLOWED', () => {
    expect(canReadAttachment({ attachmentOwnerUid: 'sarah', actorUid: 'sarah' }).code).toBe('ALLOWED');
  });

  it('third party → REFUSED(NOT_OWNER_NOT_SHARED)', () => {
    const out = canReadAttachment({ attachmentOwnerUid: 'sarah', actorUid: 'nosy' });
    expect(out.code).toBe('REFUSED');
    if (out.code !== 'REFUSED') throw new Error();
    expect(out.reasonCode).toBe('NOT_OWNER_NOT_SHARED');
  });

  it('explicit share → ALLOWED', () => {
    expect(canReadAttachment({ attachmentOwnerUid: 'sarah', actorUid: 'maya', sharedWithUids: ['maya'] }).code).toBe('ALLOWED');
  });

  it('actor is party to the entity thread → ALLOWED', () => {
    expect(canReadAttachment({ attachmentOwnerUid: 'sarah', actorUid: 'maya', actorIsPartyToEntity: true }).code).toBe('ALLOWED');
  });

  it('missing owner or actor uid → REFUSED(INVALID_INPUT)', () => {
    expect(canReadAttachment({ attachmentOwnerUid: '', actorUid: 'sarah' }).code).toBe('REFUSED');
    expect(canReadAttachment({ attachmentOwnerUid: 'sarah', actorUid: '' }).code).toBe('REFUSED');
  });

  it('party check is a positive-only unlock — explicitly false does not unlock', () => {
    expect(canReadAttachment({ attachmentOwnerUid: 'sarah', actorUid: 'nosy', actorIsPartyToEntity: false }).code).toBe('REFUSED');
  });
});
