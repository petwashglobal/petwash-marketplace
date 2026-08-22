# CEO Master Execution Queue

**Owner:** parent Claude session
**Rule 0:** ABSOLUTE MERGE FREEZE. Author, test, commit, push, open PR. CEO merges.
**Rule 1:** Never conflate "code on main" with "verified live on production".
**Rule 2:** When one task is BLOCKED-CEO, move immediately to the next independent task.
**Rule 3:** Do NOT delete legacy code without proving no current caller (web, mobile bundle, email link, push, Wallet, external integration).

---

## Status vocabulary (use EXACTLY these — no other labels)

| Status | Meaning |
|---|---|
| `NOT-INSPECTED` | Not yet looked at |
| `VERIFIED-SOURCE` | Source read, understood; may still be wrong |
| `BROKEN` | Confirmed defective |
| `FIXED-CODE` | Fix committed on a branch |
| `MERGED-MAIN` | Merged to `main` (still not proven working) |
| `BEHAVIORAL-VERIFIED` | Integration / Playwright / controlled runtime passes |
| `VERIFIED-LIVE` | Exercised against deployed production petwash.co.il |
| `BLOCKED-CEO` | Needs CEO decision (schema, economics, external key) |
| `BLOCKED-EXTERNAL` | Needs external system (Cloud Run dispatch, Nayax key, App Store) |
| `BLOCKED-LIVE` | Egress from this session blocks petwash.co.il — cannot VERIFY-LIVE from container |

---

## Lanes (max 4 worktrees, parent stays free)

| Lane | Scope | Owner |
|---|---|---|
| **A** | Provider onboarding steps 0-14 + multi-role + role-overwrite family + HE/EN declarations + admin visibility + approval → active-searchable-provider | subagent |
| **B** | Wallet/ledger authority map + Nayax DOT + K9000 dual bay + SUMIT reconciliation + Prestige/eGift value provenance | subagent |
| **C** | Marketplace booking chain + Provider Today + Meet & Greet + WalkSession/live GPS + completion→report→review | subagent |
| **D** | Archaeology continued + mobile bundle matrix + hamburger/nav sweep + deep-link sweep + privacy/uploads/feature flags + queryKey / DTO / TZ / false-success families | subagent |
| Parent | Ledger maintenance, safe confirmed defect fixes, PR authoring | this session |

---

## Master row table (populated by each lane; parent aggregates)

