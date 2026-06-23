/**
 * app-namespace-routes.ts
 *
 * The canonical map of the app-structure rebuild (SDD
 * docs/design/2026-06-24-three-frontend-app-structure-rebuild.md §6).
 *
 * Every screen the CEO listed for the Prestige app (23) and the Provider app
 * (25) is mapped to:
 *   • newPath  — its home under the new namespace (/prestige/* or /provider/*)
 *   • oldPath  — the EXISTING route that already renders it (null = brand-new
 *                screen that does not exist yet, must be built in a later stage)
 *   • status   — 'rehost' (route alias only), 'partial' (exists, needs wiring),
 *                or 'missing' (build new)
 *
 * Stage 0 ships this as DATA only (no entry flip). The namespace <Redirect>
 * aliases and the PrestigeShell wiring are mounted behind
 * VITE_APP_STRUCTURE_V2_ENABLED in App.tsx and stay dark until later stages.
 *
 * This file is the multi-agent coordination contract: Claude AND Codex build
 * the namespace from THIS table, not from a parallel invented one. A
 * table-driven test (app-namespace-routes.test.ts) fails if any of the 48 CEO
 * screens lacks a target, so the matrix can never silently drift.
 *
 * MONEY INVARIANT: rows tagged money:true re-host a finance screen. Re-hosting
 * is a route alias ONLY — the underlying component, its API calls, idempotency
 * keys and tax/receipt behavior must NOT change. See SDD §9.
 */

export type ScreenStatus = 'rehost' | 'partial' | 'missing';
export type ScreenApp = 'prestige' | 'provider';

export interface ScreenRoute {
  /** Stable id for this CEO screen (kebab-case). */
  id: string;
  /** Which native app this screen belongs to. */
  app: ScreenApp;
  /** CEO screen number within its list (1-based), for traceability to the brief. */
  ceoNumber: number;
  /** CEO's screen label, verbatim. */
  ceoLabel: string;
  /** New canonical path under the namespace. */
  newPath: string;
  /**
   * Existing route that already renders this screen, which the new path will
   * alias / redirect to. null when the screen is not built yet.
   */
  oldPath: string | null;
  status: ScreenStatus;
  /** True if this screen touches the sacred money/finance runtime (re-host only). */
  money?: boolean;
  /** Optional note (freeze status, gap detail). */
  note?: string;
}

