/**
 * CTA action-id registry (post-release 2026-09-03 · Lane B).
 *
 * CEO ruling: every critical CTA on PetWash needs ONE semantic identity
 * that survives i18n (Hebrew ⇄ English label swap), CSS refactors,
 * copy tweaks, and the "tap → nothing happens" auth failure the P0
 * post-mortem named. That identity is:
 *
 *   • the `CtaAction` enum (a compile-time literal — no typos)
 *   • the `data-action-id="<CtaAction>"` DOM attribute on the control
 *   • the URL emitter helpers (`urlForProviderIntent`, etc.) that
 *     produce the canonical destination for the intent
 *   • the `emitCtaEvent` observability hook (opt-in, no-op default —
 *     a thrown analytics sink NEVER breaks a real user action)
 *
 * A CTA that carries `data-action-id="AUTH_GOOGLE"` reads the same on
 * Chrome, Safari, iPad-RTL, and in an E2E spec, whether the visible
 * label says "המשך עם Google" or "Continue with Google" or "כניסה עם
 * חשבון Google". That is the property that makes end-to-end tests
 * durable, analytics comparable, and the "tap did nothing" bug
 * traceable to a specific action id.
 *
 * Zero external deps. Safe to import from any client bundle.
 */

/** Canonical provider services. Mirrors client/src/lib/requestedProviderService.ts. */
export type CanonicalProviderService =
  | 'walker'
  | 'sitter'
  | 'station_operator'
  | 'driver'
  | 'trainer';

/**
 * Every critical CTA identity the app cares about. The frozen list
 * (add sparingly): every new entry means a new tap surface, so keep
 * this narrow. Naming: `<DOMAIN>_<ACTION>` in SCREAMING_SNAKE_CASE.
 */
export type CtaAction =
  // Auth (SignIn / SignUp / SigninDoor / ReturnLogin)
  | 'AUTH_GOOGLE'
  | 'AUTH_APPLE'
  | 'AUTH_EMAIL_PASSWORD'
  | 'AUTH_PHONE_OTP'
  | 'AUTH_PASSKEY'
  | 'AUTH_MAGIC_LINK'
  | 'AUTH_SIGN_OUT'
  | 'AUTH_FORGOT_PASSWORD'
  | 'AUTH_RESEND_OTP'

  // Provider funnel — see PROVIDER_SERVICE_ACTION_IDS below
  | 'BECOME_PROVIDER_ENTRY'
  | 'PROVIDER_SUBMIT_APPLICATION'
  | 'SELECT_PROVIDER_SERVICE_SITTER'
  | 'SELECT_PROVIDER_SERVICE_WALKER'
  | 'SELECT_PROVIDER_SERVICE_TRAINER'
  | 'SELECT_PROVIDER_SERVICE_DRIVER'
  | 'SELECT_PROVIDER_SERVICE_STATION_OPERATOR'
  | 'ADD_PROVIDER_SERVICE_SITTER'
  | 'ADD_PROVIDER_SERVICE_WALKER'
  | 'ADD_PROVIDER_SERVICE_TRAINER'
  | 'ADD_PROVIDER_SERVICE_DRIVER'
  | 'ADD_PROVIDER_SERVICE_STATION_OPERATOR'

  // Workspace switching (customer ⇄ provider ⇄ admin)
  | 'SWITCH_TO_PET_PARENT_WORKSPACE'
  | 'SWITCH_TO_PROVIDER_WORKSPACE'
  | 'SWITCH_TO_ADMIN_WORKSPACE'

  // Booking journey (Pet Sitter / Walk / Academy)
  | 'BOOK_SITTER_ENTRY'
  | 'BOOK_WALK_ENTRY'
  | 'BOOK_ACADEMY_ENTRY'
  | 'BOOK_CONFIRM'
  | 'BOOK_CANCEL'

  // Prestige (membership entitlements — an in-workspace surface, not
  // a competing customer destination — CEO Lane A ruling)
  | 'PRESTIGE_JOIN'
  | 'PRESTIGE_MANAGE'
  | 'PRESTIGE_VIEW_BENEFITS'

  // Wallet + eGift
  | 'WALLET_VIEW'
  | 'WALLET_TOP_UP'
  | 'EGIFT_PURCHASE'
  | 'EGIFT_REDEEM'

  // Pets + KYA (personal safety)
  | 'PET_ADD'
  | 'PET_EDIT'
  | 'PET_KYA_UPDATE'

  // Journey Brain — resume an abandoned wizard from a saved
  // JourneyCheckpoint. Emitted from the NextBestActionCard when
  // the server picks a resume hint as primary or secondary. The
  // wizard itself owns hydrate + revalidation on arrival.
  | 'RESUME_JOURNEY';

