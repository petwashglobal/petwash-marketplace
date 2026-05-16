# Provider Onboarding + OAuth Identity — Rebuild Audit & PR Plan

**Status:** Audit + phased plan. **No code change in this PR.**
**Trigger:** CEO escalation 2026-05-16. "Current onboarding is not launchable."
**Companion audits:**
- `docs/GOOGLE_PLACES_AUTOCOMPLETE_AUDIT.md` — address autocomplete iOS Safari bugs (read-only audit).
- `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` — customer signup determinism (Path A).
- `docs/PATH_E_PROVIDER_REBUILD_AUDIT.md` — provider as legal/contractor/payout/compliance infrastructure (counsel-gated).
**Doctrine:** `.claude/skills/petwash-platform/SKILL.md` §0.

---

## §0 TL;DR

Provider onboarding is broken on iPhone Safari at four layers:

1. **Routing duplication** — 7 entry points, 3 different phone components, 0 validation source of truth.
2. **iOS layout regressions** — non-immersive routes leak bottom nav + chat widgets; phone field group missing `dir="ltr"` lock; address autocomplete dies under iOS keyboard.
3. **Brand violations** — 15+ emojis inside professional onboarding; Hebrew strings missing BiDi marks; OAuth consent screen says "Pet Wash™ Ltd" instead of "PetWash™"; OAuth logo never uploaded.
4. **Identity exposure** — `support@petwash.co.il` surfaces as the public product mailbox in 6+ customer-visible places (Apple Wallet, JSON-LD, NoScript, booking emails, README, legacy SECURITY.md).

**Fix path: 4 phases.** Phase A (emergency unblock, 1–2 days) → Phase B (rebuild on one canonical surface, 5–10 days) → Phase C (OAuth brand cleanup, mostly Google Cloud Console + small repo PR) → Phase D (iPhone Safari QA + automated guard).

**Hard rules preserved (per CEO):** No payment / wallet / Nayax / Tranzila / production-secret touches. No new fake claims. No emojis. No internal support identity exposed as public brand. Counsel-gated Path E work stays separate.

---

## §1 Root-cause map

### §1.1 Routing duplication — there are SEVEN provider onboarding entry points

| # | Route | Component | Lines | Immersive? | Status |
|---|---|---|---|---|---|
| 1 | `/become-provider` | `BecomeProviderRedirect` | App.tsx:2241 | ✓ | Redirector — keep |
| 2 | `/provider-onboarding` | `ProviderOnboarding` | 1517 | ✓ | **Canonical** — keep, repair |
| 3 | `/apply-provider` | `ProviderApplicationForm` | 1897 | ✗ | **Delete** — duplicate |
| 4 | `/join-team` | `ProviderApplicationForm` | (same) | ✗ | **Delete** — duplicate of #3 |
| 5 | `/join/walker` | `JoinAsWalker` | 467 | ✓ | Consolidate into #2 |
| 6 | `/join/sitter` | `JoinAsSitter` | 483 | ✓ | Consolidate into #2 |
| 7 | `/join/trainer` | `JoinAsTrainer` | ~similar | ✓ | Consolidate into #2 |

**Server endpoints** (`server/routes/provider-onboarding.ts`):
- `POST /apply` line 407 (canonical) — validates + writes application
- `GET /application/status` line 1292
- Admin invite-code routes lines 301, 343
- No Zod schema; raw `req.body` parsing (lines 464, 475, 482, 526)

### §1.2 Phone verification — FOUR implementations

| File | Component | Phone picker | OTP path |
|---|---|---|---|
| `client/src/pages/ProviderOnboarding.tsx:122–304` | Custom inline | Hardcoded 9-country dropdown w/ **emoji flags** | `POST /api/provider/phone/send-otp` + `verify-otp` |
| `client/src/components/PhoneInput.tsx:1–161` | Library wrapper (`react-phone-number-input`) | Library | None — validation only |
| `client/src/pages/OnboardingVerification.tsx:130–666` | Modal w/ second-factor | `<PhoneInput />` | `POST /api/onboarding-verification/send-sms-code` |
| `client/src/pages/JoinAsWalker.tsx:244–250` | Embedded in multi-step | `<PhoneInput />` | None |

**`/provider-onboarding` uses the custom inline picker** — every other provider flow uses the library. The custom picker is the source of: hardcoded countries, emoji flags, missing `dir="ltr"` lock, no shared validation.

### §1.3 Country-selector / phone-input order in RTL

