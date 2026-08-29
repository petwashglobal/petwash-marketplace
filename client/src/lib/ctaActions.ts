/**
 * ctaActions — CEO MASTER §A11 §A12 (2026-08-29) — the ONE semantic
 * identity every critical call-to-action carries.
 *
 * ARCHITECTURE (revised after CEO 2026-08-29 correction review):
 *
 *   * The provider-service vocabulary is defined ONCE in
 *     shared/lib/providerServiceVocabulary.ts. This file imports it,
 *     never redefines it. CEO §7 — no duplicate "canonical" alphabets.
 *
 *   * The URL emitter routes through /become-provider, NOT directly
 *     to /provider-onboarding. That resume gate is the ONE canonical
 *     entry that decides anonymous → sign-in-with-preserved-context /
 *     draft → resume / pending → status / approved → workspace. CEO §1.
 *     Direct linking to /provider-onboarding drops requestedService +
 *     UTM + campaign for anonymous users, recreating the exact defect
 *     Lane B fixed.
 *
 *   * The URL emitter's `extra` argument is a SANITIZED allowlist —
 *     UTM / campaign / referrer only. A caller CANNOT override
 *     requestedService/intent/role/type/redirect/workspace/uid. CEO §6.
 *
 *   * Every action carries METADATA (risk / requiresAuth /
 *     requiresConfirmation / workspace). Money and legal actions are
 *     tagged MONEY_OR_LEGAL and require explicit CONFIRM_* follow-up.
 *     The registry is an INTENT vocabulary, not a command bus. CEO §10 §11.
 *
 *   * Observability is opt-in (setCtaEventSink) with a no-op default,
 *     so server bundles importing this module have no analytics
 *     dependency and a thrown sink NEVER breaks a real user action.
 *     CEO §A40 §D4.
 */

import {
  CODE_TO_LEGACY,
  LEGACY_TO_CODE,
  normaliseToProviderServiceCode,
  type LegacyProviderServiceAlias,
  type ProviderServiceCode,
} from '@shared/lib/providerServiceVocabulary';

// Re-export the shared vocabulary so downstream consumers do not need
// two imports. Kept as a type-only re-export to signal "this is not
// where the vocabulary is defined".
export type { ProviderServiceCode, LegacyProviderServiceAlias };

/**
 * Semantic action IDs for every critical CTA. The set is small on
 * purpose — additions require a PR whose diff shows the emitter, the
 * metadata classification (below), and a regression test.
 *
 * NEVER use a translated string to decide behaviour. NEVER decide
 * authorization from an action-id (a picker card taps do not grant
 * a capability — the server still owns approval). CEO §A12 §9.
 */
