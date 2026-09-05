/**
 * FCM token-store unification (audit B-1).
 *
 * The web client writes device tokens to the Firestore subcollection
 * fcmTokens/{uid}/devices/{deviceId}; POST /api/fcm/register-token writes the
 * legacy array users/{uid}.fcmTokens. FCMService.sendToUser historically read ONLY
 * the legacy array, so booking-confirmed / receipt / promo push silently never
 * reached web-registered devices ("No FCM tokens" → return false).
 *
 * These tests lock in the unified read (BOTH stores) and the safe prune predicate.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { mergePushTokens } from '../services/FCMService';

describe('mergePushTokens — unifies both token stores', () => {
  it('includes tokens from BOTH the device subcollection and the legacy array', () => {
    const merged = mergePushTokens(
      [{ token: 'web-A', deviceId: 'dev-1' }],
      ['native-B'],
    );
    expect(merged.has('web-A')).toBe(true);
    expect(merged.has('native-B')).toBe(true);
    expect(merged.size).toBe(2);
  });

  it('tags each token with the store it came from (so pruning hits the right place)', () => {
    const merged = mergePushTokens(
      [{ token: 'web-A', deviceId: 'dev-1' }],
      ['legacy-B'],
    );
    expect(merged.get('web-A')).toEqual({ source: 'device', deviceId: 'dev-1' });
    expect(merged.get('legacy-B')).toEqual({ source: 'legacy' });
  });

  it('de-duplicates a token registered in both stores, preferring the device entry', () => {
    const merged = mergePushTokens(
      [{ token: 'shared', deviceId: 'dev-9' }],
      ['shared'],
    );
    expect(merged.size).toBe(1);
    expect(merged.get('shared')).toEqual({ source: 'device', deviceId: 'dev-9' });
  });

  it('drops empty/falsy tokens from either store', () => {
    const merged = mergePushTokens(
      [{ token: '', deviceId: 'dev-x' }],
      ['', undefined as unknown as string, 'real'],
    );
    expect(merged.has('')).toBe(false);
    expect(Array.from(merged.keys())).toEqual(['real']);
  });

  it('returns an empty map when the user has no tokens anywhere', () => {
    expect(mergePushTokens([], []).size).toBe(0);
  });
});

describe('FCMService.sendToUser — reads both stores, prunes safely (source guard)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'FCMService.ts'), 'utf8');
  const start = src.indexOf('static async sendToUser(');
  const slice = src.slice(start, start + 3000);

  it('reads the device subcollection via getUserFcmTokens', () => {
    expect(src).toMatch(/import\s*\{[^}]*getUserFcmTokens[^}]*\}\s*from\s*'\.\.\/lib\/fcm-push'/);
    expect(slice).toContain('getUserFcmTokens(payload.userId)');
  });

  it('also reads the legacy array store and merges the two', () => {
    expect(slice).toContain('this.getLegacyArrayTokens(payload.userId)');
    expect(slice).toContain('mergePushTokens(deviceTokens, legacyTokens)');
  });

  it('prunes ONLY tokens FCM reports as permanently invalid (not transient failures)', () => {
    expect(slice).toContain('INVALID_TOKEN_CODES.has(resp.error.code)');
    // The old code pruned on any !resp.success — that must be gone.
    expect(slice).not.toMatch(/if\s*\(!resp\.success\)\s*\{\s*tokensToRemove\.push/);
  });

  it('deletes dead device tokens from the subcollection, dead legacy tokens from the array', () => {
    expect(slice).toContain("collection('fcmTokens')");
    expect(slice).toContain('this.removeTokens(payload.userId, legacyToRemove)');
  });
});
