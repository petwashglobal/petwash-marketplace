/**
 * Wolt-style human-readable provider code.
 *
 * OPERATIONAL ONLY — for support, dashboards, and customer-facing reference
 * (like Wolt's courier ID or our K9000 station codes). It is NOT a legal
 * identifier; the legally load-bearing ID for an Israeli provider is their
 * osek (business-tax) number, stored separately.
 *
 * Derived from the provider's immutable serial `id`, so the code is stable
 * for the life of the account and collision-free by construction (one id →
 * one code). Format: `PW-PRV-<year>-<5-digit zero-padded id>`, e.g.
 * `PW-PRV-2026-00042`. IDs past 99,999 simply widen the numeric part.
 */
const PROVIDER_CODE_PREFIX = 'PW-PRV';

export function formatProviderCode(id: number, createdAt?: Date | string | null): string {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`formatProviderCode: id must be a positive integer, got ${id}`);
  }
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `${PROVIDER_CODE_PREFIX}-${year}-${String(id).padStart(5, '0')}`;
}

/** True if a string matches the provider-code shape (cheap validation/guard). */
export function isProviderCode(value: string): boolean {
  return /^PW-PRV-\d{4}-\d{5,}$/.test(value);
}
