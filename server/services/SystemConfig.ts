/**
 * SYSTEM CONFIG SERVICE
 * PETWASH SYSTEM INTELLIGENCE SPEC — Admin Control System
 *
 * Singleton in-memory config store for runtime toggles.
 * Admins can adjust these via the admin panel without a code deploy.
 *
 * On server restart values reset to defaults — this is intentional.
 * These toggles govern live operational behaviour (e.g. whether CAPTCHA
 * is strictly enforced) and should default to safe values.
 */

import { logger } from '../lib/logger';

export interface SystemConfigMap {
  'captcha.strict_mode': boolean;
  'sms.required_for_registration': boolean;
  'step_up.enabled': boolean;
  'step_up.threshold_seconds': number;
  'matching.default_radius_km': number;
  'matching.boost_new_providers': boolean;
  // Supplier-invoice screening (First Safe PR). OFF = the new routes are
  // closed, no screening runs, legacy accounting flows untouched. Money is
  // never moved by this feature; payment execution stays separate.
  'ff.supplier_invoice_control.enabled': boolean;
  // PR-S4: separately-gated SUMIT (sumit.co.il) send. When this flag is OFF
  // the new POST /api/supplier-invoices/:id/send-to-sumit route returns 404
  // even if the parent supplier-invoice flag is ON. Defense in depth — must
  // flip BOTH flags to actually send a document. Default OFF.
  'ff.supplier_invoice_control.sumit_send.enabled': boolean;
  // Maya reception/intake (Stage 1b)
  'ff.maya.enabled': boolean;
  'ff.maya.provider_intake.enabled': boolean;
  'ff.maya.booking_intake.enabled': boolean;
  'ff.maya.tasks.enabled': boolean;
  'ff.maya.escalations.enabled': boolean;
  // Maya Voice (Stage 3A) — provider-signature webhook; admin GETs stay under /api/admin
  'ff.maya.voice.enabled': boolean;
  'ff.maya.voice.inbound.enabled': boolean;
  'ff.maya.voice.outbound.enabled': boolean;
  'ff.maya.voice.extraction.enabled': boolean;
  // Maya WhatsApp lead-bot — inbound webhook, honest answers + lead capture.
  'ff.maya.whatsapp.enabled': boolean;
  'ff.maya.voice.recording.enabled': boolean;
  // AI booking intake (AI-B1) — Gemini parses natural-language booking
  // requests ("walk my dog tomorrow morning in Tel Aviv") into structured
  // BookingRequest prefills. AI never confirms / assigns / quotes / charges.
  // Default OFF; backend returns 503 feature_disabled when off.
  'ff.ai.booking_intake.enabled': boolean;
  // AI provider matching score (AI-B2) — Gemini ranks a set of candidate
  // provider IDs against the parsed booking intake using PUBLIC profile
  // fields only (bio, rating, response rate, services, languages, badges,
  // working hours, home setup). Never sees background check, KYC, risk
  // score, admin notes, or any other internal trust field. Falls back to
  // a deterministic rating-based score when Gemini is unavailable.
  'ff.ai.provider_matching.enabled': boolean;
  // AI smart slot suggestions (AI-B3) — turns a vague date/time intent
  // ("tomorrow morning") into concrete, backend-validated slot windows
  // from availability_slots. Honors active payment locks, service
  // duration, timezone, and provider filtering. NEVER returns synthetic
  // slots — every suggestion is a real available_slots row.
  // Deterministic (no Gemini call) — safety + correctness > AI flair here.
  'ff.ai.slot_suggestions.enabled': boolean;
  // AI care-tag extraction (AI-B4) — Gemini maps customer free-text
  // about their pet ("anxious around men", "senior dog needs gentle
  // handling") into a CLOSED allowlist of provider-friendly care tags.
  // Never diagnoses. Never claims medical authority. Out-of-vocab tags
  // from the model are silently dropped by Zod.
  'ff.ai.care_notes.enabled': boolean;
  // AI wallet anomaly monitor (AI-W1) — admin-only. Reads recent
  // wallet_ledger_entries, aggregates per user (PII-stripped), asks
  // Gemini to score 0..100 risk + flag the worst. NEVER refunds /
  // credits / changes account status — flags-only for human admin
  // review. Falls back to deterministic threshold scoring when Gemini
  // is unavailable. Zero new infrastructure cost.
  'ff.ai.wallet_anomaly_monitor.enabled': boolean;
  /**
   * SUMIT activation mode. Mission-4 strategy-pattern dispatcher chooses
   * the integration method:
   *   'off'        — every send returns sent:false reason:"mode is off" (default)
   *   'email'      — forward to ACCOUNTANT_EMAIL with the original file attached
   *   'api'        — direct sumit.co.il REST call via SumitClient (needs API spec)
   *   'csv_export' — write a CSV row + PDF copy to firebase storage for manual upload
   * Independent of the two ff. flags above; activation requires BOTH the flags
   * AND mode != 'off'. Default 'off' means production behaviour is unchanged.
   */
  'sumit.mode': 'off' | 'email' | 'api' | 'csv_export';
  'recovery.signup_reminder_enabled': boolean;
  'recovery.booking_followup_enabled': boolean;
  /**
   * Auth-rebuild Phase 1 (CEO directive 2026-09-01) — canonical identity
   * resolver. When ON, every session-mint feeder calls
   * `server/identity/loginOrLink.ts` after Firebase verify to record the
   * identity_accounts link and emit IDENTITY_SHADOW_WOULD_MERGE if a
   * verified email collides with another users row.
   *
   * Default OFF: existing feeders keep their current byte-for-byte
   * behaviour until every one is wired AND the dedup dry-run has been
   * reviewed by support. Folds in the legacy IDENTITY_UNIFIED_ENABLED
   * env gate — either enables the wiring.
   *
   * Turning this ON is safe: identity_accounts writes are additive and
   * observation-only in Phase 1. No automatic linking, no merging.
   */
  'ff.returning_user.identity_unified.enabled': boolean;
  /**
   * Auth-rebuild Phase 3.b (CEO directive 2026-09-01, D3) — Pet Wash-
   * owned session model observation.
   *
   * When ON, `POST /api/auth/session` (and other session-cookie mint
   * sites) additionally calls `SessionService.mintSession()` to record
   * a `sessions_pw` row. The Firebase `__session` cookie remains the
   * authoritative session; the opaque Pet Wash session id is minted
   * and hashed at rest but is NOT emitted to the client in Phase 3.b.
   *
   * Purpose: prove the mint mechanism, index shape, and cache-invalidation
   * plumbing all behave correctly against real production login traffic
   * before Phase 3.c makes the Pet Wash session cookie authoritative.
   *
   * Default OFF. Zero behaviour change. Turning ON is safe: SessionService
   * is transaction-safe and never blocks the login response on write
   * failure (all callers wrap it in try/catch).
   */
  'ff.returning_user.sessions_owned.enabled': boolean;
  /**
   * Auth-rebuild Phase 3.c.1 — EMIT the Pet Wash session cookie.
   *
   * When ON (in addition to `ff.returning_user.sessions_owned.enabled`),
   * successful login responses set an HttpOnly `pw_session_id` cookie
   * carrying the RAW opaque session id from SessionService.mintSession().
   * The cookie is SameSite=Lax, Secure in prod, path=/, and max-age
   * matches the sessions_pw expiry.
   *
   * NOTHING READS THE COOKIE YET. Phase 3.c.2 adds a shadow-verify
   * middleware that compares the cookie-derived UID with the Firebase-
   * decoded UID and logs disagreements. Phase 3.c.3 flips authority.
   *
   * Default OFF. Turning ON is safe: the cookie is emitted but no code
   * path reads it, so login continues to run on the Firebase session
   * cookie as before.
   */
  'ff.returning_user.sessions_owned.emit_cookie': boolean;
  /**
   * Auth-rebuild Phase 3.c.2 — SHADOW-VERIFY the Pet Wash session cookie.
   *
   * When ON, every request that carries both `__session` (Firebase) and
   * `pw_session_id` (Pet Wash) resolves each independently and compares.
   * On disagreement:
   *   - Log a redacted `SECURITY_SESSION_MISMATCH` event
   *   - Continue serving on the LESS-PRIVILEGED result (do NOT choose
   *     the more privileged one on disagreement — fail closed on
   *     authority even during shadow observation)
   * When authority has not yet flipped (Phase 3.c.3), the request still
   * proceeds via the Firebase path — this observation only surfaces the
   * disagreement, it doesn't change auth decisions.
   *
   * Default OFF. Requires `sessions_owned.enabled` + `emit_cookie` to
   * be ON to produce useful observations.
   */
  'ff.returning_user.sessions_owned.shadow_verify': boolean;
  /**
   * Auth-rebuild Phase 3.c.3 — AUTHORITY cutover.
   *
   * When ON (in addition to `shadow_verify`), a Firebase↔PW UID
   * disagreement on ANY request causes the middleware to REFUSE the
   * request rather than continue on the more-privileged side. Client
   * sees 401 { error: 'SESSION_AUTHORITY_SKEW' }; server logs a
   * redacted SECURITY_SESSION_AUTHORITY_DROP event.
   *
   * Fail-CLOSED by design (CEO §2): the less-privileged path in a
   * disagreement is "refuse and force re-auth" — never "silently
   * choose the more privileged result".
   *
   * Enabling this flag ONLY takes effect while
   * `sessions_owned.enabled` + `.emit_cookie` + `.shadow_verify` are
   * all ON — otherwise the cookies for comparison don't exist and
   * the middleware short-circuits to next(). Default OFF; do not flip
   * ON in production until shadow_verify has observed zero disagreements
   * for a meaningful window.
   */
  'ff.returning_user.sessions_owned.authority': boolean;
  /**
   * Auth-rebuild Phase 11 (CEO D7 — /signin door flip).
   *
   * When ON, /signin renders the returning-user door (ReturnLogin,
   * client/src/auth/ReturnLogin.tsx) when the browser reports a
   * platform authenticator AND a `petwash_passkey_email` hint is
   * present in localStorage. When any of those conditions fail, the
   * door silently falls back to the legacy SignUpLuxury signin
   * surface — no visible flicker, no dead-end.
   *
   * When OFF, /signin renders the legacy SignUpLuxury signin surface
   * regardless. That is the default until CEO flips this flag as part
   * of the cohort rollout (internal → staff → percentage → default).
   *
   * The client independently honours two per-viewer overrides that
   * DO NOT need this flag set:
   *   - URL param `?door=new`   — one-off preview / test cohort
   *   - localStorage `pw_ff_new_door=1` — internal-user opt-in
   * These are staff-facing preview knobs. Turning the server flag ON
   * enables the door for all traffic that qualifies.
   */
  'ff.returning_user.new_door.enabled': boolean;
  /**
   * Percentage cohort (0..100) of returning-user traffic that gets the
   * new door when `ff.returning_user.new_door.enabled` is ON. Used to
   * stage: 0 → 1 → 10 → 50 → 100. Deterministic per-visitor via a
   * stable hash of the passkey-email hint so a user does not flip
   * between doors between visits. Ignored when the master flag is OFF.
   */
  'ff.returning_user.new_door.percent': number;
}

