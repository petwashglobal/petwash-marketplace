/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  THE AUTH RULEBOOK — the single source of truth for sign-up / sign-in      ║
 * ║                                                                            ║
 * ║  This file DECLARES what the system is supposed to do for every user       ║
 * ║  role × every channel (email code / SMS code / WhatsApp code / social /     ║
 * ║  passkey / PIN). It is plain enough for a non-engineer to read and say     ║
 * ║  "yes, that's the logic" — and precise enough for the Referee              ║
 * ║  (server/lib/authConformance.ts) to check the LIVE code against it and     ║
 * ║  FAIL the build when reality drifts from this truth.                       ║
 * ║                                                                            ║
 * ║  Rule of the house: change the BEHAVIOUR, you MUST change this file —      ║
 * ║  the Referee will catch you if you don't.                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

/** One verifiable assertion the Referee runs against a real source file. */
export interface RuleCheck {
  id: string;
  /** Plain-language: what must be true, and why. */
  says: string;
  /** Repo-relative file the Referee reads. */
  file: string;
  /** Every one of these substrings MUST be present (drift = one goes missing). */
  mustContain?: string[];
  /** None of these may be present. */
  mustNotContain?: string[];
}

export interface ChannelRule {
  channel: string;
  /** Plain-language description of the channel's intended behaviour. */
  plain: string;
  codeLength?: number;
  ttlSeconds?: number;
  maxAttempts?: number;
  lockoutMinutes?: number;
  botGate?: 'turnstile' | 'none';
  status: 'live' | 'config-gated' | 'not-used';
  endpoints?: string[];
  checks: RuleCheck[];
}

export interface RolePolicy {
  role: string;
  plain: string;
  /** What this role must satisfy before the gated capability unlocks. */
  requires: string[];
  checks?: RuleCheck[];
}

