# Open-PR Dependency Map

**Owner:** parent Claude session
**Refreshed:** 2026-08-22
**Rule:** No merges. CEO merges. Do not stack new PRs on unmerged PRs unless dependency is truly unavoidable.

## Legend

- 💰 = money / VAT / commission / payout / refund / provider-earnings / Prestige / eGift
- 🔐 = auth / signup / session / claims / password / OTP / passkey
- 🗄️ = schema / migration / new column
- 📱 = affects mobile bundle / native app
- 🌐 = changes public-facing API contract or response shape
- ⚙️ = CI / workflow YAML only
- 📄 = docs only
- ✅ = pure additive UI / no external behavior change

---

## Currently open PRs — this session (after freeze started 2026-08-22)

| # | Title | Base | Depends on | Class | Safe to CEO review? |
|---|---|---|---|---|---|
| **2047** | drift-detector: add wallet_ledger_entries reconciliation pass | main | — | 💰 ✅ (detect-only, no writes to money tables) | Yes — additive audit pass |
| **2046** | tz: finance close-record + period aggregates use Israel calendar day | main | — | 💰 ✅ | Yes — bucketing correctness |
| **2045** | tz: admin dashboard today tile + revenue chart use Israel calendar day | main | — | ✅ | Yes — bucketing correctness |
| **2044** | provider-today: first-class ACCEPT / DECLINE / SCHEDULE M&G | main | — | ✅ | Yes — UI wires existing server routes |
| **2043** | provider-dashboard-v2: strip _source watermark | main | — | ✅ | Yes — no client reads _source |
| **2042** | walk-session: DTO discipline on owner tracking | main | — | ✅ | Yes — field-removal only |
| **2041** | nayax-cortina: verify CurrencyCode is ILS | main | — | 💰 | Yes — one new decline reason |
| **2040** | deep-links: 7 broken email/notification URLs | main | — | ✅ | Yes — link-target fix |
| **2039** | marketplace-reviews: advisory lock on submit (race fix) | main | — | 💰 (mutation lock) | Yes — mirrors reviews.ts pattern |
| **2038** | m&g: atomic transitions on request/schedule/complete | main | — | ✅ | Yes — mirrors /start /complete pattern |
| **2037** | 🔐 careers: PII enumeration — /my-applications needs Firebase auth | main | — | 🔐 🌐 CRITICAL | Yes — privacy law §13 fix |
| **2036** | queries: 4 more queryKey[1] filter drops | main | — | 🌐 | Yes — 2 pages currently broken |
| **2035** | 💰 booking-ledger: providerVatCents was undefined (CRITICAL) | main | — | 💰 CRITICAL | Yes — silent 100% failure fix |
| **2034** | admin: surface 20+ hidden fields on ProviderKycReview | main | — | ✅ | Yes — additive UI |
| **2033** | docs: open-PR dependency map (THIS FILE) | main | — | 📄 | Yes — docs only |
| **2032** | provider-onboarding: country-aware city picker | main | 2026, 2027, 2028 (all merged) | ✅ | Yes — additive UI |
| **2031** | docs: CEO master execution queue + reconciliation | main | — | 📄 | Yes — docs only |

**All 17 open PRs are branched off `main`.** No stacking on unmerged branches.

## Recently-merged reference (context for reviewing the open PRs above)

Merged before the freeze — supply pieces the open PRs depend on.

| # | Title | Supplies |
|---|---|---|
| 2030 | street picker from baked israel-streets + PetTrek CityPicker | `GET /api/geocode/streets`, `getStreetsForCity()`, `AddressPicker.showCitySuggestion` + StreetCombo, `MyAccountStreetSuggestions` |
| 2029 | ci: schedule Cloud Run prune weekly | Sunday 04:07 UTC cron; delete-mode fallback |
| 2028 | booker+provider CityPicker into AddressPicker + sitter profile | `AddressPicker.showCitySuggestion` prop, Sitter/Walker BookingFlow wireup, SitterEditProfile city picker |
| 2027 | shop CityPicker | Shop checkout city picker |
| 2026 | MyAccount CityPicker + postcode autofill | MyAccount profile city picker |

## Stacking rule while merge freeze is active