const DEFAULTS: SystemConfigMap = {
  'captcha.strict_mode': false,
  'sms.required_for_registration': false,
  'step_up.enabled': false,
  'step_up.threshold_seconds': 7200,
  'matching.default_radius_km': 15,
  'matching.boost_new_providers': true,
  'ff.supplier_invoice_control.enabled': false,
  'ff.supplier_invoice_control.sumit_send.enabled': false,
  // Maya reception/intake (Stage 1b) — ENABLED 2026-06-14 (CEO directive: "we need
  // all, shift to our control"). Maya is DRAFT-ONLY (creates provider/booking drafts,
  // tasks, escalations — never writes wallet/payment/confirm) and every route sits
  // behind the full admin security stack, so turning it on is safe. Operator can
  // still disable any of these at runtime in /admin/system-config.
  'ff.maya.enabled': true,
  'ff.maya.provider_intake.enabled': true,
  'ff.maya.booking_intake.enabled': true,
  'ff.maya.tasks.enabled': true,
  'ff.maya.escalations.enabled': true,
  // Maya Voice (Stage 3A) — inbound activated per CEO request 2026-05-25
  // (+16292059682 was hitting the 503 "busy" gate on every call).
  //
  // Activated ON by default:
  //   ff.maya.voice.enabled          — master switch for the voice subsystem
  //   ff.maya.voice.inbound.enabled  — accept Twilio /voice + /gather webhooks
  //
  // Left OFF by default (privacy / cost / not-yet-needed):
  //   ff.maya.voice.outbound.enabled    — Maya-initiated callbacks
  //   ff.maya.voice.extraction.enabled  — intent extraction → booking/task creation
  //   ff.maya.voice.recording.enabled   — call audio recording (PII; flip only after DPA review)
  //
  // Operator can still disable in /admin/system-config at runtime — the in-memory
  // store accepts patches and they take effect immediately for the current instance.
  'ff.maya.voice.enabled': true,
  'ff.maya.voice.inbound.enabled': true,
  'ff.maya.voice.outbound.enabled': false,
  'ff.maya.voice.extraction.enabled': false,
  // CEO directive: Maya WhatsApp lead-bot ON by default. (Real activation still
  // requires connecting the number as a Twilio WhatsApp sender — no inbound
  // traffic arrives until that Meta/Twilio step is done.)
  'ff.maya.whatsapp.enabled': true,
  'ff.maya.voice.recording.enabled': false,
  // AI-B1 default OFF
  'ff.ai.booking_intake.enabled': false,
  // AI-B2 default OFF
  'ff.ai.provider_matching.enabled': false,
  // AI-B3 default OFF
  'ff.ai.slot_suggestions.enabled': false,
  // AI-B4 default OFF
  'ff.ai.care_notes.enabled': false,
  // AI-W1 default OFF
  'ff.ai.wallet_anomaly_monitor.enabled': false,
  'sumit.mode': 'off',
  'recovery.signup_reminder_enabled': true,
  'recovery.booking_followup_enabled': true,
  // Auth-rebuild Phase 1 — canonical identity resolver. Default OFF.
  // See interface docstring above.
  'ff.returning_user.identity_unified.enabled': false,
  // Auth-rebuild Phase 3.b — Pet Wash-owned session observation. OFF.
  // See interface docstring above.
  'ff.returning_user.sessions_owned.enabled': false,
  // Auth-rebuild Phase 3.c.1 — emit HttpOnly pw_session_id cookie. OFF.
  'ff.returning_user.sessions_owned.emit_cookie': false,
  // Auth-rebuild Phase 3.c.2 — shadow-verify pw_session_id against Firebase. OFF.
  'ff.returning_user.sessions_owned.shadow_verify': false,
  // Auth-rebuild Phase 3.c.3 — authority cutover; fail-CLOSED on disagreement. OFF.
  'ff.returning_user.sessions_owned.authority': false,
  // Auth-rebuild Phase 11 — /signin door flip. Default OFF.
  // Client-side ?door=new and localStorage pw_ff_new_door=1 still work
  // as per-viewer previews even while the flag is OFF; see interface
  // docstring above for the full rollout ladder.
  'ff.returning_user.new_door.enabled': false,
  'ff.returning_user.new_door.percent': 0,
};