export const CtaAction = {
  // ─── AUTH ────────────────────────────────────────────────────
  AUTH_GOOGLE: 'AUTH_GOOGLE',
  AUTH_APPLE: 'AUTH_APPLE',
  AUTH_PHONE: 'AUTH_PHONE',
  AUTH_EMAIL: 'AUTH_EMAIL',
  AUTH_PASSKEY: 'AUTH_PASSKEY',
  AUTH_SIGN_IN: 'AUTH_SIGN_IN',
  AUTH_SIGN_UP: 'AUTH_SIGN_UP',
  AUTH_SIGN_OUT: 'AUTH_SIGN_OUT',
  AUTH_PASSWORD_RESET: 'AUTH_PASSWORD_RESET',

  // ─── PROVIDER — journey ──────────────────────────────────────
  START_PROVIDER_APPLICATION: 'START_PROVIDER_APPLICATION',
  SAVE_PROVIDER_DRAFT: 'SAVE_PROVIDER_DRAFT',
  SUBMIT_PROVIDER_APPLICATION: 'SUBMIT_PROVIDER_APPLICATION',
  RESUME_PROVIDER_APPLICATION: 'RESUME_PROVIDER_APPLICATION',

  // ─── PROVIDER — service picker (CEO §A7 vocabulary) ──────────
  // ADD = the CTA seed from a marketing page ("Become a Sitter").
  // SELECT = the picker card inside the onboarding wizard.
  // Both are INTENT signals; the server still owns capability +
  // approval. CEO §9 — action-id is never authority.
  ADD_PROVIDER_SERVICE_PET_SITTING: 'ADD_PROVIDER_SERVICE_PET_SITTING',
  ADD_PROVIDER_SERVICE_DOG_WALKING: 'ADD_PROVIDER_SERVICE_DOG_WALKING',
  ADD_PROVIDER_SERVICE_TRAINING: 'ADD_PROVIDER_SERVICE_TRAINING',
  ADD_PROVIDER_SERVICE_PET_TRANSPORT: 'ADD_PROVIDER_SERVICE_PET_TRANSPORT',
  ADD_PROVIDER_SERVICE_STATION_OPERATOR: 'ADD_PROVIDER_SERVICE_STATION_OPERATOR',
  SELECT_PROVIDER_SERVICE_PET_SITTING: 'SELECT_PROVIDER_SERVICE_PET_SITTING',
  SELECT_PROVIDER_SERVICE_DOG_WALKING: 'SELECT_PROVIDER_SERVICE_DOG_WALKING',
  SELECT_PROVIDER_SERVICE_TRAINING: 'SELECT_PROVIDER_SERVICE_TRAINING',
  SELECT_PROVIDER_SERVICE_PET_TRANSPORT: 'SELECT_PROVIDER_SERVICE_PET_TRANSPORT',
  SELECT_PROVIDER_SERVICE_STATION_OPERATOR: 'SELECT_PROVIDER_SERVICE_STATION_OPERATOR',

  // ─── WORKSPACE SWITCH (CEO §A9 §A10) ─────────────────────────
  SWITCH_TO_PET_PARENT: 'SWITCH_TO_PET_PARENT',
  SWITCH_TO_PROVIDER: 'SWITCH_TO_PROVIDER',

  // ─── PET / KYA ───────────────────────────────────────────────
  ADD_PET: 'ADD_PET',
  EDIT_PET: 'EDIT_PET',
  CONFIRM_KYA: 'CONFIRM_KYA',

  // ─── BOOKING / PAYMENT — CEO §10 safer semantics ─────────────
  //
  // The registry names INTENT, never the money execution itself. So
  // "cancel booking" is split into OPEN_CANCELLATION_QUOTE (opens the
  // quote screen — no money moves) and CONFIRM_BOOKING_CANCELLATION
  // (the explicit user confirm after seeing the quote). "Retry
  // payment" is START_PAYMENT_RETRY (opens the retry surface) —
  // the actual charge is a server-owned domain action, not a CTA.
  START_BOOKING: 'START_BOOKING',
  CONTINUE_BOOKING: 'CONTINUE_BOOKING',
  START_PAYMENT: 'START_PAYMENT',
  START_PAYMENT_RETRY: 'START_PAYMENT_RETRY',
  OPEN_CANCELLATION_QUOTE: 'OPEN_CANCELLATION_QUOTE',
  CONFIRM_BOOKING_CANCELLATION: 'CONFIRM_BOOKING_CANCELLATION',

  // ─── PRESTIGE ────────────────────────────────────────────────
  START_PRESTIGE_ENROLLMENT: 'START_PRESTIGE_ENROLLMENT',
  OPEN_PRESTIGE_HOME: 'OPEN_PRESTIGE_HOME',

  // ─── WALLET / EGIFT — same safer split as booking money ──────
  START_WALLET_TOPUP: 'START_WALLET_TOPUP',
  CONFIRM_WALLET_TOPUP: 'CONFIRM_WALLET_TOPUP',
  START_EGIFT_REDEMPTION: 'START_EGIFT_REDEMPTION',
  CONFIRM_EGIFT_REDEMPTION: 'CONFIRM_EGIFT_REDEMPTION',
} as const;

