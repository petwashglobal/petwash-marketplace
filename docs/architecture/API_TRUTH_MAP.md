# PetWash — API Truth Map
> Branch HEAD only. Source: `server/routes.ts` mount points + individual route files.

Legend: ✅ Canonical  ⚠️ Duplicate  🔴 Dead  🟡 Partial

---

## Auth Endpoints

| Method | Path | Mounted | Business Purpose | Canonical? | DB Tables Written | External Services | Status |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/session` | `routes.ts` line 996 | Exchange Firebase ID token for session cookie; syncs user to Postgres | ✅ Canonical | `users` (via AuthService), `sessions` | Firebase Admin SDK, Google Sheets (new user log), HubSpot (new user) | Live |
| POST | `/api/auth/signout` | `routes.ts` line 1274 | Clear session cookie, revoke refresh tokens | ✅ Canonical | `sessions` | Firebase Admin SDK | Live |
| POST | `/api/auth/post-login` | `routes.ts` line 1298 | Route decision after login (profile complete? provider? etc.) | ✅ Canonical | `users` | — | Live |
| GET | `/api/auth/whoami` | `routes.ts` line 1301 | Return current user profile + role + onboarding state | ✅ Canonical | — (read only) | — | Live |
| POST | `/api/auth/choose-role` | `routes.ts` line 1304 | Save role intent (customer/provider/staff) | ✅ Canonical | `users` | — | Live |
| POST | `/api/auth/complete-profile` | `routes.ts` line 1310 | Save first/last name, phone, terms acceptance | ✅ Canonical | `users` | — | Live |
| GET | `/api/session/whoami` | `routes.ts` line 2158 | Another whoami implementation | ⚠️ **Duplicate of /api/auth/whoami** | `users` (read) | — | Live but redundant |
| GET | `/api/auth/me-session` | `routes.ts` line 2062 | Third whoami variant | ⚠️ **Duplicate** | `users` (read) | — | Live but redundant |
| GET | `/api/me/role` | `routes.ts` line 2284 | Return user role only | ⚠️ **Partial duplicate** | — | — | Live |
| POST | `/api/simple-auth/signup` | `routes.ts` line 1869 | Email/password signup outside Firebase | ⚠️ **Legacy parallel auth path** | `users` | — | Live — needs audit |
| POST | `/api/simple-auth/login` | `routes.ts` line 1950 | Email/password login outside Firebase | ⚠️ **Legacy parallel auth path** | `sessions` | — | Live — needs audit |
| POST | `/api/webauthn/register/*` | `routes.ts` lines 2699+ | Passkey registration | ✅ Active | `users` (device record) | WebAuthn | Live |
| POST | `/api/webauthn/login/*` | `routes.ts` lines 2816+ | Passkey login | ✅ Active | `sessions` | WebAuthn | Live |

---

## Provider Endpoints

| Method | Path | Mounted At | Business Purpose | Canonical? | DB Tables Written | Status |
|---|---|---|---|---|---|---|
| POST | `/api/provider-onboarding/apply` | `routes.ts` line 10527; handler `provider-onboarding.ts` line 400 | **Submit provider application** | ✅ **CANONICAL** | `provider_applications` (schema.ts line 5027) | Live |
| GET | `/api/provider-onboarding/application/status` | `provider-onboarding.ts` line 1180 | Check my application status | ✅ Canonical | — (read) | Live |
| GET | `/api/provider-onboarding/my/status` | `provider-onboarding.ts` line 1783 | Alternate status endpoint | ⚠️ Possible duplicate of above | — (read) | Needs audit |
| POST | `/api/provider-onboarding/admin/applications/approve` | `provider-onboarding.ts` line 1372 | Admin: approve application | ✅ Canonical | `provider_applications`, `users` (role upgrade) | Live |
| POST | `/api/provider-onboarding/admin/applications/reject` | `provider-onboarding.ts` line 1490 | Admin: reject application | ✅ Canonical | `provider_applications` | Live |
| POST | `/api/provider-applications` | `routes.ts` line 10553; handler `provider-applications.ts` | Submit application to **DEAD** flow | 🔴 **DEAD — no live frontend caller** | `provider_applicants` (schema-enterprise.ts line 1677) | DEPRECATED — logging only |
| POST | `/api/provider-applications/draft` | `provider-applications.ts` | Save draft to dead flow | 🔴 DEAD | `provider_applicants` | DEPRECATED |
| GET | `/api/provider-applications/my` | `provider-applications.ts` | Get my dead-path application | 🔴 DEAD | `provider_applicants` (read) | DEPRECATED |
| POST | `/api/provider-applications/my/documents` | `provider-applications.ts` | Upload docs to dead flow | 🔴 DEAD | `provider_applicants` | DEPRECATED |
| POST | `/api/provider-intake/submit` | `routes.ts` line 10508; `provider-intake.ts` line 364 | Google Forms integration submit | 🟡 Partial — separate intake workflow | `provider_intake_queue` | Partial |

---

## Booking Endpoints — The Fragmentation

| Method | Path | Business Purpose | DB Table Written | Status |
|---|---|---|---|---|
| POST | `/api/bookings/create` | Create general booking | `bookings` (Firestore) | ✅ Active |
| GET | `/api/bookings/my-bookings` | **Get customer's bookings** | `bookings` (Firestore) **ONLY** — misses walk/sitter/trainer Postgres tables | 🔴 **CRITICAL BUG** |
| POST | `/api/walk-my-pet/walks/book` | Create walk booking | `walk_bookings` (Postgres, schema.ts line 4677) | ✅ Active silo |
| GET | `/api/walk-my-pet/users/:userId/walks` | Get user's walks | `walk_bookings` (Postgres) | ✅ Active — but separate from /my-bookings |
| POST | `/api/sitter-suite/bookings` | Create sitter booking | `sitter_bookings` (Postgres, schema.ts line 4301) | ✅ Active silo |
| GET | `/api/sitter-suite/bookings` | Get sitter bookings | `sitter_bookings` (Postgres) | ✅ Active — separate from /my-bookings |
| POST | `/api/booking-requests/*` | Pre-booking request/quote flow | `booking_requests` (schema.ts line 10534) | 🟡 Partial — does this produce a confirmed booking? |
| POST | `/api/marketplace-bookings/*` | Marketplace booking | Unknown | 🟡 Needs audit |
| POST | `/api/unified-booking/*` | Unified booking attempt | Unknown | 🟡 Needs audit |
| POST | `/api/platforms/*` | Super-app booking | `octopus_bookings` (schema.ts line 11833) | 🟡 Partial |

---

## Loyalty Endpoints

| Method | Path | Mounted | Business Purpose | Canonical? | DB Tables Written | Status |
|---|---|---|---|---|---|---|
| POST | `/api/privilege/register` | `routes.ts` line 9231 → `privilege-loyalty.ts` line 79 | **Register loyalty member** | ✅ **CANONICAL** (called by `PrivilegeSignup.tsx` line 333) | `loyalty_profiles` or similar | Live |
| GET | `/api/privilege/check/:email` | `privilege-loyalty.ts` line 359 | Check if email already registered | ✅ Active | — (read) | Live |
| POST | `/api/loyalty/auto-enroll` | `routes.ts` line 9491 → `loyalty.ts` line 130 | Auto-enroll user in loyalty | ⚠️ May duplicate `/api/privilege/register` | `loyalty_profiles` | Needs audit |
| GET | `/api/loyalty/profile` | `loyalty.ts` line 65 | Get loyalty profile | ✅ Canonical | — (read) | Live |
| POST | `/api/loyalty/points/add` | `loyalty.ts` line 411 | Admin: add points | ✅ Admin only | `points_transactions` | Live |
| GET | `/api/loyalty/points/history` | `loyalty.ts` line 385 | Get points history | ✅ Active | — (read) | Live |
| POST | `/api/prestige/join` | `routes.ts` line 10092 → `prestige-join.ts` line 60 | Prestige join (separate from privilege) | ⚠️ **Possible duplicate of /api/privilege/register** | Unknown | Needs audit |
| GET | `/api/loyalty/tiers` | Inline `routes.ts` line 789 | Get tier list | ✅ Active but **hardcoded response** | — | Live but brittle |

---

## Payment Endpoints

| Method | Path | Business Purpose | External Service | Status |
|---|---|---|---|---|
| POST | `/api/nayax/payment` | K9000 station payment | Nayax API | ✅ Live |
| POST | `/api/nayax/redeem` | Nayax token redeem | Nayax | ✅ Live |
| POST | `/api/nayax-checkout` | Legacy Nayax checkout | Nayax | ⚠️ Duplicate of `/api/nayax/payment`? |
| POST | `/api/nayax-redeem` | Legacy Nayax redeem | Nayax | ⚠️ Duplicate |
| POST | `/api/k9000/start-session` | Start wash bay session | Nayax | ✅ Live |
| POST | `/api/k9000/end-session` | End wash bay session | Nayax | ✅ Live |
| POST | `/api/checkout` | General checkout (vouchers, packages) | Tranzila / Nayax | ✅ Live |
| POST | `/api/webhooks/nayax` | Nayax webhook receiver | Nayax | ✅ Live |
| POST | `/api/webhooks/sendgrid` | SendGrid event webhook | SendGrid | ✅ Live |
| POST | `/api/tranzila-event-webhooks/*` | Tranzila webhook | Tranzila | ✅ Live |

---

## Notification Endpoints

| Method | Path | Business Purpose | External Service | Status |
|---|---|---|---|---|
| POST | `/api/notifications/*` | Send notifications (email/SMS/push) | SendGrid, Twilio, FCM | ✅ Active |
| POST | `/api/fcm/*` | Push notification dispatch | Firebase FCM | ✅ Active |
| POST | `/api/webhooks/twilio` | SMS delivery status webhook | Twilio | ✅ Active |

---

## Infrastructure / Health

| Method | Path | Business Purpose | Status |
|---|---|---|---|
| GET | `/api/health` | Basic health check | ✅ Live |
| GET | `/api/status` | Platform status (public) | ✅ Live |
| GET | `/api/admin/integration-health` | Admin integration health checks | ✅ Live (PR A) |
| GET | `/api/config/firebase` | Firebase config for client SDK | ✅ Live |
| GET | `/api/config/google-maps` | Maps API key for client | ✅ Live |
| GET | `/api/auth/health` | Auth subsystem health | ✅ Live |

---

## Forms / CRM

| Method | Path | Business Purpose | External Service | Status |
|---|---|---|---|---|
| POST | `/api/global-forms/*` | Global form submissions | Google Sheets, HubSpot | 🟡 Partial |
| POST | `/api/provider-intake/submit` | Provider intake via Google Forms | Google Sheets | 🟡 Partial |
| GET/POST | `/api/enterprise/sales-crm/*` | CRM operations | HubSpot | 🟡 Partial |
| POST | `/api/campaigns/*` | Marketing campaigns | HubSpot | 🟡 Partial |