`ProviderOnboarding.tsx:826`:
```
<div className="flex gap-2">                  ← NO dir="ltr"
  <Select value={phoneCountryCode}>            ← country (logical first)
  <Input value={phoneNumber} />                ← phone (logical second)
  <Button>Send Code</Button>                   ← action
</div>
```
In Hebrew RTL context, Tailwind `flex` reverses visual order — country goes to the right of phone. **CEO rule: country LEFT, phone RIGHT, in every language. Fix: wrap field group in `dir="ltr"`.**

`OnboardingVerification.tsx:371` already does this for the OTP digits (`dir="ltr"`). Pattern exists in repo; it's not applied to the phone group in the canonical flow.

### §1.4 Address autocomplete on provider onboarding

`ProviderOnboarding.tsx:916–933` uses `<GooglePlacesAutocomplete>` (the same component audited in `docs/GOOGLE_PLACES_AUTOCOMPLETE_AUDIT.md`). The five iOS Safari bugs documented there apply here verbatim:
- Dropdown floats off-screen when keyboard opens (uses `scrollY/scrollX` instead of `visualViewport`)
- Pointerdown selection race
- Z-index 999999 hard-coded — modal overlays exceed it
- WebKitOverflowScrolling jank at exactly 260px height
- Focus-vs-predictions race dismisses keyboard

Provider onboarding's "Next" button (line 972) requires `city` to be set, so a broken autocomplete = stuck flow.

### §1.5 Overlay leak on non-immersive routes

`client/src/lib/immersive-routes.ts:93` correctly lists `/provider-onboarding`, `/become-provider`, `/join/walker`, `/join/sitter`, `/join/trainer`. **It does NOT list `/apply-provider` or `/join-team`.** Those two routes render:
- `MobileBottomNav` (captures taps behind iOS keyboard)
- `FloatingStack` (chat widget)
- `PromoAdPopup`
- `AiChatWidget`

Both routes also render `ProviderApplicationForm` (duplicate of each other). **Resolving by deleting both routes is cleaner than adding to the immersive list.**

### §1.6 Validation — no source of truth

| Layer | What it checks |
|---|---|
| Client (`ProviderOnboarding.tsx:972`) | Boolean OR of 7 state vars (`firstName`, `lastName`, `phoneNumber`, `phoneVerified`, `idNumber`, `city`, `providerTypes`) |
| Server (`server/routes/provider-onboarding.ts:485–515`) | Manual presence checks; raw JSON.parse |
| Shared Zod | **None** |

No race-safe validation, no canonical schema, no consistent error shape. Each flow re-implements.

### §1.7 Emojis inside professional onboarding (CEO doctrine violation)

| File | Count | Examples (line) |
|---|---|---|
| `ProviderOnboarding.tsx` | **15** | 🇮🇱🇺🇸🇬🇧🇦🇺🇩🇪🇫🇷🇷🇺🇮🇳🇧🇷 (230–238), 📱 (269), ✅ (298, 823), 🚶🏠🚗🎓🚿 (726–790), ⚠️ (884), 🚗🎓🐕✅🛡️⚠️ (1231–1385) |
| `ProviderApplicationForm.tsx` | 2 | 📸 (646), 🚗 (755) |
| `JoinAsWalker.tsx` | 2 | 📷 🚗 (371) |

**Total: 19.** All must be replaced with Lucide icons or plain text.

### §1.8 Hebrew BiDi marks on brand mark

`ProviderOnboarding.tsx`:
- L307 — `'הצטרפו לצוות Pet Wash'` — **missing** U+2066 / U+2069 ❌
- L386–387 — `'אני מסכים/ה שחברת ⁦Pet Wash™⁩ תבצע…'` — correct ✓
- L1223 — `'…יאומתו ידנית על ידי צוות Pet Wash.'` — **missing** ❌

Two of three Hebrew brand instances are unisolated. iOS Safari + Hebrew = visual reversal of the brand mark inside the sentence.

### §1.9 OAuth consent screen identity (Google Cloud Console + repo)

**Repo-side problem** — `client/src/components/PremiumGoogleOAuthConsent.tsx:34,66,102`:
```
appName: '⁦Pet Wash™⁩ Ltd'      ← "Ltd" is legal-entity suffix; doesn't belong on the brand mark
```
Per §0: `PetWash™` is brand; `Pet Wash Ltd` / `פט ווש בע״מ` is legal entity. Mixing the two on the consent screen looks unfinished.

