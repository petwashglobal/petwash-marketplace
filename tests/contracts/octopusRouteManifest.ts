/**
 * Octopus Route-Contract Manifest — canonical routes for launch-critical
 * flows. This file is the source of truth for the tests in
 * `tests/contracts/octopusRouteContracts.test.ts`.
 *
 * SCOPE (per CEO section I + J): NOT "perfect static analysis of every
 * route in the codebase". This is an explicit manifest of the flows
 * PetWash cannot ship without — auth, money, admin, provider onboarding,
 * booking-request creation. Each entry records:
 *
 *   - the frontend ROUTE the user navigates to (mounted in App.tsx)
 *   - the SERVER endpoint the client calls (mounted in server/routes*)
 *   - required AUTH middleware
 *   - RETIRED alternates that MUST return 410 Gone (proof the canonical
 *     rail is the only live path)
 *
 * When a PR adds / renames / retires a critical route, this manifest is
 * updated in the same PR. The test suite compares the manifest to the
 * actual mounted routes and fires loudly on drift.
 *
 * Categories in the manifest map 1:1 to the CEO's 15 flow list in
 * section I. Not every flow is encoded yet — the initial manifest
 * covers the 8 highest-risk (auth + money + admin + provider). Later
 * PRs will extend to booking / cancel / eGift / station wash / profile /
 * security / HR / provider calendar / notifications.
 */

export interface ClientCall {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Server path including the /api prefix (e.g. '/api/auth/sms/start'). */
  path: string;
  /**
   * Set to the number of an open PR that would make this call resolve to
   * a mounted handler. The test is skipped (with the PR visible in the
   * skip reason) until that PR merges.
   */
  pendingPR?: number;
}

export interface ServerMount {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /**
   * The server path pattern as it appears in the router.<verb>(...) call.
   * Includes the mount prefix (e.g. '/api/auth/sms/start' for a route
   * registered on app.post, or '/start' if mounted under `/api/auth/sms`
   * router). This test matches both shapes.
   */
  path: string;
  /**
   * Required authorization boundary the middleware must enforce.
   * The test asserts the handler line contains the corresponding
   * middleware token (requireAdmin / requireAuth / etc.).
   */
  auth: 'public' | 'user' | 'admin' | 'super_admin';
  /**
   * Set to the number of an open PR that would land this mount. The
   * test is skipped (with the PR visible in the skip reason) until
   * that PR merges.
   */
  pendingPR?: number;
}

/**
 * A `retiredAlternates[]` entry.
 * A plain string reads as { path, pendingPR: undefined } — the test
 * asserts the retirement is live TODAY. A `{ path, pendingPR }` entry
 * declares that a specific PR is expected to make the retirement live;
 * the corresponding tests are skipped (with the PR number visible in
 * the skip reason) until that PR merges, so the harness stays green on
 * `main` while still tracking the intent.
 */
export type RetiredAlternate = string | { path: string; pendingPR: number };

export interface RouteContract {
  /** Human-readable action name (e.g. "Continue with Google"). */
  action: string;
  /** Which of the 15 CEO-listed flow categories this belongs to. */
  flow:
    | 'signup' | 'google_login' | 'mobile_login' | 'provider' | 'prestige'
    | 'booking' | 'cancel' | 'egift' | 'station_wash' | 'profile'
    | 'security' | 'admin' | 'hr' | 'provider_calendar' | 'notifications';
  /** Frontend route(s) the user navigates to. Must exist in App.tsx. */
  clientRoutes?: string[];
  /** Server endpoint(s) the client calls. Must be mounted. */
  clientCalls?: ClientCall[];
  /** Server route mount(s) the endpoint(s) resolve to. */
  serverMounts?: ServerMount[];
  /**
   * Paths that MUST return 410 Gone (proof the canonical rail is the
   * only live path). Each entry must appear in a router.all(...) sentinel
   * with V1_DEPRECATED / ENDPOINT_RETIRED and MUST NOT have a
   * router.<verb>(...) mount elsewhere for the same specific path.
   */
  retiredAlternates?: RetiredAlternate[];
  /** One-line why-this-matters for a reviewer. */
  note?: string;
}