/** Prestige (customer) app — 23 screens, SDD §6.1. */
export const PRESTIGE_SCREENS: ScreenRoute[] = [
  { id: 'prestige-welcome',     app: 'prestige', ceoNumber: 1,  ceoLabel: 'Welcome/Login',          newPath: '/prestige/welcome',           oldPath: null,                 status: 'missing', note: 'built natively as PrestigeWelcome (Stage 4); no old route to alias — CTAs route into existing auth' },
  { id: 'prestige-pass',        app: 'prestige', ceoNumber: 2,  ceoLabel: 'Member Card / QR',        newPath: '/prestige/pass',              oldPath: '/prestige-pass',     status: 'rehost' },
  { id: 'prestige-home',        app: 'prestige', ceoNumber: 3,  ceoLabel: 'Home Dashboard',          newPath: '/prestige',                   oldPath: '/dashboard',         status: 'rehost' },
  { id: 'prestige-pets',        app: 'prestige', ceoNumber: 4,  ceoLabel: 'Pet Profiles',            newPath: '/prestige/pets',              oldPath: '/pets',              status: 'rehost' },
  { id: 'prestige-book-wash',   app: 'prestige', ceoNumber: 5,  ceoLabel: 'Book Self-Service Wash',  newPath: '/prestige/book/wash',         oldPath: '/k9000',             status: 'rehost' },
  { id: 'prestige-packages',    app: 'prestige', ceoNumber: 6,  ceoLabel: 'Buy Wash Package',        newPath: '/prestige/packages',          oldPath: '/packages',          status: 'rehost', money: true },
  { id: 'prestige-gift',        app: 'prestige', ceoNumber: 7,  ceoLabel: 'Gift Card',               newPath: '/prestige/gift',              oldPath: '/buy-gift-card',     status: 'rehost', money: true },
  { id: 'prestige-book-sitter', app: 'prestige', ceoNumber: 8,  ceoLabel: 'Pet Sitter Booking',      newPath: '/prestige/book/sitter',       oldPath: '/sitter-suite',      status: 'rehost' },
  { id: 'prestige-book-walk',   app: 'prestige', ceoNumber: 9,  ceoLabel: 'Walk My Pet Booking',     newPath: '/prestige/book/walk',         oldPath: '/walk-my-pet',       status: 'rehost' },
  { id: 'prestige-book-trainer',app: 'prestige', ceoNumber: 10, ceoLabel: 'Trainer Booking',         newPath: '/prestige/book/trainer',      oldPath: '/academy',           status: 'rehost' },
  { id: 'prestige-book-transport', app: 'prestige', ceoNumber: 11, ceoLabel: 'Pet Transport Booking', newPath: '/prestige/book/transport',   oldPath: '/pettrek',           status: 'partial', note: 'PetTrek frozen / Coming Soon — stub until unfrozen' },
  { id: 'prestige-shop',        app: 'prestige', ceoNumber: 12, ceoLabel: 'Shop',                    newPath: '/prestige/shop',              oldPath: '/shop',              status: 'rehost' },
  { id: 'prestige-product',     app: 'prestige', ceoNumber: 13, ceoLabel: 'Product Details',         newPath: '/prestige/shop/:id',          oldPath: '/shop/:id',          status: 'rehost' },
  { id: 'prestige-cart',        app: 'prestige', ceoNumber: 14, ceoLabel: 'Cart',                    newPath: '/prestige/cart',              oldPath: '/cart',              status: 'rehost', money: true },
  { id: 'prestige-checkout',    app: 'prestige', ceoNumber: 15, ceoLabel: 'Checkout',                newPath: '/prestige/checkout',          oldPath: '/checkout',          status: 'rehost', money: true },
  { id: 'prestige-wallet',      app: 'prestige', ceoNumber: 16, ceoLabel: 'Wallet / Credits',        newPath: '/prestige/wallet',            oldPath: '/my-wallet',         status: 'rehost', money: true, note: '/wallet is the Apple-pass download; member wallet is /my-wallet (MyWallet)' },
  { id: 'prestige-rewards',     app: 'prestige', ceoNumber: 17, ceoLabel: 'Rewards',                 newPath: '/prestige/rewards',           oldPath: '/loyalty/dashboard', status: 'rehost' },
  { id: 'prestige-receipts',    app: 'prestige', ceoNumber: 18, ceoLabel: 'Receipts / Invoices',     newPath: '/prestige/receipts',          oldPath: '/receipts',          status: 'rehost', money: true },
  { id: 'prestige-bookings',    app: 'prestige', ceoNumber: 19, ceoLabel: 'Booking History',         newPath: '/prestige/bookings',          oldPath: '/bookings',          status: 'rehost' },
  { id: 'prestige-booking-detail', app: 'prestige', ceoNumber: 20, ceoLabel: 'Reschedule / Cancel',  newPath: '/prestige/bookings/:id',      oldPath: '/bookings/:id',      status: 'partial', money: true, note: 'cancel/refund inside CustomerBookings — do not touch refund math' },
  { id: 'prestige-support',     app: 'prestige', ceoNumber: 21, ceoLabel: 'Support',                 newPath: '/prestige/support',           oldPath: '/support',           status: 'rehost' },
  { id: 'prestige-account',     app: 'prestige', ceoNumber: 22, ceoLabel: 'Account Settings',        newPath: '/prestige/account',           oldPath: '/my-account',        status: 'rehost' },
  { id: 'prestige-legal',       app: 'prestige', ceoNumber: 23, ceoLabel: 'Terms / Privacy',         newPath: '/prestige/legal',             oldPath: '/legal',             status: 'rehost', note: 'WebView-allowed' },
];