**Google Cloud Console side** (NOT in repo — CEO must update):
- App name → currently "Pet Wash Ltd" → change to **PetWash** (no "Ltd")
- App logo → upload `client/public/brand/petwash-oauth-logo-120x120.png` (asset exists; never uploaded)
- Support email → currently `support@petwash.co.il` (internal mailbox) → change to dedicated public alias (decision below)
- Privacy URL → `https://petwash.co.il/legal/privacy` (page exists ✓)
- Terms URL → `https://petwash.co.il/legal/terms` (page exists ✓)
- Authorized domains → `petwash.co.il` (verify)
- Authorized redirect URIs → `https://petwash.co.il/__/auth/handler` (verify)

**Repo touchpoints** (read but verified — no other source-of-truth bugs):
- `client/src/lib/firebase.ts:42` — auth domain hardcoded to `petwash.co.il` in production ✓
- `firebase.json:149` — CSP allows `accounts.google.com` ✓
- `client/public/manifest.json:2` — `"name": "Pet Wash™"` ✓

### §1.10 support@petwash.co.il exposure map

| Surface | File:Line | Customer-visible? |
|---|---|---|
| Apple Wallet pass | `server/apple-wallet-pass-template.json:62` | **YES** (in customer's iPhone Wallet) |
| Booking confirmation email | `server/services/PetWashOperationsOrchestrator.ts:195,501` | **YES** |
| Hebrew notification | `server/services/PetWashNotificationEngine.ts:462` | **YES** |
| Provider payout email | `server/services/ProviderPayoutService.ts:262` | YES (providers) |
| JSON-LD org email | `client/index.html:262` | YES (SEO) |
| NoScript fallback | `client/index.html:165` | YES (rare) |
| README.md | line 237 | Public repo doc |
| Legacy `SECURITY.md` | line 7 | Still says `support@petwashglobal.com` — stale |

**Decision needed (R-A below):** keep current exposure, or split into two aliases — `contact@petwash.co.il` (public/OAuth/Wallet/SEO) vs `support@petwash.co.il` (operational/internal).

---

## §2 PR plan — Phases A → D

### Phase A — Emergency UX unblock (1–2 days)

**Goal:** stop the bleeding on iPhone Safari. Brand surfaces stop looking unfinished. Form actually advances. No architectural refactor — that's Phase B.

**PR-A1 — Strip emojis from professional onboarding** (~1 hour)
- Files: `ProviderOnboarding.tsx`, `ProviderApplicationForm.tsx`, `JoinAsWalker.tsx`
- Replace 19 emojis with `<Lucide />` components (`Phone`, `Check`, `AlertTriangle`, `Camera`, `Car`, `Home`, `Sparkles`, `GraduationCap`, `Dog`, `Shield`)
- Country code list: drop emoji flags, render two-letter ISO code + dial code (e.g. `IL +972`)
- Risk: LOW. Visual only.

**PR-A2 — Lock phone field group to LTR + fix BiDi marks** (~30 min)
- `ProviderOnboarding.tsx:820–902` — wrap phone country/input/button row in `<div dir="ltr">`
- Lines 307, 1223 — wrap `Pet Wash` with U+2066 … U+2069 (consistent with line 386)
- Risk: LOW.

**PR-A3 — Register or delete non-immersive provider routes** (~30 min)
- Decision: delete `/apply-provider` and `/join-team` (recommended — duplicates of canonical)
- Or interim: add both to `immersive-routes.ts:93`
- Same change suppresses bottom nav, chat widget, promo popup, AI widget overlay on those routes
- Risk: LOW.

**PR-A4 — OAuth consent screen brand string fix** (~10 min)
- `client/src/components/PremiumGoogleOAuthConsent.tsx:34,66,102` — change `Pet Wash™ Ltd` → `PetWash™`
- Risk: LOW.

**Total Phase A:** ~3 hours engineering, ~1 day soak in staging + iPhone Safari verification.

**Out of scope for Phase A:** address autocomplete fixes (that's Phase B), validation refactor, route consolidation, Google Cloud Console config (that's Phase C).

---

### Phase B — Proper rebuild (5–10 days)

**Goal:** one canonical provider onboarding surface. Every gap surfaced in §1 is fixed structurally, not patched.

**PR-B1 — Unify phone verification component**
- Extract `usePhoneOtpVerification(phone, options)` hook from `ProviderOnboarding.tsx:122–304`
- Replace custom country picker with the library-backed `<PhoneInput>` (already used in 3 other flows)
- Server: keep `/api/provider/phone/*` endpoints; client converges on hook
- Risk: MEDIUM. Touches the OTP wire path; needs careful Twilio fallback verification.

**PR-B2 — Unify address autocomplete (apply Google Places audit P0+P1)**
- `client/src/components/ui/google-places-autocomplete.tsx` — VisualViewport API for keyboard-aware repositioning
- `client/src/components/ui/google-places-autocomplete.tsx` — debounce cleanup on unmount
- `server/routes/google-services.ts:676` — gate `/api/google/reverse-geocode` behind `requireGooglePlacesEnabled`
- Risk: MEDIUM. Component is reused across 20+ pages; full regression test required.

**PR-B3 — Shared Zod schema (client + server)**
- New `shared/schemas/provider-onboarding.ts` — phone, address, name, ID, declarations
- Client uses for live form validation
- Server uses to replace manual `req.body` checks in `provider-onboarding.ts:485`
- Risk: MEDIUM. Server validation tightens; needs staging soak.

**PR-B4 — Consolidate routes**
- Delete `/apply-provider`, `/join-team` (already done in A3 — code removal here)
- `/join/walker`, `/join/sitter`, `/join/trainer` → render `/provider-onboarding?role=walker` (or similar)
- Remove `ProviderApplicationForm`, `JoinAsWalker`, `JoinAsSitter`, `JoinAsTrainer` once nothing references them
- Risk: MEDIUM-HIGH. Surface deletion; need redirect chain.

**PR-B5 — iPhone Safari layout system**
- Single immersive shell wrapping provider onboarding: `min-height: 100dvh`, `padding-bottom: max(16px, env(safe-area-inset-bottom))`
- Sticky footer button uses `position: fixed; bottom: 0` with safe-area inset
- VisualViewport listener pushes keyboard padding into form container
- Risk: LOW–MEDIUM. CSS only; standard mobile-first pattern.

**Total Phase B:** ~5–10 days engineering; staged merge order B1 → B2 → B5 → B3 → B4.

---

### Phase C — OAuth brand / config cleanup

**Goal:** Google OAuth consent screen looks polished and on-brand. Owner email is appropriate for public exposure.

**Most of Phase C is CEO action in Google Cloud Console + Firebase Console, not repo work.**

**C1 — CEO action (Google Cloud Console)**
1. Open Google Cloud Console → **APIs & Services → OAuth consent screen**
2. **App name** → `PetWash` (remove "Ltd")
3. **App logo** → upload `client/public/brand/petwash-oauth-logo-120x120.png` (asset already in repo)
4. **Support email** → see decision R-A below
5. **Application home page** → `https://petwash.co.il`
6. **Privacy Policy URL** → `https://petwash.co.il/legal/privacy`
7. **Terms of Service URL** → `https://petwash.co.il/legal/terms`
8. **Authorized domains** → confirm `petwash.co.il` is listed
9. Save → verify on iPhone Safari OAuth flow (open private window, hit sign-in)

**C2 — CEO action (Firebase Console)**
1. Project `signinpetwash` → **Authentication → Sign-in method → Google** → confirm OAuth client matches C1
2. Project Settings → confirm `authDomain` shows `petwash.co.il` for prod env

**C3 — Repo PR (small)**
- `client/index.html:47` — `og:image` currently points to `IMG_7114_1751624638881.jpeg` (product photo); change to `/brand/petwash-logo-official.png` for consistent OG card branding
- `SECURITY.md:7` — replace stale `support@petwashglobal.com` with current contact
- If R-A=split: update Apple Wallet template, booking emails, JSON-LD to use new alias
- Risk: LOW.

---

### Phase D — Tests + iPhone Safari QA

**D1 — Manual iPhone Safari golden-path checklist** (one page in repo)
- Sign-in via Google OAuth → consent screen renders new brand → returns to app
- `/provider-onboarding` → phone field shows country LEFT, phone RIGHT in Hebrew + English
- OTP send → SMS arrives within 30s → code entry → verified state
- Address autocomplete → dropdown appears under keyboard → tap suggestion → field populates → Next button enabled
- No bottom nav / chat widget / promo popup overlaying form
- No emoji visible anywhere on the flow

**D2 — Automated guard**
- ESLint rule rejecting raw emoji unicode inside `client/src/pages/{Provider,JoinAs}*` files
- Playwright iOS Safari test covering golden path (CI-gated, runs on every PR touching `client/src/pages/Provider*`)
- Snapshot test verifying `dir="ltr"` wrapper present on phone field group

**D3 — Hebrew BiDi lint**
- Custom ESLint rule: any string literal containing both Hebrew letters AND `Pet ?Wash` must include `⁦…⁩` isolation marks
- Catches future regressions

**Total Phase D:** ~1–2 days. Lands alongside or just after Phase B.

---

## §3 Decisions awaiting CEO

| ID | Question | Recommendation |
|---|---|---|
| **R-A** | OAuth + customer-facing email: keep `support@petwash.co.il` OR split into `contact@petwash.co.il` (public, OAuth, Wallet, SEO) vs `support@petwash.co.il` (operational) | **Split.** Cleaner brand separation. Costs 5 min in Workspace + small repo PR. |
| **R-B** | Phase A4 (OAuth string `PetWash™ Ltd` → `PetWash™`): ship now or wait for full C1? | **Ship now.** Internal string is repo-controlled; CEO Console config is separate. |
| **R-C** | Delete `/apply-provider`, `/join-team` outright (no redirect) OR delete with 302 redirect to `/provider-onboarding` for 90 days? | **302 for 90 days.** Inbound links from Google, business cards, social may reference legacy URLs. |
| **R-D** | `/join/walker`, `/join/sitter`, `/join/trainer` — keep as standalone or fold into `/provider-onboarding?role=`? | **Fold into role-aware.** One surface, one component, role hints the copy. |
| **R-E** | Phase B1 phone refactor — drop the custom 9-country picker entirely OR keep IL as default w/ library fallback? | **Library only.** `react-phone-number-input` handles all countries; IL stays default. Custom picker dies. |
| **R-F** | Phase D2 automated guard scope: lint emojis ONLY on provider pages, or all auth/onboarding pages? | **All `client/src/pages/{Provider*,JoinAs*,SignIn,SignUp,Onboarding*,Auth*}`.** Covers the surface CEO has flagged as luxury. |

---

## §4 What this PR does NOT do

- No code changes (audit-only).
- No schema migration.
- No new dependency.
- No CI workflow change.
- No payment / wallet / Tranzila / Summit / Nayax / K9000 touch.
- No production-secret read or write.
- No Google Cloud Console / Firebase Console mutation.
- No emoji removed yet (Phase A1).
- No route deletion yet (Phase A3 / B4).
- No counsel-gated Path E work touched (separate doc, separate engagement).

---

## §5 Five-filter check (§0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ One route, one phone component, one schema, one autocomplete = real fix |
| Cheaper? | ✓✓ Phase A ships in 3 hours; Phase B reuses code that already exists |
| Faster? | ✓✓ Total path 7–14 days for a structural rebuild on the busiest funnel |
| Easier? | ✓✓ Routing consolidation eliminates 3 pages of duplicate maintenance |
| Luxurious? | ✓✓✓ No emojis, brand mark isolated, OAuth screen polished, RTL respects logical order |

**Honest miss:** Phase B1 (phone refactor) couples Twilio + Firebase + custom server endpoints. The OTP wire path has caused production incidents historically. **Soak Phase B1 alone in staging for 48h before stacking B2–B5.**

---

## §6 References

- `client/src/App.tsx:2241–2285` — provider routes
- `client/src/lib/immersive-routes.ts:93` — immersive list (missing `/apply-provider`, `/join-team`)
- `client/src/pages/ProviderOnboarding.tsx:122–304` — custom phone OTP
- `client/src/pages/ProviderOnboarding.tsx:820–902` — phone field group (RTL bug)
- `client/src/pages/ProviderOnboarding.tsx:916–933` — address autocomplete usage
- `client/src/pages/ProviderOnboarding.tsx:972` — "Next" button gate
- `client/src/components/PhoneInput.tsx` — library wrapper (Phase B1 target)
- `client/src/components/PremiumGoogleOAuthConsent.tsx:34,66,102` — "Pet Wash™ Ltd" string
- `client/src/components/ui/google-places-autocomplete.tsx` — Google Places audit
- `client/public/brand/petwash-oauth-logo-120x120.png` — OAuth logo (never uploaded)
- `client/public/brand/petwash-logo-official.png` — current brand mark
- `server/routes/provider-onboarding.ts:407–550` — server submit + validation
- `server/apple-wallet-pass-template.json:62` — support email exposure
- `client/index.html:47,165,262` — OG image, NoScript, JSON-LD
- `docs/GOOGLE_PLACES_AUTOCOMPLETE_AUDIT.md` — companion audit (Phase B2 source)
- `docs/PATH_E_PROVIDER_REBUILD_AUDIT.md` — counsel-gated provider infrastructure (orthogonal)
- `.claude/skills/petwash-platform/SKILL.md` §0 — brand discipline doctrine

---

**End of audit.** Implementation gated on CEO approval of phase ordering + decisions R-A through R-F in §3.
