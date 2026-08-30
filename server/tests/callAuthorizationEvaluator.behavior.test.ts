/**
 * CallAuthorizationEvaluator — Program 9.
 */
import { describe, it, expect } from 'vitest';
import { authorizeCall } from '../services/marketplace/CallAuthorizationEvaluator';

describe('CallAuthorizationEvaluator', () => {
  it('before confirmation → REFUSED(NO_CALL_BEFORE_CONFIRMATION)', () => {
    const out = authorizeCall({ actorRole: 'CUSTOMER', bookingStatus: 'REQUESTED' });
    expect(out.code).toBe('REFUSED');
    if (out.code !== 'REFUSED') throw new Error();
    expect(out.reasonCode).toBe('NO_CALL_BEFORE_CONFIRMATION');
  });

  it('CONFIRMED → ALLOWED with IN_APP_MASKED', () => {
    const out = authorizeCall({ actorRole: 'CUSTOMER', bookingStatus: 'CONFIRMED' });
    expect(out.code).toBe('ALLOWED');
    if (out.code !== 'ALLOWED') throw new Error();
    expect(out.surface).toBe('IN_APP_MASKED');
    expect(out.recordCall).toBe(false);
  });

  it('IN_PROGRESS + isActiveServiceWindow → ACTIVE_SERVICE_PROMINENT reason', () => {
    const out = authorizeCall({ actorRole: 'CUSTOMER', bookingStatus: 'IN_PROGRESS', isActiveServiceWindow: true });
    if (out.code !== 'ALLOWED') throw new Error();
    expect(out.reasonCode).toBe('ACTIVE_SERVICE_PROMINENT');
  });

  it('isEmergency=true → EMERGENCY_LIST regardless of booking state', () => {
    const out = authorizeCall({ actorRole: 'CUSTOMER', bookingStatus: 'REQUESTED', isEmergency: true });
    if (out.code !== 'ALLOWED') throw new Error();
    expect(out.surface).toBe('EMERGENCY_LIST');
  });

  it('requesting raw number → REFUSED(RAW_NUMBER_NEVER_EXPOSED)', () => {
    const out = authorizeCall({ actorRole: 'PROVIDER', bookingStatus: 'CONFIRMED', requestingRawNumber: true });
    expect(out.code).toBe('REFUSED');
    if (out.code !== 'REFUSED') throw new Error();
    expect(out.reasonCode).toBe('RAW_NUMBER_NEVER_EXPOSED');
  });

  it('COMPLETED / CANCELLED / DECLINED / EXPIRED → REFUSED (no call after)', () => {
    for (const s of ['COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED'] as const) {
      expect(authorizeCall({ actorRole: 'CUSTOMER', bookingStatus: s }).code).toBe('REFUSED');
    }
  });

  it('recordCall is always false (doctrine default)', () => {
    const out = authorizeCall({ actorRole: 'CUSTOMER', bookingStatus: 'CONFIRMED' });
    if (out.code !== 'ALLOWED') throw new Error();
    expect(out.recordCall).toBe(false);
  });
});
