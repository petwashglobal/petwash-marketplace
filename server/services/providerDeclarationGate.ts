/**
 * providerDeclarationGate.ts — Phase-1 wiring for the Provider Protection Book.
 *
 * Turns the canonical registry (shared/providerProtectionDeclarations.ts) into a
 * live status + gate the onboarding UI and (later, separately-approved) payout
 * path consume. SIGNED records are stored as completed `signing_sessions` rows
 * whose `documentType` encodes the declaration key + version — so we add NO new
 * table and NO migration; the existing DocuSeal webhook already flips those rows
 * to `completed`.
 *
 * DARK by design on two independent axes (both fail-safe):
 *   1. DOCUSEAL_API_KEY unset → no signing session can be created.
 *   2. reviewedByCounsel === false on a doc → that doc is collect-only; the start
 *      endpoint refuses to send draft legal text for binding signature.
 *
 * This module performs NO money mutation. The payout/activation enforcement hook
 * that calls checkProviderDeclarationsSigned() lives in payoutGate.ts and is a
 * separate, explicitly-approved change (protected money domain).
 *
 * IDENTITY: providerUid is the provider's Firebase UID — the same key
 * provider_services.provider_id and signing_sessions.user_id use.
 */
import { db } from '../db';
import { and, eq, like } from 'drizzle-orm';
import { signingSessions } from '@shared/schema';
import { providerServices } from '@shared/schema-provider-services';
import { normalizeServiceType } from '@shared/provider-service-levels';
import {
  requiredDeclarationsForScopes,
  type ProviderDeclarationScope,
} from '@shared/providerProtectionDeclarations';

/** documentType namespace for declaration signing sessions. */
export const DECLARATION_DOC_TYPE_PREFIX = 'provider_declaration';

/** Encode a declaration key + version into a signing_sessions.documentType. */
export function declarationDocType(key: string, version: string): string {
  return `${DECLARATION_DOC_TYPE_PREFIX}:${key}:${version}`;
}

/** Parse a declaration documentType back into { key, version }, or null. */
export function parseDeclarationDocType(
  documentType: string | null | undefined,
): { key: string; version: string } | null {
  if (!documentType || !documentType.startsWith(`${DECLARATION_DOC_TYPE_PREFIX}:`)) return null;
  const parts = documentType.split(':');
  // prefix : key : version  (version itself never contains ':')
  if (parts.length < 3) return null;
  const key = parts[1];
  const version = parts.slice(2).join(':');
  if (!key || !version) return null;
  return { key, version };
}

/**
 * Canonical service type → the service-specific declaration scopes it triggers.
 * A pet_sitter may host at home AND visit the owner's home, so we conservatively
 * require both sitter protocols. grooming has no service-specific declaration
 * (core docs still apply to everyone).
 */
const SERVICE_TO_SCOPES: Record<string, ProviderDeclarationScope[]> = {
  pet_sitting: ['PET_SITTER_HOSTING', 'PET_SITTER_OWNER_HOME'],
  dog_walking: ['WALK_MY_PET'],
  pet_training: ['ACADEMY'],
  pet_transport: ['PETTREK'],
  grooming: [],
};

/** Pure mapping helper (exported for tests): service-type list → scope set. */
export function scopesForServiceTypes(serviceTypes: Array<string | null | undefined>): ProviderDeclarationScope[] {
  const scopes = new Set<ProviderDeclarationScope>();
  for (const st of serviceTypes) {
    const canon = normalizeServiceType(st);
    for (const s of SERVICE_TO_SCOPES[canon] ?? []) scopes.add(s);
  }
  return [...scopes];
}

/** Read the provider's service rows and resolve the declaration scopes they need. */
export async function getProviderDeclarationScopes(providerUid: string): Promise<ProviderDeclarationScope[]> {
  const rows = await db
    .select({ serviceType: providerServices.serviceType })
    .from(providerServices)
    .where(eq(providerServices.providerId, providerUid));
  return scopesForServiceTypes(rows.map((r) => r.serviceType));
}

