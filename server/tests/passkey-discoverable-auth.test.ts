/**
 * Face-ID / discoverable passkey login must call updateDeviceOnAuth correctly.
 *
 * Signature: updateDeviceOnAuth(uid, isAdmin, credId, newCounter, ipAddress, userAgent).
 * The discoverable-auth path called it as
 *   updateDeviceOnAuth(uid, credentialId, collectionPath, { counter, ... })
 * — credentialId in the isAdmin slot, a string in the credId slot, and an OBJECT
 * where a number (newCounter) was expected. Result: every Face-ID / discoverable
 * login threw → 100% broken. Fixed to the positional call (mirrors the working
 * non-discoverable caller). Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'webauthn', 'service.ts'),
  'utf8',
);

describe('webauthn discoverable auth — updateDeviceOnAuth call shape', () => {
  it('no longer passes the broken (credentialId, collectionPath, {object}) form', () => {
    expect(src).not.toMatch(/updateDeviceOnAuth\(uid, credentialId, collectionPath, \{/);
  });

  it('every updateDeviceOnAuth call uses the positional signature with newCounter', () => {
    // Both call sites must pass verification.authenticationInfo.newCounter positionally.
    const calls = (src.match(/updateDeviceOnAuth\(\s*\n\s*uid,\s*\n\s*isAdmin,\s*\n\s*credentialId,\s*\n\s*verification\.authenticationInfo\.newCounter,/g) || []).length;
    expect(calls).toBeGreaterThanOrEqual(2); // discoverable + non-discoverable
  });
});
