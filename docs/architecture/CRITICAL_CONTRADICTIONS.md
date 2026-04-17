# PetWash — Critical Contradictions
> Only items proven by exact file + line evidence. No speculation.

---

## 1. Booking History Shows Empty for Walk/Sitter/Trainer Customers

| Field | Detail |
|---|---|
| **Issue** | `GET /api/bookings/my-bookings` only reads Firestore `bookings` collection. Walk, sitter, and trainer bookings are in Postgres tables (`walk_bookings`, `sitter_bookings`, `trainer_bookings`) and are never returned. |
| **Exact proof** | `server/routes/bookings.ts` lines 363-401: `db.collection("bookings").where(queryField, "==", userId)` — no Postgres query at all |
| **Walk bookings written to**: `walk_bookings` Postgres table (schema.ts line 4677) by `POST /api/walk-my-pet/walks/book` |
| **Sitter bookings written to**: `sitter_bookings` Postgres table (schema.ts line 4301) by `POST /api/sitter-suite/bookings` |
| **Business damage** | Customer books a walk or sitter stay → goes to `/bookings` → sees nothing. Customer thinks booking was lost. Calls support. Requests refund. Trust damage. Provider sees booking but customer doesn't → dispute. Financial records incomplete. Payout reports miss walk/sitter revenue. |
| **Safe next action** | Spike: book a walk as test user, confirm `/bookings` shows nothing. Then PR D2: unify `GET /api/bookings/my-bookings` to aggregate all 4 sources. |

---

## 2. Two Parallel Provider Application Systems — Different DB Tables

| Field | Detail |
|---|---|
| **Issue** | Two separate provider application flows exist: one live (`provider_applications`), one dead (`provider_applicants`). Admin panels for the dead flow show empty data because no live frontend ever writes to it. |
| **Live path proof** | `client/src/App.tsx` lines 2065-2077: `/become-provider` is a pure redirect, never renders `BecomeProvider.tsx`. `ProviderOnboarding.tsx` (RequireAuth) is the only real form. It calls `POST /api/provider-onboarding/apply` which writes `provider_applications` (schema.ts line 5027). |
| **Dead path proof** | `BecomeProvider.tsx` is lazy-imported at App.tsx line 76 but no route ever renders it. `POST /api/provider-applications` (server/routes/provider-applications.ts) writes `provider_applicants` (schema-enterprise.ts line 1677) — unreachable from any live frontend. |
| **Business damage** | If any admin panel reads `provider_applicants` as the source of truth for provider review, they are seeing an empty table. All real provider applications are in `provider_applications`. Admin may not know which table to check. |
| **Safe next action** | PR B (in progress): deprecation telemetry on dead path. After 7 days of zero `[DEPRECATED_ENDPOINT]` logs in production, PR C1 removes the dead files and table. |

---

## 3. Gemini AI Silently Broken by Startup Key Deletion

| Field | Detail |
|---|---|
| **Issue** | `server/index.ts` lines 5-6 delete `process.env.GEMINI_API_KEY` if `process.env.GOOGLE_API_KEY` is also present. Any deployment that sets both keys (common in Google Cloud environments) silently disables all Gemini AI features. |
| **Exact proof** | `server/index.ts` lines 5-6: `if (process.env.GOOGLE_API_KEY) { delete process.env.GEMINI_API_KEY; }` (or equivalent) |
| **Features broken when this fires** | KYC anomaly detection (`server/services/KYC2026.ts`), AI insights (`server/routes/ai-insights.ts`), Gemini watchdog, AI-powered rewards messages |
| **Business damage** | KYC analysis returns no AI signal → all applications go to manual review. AI rewards messages fail silently. Platform appears to have AI but it returns nothing. |
| **Safe next action** | Remove those 2 lines from `server/index.ts`. Add Gemini key check to startup health log. PR name: `fix: stop deleting GEMINI_API_KEY at startup`. |

---

## 4. Three "Who Am I" Endpoints — Inconsistent Response Shapes

| Field | Detail |
|---|---|
| **Issue** | Three separate endpoints return the current user's identity: `GET /api/auth/whoami` (routes.ts line 1301), `GET /api/session/whoami` (routes.ts line 2158), `GET /api/auth/me-session` (routes.ts line 2062). They may return different shapes or use different auth middleware. |
| **Business damage** | Different frontend components calling different whoami paths may get inconsistent role/profile data, leading to wrong routing decisions (e.g., one says user is a provider, another says user is a customer). |
| **Safe next action** | Phase C2: add logging to all three endpoints to measure call frequency. Consolidate to `GET /api/auth/whoami` as the canonical path. Point other two to proxy or redirect. |

---

## 5. Loyalty Join Routes Rendering Same Component Independently (Analytics Fragmentation)

| Field | Detail |
|---|---|
| **Issue** | `/privilege`, `/loyalty/join`, and `/vito` all render `PrivilegeSignup.tsx` directly (App.tsx lines 703-712). No redirect — each is a fully independent render. |
| **Business damage** | Analytics attribution for loyalty sign-ups is split three ways. A/B tests cannot be run on the join flow because the same form has three URLs. Email campaign links using different URLs make it impossible to measure actual conversion rate of the loyalty product. |
| **Safe next action** | PR B1: Change `/loyalty/join` and `/vito` to `<Redirect to="/privilege">`. Zero behavior change — same form, same API, same DB write. Confirmed safe. |

---

## 6. Nayax Webhook Duplicate Endpoints

| Field | Detail |
|---|---|
| **Issue** | Both `POST /api/webhooks/nayax` and `POST /api/nayax-webhook` may exist as Nayax webhook receivers. If Nayax is configured to post to both (or if the wrong one was configured), payments could be double-processed or missed. |
| **Business damage** | Payment double-processing or missed payment recording for K9000 wash sessions. Revenue reconciliation errors. |
| **Safe next action** | Audit which URL is configured in Nayax dashboard. Confirm only one handler is mounted. Add explicit comment in routes.ts identifying the canonical Nayax webhook URL. |

---

## 7. `admin_users` and `users` Parallel Identity Tables

| Field | Detail |
|---|---|
| **Issue** | `admin_users` table (schema.ts line 1250) exists separately from `users` table (schema.ts line 35). Admin authentication may check `admin_users` while the rest of the platform checks `users`. If an admin's record is in only one table, auth edge cases can allow or block access incorrectly. |
| **Business damage** | Admin cannot access a feature because their role is in `admin_users` but the middleware checks `users.role`. Or vice versa — a deactivated admin still has a record in the other table. |
| **Safe next action** | Phase F1: audit all admin auth middleware to confirm which table is checked. Then consolidate. |
