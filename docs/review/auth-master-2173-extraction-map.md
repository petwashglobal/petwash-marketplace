# AUTH MASTER PR #2173 — Extraction Map

**Branch:** `auth-master-lane-e-cta-action-registry`
**Base:** `main`
**Prepared:** 2026-08-29 (CEO FLY MODE II §26–§29)
**Purpose:** #2173 became an integration/incubation branch. This map
groups every file it touches into the four extraction PRs the final
review will land as, so each group can be reviewed in isolation once
dependencies settle.

> **NO MERGE OF #2173 AS A WHOLE.** Continue safe development here;
> extract focused PRs from the groups below when dependencies allow.

---

## Group A — CTA / Journey UI (§26)

The provider-service intent chain from marketing overview → resume
gate → onboarding. Ships the CTA registry + canonical URL emitter,
retires legacy `/join/<alias>` deep-links, and threads
`requestedService` end-to-end.

| Path | Kind | Purpose |
|------|------|---------|
| `client/src/lib/ctaActions.ts` | new | CTA action registry + provider-intent URL emitter |
| `client/src/lib/becomeProvider.ts` | edit | provider signup intent seed + resume payload |
| `client/src/lib/attribution.ts` | edit | UTM + referrer capture for CTA |
| `shared/lib/providerServiceVocabulary.ts` | edit | legacy alias → canonical code map |
| `client/src/components/ProviderRegistrationBanner.tsx` | edit | canonical CTA wiring; drops legacy alias emit |
| `client/src/pages/sitter-suite/BrowseSitters.tsx` | edit | `data-action-id` + testid on Sitter CTA |
| `client/src/pages/walk-my-pet/BrowseWalkers.tsx` | edit | ditto for Walker |
| `client/src/pages/PlatformHub.tsx` | edit | provider tiles route through canonical CTA |
| `client/src/pages/BecomeProviderResume.tsx` | new/edit | state-aware resume gate |
| `client/src/pages/becomeProviderResume.helpers.ts` | new | pure helpers extracted for tests |
| `client/src/pages/ProviderOnboarding.tsx` | edit | consumes `requestedService` + provider chip preselect |
| `client/src/pages/ProviderApplicationStatus.tsx` | edit | link back through resume gate |
| `client/src/pages/ProviderPending.tsx` | edit | dead-end CTAs → resume gate |
| `client/src/pages/ChoosePath.tsx` | edit | mode picker routes through canonical CTAs |
| `client/src/pages/legal/MarketplaceTerms.tsx` | edit | provider-terms link uses canonical CTA |
| `client/src/App.tsx` | edit | delete legacy `/join/<alias>` redirects; canonical `/become-provider` |
| `server/tests/ctaActions.regression.test.ts` | new | CTA registry pins |
| `server/tests/providerCtaWiring.regression.test.ts` | new | every marketing CTA carries data-action-id |
| `server/tests/becomeProviderResumeCanonical.regression.test.ts` | new | resume-gate URL preservation |
| `server/tests/noLegacyProviderTypeEmitter.regression.test.ts` | new | scanner refusing `role=walker`-style URLs |
| `tests/e2e/auth-master-lane-e-become-provider-gate.e2e.spec.ts` | new | anonymous → sign-in → gate → onboarding (persona bypass) |
| `tests/e2e/auth-master-lane-e-sitter-full-journey.e2e.spec.ts` | new | sitter/walker/trainer × 3 scenarios (21 real-Chromium) |

---

## Group B — Auth Observability (§27)

Client → server auth-journey correlation. `X-Auth-Journey-Id` header
propagates every fetch to `/api/auth/session` + `/api/auth/post-login`;
`/api/auth/trace-event` accepts client-side stage records for
correlation with server-side auth logs. Post-auth navigation ownership
token stops the F3 "12 competing navigators" race.

| Path | Kind | Purpose |
|------|------|---------|
| `client/src/lib/authJourney.ts` | new/edit | journey id start + stage recorder + `withAuthJourneyHeader()` |
| `client/src/lib/preferredAuthMethod.ts` | new/edit | preferred auth method persistence + attribution |
| `client/src/lib/postAuthNavigationOwner.ts` | new | cooperative navigation ownership token |
| `client/src/lib/postLoginCoordinator.ts` | edit | attaches `X-Auth-Journey-Id`; claims nav owner |
| `client/src/components/GoogleOneTap.tsx` | edit | full stage instrumentation + owner claim |
| `client/src/pages/SignUpLuxury.tsx` | edit | 8 `withAuthJourneyHeader` sites + stage recorder |
| `client/src/pages/admin/AdminLoginV2.tsx` | edit | data-action-id + emitCtaEvent + owner claim |
| `client/src/pages/AccountActivation.tsx` | edit | poll transition claims nav owner |
| `client/src/pages/ChooseMode.tsx` | edit | 3 branch owner claims |
| `client/src/pages/NotificationConsent.tsx` | edit | 3 branch owner claims |
| `client/src/pages/PrivilegeSignup.tsx` | edit | enrolled short-circuit owner claim |
| `server/routes/auth-trace.ts` | new | `POST /api/auth/trace-event` (Zod-validated, drops forbidden PII) |
| `server/routes/post-login.ts` | edit | parse `X-Auth-Journey-Id` header |
| `server/routes.ts` | partial edit | `/api/auth/session` parses same header |
| `server/tests/authJourneyHeaderThreading.regression.test.ts` | new | every SignUpLuxury fetch threaded |
| `server/tests/authJourneyAttribution.regression.test.ts` | new | attribution shape pins |
| `server/tests/authTraceEndpoint.regression.test.ts` | new | Zod + PII drop |
| `server/tests/postAuthNavigationOwner.regression.test.ts` | new | owner + release contract |

