/**
 * Centralized resolver for the Google service-account credential JSON blob.
 *
 * Several independent services (Google Wallet, Sheets, GCS backup, Drive
 * backup, Drive archival) each read a different subset of these env vars in
 * a different order. That meant rotating or removing one secret could break
 * some integrations silently while leaving others working. This is the one
 * place that chain is defined.
 *
 * Priority: an optional service-specific override, then
 * GOOGLE_APPLICATION_CREDENTIALS_JSON, then GOOGLE_SERVICE_ACCOUNT_JSON,
 * then the legacy FIREBASE_SERVICE_ACCOUNT_KEY.
 *
 * Note: this does not consider the bare GOOGLE_APPLICATION_CREDENTIALS var —
 * that name conventionally holds a file path, not a JSON blob, so treating
 * it as JSON here would be a separate bug, not a fallback.
 */
export function resolveGoogleServiceAccountJson(serviceOverride?: string): string | undefined {
  const candidates = [
    serviceOverride,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim() && candidate.trim() !== 'null') {
      return candidate.trim();
    }
  }
  return undefined;
}