export interface DeclarationStatusItem {
  key: string;
  version: string;
  titleEn: string;
  titleHe: string;
  category: 'core' | 'service';
  signed: boolean;
  signedAt: string | null;
  signatureStatus: 'completed' | 'pending';
  reviewedByCounsel: boolean;
}

export interface ProviderDeclarationStatus {
  providerUid: string;
  required: DeclarationStatusItem[];
  allSigned: boolean;
  /** keys of required docs not yet signed at the current version. */
  missing: string[];
  /** true only if every required doc has a counsel-approved version. */
  counselApprovedAll: boolean;
  /** whether the DocuSeal API key is configured (signing actually possible). */
  signingConfigured: boolean;
}

/**
 * Full required-vs-signed status for a provider, given the services they offer.
 * A signed doc = a completed signing_sessions row at the SAME version (a wording
 * bump invalidates the old signature, which is the point of versioning).
 */
export async function getProviderDeclarationStatus(providerUid: string): Promise<ProviderDeclarationStatus> {
  const scopes = await getProviderDeclarationScopes(providerUid);
  const requiredDocs = requiredDeclarationsForScopes(scopes);

  const sessions = await db
    .select({
      documentType: signingSessions.documentType,
      status: signingSessions.status,
      signedAt: signingSessions.signedAt,
      completedAt: signingSessions.completedAt,
    })
    .from(signingSessions)
    .where(
      and(
        eq(signingSessions.userId, providerUid),
        like(signingSessions.documentType, `${DECLARATION_DOC_TYPE_PREFIX}:%`),
      ),
    );

  // key:version → completion record (only completed sessions count)
  const signedMap = new Map<string, { signedAt: Date | null }>();
  for (const s of sessions) {
    const parsed = parseDeclarationDocType(s.documentType);
    if (!parsed) continue;
    const complete = String(s.status) === 'completed' || !!s.completedAt;
    if (!complete) continue;
    signedMap.set(`${parsed.key}:${parsed.version}`, {
      signedAt: (s.signedAt ?? s.completedAt) as Date | null,
    });
  }

  const required: DeclarationStatusItem[] = requiredDocs.map((d) => {
    const hit = signedMap.get(`${d.key}:${d.version}`);
    return {
      key: d.key,
      version: d.version,
      titleEn: d.titleEn,
      titleHe: d.titleHe,
      category: d.category,
      signed: !!hit,
      signedAt: hit?.signedAt ? hit.signedAt.toISOString() : null,
      signatureStatus: hit ? 'completed' : 'pending',
      reviewedByCounsel: d.reviewedByCounsel,
    };
  });

  const missing = required.filter((r) => !r.signed).map((r) => r.key);

  return {
    providerUid,
    required,
    allSigned: required.length > 0 && missing.length === 0,
    missing,
    counselApprovedAll: requiredDocs.every((d) => d.reviewedByCounsel),
    signingConfigured: !!process.env.DOCUSEAL_API_KEY,
  };
}

export interface DeclarationGateResult {
  ok: boolean;
  reason: string;
  missing: string[];
}

/**
 * The gate the payout/activation path will call (in a separate, approved PR).
 * Fail-CLOSED: any error → HOLD. Returns ok:false when required declarations are
 * unsigned. Kept here (not in payoutGate.ts) so the engine ships without touching
 * the money domain.
 */
export async function checkProviderDeclarationsSigned(providerUid: string): Promise<DeclarationGateResult> {
  try {
    if (!providerUid) return { ok: false, reason: 'NO_PROVIDER_UID', missing: [] };
    const status = await getProviderDeclarationStatus(providerUid);
    if (status.required.length === 0) {
      // Core docs are required for everyone, so this only happens if the registry
      // is empty — treat as nothing-to-enforce rather than a false hold.
      return { ok: true, reason: 'NO_DECLARATIONS_REQUIRED', missing: [] };
    }
    if (!status.allSigned) {
      return { ok: false, reason: 'DECLARATIONS_UNSIGNED', missing: status.missing };
    }
    return { ok: true, reason: 'OK', missing: [] };
  } catch {
    return { ok: false, reason: 'DECLARATION_GATE_ERROR', missing: [] };
  }
}
