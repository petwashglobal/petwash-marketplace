# PetWash Trust Platform — Formal Blueprint

> **STATUS: DESIGN ONLY.** Do not implement until this phase is formally green-lit.
>
> **Current priority (build order):**
> 1. Finish Sprint 2b client wiring.
> 2. Stabilize the front-door rebuild.
> 3. Protect guest-checkout revenue.
> 4. Build the Trust Platform later as a dedicated phase.
>
> **Scope:** captured as design documentation. Code waits until the phase is approved.

---

## Purpose

The PetWash Trust Platform is **not simply MFA.** It is the long-term foundation for: account protection, provider protection, payout protection, booking protection, fraud prevention, recovery protection, support visibility, auditability, council / franchise / investor confidence, and future enterprise readiness.

Treat it as a **trust platform**, not a login feature.

## Core principle

Security must be: smart, fast, smooth, low-friction, elderly-friendly, Hebrew/RTL-ready, English-ready, privacy-first, role-aware, risk-based, auditable, and reversible where possible.

**The goal is not to challenge every user — only to challenge when the risk or action requires it.**

## Existing PetWash primitives to reuse (do not reinvent — extend cleanly)

`auditLedger` · `merkleSnapshots` · `userDevices` · `userDeviceEvents` · `WEBAUTHN_RP_ID` · `WEBAUTHN_COOKIE_SECRET` · `loginSecurityEventTypeEnum` · `BiometricSecurityMonitor` · `mfaRequired` · `mfaVerified` · `notificationDispatcher` · Twilio SMS infrastructure.

---

## Phases

### Phase 1 — Identity Foundations
Reliable identity ownership + basic security-event capture.
- Email verification on signup
- SMS OTP stabilization
- Session hardening
- `schemaVersion: "v1"` on all security events
- Normalized security event stream
- `auditLedger` + `merkleSnapshot` integration
- `notificationDispatcher` **subscription** model (no direct calls from random services)

### Phase 2 — Trust Infrastructure
Known devices, trusted sessions, runtime rule control.
- Device registry (`userDevices`, `userDeviceEvents`)
- Known-device recognition + **trusted-device expiry**
- New-device login alerts
- **Session trust levels:** `unauthenticated` · `low` · `standard` · `elevated` · `restricted`
- Runtime rule modes: `observe` / `alert` / `soft` / `hard`

> The system asks **"Does this session have enough trust for this action?"** — not merely "Is the user logged in?"

### Phase 3 — Modern Authentication (passkeys-primary)
Authentication hierarchy:
1. **Passkeys / WebAuthn — preferred**
2. TOTP authenticator app — strong backup
3. SMS OTP — fallback / recovery / lower-trust
4. Email OTP — bootstrap / recovery only

Includes: passkey registration + login, TOTP opt-in, backup methods, device-management UI, recovery flow, multi-device passkey enrollment, and the **post-SMS-login passkey prompt**: *"Secure your account with Face ID in 5 seconds."* (Promote passkeys immediately after SMS login — fastest adoption path.)

### Phase 4 — Sensitive Action Protection
Sensitive mutations: payout bank change · email/phone/password change · disabling MFA · removing passkey · adding payout method · changing provider business identity · changing legal/provider documents · account closure · provider booking-status change.

Every sensitive mutation uses: elevated trust → event written to audit stream → notification → cooldown window → reversible where possible → one-tap **"this wasn't me"** → support/admin review if required.

> **The alert is not the protection. The reversible window is the protection.**

### Phase 5 — Role-Based Trust Policies
- **Consumers:** low friction; passkeys encouraged; strong protection on sensitive changes; SMS/email fallback for lower-risk use.
- **Providers:** higher baseline (money, pets, documents, liability, payouts).

Before `payout_enabled = true`: email verified · phone verified · passkey or TOTP enabled · trusted device established · recent elevated trust.
Before `booking_enabled = true`: profile complete · required documents approved · minimum account trust · provider security baseline complete.

Future policies: consumer · provider · admin · support · franchise partner · municipal partner.

### Phase 6 — Adaptive Risk
Signals: new device · failed-login velocity · impossible travel · unusual location · suspicious IP · session age · sensitive action · provider payout change · **recent SIM swap** · automation indicators · privilege-escalation attempts.

Risk → response: `low` = frictionless · `medium` = soft challenge · `high` = elevated trust or block.

**Geo-IP is a supporting signal only — never block solely on geo** (noisy: VPNs, mobile carriers, roaming, inaccurate IP data, shared networks). Privacy-first: store country (city/region only if needed); no precise GPS; no creepy fingerprinting; no unnecessary location data.

### Phase 7 — Trust Experience
Security center · account-health score · user-facing audit history · trusted-device management · notification preferences · fatigue controls · Hebrew/RTL + English security UX · elderly-friendly explanations.

Account-health items: email verified · phone verified · passkey enabled · backup method added · trusted devices reviewed · recent activity checked · provider payout protection active.
Provider-facing example: *"Your account needs stronger protection before payouts can be enabled."*

---