/** Provider app — 25 screens, SDD §6.2. */
export const PROVIDER_SCREENS: ScreenRoute[] = [
  { id: 'provider-login',        app: 'provider', ceoNumber: 1,  ceoLabel: 'Provider Login',           newPath: '/provider/login',                oldPath: '/signin',                      status: 'rehost' },
  { id: 'provider-app-status',   app: 'provider', ceoNumber: 2,  ceoLabel: 'Application Status',        newPath: '/provider/application-status',   oldPath: '/provider-application/status', status: 'rehost' },
  { id: 'provider-onboarding',   app: 'provider', ceoNumber: 3,  ceoLabel: 'Onboarding Checklist',      newPath: '/provider/onboarding',           oldPath: '/provider-onboarding',         status: 'rehost' },
  { id: 'provider-identity',     app: 'provider', ceoNumber: 4,  ceoLabel: 'Identity Upload',           newPath: '/provider/onboarding/identity',  oldPath: '/provider-onboarding',         status: 'rehost', note: 'step within onboarding' },
  { id: 'provider-tax',          app: 'provider', ceoNumber: 5,  ceoLabel: 'Tax Declaration',           newPath: '/provider/onboarding/tax',       oldPath: '/provider-onboarding',         status: 'rehost', note: 'step within onboarding' },
  { id: 'provider-insurance',    app: 'provider', ceoNumber: 6,  ceoLabel: 'Insurance Declaration',     newPath: '/provider/onboarding/insurance', oldPath: '/provider-onboarding',         status: 'rehost', note: 'step within onboarding' },
  { id: 'provider-bank',         app: 'provider', ceoNumber: 7,  ceoLabel: 'Bank Verification',         newPath: '/provider/onboarding/bank',      oldPath: '/provider-onboarding',         status: 'partial', money: true, note: 'payout-rail wiring — do not alter payout math' },
  { id: 'provider-sign',         app: 'provider', ceoNumber: 8,  ceoLabel: 'Legal Agreement Signature', newPath: '/provider/onboarding/sign',      oldPath: '/provider-onboarding',         status: 'rehost', note: 'step within onboarding' },
  { id: 'provider-academy',      app: 'provider', ceoNumber: 9,  ceoLabel: 'Academy Training',          newPath: '/provider/academy',              oldPath: '/academy',                     status: 'rehost' },
  { id: 'provider-services',     app: 'provider', ceoNumber: 10, ceoLabel: 'Services Offered',          newPath: '/provider/services',             oldPath: '/provider-os',                 status: 'rehost', note: 'POSServices module (?m=services)' },
  { id: 'provider-pricing',      app: 'provider', ceoNumber: 11, ceoLabel: 'Pricing',                   newPath: '/provider/services/pricing',     oldPath: '/provider-os',                 status: 'partial', note: 'pricing within POSServices' },
  { id: 'provider-calendar',     app: 'provider', ceoNumber: 12, ceoLabel: 'Availability Calendar',     newPath: '/provider/calendar',             oldPath: '/provider-os',                 status: 'rehost', note: 'POSCalendar module (?m=calendar)' },
  { id: 'provider-job-requests', app: 'provider', ceoNumber: 13, ceoLabel: 'Job Requests',             newPath: '/provider/jobs/requests',        oldPath: '/provider-os',                 status: 'rehost', note: 'POSJobs ?tab=requests' },
  { id: 'provider-jobs',         app: 'provider', ceoNumber: 14, ceoLabel: 'Accepted Jobs',             newPath: '/provider/jobs',                 oldPath: '/provider-os',                 status: 'rehost', note: 'POSJobs ?tab=accepted' },
  { id: 'provider-job-detail',   app: 'provider', ceoNumber: 15, ceoLabel: 'Job Details',              newPath: '/provider/jobs/:id',             oldPath: '/provider/tasks',              status: 'rehost' },
  { id: 'provider-job-start',    app: 'provider', ceoNumber: 16, ceoLabel: 'Start Job',                newPath: '/provider/jobs/:id/start',       oldPath: '/provider/tasks',              status: 'partial', money: true, note: 'lifecycle — verify, do not change money' },
  { id: 'provider-job-complete', app: 'provider', ceoNumber: 17, ceoLabel: 'Complete Job',            newPath: '/provider/jobs/:id/complete',    oldPath: '/provider/tasks',              status: 'partial', money: true, note: 'completion gates payout — do not touch' },
  { id: 'provider-job-notes',    app: 'provider', ceoNumber: 18, ceoLabel: 'Care Notes / Photos',     newPath: '/provider/jobs/:id/notes',       oldPath: '/provider/tasks',              status: 'rehost' },
  { id: 'provider-incident',     app: 'provider', ceoNumber: 19, ceoLabel: 'Incident Report',         newPath: '/provider/safety/incident',      oldPath: '/provider-os',                 status: 'rehost', note: 'POSSafety module (?m=safety)' },
  { id: 'provider-earnings',     app: 'provider', ceoNumber: 20, ceoLabel: 'Earnings',                newPath: '/provider/earnings',             oldPath: '/provider/earnings',           status: 'rehost', money: true, note: 'already namespaced' },
  { id: 'provider-payouts',      app: 'provider', ceoNumber: 21, ceoLabel: 'Payouts',                 newPath: '/provider/payouts',              oldPath: '/provider-os',                 status: 'rehost', money: true, note: 'POSWallet module (?m=wallet)' },
  { id: 'provider-documents',    app: 'provider', ceoNumber: 22, ceoLabel: 'Missing Documents',       newPath: '/provider/documents',            oldPath: '/provider-os',                 status: 'rehost', note: 'POSDocuments module (?m=documents)' },
  { id: 'provider-compliance',   app: 'provider', ceoNumber: 23, ceoLabel: 'Compliance Renewal',      newPath: '/provider/compliance',           oldPath: '/provider-compliance',         status: 'rehost' },
  { id: 'provider-support',      app: 'provider', ceoNumber: 24, ceoLabel: 'Provider Support',        newPath: '/provider/support',              oldPath: '/provider-os',                 status: 'rehost', note: 'POSAssistant module (?m=assistant)' },
  { id: 'provider-account',      app: 'provider', ceoNumber: 25, ceoLabel: 'Account Settings',        newPath: '/provider/account',              oldPath: '/provider-os',                 status: 'rehost', note: 'POSProfile/POSSettings module (?m=settings)' },
];

/** All 48 CEO-listed screens. */
export const SCREEN_ROUTES: ScreenRoute[] = [...PRESTIGE_SCREENS, ...PROVIDER_SCREENS];

/** Screens that have an existing route to redirect FROM (Stage 1/2 alias source). */
export const REDIRECTABLE_SCREENS: ScreenRoute[] = SCREEN_ROUTES.filter(
  (s) => s.oldPath !== null,
);
