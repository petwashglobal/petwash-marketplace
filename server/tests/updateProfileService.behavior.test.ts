/**
 * UpdateProfileService — CEO P0-MY-ACCOUNT atomic write + fan-out.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  updateProfile,
  type CanonicalSnapshot,
  type WriteEffects,
} from '../services/marketplace/UpdateProfileService';

const baseSnapshot: CanonicalSnapshot = {
  firstName: 'Sarah',
  lastName: 'Cohen',
  email: 'sarah@example.com',
  emailVerified: true,
  phone: '+972501234567',
  phoneVerified: true,
  dateOfBirth: '1990-01-01',
  language: 'he',
  address: 'Tel Aviv',
  city: 'Tel Aviv',
  postalCode: '6100000',
  country: 'IL',
};

function makeEffects(over: Partial<WriteEffects> = {}, snapshot: CanonicalSnapshot = baseSnapshot): WriteEffects {
  return {
    writeCanonical: vi.fn(async () => snapshot),
    updateFirebaseDisplayName: vi.fn(async () => {}),
    refreshPrestigeMirror: vi.fn(async () => {}),
    ...over,
  };
}

describe('UpdateProfileService — rejects', () => {
  it('missing actorUid → REJECTED(INVALID_ACTOR)', async () => {
    const out = await updateProfile({ actorUid: '', patch: { firstName: 'A' } }, makeEffects());
    expect(out.code).toBe('REJECTED');
    if (out.code !== 'REJECTED') throw new Error();
    expect(out.reasonCode).toBe('INVALID_ACTOR');
  });

  it('empty patch → REJECTED(NO_FIELDS)', async () => {
    const out = await updateProfile({ actorUid: 'sarah', patch: {} }, makeEffects());
    expect(out.code).toBe('REJECTED');
    if (out.code !== 'REJECTED') throw new Error();
    expect(out.reasonCode).toBe('NO_FIELDS');
  });

  it('email in patch → REJECTED(FIELD_NOT_WRITABLE) — direct path never changes email', async () => {
    const out = await updateProfile({ actorUid: 'sarah', patch: { email: 'x@y.com' } as any }, makeEffects());
    expect(out.code).toBe('REJECTED');
    if (out.code !== 'REJECTED') throw new Error();
    expect(out.reasonCode).toBe('FIELD_NOT_WRITABLE');
  });

  it('phone in patch → REJECTED(FIELD_NOT_WRITABLE) — direct path never changes phone', async () => {
    const out = await updateProfile({ actorUid: 'sarah', patch: { phone: '+972500000000' } as any }, makeEffects());
    expect(out.code).toBe('REJECTED');
  });

  it('random field → REJECTED(FIELD_NOT_WRITABLE)', async () => {
    const out = await updateProfile({ actorUid: 'sarah', patch: { hackerField: 'x' } as any }, makeEffects());
    expect(out.code).toBe('REJECTED');
  });
});

describe('UpdateProfileService — happy path + fan-out', () => {
  it('name change → OK + FIREBASE_DISPLAY_NAME + PRESTIGE_MIRROR fanned', async () => {
    const eff = makeEffects();
    const out = await updateProfile({ actorUid: 'sarah', patch: { firstName: 'Sarah', lastName: 'Levi' } }, eff);
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.fannedOut).toContain('FIREBASE_DISPLAY_NAME');
    expect(out.fannedOut).toContain('PRESTIGE_MIRROR');
    expect(eff.updateFirebaseDisplayName).toHaveBeenCalledTimes(1);
    expect(eff.refreshPrestigeMirror).toHaveBeenCalledTimes(1);
  });

  it('non-name change → skips Firebase displayName fan-out', async () => {
    const eff = makeEffects();
    const out = await updateProfile({ actorUid: 'sarah', patch: { language: 'en' } }, eff);
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.fannedOut).not.toContain('FIREBASE_DISPLAY_NAME');
    expect(eff.updateFirebaseDisplayName).not.toHaveBeenCalled();
  });

  it('OK response carries the server-persisted snapshot (readback)', async () => {
    const persisted: CanonicalSnapshot = { ...baseSnapshot, firstName: 'Persisted' };
    const eff = makeEffects({}, persisted);
    const out = await updateProfile({ actorUid: 'sarah', patch: { firstName: 'ClientTyped' } }, eff);
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    // Client sees SERVER truth ("Persisted"), never its own optimistic input.
    expect(out.snapshot.firstName).toBe('Persisted');
  });
});

describe('UpdateProfileService — split-brain guard', () => {
  it('DB OK + Firebase throws → UPDATE_PARTIAL_ROLLBACK_REQUIRED(FIREBASE_UPDATE_FAILED)', async () => {
    const eff = makeEffects({
      updateFirebaseDisplayName: vi.fn(async () => { throw new Error('firebase-down'); }),
    });
    const out = await updateProfile({ actorUid: 'sarah', patch: { firstName: 'Sarah', lastName: 'Levi' } }, eff);
    expect(out.code).toBe('UPDATE_PARTIAL_ROLLBACK_REQUIRED');
    if (out.code !== 'UPDATE_PARTIAL_ROLLBACK_REQUIRED') throw new Error();
    expect(out.reasonCode).toBe('FIREBASE_UPDATE_FAILED');
    // Snapshot is included so the admin path can reconcile.
    expect(out.snapshot).toBeDefined();
  });

  it('Prestige mirror throws → UPDATE_PARTIAL_ROLLBACK_REQUIRED(PRESTIGE_MIRROR_FAILED)', async () => {
    const eff = makeEffects({
      refreshPrestigeMirror: vi.fn(async () => { throw new Error('prestige-down'); }),
    });
    const out = await updateProfile({ actorUid: 'sarah', patch: { firstName: 'Sarah', lastName: 'Levi' } }, eff);
    expect(out.code).toBe('UPDATE_PARTIAL_ROLLBACK_REQUIRED');
    if (out.code !== 'UPDATE_PARTIAL_ROLLBACK_REQUIRED') throw new Error();
    expect(out.reasonCode).toBe('PRESTIGE_MIRROR_FAILED');
  });

  it('DB write throws → propagates (caller wraps for HTTP 500)', async () => {
    const eff = makeEffects({
      writeCanonical: vi.fn(async () => { throw new Error('db-down'); }),
    });
    await expect(
      updateProfile({ actorUid: 'sarah', patch: { firstName: 'Sarah' } }, eff)
    ).rejects.toThrow('db-down');
  });
});