- New PRs branch **only from `main`** to keep each independently reviewable.
- Anywhere a genuine dependency exists (e.g. #2032 needs `CityPicker` which is already on main), it's already satisfied because those PRs merged before the freeze.
- Doc PRs (#2031, #2033) never block code PRs.

## No-merge freeze

Absolute merge freeze from 2026-08-22 onwards until CEO instructs otherwise with explicit `MERGE #XXXX`. Session role from here: author / test / commit / push / open PR / continue next independent task.

## Update rhythm

Parent session updates this file whenever a new PR is opened, closed, or merged. If a CEO-approved merge lands, note it in the "Recently-merged reference" table with what it supplies.

---

## Historical map (pre-2026-08-22 freeze, previous session)

The map below survives from the prior session's dependency work (2026-08-18). Kept as reference — every branch listed here was either merged, closed, or is now stale.

### CRITICAL — Do not confuse PR #1870 with §§6-7

Branch reconciliation ran 2026-08-18 confirmed:

| Item | Fact |
|---|---|
| PR #1870 head branch | `sprint/auth-identity-change` @ `bbe97040d` — **1 commit** |
| PR #1870 actual scope | pin-auth hardening ONLY — `pin-auth.ts`, `pinAuthIdentity.regression.test.ts`, `Settings.tsx`, `PinKeypad.tsx` |
| PR #1870 body | Advertises "Email change (in progress) / Mobile change (in progress)" — **aspirational only, the diff has neither** |
| PR-AUTH-SECURITY-9 §§6-7 (email/mobile change) authoritative branch | `claude/pr-auth-security-9` @ `f485b8e20` — the ONLY branch shipping `auth-change-email.ts`, `auth-change-mobile.ts`, `ChangeEmailPanel.tsx`, `ChangeMobilePanel.tsx`, `AuthChangeEmailConfirm.tsx`, migration `0116_email_mobile_change_requests.sql` |
| Overlap / conflict between #1870 and pr-auth-security-9 | **None** — #1870 edits `pages/Settings.tsx`; §§6-7 edits `pages/SecuritySettings.tsx`. No shared file. |
| Recommendation | Land #1870 for pin-auth OR amend its description. §§6-7 needs a separate PR opened from `claude/pr-auth-security-9`. |

### Prior-session merge-order recommendation

| Wave | Branches |
|---|---|
| Wave 1 SAFE | `claude/pr-legal-cookies`, `claude/pr-drawer-franchise-referral`, `claude/pr-provider-pending-flow`, `claude/pr-provider-pending-contrast`, `claude/pr-account-activation-sms-canonical`, `claude/pr-company-cta`, `claude/pr-admin-client-contracts`, `claude/pr-tsc-clean-language-props` |
| Wave 2 SECURITY | `claude/pr-nav-header-hygiene`, `claude/pr-admin-auth-gaps`, `claude/pr-prestige-sse-bearer`, `claude/pr-ws-match-auth`, `claude/pr-provider-today-server-gate` |
| Wave 3 MONEY | `claude/lane-b-confirm-refund-writers`, `claude/pr-billing-refund-idempotent`, `claude/pr-bookings-confirm-firestore-txn`, `claude/pr-booking-expiry-atomic-transition` |
| Wave 4 LARGE AUTH | `claude/pr-auth-security-9` (~15 files, real email/mobile change) |
| Wave 5 PROVIDER TODAY UX (stacked) | `claude/pr-provider-today-dashboard` (base) → `claude/pr-provider-today-meet-greet` |

### Prior-session known conflict risks

- `client/src/components/PetWashHeader.tsx` — 3 branches (nav-header-hygiene, drawer-franchise-referral, pr-auth-security-9). Resolve in that order.
- `server/routes/prestige-pass.ts` — `claude/pr-prestige-sse-bearer` (SSE handler ~L2160) vs `claude/lane-b-confirm-refund-writers` (admin refund handler further down). Different sections; should merge cleanly.
- `client/src/App.tsx` — 4 branches touching different sections (drawer routes, auth routes, ProviderToday route, dead-prop drops). Manual rebase.

**None of the historical branches above are in this session's open-PR list** — they may still be open PRs from prior sessions or already merged; check `gh pr list --state=all` before assuming.
