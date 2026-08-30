/**
 * CommunicationScopingService — Program 8.
 */
import { describe, it, expect } from 'vitest';
import {
  threadKeyFor,
  statusFor,
} from '../services/marketplace/CommunicationScopingService';

describe('CommunicationScopingService', () => {
  it('booking A and booking B produce distinct thread keys', () => {
    const a = threadKeyFor({ entityKind: 'booking', entityId: 'A' });
    const b = threadKeyFor({ entityKind: 'booking', entityId: 'B' });
    expect(a).not.toBe(b);
  });

  it('support escalation for a booking is a DIFFERENT thread from the booking thread', () => {
    const chat = threadKeyFor({ entityKind: 'booking', entityId: 'B-1' });
    const support = threadKeyFor({ entityKind: 'booking', entityId: 'B-1', isSupportEscalation: true });
    expect(chat).not.toBe(support);
    expect(support.startsWith('support:')).toBe(true);
  });

  it('shop order support is separate from booking support even at same entityId', () => {
    const shop = threadKeyFor({ entityKind: 'shop_order', entityId: '42', isSupportEscalation: true });
    const booking = threadKeyFor({ entityKind: 'booking', entityId: '42', isSupportEscalation: true });
    expect(shop).not.toBe(booking);
  });

  it('meet_greet gets its own thread from booking', () => {
    const mg = threadKeyFor({ entityKind: 'meet_greet', entityId: 'MG-1' });
    const booking = threadKeyFor({ entityKind: 'booking', entityId: 'MG-1' });
    expect(mg).not.toBe(booking);
  });

  it('statusFor NO_THREAD_YET when the thread does not exist', () => {
    expect(statusFor({ entityCurrentState: 'CONFIRMED', threadExists: false })).toBe('NO_THREAD_YET');
  });

  it('statusFor OPEN by default when thread exists', () => {
    expect(statusFor({ entityCurrentState: 'CONFIRMED', threadExists: true })).toBe('OPEN');
  });

  it('READ_ONLY when the entity is in a caller-declared read-only state', () => {
    expect(statusFor({
      entityCurrentState: 'COMPLETED',
      threadExists: true,
      readOnlyStates: ['COMPLETED'],
    })).toBe('READ_ONLY');
  });

  it('ARCHIVED beats READ_ONLY when the state appears in archived list', () => {
    expect(statusFor({
      entityCurrentState: 'CANCELLED',
      threadExists: true,
      readOnlyStates: ['CANCELLED'],
      archivedStates: ['CANCELLED'],
    })).toBe('ARCHIVED');
  });
});