export type CtaAction = (typeof CtaAction)[keyof typeof CtaAction];

/**
 * Action metadata — CEO §11 discipline for Journey Brain and
 * downstream consumers. An action-id is not one thing:
 *
 *   * NAVIGATION       — opens a screen, no state change
 *   * PREFERENCE       — records an intent / selection
 *   * AUTH             — a sign-in / sign-up step
 *   * BUSINESS_ACTION  — a booking / KYA / provider draft mutation
 *   * MONEY_OR_LEGAL   — moves money OR carries legal effect;
 *                        MUST be paired with an explicit CONFIRM_*
 *                        action and MUST NOT run without server
 *                        idempotency + explicit user confirmation
 *
 * `requiresAuth` — action is only legal for an authenticated user.
 * `requiresConfirmation` — UI must show a confirm step before the
 *                          action fires. Set for MONEY_OR_LEGAL and
 *                          for CANCEL-shaped BUSINESS_ACTION.
 * `workspace` — which workspace the action lives in. Purely
 *               informational; capability grants come from the server.
 */
export type CtaRisk =
  | 'NAVIGATION'
  | 'PREFERENCE'
  | 'AUTH'
  | 'BUSINESS_ACTION'
  | 'MONEY_OR_LEGAL';
export type CtaWorkspace = 'PUBLIC' | 'PET_PARENT' | 'PROVIDER' | 'ADMIN';

export interface CtaMeta {
  risk: CtaRisk;
  requiresAuth: boolean;
  requiresConfirmation: boolean;
  workspace: CtaWorkspace;
}