## The 10 non-negotiable design rules

1. **No ad-hoc security alerts** — all alerts come from the event stream.
2. **All security events are schema-versioned** — every event starts with `schemaVersion: "v1"`.
3. **Append-only and tamper-evident** — reuse `auditLedger` + `merkleSnapshots` (hash-chained).
4. **Weaker factors cannot remove stronger factors** — SMS can't remove a passkey / reset TOTP / disable MFA; a newly-changed phone or email is not immediately trusted for recovery.
5. **Sensitive mutations require elevated trust** — payout, email, phone, password, MFA, passkey removal, provider status.
6. **Sensitive mutations should be reversible where possible** — cooldown/cancel windows, one-tap "this wasn't me", support/admin review.
7. **Enforcement must be runtime configurable** — each rule supports `observe` / `alert` / `soft` / `hard` (no emergency deploys for false positives).
8. **Passkey ≠ trusted device** — separate credential / device / session / role / action trust. A synced passkey proves strong auth, but the physical device may still be new.
9. **Providers need higher trust than consumers** — money, pets, documents, liability, bookings, payouts.
10. **Hebrew/RTL and elderly-friendly UX are core** — security users cannot understand is not secure.

---

## Research-backed smart / fast / smooth upgrades (2026)

1. **Auto-prompt passkey enrollment after SMS login** — the main adoption lever (~2× adoption in industry data). *"Secure your account with Face ID in 5 seconds."*
2. **SIM-swap detection via Twilio** (Lookup / line intelligence) — if SIM recently swapped: distrust SMS for sensitive actions, raise risk score, require passkey/TOTP/elevated trust.
3. **Tiered reversible windows** — highest-risk changes (payout, account closure, primary-MFA change, passkey removal, provider legal identity) get longer cancel windows (e.g. 24h); lower-risk get shorter cooldown / alert-only / soft challenge.
4. **Continuous trust re-check** — re-evaluate on entering sensitive areas (payout settings, provider dashboard, document upload, account/security settings, booking enablement), not only at login.
5. **Encourage multi-device passkey setup** — recovery is easier when users have more than one strong device.

---

## Event stream design

Every security event is append-only · schema-versioned · tamper-evident · queryable · consumed by downstream systems.

**Event names (taxonomy):**
`auth.login.success` · `auth.login.failed` · `auth.device.new` · `auth.passkey.added` · `auth.passkey.removed` · `auth.totp.enabled` · `auth.totp.disabled` · `account.email.changed` · `account.phone.changed` · `account.password.changed` · `provider.payout.updated` · `provider.booking_enabled.changed` · `trust.stepup.required` · `trust.stepup.completed` · `trust.rule.triggered` · `trust.rule.blocked` · `recovery.started` · `recovery.completed` · `recovery.denied`

**Consumers:** `notificationDispatcher` · fraud detection · support tools · analytics · account health · admin dashboard · future ML/risk · compliance/audit reporting.

> **Rule:** services *write* events; consumers *react* to events. Services do not directly send security alerts.

---

## Recovery protection rules

Assume recovery is the most dangerous area.
- Weaker factor cannot remove a stronger factor.
- Newly-changed recovery details are temporarily low-trust.
- Sensitive changes require cooldown; high-risk changes should be reversible.
- Support override must be audited.
- Provider payout changes require stronger trust.
- SMS distrusted if SIM-swap risk detected.

SMS OTP alone **cannot**: remove passkey · disable TOTP · change payout bank · close account · change provider legal identity.
Email OTP alone **cannot**: disable stronger MFA · approve payout change · remove trusted devices · reset provider payout protection.

## Synced passkey model

A synced passkey is a strong credential — **not** the same as a trusted device. Example: login with a synced passkey on a new iPhone → authentication strength `high`, device trust `new`, session trust `medium`, sensitive action → step-up or cooldown required.

## Notification fatigue rules

- **Critical (cannot be disabled):** new-device login · password changed · passkey removed · payout changed · MFA disabled.
- **Important (configurable, recommended on):** failed-login spike · new location · recovery started · provider document changed.
- **Informational (optional):** weekly security summary · account-health reminders · device-review reminders.

Do not notify on every routine click — only meaningful trust/security changes.

---

## Go-to-market value

The Trust Platform is a business asset. Positioning: *"PetWash has demonstrable, auditable trust and payout-protection infrastructure built into the platform."* Relevant to councils, property groups, franchises, investors, providers, and enterprise partners.

**PetWash is not just a booking app — it is trusted marketplace infrastructure for pet-care services.**

## Implementation discipline

Do not build during the current rebuild. Correct order:
1. Sprint 2b client wiring → 2. guest-checkout revenue → 3. front-door stability → 4. Trust Platform green-light → 5. phased implementation.

**This document is captured now. Code waits until the phase is approved.**

---

## Final framing

Not *"Add MFA."* The correct framing is *"Build the PetWash Trust Platform"* — the system that turns security into product trust, operational safety, and go-to-market advantage. Build it carefully, as a dedicated phase, reusing existing primitives wherever possible.
