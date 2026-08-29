/**
 * ctaActions — CEO MASTER PROGRAM §A11 §A12 (2026-08-29) — the ONE
 * semantic identity every critical call-to-action carries.
 *
 * WHY THIS EXISTS
 *
 *   * i18n breaks text-based tests. A CTA labelled "Continue with
 *     Google" in EN, "המשך עם Google" in HE, "Continue" on a compact
 *     viewport, and "→" on a tight mobile card is ONE action. E2E
 *     specs that look for the string are lies about coverage.
 *
 *   * Product analytics + auth-trace + observability (§A40 §B41)
 *     need a stable event vocabulary. `data-action-id` is what makes
 *     "Google click → Firebase success → session → post-login" a real
 *     funnel and not a guess.
 *
 *   * CTAs currently write different things (`?type=sitter`,
 *     `?role=trainer`, `?requestedService=pet_sitting`) at the URL
 *     edge. The registry names an ACTION, and a single edge normaliser
 *     translates action → URL param + session storage. That is the CEO
 *     §A11 "one semantic action helper" rule.
 *
 * DISCIPLINE
 *
 *   * Every value is a compile-time literal (no interpolation) so
 *     grep + source-anchored regression pins can find every emitter
 *     and every consumer.
 *
 *   * Every value is SCREAMING_SNAKE_CASE. `data-action-id="AUTH_GOOGLE"`
 *     is legal HTML and survives a class-name refactor.
 *
 *   * The set of allowed action IDs is FROZEN in one place. If a new
 *     CTA doesn't have an entry here, it does not get a data-action-id
 *     — the enum lookup fails at type-check time.
 *
 *   * Never derive behaviour from a translated string (§A12).
 *
 * USAGE
 *
 *   import { CtaAction } from '@/lib/ctaActions';
 *
 *   <button data-action-id={CtaAction.AUTH_GOOGLE}
 *           onClick={handleGoogle}>
 *     {t('auth.continueWithGoogle')}
 *   </button>
 *
 *   const cardTestId = `provider-type-${service}` as const;
 *   <div data-action-id={CtaAction.SELECT_PROVIDER_SITTER}
 *        data-testid={cardTestId}
 *        ...>...</div>
 *
 *   // Emit a client observability event:
 *   emitCtaEvent(CtaAction.AUTH_GOOGLE, { authJourneyId });
 *
 *   // Or resolve URL edge params from an intent:
 *   const url = urlForProviderService(CtaAction.ADD_PROVIDER_SERVICE_PET_SITTING);
 */

/**
 * Semantic action IDs for every critical CTA. The set is small on
 * purpose — additions require a PR whose diff shows the emitter and
 * a regression test.
 *
 * Legacy alias forms (`?type=sitter`, `?role=trainer`) do NOT get an
 * ID here — they are URL-edge shapes, not first-class actions. The
 * normaliser translates them into the canonical intent when they
 * arrive.
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

  // ─── PROVIDER — service picker (§A7 canonical vocabulary) ────
  // These are the ACTIVATION intents (adds the service to the draft
  // + persists the seed). The picker also carries them as
  // data-action-id so tests + analytics see one identity per service.
  ADD_PROVIDER_SERVICE_PET_SITTING: 'ADD_PROVIDER_SERVICE_PET_SITTING',
  ADD_PROVIDER_SERVICE_DOG_WALKING: 'ADD_PROVIDER_SERVICE_DOG_WALKING',
  ADD_PROVIDER_SERVICE_TRAINING: 'ADD_PROVIDER_SERVICE_TRAINING',
  ADD_PROVIDER_SERVICE_PET_TRANSPORT: 'ADD_PROVIDER_SERVICE_PET_TRANSPORT',
  ADD_PROVIDER_SERVICE_STATION_OPERATOR: 'ADD_PROVIDER_SERVICE_STATION_OPERATOR',

  // The picker card is the interactive control. Its data-action-id
  // stays the same regardless of selected state — the state lives on
  // aria-pressed / data-selected. §A16 "exact selection behaviour"
  // wire lives in the toggle handler, not in the id.
  SELECT_PROVIDER_SERVICE_PET_SITTING: 'SELECT_PROVIDER_SERVICE_PET_SITTING',
  SELECT_PROVIDER_SERVICE_DOG_WALKING: 'SELECT_PROVIDER_SERVICE_DOG_WALKING',
  SELECT_PROVIDER_SERVICE_TRAINING: 'SELECT_PROVIDER_SERVICE_TRAINING',
  SELECT_PROVIDER_SERVICE_PET_TRANSPORT: 'SELECT_PROVIDER_SERVICE_PET_TRANSPORT',
  SELECT_PROVIDER_SERVICE_STATION_OPERATOR: 'SELECT_PROVIDER_SERVICE_STATION_OPERATOR',

  // ─── WORKSPACE SWITCH (§A10 §A9) ─────────────────────────────
  SWITCH_TO_PET_PARENT: 'SWITCH_TO_PET_PARENT',
  SWITCH_TO_PROVIDER: 'SWITCH_TO_PROVIDER',

  // ─── PET / KYA ───────────────────────────────────────────────
  ADD_PET: 'ADD_PET',
  EDIT_PET: 'EDIT_PET',
  CONFIRM_KYA: 'CONFIRM_KYA',

  // ─── BOOKING / PAYMENT ───────────────────────────────────────
  START_BOOKING: 'START_BOOKING',
  CONTINUE_BOOKING: 'CONTINUE_BOOKING',
  CONTINUE_PAYMENT: 'CONTINUE_PAYMENT',
  RETRY_PAYMENT: 'RETRY_PAYMENT',
  CANCEL_BOOKING: 'CANCEL_BOOKING',

  // ─── PRESTIGE ────────────────────────────────────────────────
  START_PRESTIGE_ENROLLMENT: 'START_PRESTIGE_ENROLLMENT',
  OPEN_PRESTIGE_HOME: 'OPEN_PRESTIGE_HOME',

  // ─── WALLET / EGIFT ──────────────────────────────────────────
  REDEEM_EGIFT: 'REDEEM_EGIFT',
  ADD_WALLET_CREDIT: 'ADD_WALLET_CREDIT',
} as const;

export type CtaAction = (typeof CtaAction)[keyof typeof CtaAction];

/**
 * The 5-string canonical provider service alphabet the wizard +
 * provider_services rows speak. Mirrors CANONICAL_SERVICES in
 * requestedProviderService.ts — kept in this file only so the CTA
 * mapping tables below stay in one place. If ever unified, this
 * const alias should re-export from there.
 */