export type ConfigKey = keyof SystemConfigMap;

class SystemConfigService {
  private store: SystemConfigMap = { ...DEFAULTS };
  private lastUpdated = new Date();
  private auditLog: Array<{ key: string; from: unknown; to: unknown; by: string; at: Date }> = [];

  get<K extends ConfigKey>(key: K): SystemConfigMap[K] {
    return this.store[key];
  }

  set<K extends ConfigKey>(key: K, value: SystemConfigMap[K], updatedBy: string): void {
    const prev = this.store[key];
    this.store[key] = value;
    this.lastUpdated = new Date();
    this.auditLog.push({ key, from: prev, to: value, by: updatedBy, at: new Date() });

    logger.info('[SystemConfig] Config updated', {
      key,
      from: prev,
      to: value,
      by: updatedBy,
    });
  }

  patch(changes: Partial<SystemConfigMap>, updatedBy: string): void {
    for (const [rawKey, value] of Object.entries(changes)) {
      const key = rawKey as ConfigKey;
      if (key in this.store) {
        this.set(key, value as any, updatedBy);
      } else {
        logger.warn('[SystemConfig] Unknown config key ignored', { key });
      }
    }
  }

  all(): SystemConfigMap {
    return { ...this.store };
  }

  meta() {
    return {
      lastUpdated: this.lastUpdated,
      auditLog: this.auditLog.slice(-20),
      defaults: DEFAULTS,
    };
  }

  reset(updatedBy: string): void {
    logger.warn('[SystemConfig] Full reset to defaults', { by: updatedBy });
    for (const key of Object.keys(DEFAULTS) as ConfigKey[]) {
      this.set(key, DEFAULTS[key], updatedBy);
    }
  }
}

export const systemConfig = new SystemConfigService();

/**
 * Thin async wrapper around `systemConfig.get(key)`.
 *
 * Maya admin routes (server/routes/admin-maya.ts) imported a named
 * `getFeatureFlag` export that did not exist — the import threw
 * `SyntaxError` at module load and the routes.ts smoke test caught it
 * (CI run #965 gate failure). Adding the wrapper as a named export
 * restores module-load without touching any Maya code.
 *
 * Async signature matches the call sites which `await` the result, and
 * leaves room for a future DB-backed flag store without changing
 * callers. Today this is a synchronous lookup against the in-memory
 * `systemConfig` instance.
 */
export async function getFeatureFlag<K extends ConfigKey>(key: K): Promise<SystemConfigMap[K]> {
  return systemConfig.get(key);
}
