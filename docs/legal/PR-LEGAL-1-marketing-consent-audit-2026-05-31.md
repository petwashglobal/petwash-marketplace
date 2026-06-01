# PR-LEGAL-1 — Marketing-Consent Send-Boundary Audit

| | |
|---|---|
| **Date** | 2026-05-31 |
| **Author** | GC / legal-engineering |
| **Law** | §30א חוק התקשורת (Spam Law, Amendment 40) — ₪1,000/message statutory damages, no proof of harm required, courts start at the maximum |
| **Method** | Read-only static audit of outbound messaging paths. No code changed. |
| **Verdict** | **Partial coverage. A correct consent gate exists but marketing senders bypass it.** |

---

## 1. What the law requires

Under §30א, Pet Wash may not send a **commercial/marketing** message by email, SMS, WhatsApp, fax, or auto-dialer without the recipient's **prior opt-in consent**, and every message must carry a working opt-out. Statutory damages are **₪1,000 per message** with no proof of harm — and the Supreme Court instructs courts to *start* at that maximum. Transactional/service messages (booking confirmation, security codes) are treated differently from marketing; the audit therefore cares most about the **marketing** senders.

## 2. What exists (the good news)

The platform has the **right chokepoint** already built:

- **`NotificationConsentManager.checkUserConsent()`** (`server/services/NotificationConsentManager.ts:208`) — a real per-user, per-category consent gate.
- **`UnifiedMessagingHub.shouldSend()`** (`server/services/UnifiedMessagingHub.ts:46,235`) — routes messages through the consent check before dispatch.
- **`guarded-sendgrid.ts`** — a canonical email entry point (spend circuit-breaker).
- User schema already defaults `marketingConsent`, per-channel `communicationPreferences`, `suppressionList`, `unsubscribedAt` to **opt-out by default** — the correct legal posture.

If everything routed through `UnifiedMessagingHub`, this risk would be largely closed.

## 3. The gap (the exposure)

Not everything routes through the gate. Verified bypasses:

| # | Finding | File | Why it matters |
|---|---|---|---|
| **1** | **`winbackChannel.ts` — a re-engagement MARKETING sender (SMS + WhatsApp, "Hebrew copy per variant") — has NO consent / opt-out check.** It enforces *cost caps*, not consent. | `server/services/winbackChannel.ts` | This is the clearest §30א exposure: marketing messages sent without verifying opt-in |
| **2** | **`TwilioSMSService` performs no consent/opt-out check itself.** Safe only if every caller checks first — and callers are many (`backgroundJobs`, `routes`, `walk-my-pet`, `sitter-suite`, …). | `server/services/TwilioSMSService.ts` + ~10 callers | SMS can be sent without a consent gate depending on the call site |
| **3** | **37 direct `sgMail.send(...)` call sites** bypass `guarded-sendgrid.ts`. The guard is in any case a **spend** circuit-breaker, **not** a consent gate. | 37 sites across `server/**` | No programmatic opt-in enforcement at the email send boundary |
| **4** | The consent gate is referenced in only ~4 files; most send sites do not consult `checkUserConsent()`. | repo-wide | Coverage is the exception, not the rule |

**Plain English:** the company *can*, today, send a marketing SMS/WhatsApp/email to someone who never opted in (or who opted out), because the marketing senders don't consult the consent gate that already exists. Under §30א that is ₪1,000 per recipient.

## 4. Recommended fix (PR-LEGAL-1 implementation — needs CEO go-ahead)

Smallest-risk, highest-coverage sequence. None of this changes wallet/finance, K9000/Nayax, or schema.

1. **Gate the marketing senders first.** Route `winbackChannel` (and any campaign/re-engagement sender) through `NotificationConsentManager.checkUserConsent()` before every SMS/WhatsApp send. A send with no opt-in record → skip + log. *(This single change removes the sharpest exposure.)*
2. **Make `TwilioSMSService` consent-aware** for `category: 'marketing'` sends — refuse marketing sends without an opt-in; allow transactional (codes, booking) through.
3. **Add a one-click opt-out** (unsubscribe link / STOP keyword) to every marketing template and honour it in `suppressionList` at send time.
4. **CI guard (last):** fail the build if a new `winback`/campaign send path skips the consent gate, mirroring the planned `sgMail.send` detector.

## 5. What needs counsel vs not

- **No external lawyer needed** to wire the consent gate (items 1–4) — that's engineering against an existing, correct gate.
- **[עו"ד light]** the classification line — *which* message types are "marketing" vs "transactional" under §30א (e.g. is a "your wash is ready" upsell marketing?) — should be confirmed by counsel so the gate's category map is legally correct.

## 6. Evidence
- Consent gate: `server/services/NotificationConsentManager.ts:208` (`checkUserConsent`)
- Hub gate: `server/services/UnifiedMessagingHub.ts:46,235` (`shouldSend`)
- Marketing bypass: `server/services/winbackChannel.ts` (no consent reference)
- SMS service: `server/services/TwilioSMSService.ts` (no consent reference)
- Email bypass count: 37 direct `sgMail.send(` sites outside `guarded-sendgrid.ts`