export type CanonicalProviderService =
  | 'walker'
  | 'sitter'
  | 'trainer'
  | 'driver'
  | 'station_operator';

/**
 * Map: canonical provider service label → the SELECT card action-id
 * (used by the picker) + the ADD intent action-id (used by the CTA
 * on Sitter/Walk-My-Pet/Academy/PetTrek pages). These pair up so a
 * single service has ONE identity across "the CTA that started the
 * intent" and "the card that owns the selection".
 */
export const PROVIDER_SERVICE_ACTION_IDS: Record<
  CanonicalProviderService,
  { select: CtaAction; add: CtaAction }
> = {
  sitter: {
    select: CtaAction.SELECT_PROVIDER_SERVICE_PET_SITTING,
    add: CtaAction.ADD_PROVIDER_SERVICE_PET_SITTING,
  },
  walker: {
    select: CtaAction.SELECT_PROVIDER_SERVICE_DOG_WALKING,
    add: CtaAction.ADD_PROVIDER_SERVICE_DOG_WALKING,
  },
  trainer: {
    select: CtaAction.SELECT_PROVIDER_SERVICE_TRAINING,
    add: CtaAction.ADD_PROVIDER_SERVICE_TRAINING,
  },
  driver: {
    select: CtaAction.SELECT_PROVIDER_SERVICE_PET_TRANSPORT,
    add: CtaAction.ADD_PROVIDER_SERVICE_PET_TRANSPORT,
  },
  station_operator: {
    select: CtaAction.SELECT_PROVIDER_SERVICE_STATION_OPERATOR,
    add: CtaAction.ADD_PROVIDER_SERVICE_STATION_OPERATOR,
  },
};

/**
 * The CEO canonical vocabulary (`pet_sitting`, `dog_walking`, …) is
 * what /provider-onboarding accepts on the ?requestedService= edge.
 * This helper lets a CTA emit the canonical form without hard-coding
 * the URL param name in five places.
 *
 * Example — the "Become a Sitter" button on /sitter-suite:
 *
 *   <a
 *     data-action-id={CtaAction.ADD_PROVIDER_SERVICE_PET_SITTING}
 *     href={urlForProviderIntent('sitter')}
 *   >Become a Sitter</a>
 *
 * Renders as `/provider-onboarding?requestedService=pet_sitting`.
 * The legacy `?type=` and `?role=` aliases are still accepted at the
 * receiving edge (see requestedProviderService.ts) so old bookmarks,
 * email links and native-app deep links do not break — but every new
 * emitter should use this helper.
 */
export const CANONICAL_URL_ALIAS: Record<CanonicalProviderService, string> = {
  sitter: 'pet_sitting',
  walker: 'dog_walking',
  trainer: 'training',
  driver: 'pet_transport',
  station_operator: 'station_operator',
};

/** Absolute path — not relative — so redirects that lose a base still work. */
export function urlForProviderIntent(
  service: CanonicalProviderService,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({
    requestedService: CANONICAL_URL_ALIAS[service],
    ...(extra ?? {}),
  });
  return `/provider-onboarding?${params.toString()}`;
}

/**
 * Opt-in observability. Every CTA that has an action-id can also
 * emit a telemetry event using the SAME id — the funnel then names
 * itself without a translation table. Non-sensitive fields only
 * (§A40 §D4): NO password, NO OTP, NO token, NO PII.
 *
 * The transport is deliberately absent here. Register a sink with
 * setCtaEventSink() from the app shell so this module has no
 * dependency on the telemetry provider (React Query, analytics
 * client, whichever) — and stays safely importable from server-side
 * bundle checks.
 */
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