export const CTA_META: Record<CtaAction, CtaMeta> = {
  // AUTH — public, no confirmation, authentication itself.
  AUTH_GOOGLE:         { risk: 'AUTH', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_APPLE:          { risk: 'AUTH', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_PHONE:          { risk: 'AUTH', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_EMAIL:          { risk: 'AUTH', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_PASSKEY:        { risk: 'AUTH', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_SIGN_IN:        { risk: 'NAVIGATION', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_SIGN_UP:        { risk: 'NAVIGATION', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_SIGN_OUT:       { risk: 'AUTH', requiresAuth: true, requiresConfirmation: false, workspace: 'PUBLIC' },
  AUTH_PASSWORD_RESET: { risk: 'AUTH', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },

  // PROVIDER journey — NAVIGATION for start/resume, BUSINESS for save/submit.
  START_PROVIDER_APPLICATION:  { risk: 'NAVIGATION', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  RESUME_PROVIDER_APPLICATION: { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },
  SAVE_PROVIDER_DRAFT:         { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },
  SUBMIT_PROVIDER_APPLICATION: { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: true, workspace: 'PROVIDER' },

  // PROVIDER service picker — all preference.
  ADD_PROVIDER_SERVICE_PET_SITTING:      { risk: 'PREFERENCE', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  ADD_PROVIDER_SERVICE_DOG_WALKING:      { risk: 'PREFERENCE', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  ADD_PROVIDER_SERVICE_TRAINING:         { risk: 'PREFERENCE', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  ADD_PROVIDER_SERVICE_PET_TRANSPORT:    { risk: 'PREFERENCE', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  ADD_PROVIDER_SERVICE_STATION_OPERATOR: { risk: 'PREFERENCE', requiresAuth: false, requiresConfirmation: false, workspace: 'PUBLIC' },
  SELECT_PROVIDER_SERVICE_PET_SITTING:      { risk: 'PREFERENCE', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },
  SELECT_PROVIDER_SERVICE_DOG_WALKING:      { risk: 'PREFERENCE', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },
  SELECT_PROVIDER_SERVICE_TRAINING:         { risk: 'PREFERENCE', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },
  SELECT_PROVIDER_SERVICE_PET_TRANSPORT:    { risk: 'PREFERENCE', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },
  SELECT_PROVIDER_SERVICE_STATION_OPERATOR: { risk: 'PREFERENCE', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },

  // Workspace switch — navigation.
  SWITCH_TO_PET_PARENT: { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  SWITCH_TO_PROVIDER:   { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PROVIDER' },

  // Pet / KYA — business.
  ADD_PET:      { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  EDIT_PET:     { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  CONFIRM_KYA:  { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: true, workspace: 'PET_PARENT' },

  // BOOKING / PAYMENT — CEO §10 discipline.
  START_BOOKING:                  { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  CONTINUE_BOOKING:               { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  // START_PAYMENT / START_PAYMENT_RETRY open the payment surface — no
  // money moves at click time. The actual charge is server-owned +
  // idempotent + SDK-mediated. CEO §10 — the CTA is the intent, not
  // the execution.
  START_PAYMENT:                  { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: true, workspace: 'PET_PARENT' },
  START_PAYMENT_RETRY:            { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: true, workspace: 'PET_PARENT' },
  OPEN_CANCELLATION_QUOTE:        { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  CONFIRM_BOOKING_CANCELLATION:   { risk: 'MONEY_OR_LEGAL', requiresAuth: true, requiresConfirmation: true, workspace: 'PET_PARENT' },

  // Prestige — nav + business, entitlement not identity.
  START_PRESTIGE_ENROLLMENT: { risk: 'BUSINESS_ACTION', requiresAuth: true, requiresConfirmation: true, workspace: 'PET_PARENT' },
  OPEN_PRESTIGE_HOME:        { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },

  // Wallet / eGift — money always split START → CONFIRM.
  START_WALLET_TOPUP:       { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  CONFIRM_WALLET_TOPUP:     { risk: 'MONEY_OR_LEGAL', requiresAuth: true, requiresConfirmation: true, workspace: 'PET_PARENT' },
  START_EGIFT_REDEMPTION:   { risk: 'NAVIGATION', requiresAuth: true, requiresConfirmation: false, workspace: 'PET_PARENT' },
  CONFIRM_EGIFT_REDEMPTION: { risk: 'MONEY_OR_LEGAL', requiresAuth: true, requiresConfirmation: true, workspace: 'PET_PARENT' },
};

/**
 * Provider-service action pair — SELECT (the picker card) + ADD
 * (the CTA seed). Keyed by CanonicalService code from the shared
 * vocabulary. Adding a new service in
 * shared/lib/providerServiceVocabulary.ts fails a compile-time check
 * on the record's exhaustiveness (missing key errors).
 */
export const PROVIDER_SERVICE_ACTION_IDS: Record<
  ProviderServiceCode,
  { select: CtaAction; add: CtaAction }
> = {
  pet_sitting:      { select: CtaAction.SELECT_PROVIDER_SERVICE_PET_SITTING,      add: CtaAction.ADD_PROVIDER_SERVICE_PET_SITTING },
  dog_walking:      { select: CtaAction.SELECT_PROVIDER_SERVICE_DOG_WALKING,      add: CtaAction.ADD_PROVIDER_SERVICE_DOG_WALKING },
  training:         { select: CtaAction.SELECT_PROVIDER_SERVICE_TRAINING,         add: CtaAction.ADD_PROVIDER_SERVICE_TRAINING },
  pet_transport:    { select: CtaAction.SELECT_PROVIDER_SERVICE_PET_TRANSPORT,    add: CtaAction.ADD_PROVIDER_SERVICE_PET_TRANSPORT },
  station_operator: { select: CtaAction.SELECT_PROVIDER_SERVICE_STATION_OPERATOR, add: CtaAction.ADD_PROVIDER_SERVICE_STATION_OPERATOR },
};

// ─── URL emitter — CEO §1 §5 §6 fixes ─────────────────────────────

/**
 * Attribution-only allowlist for URL extras. A caller may add UTM /
 * campaign / referrer alongside a provider intent, but CANNOT
 * override the canonical fields the URL emitter owns
 * (requestedService, intent, role, type, redirect, workspace, uid).
 * CEO §6 — the caller may never overwrite canonical truth.
 */
export interface CtaUrlAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  campaignId?: string;
  referrer?: string;
}

const ATTRIBUTION_KEYS: Array<keyof CtaUrlAttribution> = [
  'utm_source', 'utm_medium', 'utm_campaign',
  'utm_content', 'utm_term', 'campaignId', 'referrer',
];

function stringifyAttribution(extra: CtaUrlAttribution | undefined): URLSearchParams {
  const out = new URLSearchParams();
  if (!extra) return out;
  for (const k of ATTRIBUTION_KEYS) {
    const v = extra[k];
    if (typeof v === 'string' && v.length > 0 && v.length <= 512) out.set(k, v);
  }
  return out;
}

/**
 * The ONE URL emitter every provider CTA on /sitter-suite,
 * /walk-my-pet, /academy, /pettrek, homepage, footer, marketing
 * pages should use.
 *
 * Emits `/become-provider?requestedService=<code>&<attribution>`
 * — routes through the resume gate (BecomeProviderResume) that
 * decides:
 *   * anonymous              → /signin?redirect=<full canonical URL>
 *   * signed-in, no draft    → /provider-onboarding?requestedService=…
 *   * draft in progress      → resume + seed the intent
 *   * pending / approved     → provider status / workspace
 *
 * CEO §1 — direct /provider-onboarding drops the query string for
 * anonymous users. Direct linking is banned.
 *
 * The caller CANNOT override the canonical `requestedService` even
 * by passing `{ requestedService: 'anything' }` in `extra` — the
 * function accepts an attribution allowlist only (CEO §6).
 */
export function urlForProviderIntent(
  service: ProviderServiceCode,
  extra?: CtaUrlAttribution,
): string {
  // Attribution FIRST — canonical fields cannot be overridden.
  const params = stringifyAttribution(extra);
  params.set('requestedService', service);
  return `/become-provider?${params.toString()}`;
}

/** Same but from a legacy alias — convenience for old marketing links. */
export function urlForLegacyProviderIntent(
  alias: LegacyProviderServiceAlias,
  extra?: CtaUrlAttribution,
): string {
  return urlForProviderIntent(LEGACY_TO_CODE[alias], extra);
}

/**
 * Return-to validator — CEO §5. Only internal PetWash paths are
 * ever honoured as a post-auth `redirect`. Blocks:
 *   * absolute URLs (http://, https://, //)
 *   * javascript: / data: / file:
 *   * empty / whitespace / null
 *   * paths without a leading slash
 *   * relative traversal (`..`)
 *
 * Returns the validated path or null (caller falls back to a safe
 * default — CEO §A8 /pet-parent/home).
 */
export function safeInternalReturnTo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  // Reject protocol-hint substrings anywhere.
  const lc = trimmed.toLowerCase();
  if (lc.includes('javascript:') || lc.includes('data:') || lc.includes('file:')) return null;
  // Reject relative traversal.
  if (trimmed.includes('..')) return null;
  return trimmed;
}

// Convenience re-exports so consumers migrating the wizard's legacy
// providerTypes[] to a ProviderServiceCode[] have one import.
export { CODE_TO_LEGACY, LEGACY_TO_CODE, normaliseToProviderServiceCode };

// ─── Observability — opt-in, safe defaults ───────────────────────

type CtaEventSink = (
  action: CtaAction,
  meta?: Record<string, string | number | boolean | undefined>,
) => void;

let ctaEventSink: CtaEventSink = () => {
  /* no-op until app shell installs the real sink */
};

export function setCtaEventSink(sink: CtaEventSink): void {
  ctaEventSink = sink;
}

export function emitCtaEvent(
  action: CtaAction,
  meta?: Record<string, string | number | boolean | undefined>,
): void {
  try {
    ctaEventSink(action, meta);
  } catch {
    /* observability must NEVER break a real user action */
  }
}
