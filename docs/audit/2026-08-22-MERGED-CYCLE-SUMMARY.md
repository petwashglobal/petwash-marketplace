# 2026-08-22 Merge Cycle Summary — 40 PRs landed to main

Live-production hardening cycle 2026-08-22. Started with an absolute merge freeze; ended with CEO ordering all frozen PRs merged. 40 PRs landed to `main` in one batch.

Supersedes the `CEO-MASTER-EXECUTION-QUEUE.md` snapshot from PR #2031 — every "FIXED-CODE" row in that queue has moved to `MERGED-MAIN` (except the ones the queue explicitly flagged BLOCKED-CEO / BLOCKED-EXTERNAL, which stayed frozen).

## Cycle metadata

- Start: `78e582945` (before PR #2031)
- End:   `55dfc215e` (PR #2069 merged)
- PRs merged: **40** (2031–2069 inclusive; 2058 rebased over the stacked base)
- PRs blocked → resolved by rebase before merge: **3** (#2036, #2052, #2058)
- CI status: every PR was frozen per §0 until CEO's "i order you now to merge all pending github" — merged squash-only, one clean commit per PR on main.

## Highlights by severity

### CRITICAL (money / auth / national safety)
| PR | Fix |
|---|---|
| #2035 | `pw_provider_payouts` INSERT silently threw ReferenceError since a refactor — every completed marketplace booking wrote `pw_payments` but NOT the payout row. `providerVatCents = 0` restored. |
| #2064 | **2FA bypass on `/api/mfa/verify`** — wrong OTP was rendered as verified because handler streamed HTTP 200 with `success:false`. Now correctly 400s on failure. |
| #2066 | Live K9000 per-bay hardware telemetry was shipping on the PUBLIC petwash.co.il homepage — removed. |
| #2067 | Walker-search unauth was leaking every walker's email/phone/KYC docs/bank/nayaxPayoutAccountId/live GPS to anonymous callers. |
| #2053 | 7 contractor-onboarding endpoints let any signed-in user overwrite any other provider's bank details / fake bg-check / plant tax profile. |
| #2056 | K9000 body-`kioskId` vs HMAC-header split — kiosk A could inflate station B's revenue / drain wallet at station B / mark station B online. |
| #2041 | Nayax Cortina now verifies CurrencyCode is ILS on authorize/settlement/refund. |

### HIGH (customer PII / wrong data / wallet hijack)
- #2037, #2052 — Careers `/my-applications` PII enumeration (round 1 + 2, 8 endpoints total)
- #2054 — pets PATCH allowlist + `/wallet/business-card` phishing-card lockdown
- #2065 — franchise `/support/tickets/:id` PATCH allowlist
- #2038 — M&G booking-request atomic transitions
- #2039 — marketplace-reviews advisory-lock race
- #2068 — 6 DTO leaks (inbox, messaging, bookings, super-app-bookings, transactions, addresses)
- #2069 — /loyalty/profile allowlist + /ratings whole-table dump gate
- #2043 — provider-dashboard-v2 `_source` watermark stripped
- #2042 — walk-session DTO discipline

### Confirmation-moment arc (7-PR narrative — answered the Classic Cinemas comparison)
| PR | Fix |
|---|---|
| #2057 | `BookingConfirmedHero` — luxury ticket hero + Order Reference QR |
| #2058 | Real Apple Wallet button + `/api/wallet/booking-pass` endpoint |
| #2059 | 7 CRITICAL 404 deep-links (incl. Nayax return URLs that landed customers on 404 after paying) |
| #2060 | Real CAN-SPAM `/unsubscribe` — HMAC token + endpoint + client page |
| #2061 | Marketing suppression enforcement — both gates honour `users.marketing_consent` |
| #2062 | Google Wallet booking-pass parity (JWT + inline genericClass) |
| #2063 | 8 more welcome-email 404 links closed |

### queryKey / client bug family
- #2036, #2055 — 11 client `useQuery` calls hitting the wrong URL (SitterEditProfile CRITICAL, MyExpenses HIGH, DocumentManagement, LoyaltyDashboard admin, PetTrek dashboard, LogisticsFleetView ×2, MarketplaceIntelligence)
- #2044 — Provider-Today ACCEPT/DECLINE/SCHEDULE M&G buttons

### Small quality
- #2032 (country-aware city picker), #2033 (dep-map), #2034 (KYC admin fields), #2040 (7 email deep-links), #2045/#2046 (TZ), #2047 (wallet ledger drift), #2048 (feature-flag inventory), #2049 (signOut swallow), #2050 (WS auth swallow), #2051 (marketplace review nav), #2031 (docs).

## Ops requirements for the deploy

Set in Cloud Run env before the next release:
- `EMAIL_UNSUB_SECRET` (≥ 32 chars) — required for #2060 unsubscribe HMAC token
- `GOOGLE_WALLET_ISSUER_ID` + `GOOGLE_WALLET_SERVICE_ACCOUNT` — for #2062 Google Wallet booking pass
- `APPLE_WWDR_CERT` / `APPLE_SIGNER_CERT` — already set (needed for #2058)
- `INTERNAL_SERVICE_SECRET` — needed for the `/api/wallet/notify-pass-update` loopback (was set already)

## Post-deploy verification checklist

Only doable once main deploys to petwash.co.il — cannot verify from the session container (BLOCKED-LIVE):

1. `LandingLiveBayStrip` gone from petwash.co.il homepage (#2066)
2. `/api/mfa/verify` returns 400 on wrong OTP (#2064)
3. `/api/walk-my-pet/walkers/search` unauth response has NO `email`, `phone`, `governmentIdUrl`, `nayaxPayoutAccountId` (#2067)
4. `/api/wallet/user-passes/:userId` response has NO `authenticationToken` (#2067)
5. Book a legacy-table booking with Nayax hosted checkout → success redirect lands on `/booking/confirmation/:id?payment=success` (not the previous 404) (#2059)
6. Suspicious-login email "Review my sessions" button lands on `/security/status` (#2059)
7. Marketing email unsubscribe click writes `users.marketing_consent=false` and no further marketing email fires (#2060, #2061)
8. New booking shows the `BookingConfirmedHero` above the tabit card with a real QR of `requestId` (#2057)
9. "Add to Apple Wallet" on the hero streams a `.pkpass` (#2058)

## Deferred / still open

- Google Wallet button UI wiring (server-side landed in #2062; client hero prop `onAddToGoogleWallet` exists but no handler yet)
- KYC re-submit client page + flow (the `/provider-application/resubmit?token=` server endpoint exists at `provider-onboarding.ts:2501` — needs a client page + form + client-side upload wiring)
- Admin/internal 404s (incidents, inventory, settlements, technician tasks) — separate admin-UX PR
- Cortina single-shared-secret hardening — needs Nayax coordination
- K9000 idempotency migration to `ON CONFLICT` — needs CEO sign-off on money-flow reorder

## Master ledger status

`docs/audit/CEO-MASTER-EXECUTION-QUEUE.md` — the pre-cycle snapshot (2026-08-21) rows are all `MERGED-MAIN` unless BLOCKED. Behavioral verification (BEHAVIORAL-VERIFIED) will happen live once the deploy runs.