/**
 * Every provider service maps to a `{ select, add }` pair — the picker
 * card identity (select) and the intent identity (add) travel together.
 */
export const PROVIDER_SERVICE_ACTION_IDS: Readonly<
  Record<CanonicalProviderService, { select: CtaAction; add: CtaAction }>
> = Object.freeze({
  sitter: { select: 'SELECT_PROVIDER_SERVICE_SITTER', add: 'ADD_PROVIDER_SERVICE_SITTER' },
  walker: { select: 'SELECT_PROVIDER_SERVICE_WALKER', add: 'ADD_PROVIDER_SERVICE_WALKER' },
  trainer: { select: 'SELECT_PROVIDER_SERVICE_TRAINER', add: 'ADD_PROVIDER_SERVICE_TRAINER' },
  driver: { select: 'SELECT_PROVIDER_SERVICE_DRIVER', add: 'ADD_PROVIDER_SERVICE_DRIVER' },
  station_operator: {
    select: 'SELECT_PROVIDER_SERVICE_STATION_OPERATOR',
    add: 'ADD_PROVIDER_SERVICE_STATION_OPERATOR',
  },
});

/**
 * CEO §A7 canonical URL vocabulary → the 5-string alphabet the wizard
 * already speaks. Sits alongside requestedProviderService.ts's alias
 * map so CTA-emitters can pass either vocabulary and land the same.
 */
export const CANONICAL_URL_ALIAS: Readonly<Record<string, CanonicalProviderService>> = Object.freeze({
  pet_sitting: 'sitter',
  dog_walking: 'walker',
  training: 'trainer',
  pet_transport: 'driver',
  station_operator: 'station_operator',
});

/**
 * Build the canonical `/provider-onboarding` URL for a service intent.
 * Preserves any UTM / campaign params the caller wants to attach.
 * The wizard reads `requestedService=` first (via requestedProviderService.ts)
 * then falls back to legacy `type=` / `role=`.
 */
export function urlForProviderIntent(
  service: CanonicalProviderService,
  extra?: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams({ requestedService: service });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined || v === null || v === '') continue;
      params.set(k, String(v));
    }
  }
  return `/provider-onboarding?${params.toString()}`;
}

/**
 * Canonical customer workspace URL (Lane A ruling). Central so a
 * refactor changes it in ONE place, and CTAs never hard-code the
 * literal string.
 */
export const PET_PARENT_WORKSPACE_URL = '/pet-parent/home' as const;

/** Same idea for the provider workspace. */
export const PROVIDER_WORKSPACE_URL = '/provider-os' as const;

/** Same idea for the admin dashboard. */
export const ADMIN_DASHBOARD_URL = '/admin/dashboard' as const;

/** Envelope handed to the analytics sink. */
export interface CtaEventEnvelope {
  action: CtaAction;
  href?: string;
  ts: number;
  extra?: Readonly<Record<string, unknown>>;
}

type CtaEventSink = (event: CtaEventEnvelope) => void;

let _sink: CtaEventSink | null = null;

/**
 * Install an analytics/observability sink. Optional — if not set,
 * `emitCtaEvent` is a no-op. Passing `null` (or omitting the arg)
 * clears the sink, which is what tests do to guarantee isolation.
 */
export function setCtaEventSink(sink: CtaEventSink | null = null): void {
  _sink = sink;
}

/**
 * Emit a CTA event. Deliberately fire-and-forget — a thrown sink
 * NEVER surfaces to the tap handler. The whole point of the registry
 * is that a CTA's core behaviour (navigate, submit, sign-in) always
 * runs; analytics is opportunistic.
 */
export function emitCtaEvent(
  action: CtaAction,
  extra?: Record<string, unknown>,
): void {
  if (!_sink) return;
  try {
    _sink({
      action,
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      ts: Date.now(),
      extra: extra ? Object.freeze({ ...extra }) : undefined,
    });
  } catch {
    /* never surface to caller — see contract above */
  }
}