export const AUTH_RULEBOOK = {
  domain: 'auth/verification',
  version: '1.0.0',
  updated: '2026-06-28',

  // ── CHANNELS: what each "code" means and the exact rule ───────────────────
  channels: [
    {
      channel: 'email_code',
      plain: 'A 6-digit code emailed to the user. Valid 5 minutes, 5 tries. A matched code returns an HMAC-signed proof; /email-session swaps that proof for a login. Passwordless — exactly like the mobile code.',
      codeLength: 6, ttlSeconds: 300, maxAttempts: 5,
      botGate: 'none', // email send is itself the gate; no captcha on /email/start
      status: 'live',
      endpoints: ['/api/auth/email/start', '/api/auth/email/verify', '/api/auth/email-session'],
      checks: [
        { id: 'email.code.ttl', says: 'Email code lives 5 minutes (300s) and allows 5 attempts.', file: 'server/services/UnifiedVerificationService.ts', mustContain: ['ttlSeconds: 300', 'maxAttempts: 5'] },
        { id: 'email.proof.ttl', says: 'The email-verified proof token expires after 5 minutes.', file: 'server/lib/emailVerifiedToken.ts', mustContain: ['5 * 60 * 1000'] },
        { id: 'email.verify.mintsProof', says: '/email/verify returns the signed proof ONLY on a matched code.', file: 'server/routes/auth-email.ts', mustContain: ['mintEmailVerifiedToken', 'sessionToken'] },
        { id: 'email.session.requiresProof', says: '/email-session NEVER trusts a bare email — it validates the proof first.', file: 'server/routes/publicAuthRoutes.ts', mustContain: ['validateEmailVerifiedToken', '/api/auth/email-session'] },
        { id: 'email.session.csrfExempt', says: 'Pre-session email endpoints are CSRF-exempt or they 403.', file: 'server/index.ts', mustContain: ["'/api/auth/email/start'", "'/api/auth/email/verify'", "'/api/auth/email-session'"] },
      ],
    },
    {
      channel: 'sms_code',
      plain: 'A 6-digit code by SMS (Twilio). Valid 5 minutes, 5 tries, then a 15-minute lockout. Per-phone daily cap. A matched code → /phone-session → login. The canonical mobile-first path.',
      codeLength: 6, ttlSeconds: 300, maxAttempts: 5, lockoutMinutes: 15,
      botGate: 'turnstile',
      status: 'live',
      endpoints: ['/api/auth/sms/start', '/api/auth/sms/verify', '/api/auth/phone-session'],
      checks: [
        { id: 'sms.lockout', says: 'SMS code locks the phone for 15 minutes after too many tries.', file: 'server/services/TwilioSMSService.ts', mustContain: ['LOCKOUT_DURATION_MS = 15 * 60 * 1000'] },
        { id: 'sms.dailyCap', says: 'Each phone has a daily SMS cap (anti-fraud / cost).', file: 'server/services/TwilioSMSService.ts', mustContain: ['MAX_SMS_PER_PHONE_PER_DAY'] },
        { id: 'sms.session.csrfExempt', says: 'SMS auth endpoints are CSRF-exempt (pre-session).', file: 'server/index.ts', mustContain: ["'/api/auth/sms/start'", "'/api/auth/sms/verify'", "'/api/auth/phone-session'"] },
      ],
    },
    {
      channel: 'whatsapp_code',
      plain: 'A 6-digit code over WhatsApp — an ALTERNATIVE delivery channel for the same OTP engine as SMS (same 5-min / 5-try rules). Selected via channel:"whatsapp".',
      codeLength: 6, ttlSeconds: 300, maxAttempts: 5,
      botGate: 'turnstile',
      status: 'live',
      endpoints: ['/api/auth/phone/send-code', '/api/auth/phone/verify-code'],
      checks: [
        { id: 'whatsapp.channel', says: 'WhatsApp is a selectable OTP channel alongside SMS.', file: 'server/routes/publicAuthRoutes.ts', mustContain: ["z.enum(['sms', 'whatsapp'])"] },
      ],
    },
    {
      channel: 'social',
      plain: 'Google, Apple, Facebook, Instagram via their personal accounts. All buttons shown; an unconfigured provider degrades gracefully ("not switched on yet"), never a dead crash. Apple is required for the App Store.',
      botGate: 'none',
      status: 'live',
      checks: [
        { id: 'social.flagsOn', says: 'Google, Apple, Email, Facebook, Instagram are all enabled.', file: 'client/src/lib/authSignupFlags.ts', mustContain: ["googleSignin: on(", "appleSignin: on(", "emailPassword: on(", "facebookSignin: on(", "instagramSignin: on("] },
        { id: 'social.gracefulLux', says: 'The premium screen routes social sign-in through the graceful handler.', file: 'client/src/pages/SignUpLuxury.tsx', mustContain: ["social('apple')", "social('google')"] },
      ],
    },
    {
      channel: 'bot_gate',
      plain: 'Customer flows are protected by ONE bot check: Cloudflare Turnstile (free, no Google Enterprise tangle). reCAPTCHA is legacy and being removed.',
      botGate: 'turnstile',
      status: 'live',
      checks: [
        { id: 'botgate.turnstile.sms', says: 'The onboarding SMS gate verifies a Turnstile token.', file: 'server/routes/onboarding-verification.ts', mustContain: ['verifyTurnstileToken'] },
        { id: 'botgate.turnstile.signup', says: 'The premium signup uses invisible Turnstile.', file: 'client/src/pages/SignUpLuxury.tsx', mustContain: ['executeTurnstileInvisible'] },
      ],
    },
  ] as ChannelRule[],

  // ── ROLES: what each user role needs, internally and externally ───────────
  roles: [
    {
      role: 'customer',
      plain: 'A pet owner. Signs up/in with ONE verified identity: mobile code, OR email code, OR a social account. 18+ confirmation + Terms required. No KYC to book.',
      requires: ['one verified channel (mobile OR email OR social)', '18+ confirmation', 'Terms accepted'],
      checks: [
        { id: 'customer.consent', says: 'Signup requires Terms + 18+ before the CTA enables.', file: 'client/src/pages/SignUpLuxury.tsx', mustContain: ['agreedTerms', 'over18', 'consentOk'] },
      ],
    },
    {
      role: 'provider',
      plain: 'A sitter/walker/trainer. Same login as a customer, THEN a KYC application (ID + selfie). Payout stays LOCKED until the application is approved.',
      requires: ['verified login', 'KYC application submitted', 'admin approval before payout'],
      checks: [
        { id: 'provider.onboarding', says: 'Provider onboarding requires identity documents.', file: 'client/src/pages/ProviderOnboarding.tsx', mustContain: ['governmentId', 'selfiePhoto'] },
      ],
    },
    {
      role: 'admin',
      plain: 'PetWash staff. Authorization is SERVER-validated (useWhoami → isSuperAdmin / isAdminRole) — never a hardcoded client email. Admin routes are wrapped in AdminRouteGuard.',
      requires: ['server-validated admin role', 'AdminRouteGuard on every admin route'],
      checks: [
        { id: 'admin.serverValidated', says: 'Admin gate uses the server whoami signal, not a hardcoded email.', file: 'client/src/pages/AdminKYC.tsx', mustContain: ['useWhoami', 'isAdminRole'], mustNotContain: ["ADMIN_EMAIL = 'nirhadad1@gmail.com'"] },
      ],
    },
  ] as RolePolicy[],
};

export type AuthRulebook = typeof AUTH_RULEBOOK;
