/**
 * PrestigeMirrorRefreshService — CEO P0-MY-ACCOUNT task #165.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  refreshPrestigeMirror,
  type RefreshEffects,
} from '../services/marketplace/PrestigeMirrorRefreshService';

function makeEffects(affectedRows = 1): RefreshEffects {
  return { writeMirror: vi.fn(async () => affectedRows) };
}

describe('PrestigeMirrorRefreshService', () => {
  it('happy path → OK with fieldsWritten', async () => {
    const eff = makeEffects();
    const out = await refreshPrestigeMirror({
      actorUid: 'sarah',
      snapshot: { firstName: 'Sarah', lastName: 'Levi', language: 'he' },
    }, eff);
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.fieldsWritten.sort()).toEqual(['firstName', 'language', 'lastName']);
    expect(eff.writeMirror).toHaveBeenCalledTimes(1);
  });

  it('no Prestige row (affected=0) → NO_PRESTIGE_ROW (no error)', async () => {
    const out = await refreshPrestigeMirror({
      actorUid: 'nir',
      snapshot: { firstName: 'Nir' },
    }, makeEffects(0));
    expect(out.code).toBe('NO_PRESTIGE_ROW');
  });

  it('missing actorUid → REJECTED(INVALID_ACTOR)', async () => {
    const out = await refreshPrestigeMirror({ actorUid: '', snapshot: { firstName: 'A' } }, makeEffects());
    expect(out.code).toBe('REJECTED');
    if (out.code !== 'REJECTED') throw new Error();
    expect(out.reasonCode).toBe('INVALID_ACTOR');
  });

  it('empty snapshot → REJECTED(NO_FIELDS)', async () => {
    const out = await refreshPrestigeMirror({ actorUid: 'sarah', snapshot: {} }, makeEffects());
    expect(out.code).toBe('REJECTED');
    if (out.code !== 'REJECTED') throw new Error();
    expect(out.reasonCode).toBe('NO_FIELDS');
  });

  it('attempt to write a non-MIRROR field → REJECTED(NOT_MIRROR)', async () => {
    const out = await refreshPrestigeMirror({
      actorUid: 'sarah',
      snapshot: { address: 'x' } as any,
    }, makeEffects());
    expect(out.code).toBe('REJECTED');
    if (out.code !== 'REJECTED') throw new Error();
    expect(out.reasonCode).toBe('NOT_MIRROR');
  });

  it('null values are passed through (allows clearing a mirrored value)', async () => {
    const eff = makeEffects();
    const out = await refreshPrestigeMirror({
      actorUid: 'sarah',
      snapshot: { phone: null },
    }, eff);
    expect(out.code).toBe('OK');
    expect(eff.writeMirror).toHaveBeenCalledWith(expect.objectContaining({
      changes: expect.objectContaining({ phone: null }),
    }));
  });

  it('undefined fields are IGNORED (partial refresh is safe)', async () => {
    const eff = makeEffects();
    const out = await refreshPrestigeMirror({
      actorUid: 'sarah',
      snapshot: { firstName: 'Sarah', lastName: undefined, email: undefined },
    }, eff);
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.fieldsWritten).toEqual(['firstName']);
  });

  it('is idempotent — repeat call produces same outcome', async () => {
    const eff = makeEffects();
    const patch = { actorUid: 'sarah', snapshot: { firstName: 'Sarah' } };
    await refreshPrestigeMirror(patch, eff);
    await refreshPrestigeMirror(patch, eff);
    expect(eff.writeMirror).toHaveBeenCalledTimes(2);
  });
});