| ID | DOMAIN | CEO REQUIREMENT | FRONTEND | BACKEND | DATA | AUTH | MOBILE | STATUS | DEFECT | PR | DEPENDENCY | BLOCKER | NEXT ACTION |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A-01 | Provider Onboarding | Step 0 entry/declarations persists across refresh | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-02 | Provider Onboarding | Step 1 base account | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-03 | Provider Onboarding | Step 2 identity | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-04 | Provider Onboarding | Step 3 right to work | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-05 | Provider Onboarding | Step 4 Israeli tax/business | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-06 | Provider Onboarding | Step 5 services | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-07 | Provider Onboarding | Step 6 animal safety | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-08 | Provider Onboarding | Step 7 trust | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-09 | Provider Onboarding | Step 8 insurance | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-10 | Provider Onboarding | Step 9 bank/payout | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-11 | Provider Onboarding | Step 10 premises/address | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-12 | Provider Onboarding | Step 11 availability | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-13 | Provider Onboarding | Step 12 pricing | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-14 | Provider Onboarding | Step 13 agreements | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-15 | Provider Onboarding | Step 14 submit | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A audit |
| A-16 | Provider Save/Resume | Cross-refresh + cross-device + HE↔EN + customer↔provider persistence | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| A-17 | HE/EN Declarations | HE + EN versioning, checkbox, signature, timestamp, IP, device, API, DB, readback, admin, PDF snapshot | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| A-18 | Admin Provider Review | Admin sees every submitted field; can request fix | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| A-19 | Approval → Active Provider | Admin approve → provider capability active → searchable → Provider Today → accept booking | — | — | — | — | — | `BROKEN` | Sections J of archaeology doc: 3 approve endpoints, none insert into `providers` table | — | — | Existing canonical provider store discovery | Lane A fix (recover, don't rebuild) |
| A-20 | Partial Service Approval | Walking approved / Sitting approved / Hosting pending → per-service search visibility | — | — | — | — | — | `NOT-INSPECTED` | — | — | A-19 | — | Lane A |
| A-21 | Historical Approval Reconciliation | Read-only diagnostic report of "approved but not searchable" records | — | — | — | — | — | `NOT-INSPECTED` | — | — | A-19 | — | Lane A |
| A-22 | Multi-role One-Human-One-Account | Same Firebase UID = customer + Prestige + provider + walker + sitter + trainer additively | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| A-23 | Role Overwrite Family | Grep every `role ===`, `role:`, `setRole`, `UPDATE users SET role`, `customClaims.role`, `accountType`, `userType`, `providerRole` — find every place provider approval could destroy customer capability | — | — | — | — | — | `NOT-INSPECTED` | — | — | A-22 | — | Lane A |
| A-24 | Firebase Claim Compat Shim | Multi-role additive shim; old mobile bundles must not break | — | — | — | — | — | `NOT-INSPECTED` | — | — | A-22, A-23 | mobile matrix (D-11) | Lane A after D-11 |
| A-25 | AUTH signup chain — Google | button → SDK → callback → Firebase → session → users row → verify → age/Terms → decider → home → refresh → logout | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| A-26 | AUTH signup chain — Apple | same as above | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| A-27 | AUTH signup chain — Mobile OTP | same as above | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| A-28 | AUTH signup chain — Email/Password | same as above | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| B-01 | Wallet/Ledger Authority Map | LedgerService / WalletLedger / BillingLedger / payoutLedger / loyaltyLedger / bookingLedgerWriter / AuditLedgerService / schema-ledger-v2 / wallet routes / credit-wallet / CEO wallet / reconciliation / drift detector / anomaly routes — each: writer/reader/table/value-type/authority/UI | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane B |
| B-02 | Value Provenance | customer credit / eGift / wash package / Prestige points / promo / referral / real money — never flattened | — | — | — | — | — | `NOT-INSPECTED` | — | — | B-01 | — | Lane B |
| B-03 | Prestige/Loyalty | Membership, tier, points, birthday, referral, wash, booking, eGift, Wallet pass — server-truth, exactly-once, no client award, no parallel stores | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane B |
| B-04 | eGift Full Journey | buy → SUMIT → email → serial/QR → wallet → partial redeem → K9000 → service redeem → refund → history → admin → reconciliation | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane B |
| B-05 | Nayax Money Orchestrator | Customer → PetWash funding → redemption auth → Nayax credential → DOT → exact station → exact bay → tx → PetWash ledger → SUMIT → reconciliation | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane B |
| B-06 | K9000 Dual Bay | canonical stationId+bayId+Nayax terminal mapping; Bay A cannot start Bay B; same QR can't cross; concurrent A/B; delayed callback can't cross-actuate | — | — | — | — | — | `NOT-INSPECTED` | — | — | B-05 | — | Lane B |
| B-07 | Nayax Webhooks | raw-body HMAC / real allowlist / no example-IP fallback / event idempotency / retry-safe processing / settlement identity / refund identity / amount+currency / station+bay match | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane B |
| B-08 | SUMIT Mapping | K9000 / shop / wallet topup / eGift purchase / eGift redemption / provider commission / refund→CreditInvoice; reconciliation links: deal↔Nayax tx↔SUMIT document | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane B |
| B-09 | Smart Money Monitor | Read-only: dup tx / dup QR / wrong bay / wrong station / amount mismatch / currency mismatch / Nayax without PetWash / PetWash without Nayax / SUMIT missing / ledger dup / negative bucket / dup loyalty / dup refund / eGift overdraw / chargeback anomaly | — | — | — | — | — | `NOT-INSPECTED` | — | — | B-01…B-08 | — | Lane B |
| C-01 | Customer Booking Chain | service → location → date/time → pet → providers → profile → contact/M&G → book → pay → track → complete → review | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane C |
| C-02 | Provider Today | Server-derived: next booking / customer / pet / service / time / location / state / allowed actions; one primary CTA | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane C |
| C-03 | Meet & Greet | request → accept/schedule → both see → complete → progress; atomic transitions | — | — | — | — | — | `NOT-INSPECTED` | — | — | C-01, C-02 | — | Lane C |
| C-04 | Service Session / Live Walk | reuse WalkSessionService — check-in / check-out / GPS / ownership / participant auth / safe DTO / stale location / offline / retry / double-tap | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane C |
| C-05 | Live GPS | provider Start → background location → server → customer push → live map → elapsed → last-updated / stale-age display / no cross-user leaks | — | — | — | — | — | `NOT-INSPECTED` | — | — | C-04 | — | Lane C |
| C-06 | Completion → Report → Review | Finish → atomic → report → photos/notes/route → customer notification → view → confirm → review; reuse existing review system | — | — | — | — | — | `NOT-INSPECTED` | — | — | C-04 | — | Lane C |
| C-07 | Calendar/Availability | One authority drives: provider availability / search / booking / reschedule / calendar / blocked periods | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane C |
| C-08 | Messaging | Thread tied to booking/service/pet/participants; server auth; no client-supplied participant IDs | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane C |
| C-09 | Rover E2E Regression | signup → pet → find walker → contact → book → provider accept → payment → Provider Today → Start → tracking → Finish → report → confirm → review; then become-provider → save/resume → approval → provider mode; then switch back — pets/wallet/Prestige/bookings still there | — | — | — | — | — | `NOT-INSPECTED` | — | — | A-16..A-22, C-01..C-06 | — | Lane C |
| D-01 | Recent Merge Reconciliation | Every PR merged since 2026-08-21 20:22 UTC: PR / what / CI / deps / money? / auth? / schema? / external? / mobile? / known regression | — | — | — | — | — | `IN-PROGRESS` | — | this doc | — | — | Parent (this session) |
| D-02 | System Archaeology Continued | For every page/component/hook/API/route/service/table/job/event/notification/mobile bundle: LIVE-CONNECTED / BUILT-BUT-HIDDEN / FRONTEND-NO-BACKEND / BACKEND-NO-FRONTEND / WRONG-ROUTE / WRONG-AUTH / WRONG-DATA / WRONG-TABLE / LEGACY-SHADOW / FEATURE-FLAGGED-OFF / STALE-MOBILE / DEAD / PARTIAL | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-03 | Hamburger + Public-Nav Sweep | header / hamburger / footer / CTA / card / form / back — render/tap/navigate/auth/API/response/mobile/HE-EN/RTL | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-04 | queryKey[1] Family | All useQuery/useInfiniteQuery where queryKey has filters but default queryFn only uses [0] — find, fix safe, test actual URL | — | — | — | — | — | `PARTIAL` | 11 confirmed fixed in #2023/#2024/#2025 — still needs whole-repo sweep | — | — | — | Lane D |
| D-05 | Public DTO Family | Every public endpoint: `SELECT *` / `table.*` / `res.json(row)` / `return dbRow` — explicit DTO | — | — | — | — | — | `PARTIAL` | 2 confirmed (paw-finder, user-profile) — needs whole-repo | — | — | — | Lane D |
| D-06 | Identity Namespace Map | Firebase UID / users.id / providerId / walkerId / sitterId / customerId / memberId / walletId / bookingId / requestId — generated-where / stored-where / maps-to / used-for-auth? / public? — find invalid comparisons | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-07 | DB Split-Brain | user / pet / provider / booking / wallet / loyalty / review — Postgres/Firestore/Firebase-Auth/Redis/local: write-A read-B without sync | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-08 | Notification/Deeplink Family | Every URL from email/SMS/push/Wallet/cron/support vs App.tsx routes: VALID / AUTH-REDIRECT / WRONG-ROLE / 404 / OLD-ROUTE / MOBILE-ONLY | — | — | — | — | — | `PARTIAL` | 8 fixed in #2011/#2012/#2019 — needs comprehensive extract | — | — | — | Lane D |
| D-09 | Mobile Archaeology | Capacitor / iOS / Android / xcarchive / build bundles / App Store version | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-10 | Bundled Endpoint Scan | Search installed bundles for /api/auth/user, /api/auth/phone, /api/auth/sms, /provider/dashboard, /provider-os, /me, /my-account, /prestige, booking, wallet, old domains, Replit | — | — | — | — | — | `NOT-INSPECTED` | — | — | D-09 | — | Lane D |
| D-11 | Mobile Version Matrix | app / version / build date / source commit / API base / auth paths / booking paths / wallet paths / known stale routes / rebuild needed — provider + customer separately | — | — | — | — | — | `NOT-INSPECTED` | — | — | D-09, D-10 | App Store credentials for rebuild = BLOCKED-CEO | — | Lane D |
| D-12 | Feature Flag Graveyard | Every *_ENABLED / FEATURE_ / ENABLE_ / DISABLE_ — INTENTIONAL-OFF / MISSING-PROD-ENV / DEAD-FLAG / SAFETY-KILL-SWITCH / UNACTIVATED / UNKNOWN | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-13 | Mount Order | Behavioral test /api/user, /api/k9000, /api/franchise, /api/pass/:token; search /:id-before-/special, /:token-before-/status, catch-all shadows | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-14 | Timezone Family | CURRENT_DATE / ::date / ::timestamp / new Date() / toISOString() / cron.schedule / startOfDay / endOfDay — distinguish UTC event / user-local display / Israel business date | — | — | — | — | — | `PARTIAL` | 15 fixed in #2009/#2013/#2017 — full sweep pending | — | — | — | Lane D |
| D-15 | False-Success Family | fetch() without !response.ok; toast.success() outside proven success; catch{return}; catch(()=>{}); 200 with error; fallback []; placeholder data; silent no-op | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-16 | Concurrency/Idempotency | booking accept/confirm/cancel, refund, provider complete, customer confirm, review, wallet redemption, loyalty, Nayax, email event — double-tap / retry / multi-worker → one effect | — | — | — | — | — | `PARTIAL` | idempotency middleware exists; per-endpoint audit continues | — | — | — | Lane D |
| D-17 | Privacy/Error/Logging | Raw errors / PII logs / GPS / health / emails / phones / IDs / tokens / payment refs / customer addresses — customer-safe errors, no full PII in ordinary logs | — | — | — | — | — | `PARTIAL` | 6 rounds shipped earlier — continues | — | — | — | Lane D |
| D-18 | Uploads / URL Security | uploads / content-type / file-size / private object access / signed URLs / SSRF / open-redirect / URL validation / image processing | — | — | — | — | — | `PARTIAL` | 1 round shipped — continues | — | — | — | Lane D |
| D-19 | CEO / Tower Control Recovery | CEO Dashboard / Operations / Finance / Compliance Control Tower / Security / K9000 / Nayax / Wallet / Fraud / Reconciliation / Board / Executive — route / nav / auth / API / data / buttons — RECONNECT useful systems, don't delete | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| D-20 | Admin Buttons Sweep | Every admin mutation: button → route → auth → validation → persistence → response → refresh; no false success toast, no 404-pretending-success, no dropped parameters | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane D |
| X-01 | users.city_symbol Persistence | Schema-level column so picked citySymbol identity survives round-trip | shipped for onChange only | — | schema change needed | — | — | `BLOCKED-CEO` | picked citySymbol lost on save | — | — | Approval to add column | — |
| X-02 | ProviderOnboarding country-aware city picker | IL uses baked city list; US/UK/AU/CA keeps GooglePlaces multi-country autocomplete | — | — | — | — | — | `NOT-INSPECTED` | — | — | — | — | Lane A |
| X-03 | user_addresses persist citySymbol | Additive column on saved-address rows | — | — | schema decision | — | — | `BLOCKED-CEO` | — | — | X-01 | Approval | — |
| X-04 | Address round-trip proof | pick city → pick street → save → refresh → edit → book → checkout — persistence proven | — | — | — | — | — | `BLOCKED-LIVE` | egress blocks petwash.co.il from container | — | — | — | Lane C (behavioral only) |
| X-05 | Address in native mobile build | New CityPicker UI must be in the shipped iOS/Android app | — | — | — | — | — | `BLOCKED-EXTERNAL` | needs rebuild + upload | — | D-11 | App Store credentials | — |

---

## Lane completion order (parent aggregates every 5 items)

1. D-01 Recent merge reconciliation (parent, now)
2. A-01..A-15 Provider steps 0-14 (Lane A)
3. A-17 HE/EN declarations (Lane A)
4. A-18 Admin visibility (Lane A)
5. A-19 Approval → active-searchable provider (Lane A)
6. A-22 / A-23 Multi-role role-overwrite (Lane A)
7. A-21 Historical approved-but-inactive diagnostic (Lane A)
8. B-01 Wallet/ledger authority map (Lane B)
9. C-01..C-06 Provider Today/customer chain (Lane C)
10. C-04, C-05 WalkSession + live GPS (Lane C)
11. C-06 Completion/report/review (Lane C)
12. B-05, B-06 Nayax DOT/dual-bay (Lane B)
13. B-08 SUMIT reconciliation (Lane B)
14. D-19 CEO/Tower dashboards (Lane D)
15. D-08 Deep-link full sweep (Lane D)
16. D-09..D-11 Mobile stale-bundle matrix (Lane D)
17. D-12 Feature flags (Lane D)
18. D-13 Mount order (Lane D)
19. D-03, D-20 Every button E2E (Lane D)