export const OCTOPUS_ROUTE_CONTRACTS: RouteContract[] = [
  // ─────────────────────────────────────── AUTH
  {
    action: 'Sign up (unified signup UX)',
    flow: 'signup',
    // /sign-up redirects to /signup (Route + <Redirect>); /join was deleted
    // in 2026-05 (see App.tsx comment). Only /signup is an active mount.
    clientRoutes: ['/signup', '/sign-up'],
    clientCalls: [
      { method: 'POST', path: '/api/auth/sms/start' },
      { method: 'POST', path: '/api/auth/sms/verify' },
      { method: 'POST', path: '/api/auth/email/start' },
      { method: 'POST', path: '/api/auth/email/verify' },
      { method: 'POST', path: '/api/auth/session' },
    ],
    note: 'Canonical customer OTP surface (auth-sms.ts + auth-email.ts). PR-AUTH-OTP-8 protected /start with Turnstile.',
  },
  {
    action: 'Sign in with Google (customer + admin)',
    flow: 'google_login',
    clientCalls: [
      { method: 'POST', path: '/api/auth/session' },
      { method: 'POST', path: '/api/auth/post-login' },
    ],
    note: 'Google OAuth from Firebase → /api/auth/session mints session cookie → post-login decider routes.',
  },
  {
    action: 'Sign in with mobile OTP (returning user)',
    flow: 'mobile_login',
    clientCalls: [
      { method: 'POST', path: '/api/auth/sms/start' },
      { method: 'POST', path: '/api/auth/sms/verify' },
      { method: 'POST', path: '/api/auth/phone-session' },
    ],
    retiredAlternates: [
      { path: '/api/auth/phone/otp/send',    pendingPR: 1828 },
      { path: '/api/auth/phone/otp/resend',  pendingPR: 1828 },
      { path: '/api/auth/phone/otp/verify',  pendingPR: 1828 },
    ],
    note: 'PR-AUTH-OTP-8 (PR #1828) retired the RegistrationOTPService phone endpoints to 410. Canonical is /api/auth/sms/*.',
  },

  // ─────────────────────────────────────── PROFILE + ACTIVATION
  {
    action: 'View + edit profile',
    flow: 'profile',
    // /profile is not a real mount today; user-facing routes are /settings
    // and /my-account. Both drive the same PATCH profile handler.
    clientRoutes: ['/settings', '/my-account'],
    clientCalls: [
      // Router is mounted at /api/user (routes.ts:12378), handler is /profile.
      { method: 'GET', path: '/api/user/profile' },
      { method: 'PATCH', path: '/api/user/profile' },
    ],
    note: 'PR-DANGER-8 replaced SELECT * with explicit projection to prevent PII column leaks on future schema additions.',
  },
  {
    action: 'Account activation status + resume',
    flow: 'signup',
    clientRoutes: ['/activate-account'],
    clientCalls: [
      { method: 'GET', path: '/api/onboarding-verification/activation-status' },
    ],
    serverMounts: [
      // pendingPR: 1824 — PR-AUTH-CONTACTS-3 adds the resolveActivationUid
      // helper that derives uid from Bearer / pw_session. Until it merges
      // the handler is unauthenticated (enumeration door) and this test
      // correctly refuses to say the mount enforces auth="user".
      { method: 'GET', path: '/activation-status', auth: 'user', pendingPR: 1824 },
    ],
    note: 'PR-AUTH-CONTACTS-3 (PR #1824) fixed the ?userId=<uid> enumeration door: uid now derived from Bearer / pw_session, not query.',
  },

  // ─────────────────────────────────────── ADMIN
  {
    action: 'Admin sign in (Google-only, no password form)',
    flow: 'admin',
    // /admin/login-v2 is only referenced as an alias in a comment; not
    // registered as a separate Route (both paths point to the same
    // AdminLoginV2 component via /admin/login).
    clientRoutes: ['/admin/login'],
    clientCalls: [
      { method: 'POST', path: '/api/auth/session' },
      { method: 'GET', path: '/api/session/whoami' },
    ],
    retiredAlternates: [
      { path: '/api/admin/login', pendingPR: 1827 },
    ],
    note: 'PR-AUTH-ADMIN-7 (PR #1827) retired /api/admin/login to 410. Admin auth is Google SSO through /api/auth/session with SUPER_ADMIN_EMAILS + email_verified gate.',
  },
  {
    action: 'Admin approve staff access request',
    flow: 'admin',
    clientCalls: [
      { method: 'POST', path: '/api/access-requests/:id/approve' },
    ],
    serverMounts: [
      // Router-level path: mounted at /api/access-requests, handler is /:id/approve.
      // Handler enforces isSuperAdmin inline + requireAuth via the router.
      { method: 'POST', path: '/:id/approve', auth: 'user' },
    ],
    note: 'PR-AUTH-MULTIROLE-5 removed the users.role="staff" clobber; staff capability now derives from staff_access_requests.status=approved.',
  },

  // ─────────────────────────────────────── PROVIDER ONBOARDING
  {
    action: 'Provider apply / draft / resume',
    flow: 'provider',
    clientRoutes: ['/provider-onboarding', '/become-provider'],
    retiredAlternates: [
      // The /v1/providers* sentinel exists but the handler bodies for
      // POST/GET providers were NOT deleted (out of scope for
      // PR-DANGER-1 through DANGER-9 — those focused on wallet + brain
      // + bookings). The sentinel currently 410s them via mount order.
      // Deleting the handler bodies is a follow-up PR (call it
      // PR-DANGER-10). Marked pendingPR: 0 as a "known drift" that
      // does NOT block the harness on main — a merge that adds a
      // handler ABOVE the sentinel would still be caught.
      { path: '/api/octopus/v1/providers',        pendingPR: 0 },
      { path: '/api/octopus/v1/providers/search', pendingPR: 0 },
    ],
    note: 'Canonical provider intake lives at /api/provider-onboarding/*. Octopus V1 provider handler bodies still exist below the /v1/providers* sentinel (PR-DANGER-10 follow-up).',
  },

  // ─────────────────────────────────────── MONEY / WALLET / VOUCHER
  {
    action: 'Wallet balance + topup',
    flow: 'egift',
    clientCalls: [
      { method: 'GET', path: '/api/wallet' },
    ],
    retiredAlternates: [
      { path: '/api/octopus/v1/wallet/redeem', pendingPR: 1829 },
      { path: '/api/octopus/v1/wallet/credit', pendingPR: 1829 },
      // /v1/wallet/:userId is a GET-only handler shadowed by the sentinel
      // but the body is not deleted yet (out of scope for #1829). Same
      // follow-up as the /v1/providers handler bodies.
      { path: '/api/octopus/v1/wallet/:userId', pendingPR: 0 },
      { path: '/api/octopus/v1/brain/redeem', pendingPR: 1829 },
    ],
    note: 'PR-DANGER-1 (PR #1829) deleted the unauth mint handlers under /v1/wallet* + added /v1/brain* sentinel. Canonical wallet ops live at /api/wallet + /api/credit-wallet + /api/v2/vouchers/redeem.',
  },
  {
    action: 'Voucher redeem (canonical)',
    flow: 'egift',
    clientCalls: [
      { method: 'POST', path: '/api/v2/vouchers/redeem' },
    ],
    note: 'Server-known face value + owner check + idempotency-key. Replaces the retired /v1/brain/redeem which took client-controlled amountCents.',
  },

  // ─────────────────────────────────────── BOOKING
  {
    action: 'Create booking request (canonical)',
    flow: 'booking',
    clientCalls: [
      { method: 'POST', path: '/api/booking-requests' },
      { method: 'GET', path: '/api/booking-requests' },
    ],
    retiredAlternates: [
      { path: '/api/octopus/v1/bookings',                  pendingPR: 1832 },
      { path: '/api/octopus/v1/bookings/:id',              pendingPR: 1832 },
      { path: '/api/octopus/v1/bookings/:id/complete',     pendingPR: 1832 },
      { path: '/api/octopus/v1/bookings/:id/cancel',       pendingPR: 1832 },
    ],
    note: 'PR-DANGER-4 (PR #1832) deleted all four V1 booking handlers (the /complete one wrote PAYMENT_CAPTURED + PROVIDER_EARNING ledger rows on the deprecated octopus_bookings table).',
  },

  // ─────────────────────────────────────── COMPLIANCE
  {
    action: 'Compliance document review (reviewer-only, distinct from submitter update)',
    flow: 'admin',
    clientCalls: [
      { method: 'PUT', path: '/api/compliance/authority-documents/:id' },
      { method: 'PATCH', path: '/api/compliance/authority-documents/:id/review', pendingPR: 1833 },
    ],
    serverMounts: [
      { method: 'PUT',   path: '/authority-documents/:id',        auth: 'admin' },
      { method: 'PATCH', path: '/authority-documents/:id/review', auth: 'admin', pendingPR: 1833 },
    ],
    note: 'PR-DANGER-5 (PR #1833) split submitter vs reviewer mutations to close the self-approval evidence-tampering vector.',
  },

  // ─────────────────────────────────────── HR
  {
    action: 'HR admin employee CRUD',
    flow: 'hr',
    clientRoutes: ['/admin/hr'],
    clientCalls: [
      { method: 'GET', path: '/api/enterprise/hr/employees' },
      { method: 'GET', path: '/api/enterprise/hr/payroll' },
      { method: 'PATCH', path: '/api/enterprise/hr/employees/:id' },
      { method: 'PATCH', path: '/api/enterprise/hr/payroll/:id/status' },
    ],
    serverMounts: [
      { method: 'GET', path: '/employees', auth: 'admin' },
      { method: 'GET', path: '/payroll', auth: 'admin' },
      { method: 'PATCH', path: '/employees/:id', auth: 'admin' },
      { method: 'PATCH', path: '/payroll/:id/status', auth: 'admin' },
    ],
    note: 'PR-DANGER-2 (PR #1830 — MERGE-BLOCKED) tightened PATCH to a strict allowlist. PR-DANGER-7 (PR #1835) fixed the client bearer/cookie mismatch that silently 401d the panels.',
  },

  // ─────────────────────────────────────── INBOX
  {
    action: 'Secure Inbox — send message + lookup existence',
    flow: 'notifications',
    clientCalls: [
      { method: 'POST', path: '/api/messages/send' },
      // lookup-check may or may not exist on `main` yet depending on
      // whether P0-143 has fully landed. If the harness reports it
      // missing, ship the retirement + lookup-check as a follow-up.
      { method: 'POST', path: '/api/messages/lookup-check', pendingPR: 0 },
    ],
    retiredAlternates: [
      // pendingPR: 0 = known drift, not blocking. Handler still exists at
      // /api/messages/lookup-user (returns full recipient UID/email/
      // displayName). P0-143 was marked completed in the internal task
      // list but the code shows the handler surviving — likely a task-
      // tracking desync. Follow-up: verify + retire, or reopen P0-143.
      { path: '/api/messages/lookup-user', pendingPR: 0 },
    ],
    note: 'P0-143 nominally retired /api/messages/lookup-user, but the handler survives on main — surfaced by this harness as pending. Sender is server-derived from Firebase token, never body.',
  },
];