---

## Group C — Capability Security (§28)

The tri-state capability resolver that makes MFA fail-CLOSED real,
the shared `hasAdminOrStaffCapability` shim, and the migration of
four gates onto it. Closes the SEV-1 Bearer bypass on 13 admin route
groups.

| Path | Kind | Purpose |
|------|------|---------|
| `server/lib/userCapabilities.ts` | edit | new `resolveSecurityCapabilities` + rewritten shim; fixes `staff.approved`→`staff.active` latent bug |
| `server/middleware/requireMfa.ts` | edit | Bearer bypass closed; SERVICE_PRINCIPAL_UIDS allowlist; capability fallback via shim |
| `server/middleware/session-hardening.ts` | edit | step-up MFA reads capability fallback |
| `server/routes/mfa.ts` | edit | MFA_MANDATORY_ROLES check via shim |
| `server/routes/contractor.ts` | edit | requireAdmin via shim (`onError:false`, deny) |
| `server/routes.ts` | partial edit | `/api/auth/session` refuses `synthetic-id-token::` marker (defense-in-depth) |
| `server/tests/resolveSecurityCapabilities.behavior.test.ts` | new | 15 mocked-DB tri-state pins |
| `server/tests/mfaCapabilityFallback.regression.test.ts` | edit | 19 source-anchored pins for shim + Bearer-bypass deletion |
| `server/tests/syntheticTokenRefusal.regression.test.ts` | new | 5 pins for the server-side marker refusal |

---

## Group D — E2E Test Harness (§29)

The Firebase test adapter scaffold + client-side probe + postbuild
leak gate. Phase F1 only — Phase F2 (SignUpLuxury/GoogleOneTap
consult the probe) is a follow-up PR.

| Path | Kind | Purpose |
|------|------|---------|
| `tests/e2e/firebaseTestAdapter.ts` | new | Playwright installer + persona catalog + route intercepts |
| `client/src/lib/firebaseTestAdapterClient.ts` | new | client-side probe with 6-layer fail-CLOSED guards |
| `tests/e2e/auth-master-lane-f-firebase-step.e2e.spec.ts` | new | 3 scenarios `test.skip()`-guarded until F2 lands |
| `scripts/check-no-test-adapter-leak.mjs` | new | postbuild scanner (6 forbidden markers) |
| `package.json` | edit | wires scanner into `npm run build` |
| `server/tests/firebaseTestAdapter.regression.test.ts` | new | 10 scaffold pins |
| `server/tests/firebaseTestAdapterClient.regression.test.ts` | new | 8 probe-guard pins |
| `server/tests/postbuildLeakGate.regression.test.ts` | new | 6 script + wiring pins |
| `server/tests/firebaseTestAdapterPhaseF2.regression.test.ts` | new | 7 pins for the SignUpLuxury popup-path adapter shortcut (DEV guard + dynamic import + early-return ordering) |

---

## Group E — Legacy Sunset Hygiene (partial, §21 only)

Safe now: the three already-410 phone OTP handlers had 100+ lines of
unreachable code below the short-circuit; behaviour unchanged.

| Path | Kind | Purpose |
|------|------|---------|
| `server/routes/publicAuthRoutes.ts` | edit | delete 341 lines of unreachable code + now-orphan imports/helpers below the 3 `/otp/{send,resend,verify}` 410 stubs |

Everything else on the F5 sunset candidate list (2FA `/api/auth/2fa/*`,
TikTok duplicate OAuth, debug probes, `customAuth.ts` handler block)
is deferred pending §22–§25 telemetry + external-caller confirmation.

---

## Dependency notes

- **Group C depends on the `hasAdminOrStaffCapability` helper.** Land it before or
  together with Group A/B extractions that mount admin routes.
- **Group D is independent of A/B/C** — pure test infrastructure, safe to land
  first if the scaffold value alone is worth extracting.
- **Group A's canonical URL emitter (`urlForProviderIntent`) is consumed by
  Group B** (attribution + preferred method). Extract A before or together with B.
- **Group E is behaviour-neutral** and can extract as a one-off hygiene PR any time.

## Non-extractable / not in any group

Nothing in this branch is intended to ship as a #2173 whole-PR merge.
When the extractions land as focused PRs, this branch is retired as an
incubation branch.
