/**
 * The body PATCH /api/user/profile is allowed to receive.
 *
 * THE DEFECT THIS EXISTS TO CLOSE (2026-09-19). The account edit form hydrates
 * itself from GET /api/user/profile and saved with `{ ...editedProfile }` — the
 * WHOLE read-back, echoed straight back. Two of the fields in that read-back,
 * `email` and `twoFactorEnabled`, are ones PATCH /profile refuses OUTRIGHT
 * (server/routes/user-profile.ts, SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW):
 * security state must change through a verified flow, never a generic profile
 * write, and the endpoint says so with a 400 rather than a silent 200.
 *
 * Both halves are right on their own. Together they meant that EVERY save from
 * the account screen — a name, a birthday, a car plate, an address — came back
 *   400 "Two-step login cannot be changed from the profile endpoint."
 * even though the member never touched two-step login; the form had simply
 * handed back the value it was given. The member saw a red Hebrew "שגיאה
 * בשמירה" toast quoting an internal API route, and nothing they edited saved.
 *
 * So the payload is built from an EXPLICIT allow-list instead of a spread. A
 * field the endpoint does not own cannot reach it by being added to the
 * read-back later, which is exactly how this broke.
 *
 * Deliberately not here:
 *   email, twoFactorEnabled  — refused above; their own verified flows own them
 *                              (/api/user/settings/email/request-change,
 *                               /api/mfa/two-step/disable).
 *   photoURL                 — accepted by the schema but never applied by the
 *                              handler. The photo is written by
 *                              POST /api/user/settings/profile/photo; sending it
 *                              here would be a save that silently does nothing.
 *   idNumber                 — editable, and forwarded when the member typed one,
 *                              but never present in the read-back (encrypted PII
 *                              is not sent back to the client), so it is only
 *                              ever sent when it actually changed.
 */

/** Every key PATCH /api/user/profile reads out of the request body. */
export const PROFILE_UPDATE_FIELDS = [
  'displayName',
  'phone',
  'birthdate',
  'preferredLanguage',
  // permanent address
  'address',
  'street',
  'streetNumber',
  'apartment',
  'city',
  'postalCode',
  'country',
  'latitude',
  'longitude',
  // temporary address
  'addressIsTemporary',
  'temporaryAddress',
  'temporaryLat',
  'temporaryLng',
  'temporaryPostal',
  // extended details
  'gender',
  'idNumber',
  'carPlate',
  'carPlate2',
  'emergencyContactName',
  'emergencyContactPhone',
  'marketingConsent',
  'notificationPreferences',
] as const;

export type ProfileUpdateField = (typeof PROFILE_UPDATE_FIELDS)[number];

/**
 * Fields the profile endpoint refuses with a 400. Echoing one back — even
 * unchanged — fails the whole save, so they never go in the body.
 *
 * Mirrors SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW in
 * server/routes/user-profile.ts; profileSaveOmitsRefusedFields.regression.test.ts
 * fails if the two lists drift apart.
 */
export const PROFILE_FIELDS_THE_SERVER_REFUSES = ['twoFactorEnabled', 'email'] as const;

/**
 * Narrow an edit-form state object to the fields PATCH /api/user/profile owns.
 *
 * `undefined` values are dropped so an untouched field stays untouched — the
 * handler keys every write on `!== undefined`.
 */
export function buildProfileUpdatePayload(
  edited: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (!edited) return payload;
  for (const field of PROFILE_UPDATE_FIELDS) {
    const value = edited[field];
    if (value !== undefined) payload[field] = value;
  }
  return payload;
}
