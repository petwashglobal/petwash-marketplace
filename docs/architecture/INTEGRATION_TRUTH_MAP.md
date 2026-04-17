# PetWash — Integration Truth Map
> Branch HEAD only. Every secret name verified in `server/index.ts` startup log block.

Legend: ✅ Live  🟡 Partial  ⚠️ Risk  🔴 Dead/Broken

---

## Firebase / Google Auth

| Field | Value |
|---|---|
| **What it powers** | All user authentication (sign-in, sign-up, session cookies, token verification) |
| **Frontend entry** | `SignIn.tsx`, `SignUp.tsx`, Firebase client SDK in `AuthProvider.tsx` |
| **Backend service** | `server/lib/firebase-admin.ts` — `fbAdminAuth`, `firestoreDb` |
| **Required secrets** | `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON, full service account) |
| **Status** | ✅ **Live — platform critical** |
| **Startup visibility** | ✅ Logged at startup: `server/index.ts` line 261 |
| **Admin health check** | ✅ `/api/admin/integration-health` (PR A) |
| **Risk if broken** | 🔴 **Platform-wide auth failure — everything stops** |

---

## Google Service Account JSON (Shared Credential)

| Field | Value |
|---|---|
| **What it powers** | Calendar, Sheets, Wallet, Gmail fallback — **4 integrations share one credential** |
| **Backend service** | `server/services/googleSheetsIntegration.ts`, `server/routes/calendar.ts`, `server/routes/google-wallet.ts`, `server/routes/gmail.ts` |
| **Required secrets** | `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON, service account with scopes for each service) |
| **Status** | ✅ Live — but **single point of credential failure for 4 services** |
| **Startup visibility** | ✅ Validated at startup (PR A) |
| **Admin health check** | ✅ `/api/admin/integration-health` |
| **Risk if broken** | 🔴 Calendar, Sheets logging, Wallet passes, Gmail fallback all fail simultaneously |
| **⚠️ Scope risk** | Service account must have Calendar API, Sheets API, Wallet API, and Gmail API all enabled. If any scope is removed, that feature silently fails. |

---

## Google Calendar

| Field | Value |
|---|---|
| **What it powers** | Provider booking calendar sync, customer reminder creation |
| **Frontend entry** | Booking confirmation flow |
| **Backend service** | `server/routes/calendar.ts` |
| **Required secrets** | `GOOGLE_SERVICE_ACCOUNT_JSON` (calendar scope) |
| **Status** | 🟡 **Partial — async job wiring fixed in PR A** |
| **Risk if broken** | Calendar events not created; no customer/provider reminders |

---

## Google Maps

| Field | Value |
|---|---|
| **What it powers** | Location search, provider search by area, walk GPS display, station finder |
| **Frontend entry** | `BookingSearchPage`, `ProviderSearchPage`, `WalkTracking`, `Stations` |
| **Backend service** | `server/routes/google-services.ts`; key served via `GET /api/config/google-maps` |
| **Required secrets** | `GOOGLE_MAPS_API_KEY` |
| **Status** | ✅ Live |
| **Startup visibility** | ✅ `server/index.ts` line 263 |
| **Risk if broken** | Location features, provider discovery, walk tracking maps fail |

---

## Google Sheets

| Field | Value |
|---|---|
| **What it powers** | Registration logging, provider application logging, operational logs |
| **Backend service** | `server/services/googleSheetsIntegration.ts` — called fire-and-forget in `POST /api/auth/session` |
| **Required secrets** | `GOOGLE_SERVICE_ACCOUNT_JSON` (sheets scope) |
| **Status** | 🟡 **Partial — non-blocking, failures logged but silent** |
| **Risk if broken** | Operations team loses real-time registration feed and provider application audit trail |

---

## Google Wallet

| Field | Value |
|---|---|
| **What it powers** | Loyalty member digital pass/card issuance |
| **Backend service** | `server/routes/google-wallet.ts` |
| **Required secrets** | `GOOGLE_SERVICE_ACCOUNT_JSON` (wallet scope) |
| **Status** | 🟡 **Partial — endpoint exists, end-to-end issuance not fully verified** |
| **Risk if broken** | Loyalty members cannot receive digital pass |

---

## Gmail Fallback

| Field | Value |
|---|---|
| **What it powers** | Secondary email sending path when SendGrid fails |
| **Backend service** | `server/routes/gmail.ts` (mounted `routes.ts` line 41 import) |
| **Required secrets** | `GOOGLE_SERVICE_ACCOUNT_JSON` (Gmail scope via domain-wide delegation) |
| **Status** | 🟡 **Partial — wired but fallback logic not consistently enforced** |
| **⚠️ Risk** | If SendGrid fails AND Gmail fallback is not checked with idempotency key, users may receive double emails when both fire, or none if Gmail scope is missing |

---

## Gemini AI

| Field | Value |
|---|---|
| **What it powers** | KYC anomaly detection, AI insights, rewards messaging, watchdog |
| **Backend service** | `server/routes/ai-insights.ts`, `server/services/KYC2026.ts`, `server/routes/gemini-watchdog.ts` |
| **Required secrets** | `GEMINI_API_KEY` |
| **Status** | ⚠️ **RISK — `server/index.ts` lines 5-6 DELETE `GEMINI_API_KEY` if `GOOGLE_API_KEY` is also set** |
| **Startup visibility** | ❌ Not checked at startup |
| **Fix required** | Remove the key deletion at `server/index.ts` lines 5-6; log Gemini key presence at startup |
| **Risk if broken** | KYC AI analysis fails silently; AI reward messages return empty; watchdog disabled |

---

## SendGrid

| Field | Value |
|---|---|
| **What it powers** | All transactional email — booking confirmations, provider notifications, loyalty welcome, password reset |
| **Backend service** | `server/lib/sendgrid.ts` — `isSendGridConfigured()` check before sends |
| **Required secrets** | `SENDGRID_API_KEY` |
| **Status** | ✅ **Live — primary email path** |
| **Startup visibility** | ✅ `server/index.ts` line 67 |
| **Webhook** | `POST /api/webhooks/sendgrid` — delivery status events |
| **Risk if broken** | No transactional email; booking confirmations, KYC results, loyalty onboarding emails silent |

---

## Twilio SMS

| Field | Value |
|---|---|
| **What it powers** | SMS notifications, OTPs, booking reminders |
| **Backend service** | `server/services/TwilioSMSService.ts` |
| **Required secrets** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and EITHER `TWILIO_PHONE_NUMBER` OR `TWILIO_MESSAGING_SERVICE_SID` |
| **Status** | ✅ **Live** |
| **Startup visibility** | ✅ Checked + fatal if neither phone number nor service SID set (`server/index.ts` lines 136-143) |
| **Webhook** | `POST /api/webhooks/twilio` — SMS delivery status |
| **Risk if broken** | No SMS — OTPs fail, booking reminders not sent |

---

## Firebase Cloud Messaging (FCM)

| Field | Value |
|---|---|
| **What it powers** | Mobile push notifications |
| **Backend service** | `server/routes/fcm.ts` |
| **Required secrets** | `FIREBASE_SERVICE_ACCOUNT_KEY` (reuses Firebase credential) |
| **Status** | ✅ Live |
| **Risk if broken** | No push notifications on mobile |

---

## Nayax

| Field | Value |
|---|---|
| **What it powers** | K9000 wash station payments — card tap, NFC, app pay |
| **Backend service** | `server/routes/nayax-payments.ts`, `server/routes/nayax-monyx-events.ts` |
| **Required secrets** | Nayax API credentials (terminal IDs, API keys) |
| **Status** | ✅ **Live — revenue critical for K9000** |
| **Webhook** | `POST /api/webhooks/nayax`, `POST /api/nayax-webhook` |
| **⚠️ Duplicate webhook**: Both `/api/webhooks/nayax` and `/api/nayax-webhook` exist — verify both are active or deprecate one |
| **Risk if broken** | K9000 station payments fail — core physical business revenue stops |

---

## Tranzila

| Field | Value |
|---|---|
| **What it powers** | Alternative payment gateway (Israeli market) |
| **Backend service** | `server/routes/tranzila-webhooks.ts`, `server/routes/tranzila-event-webhooks.ts` |
| **Required secrets** | Tranzila terminal credentials |
| **Status** | ✅ Live |
| **Startup guard** | `TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true` forbidden in production (`server/index.ts` lines 219-234) |
| **Risk if broken** | Payment fallback broken; some checkout flows fail |

---

## DocuSeal (e-Signatures)

| Field | Value |
|---|---|
| **What it powers** | Provider agreement e-signatures, contractor compliance documents |
| **Backend service** | `server/routes/esign.ts`, `server/routes/israeli-2025-esign.ts` |
| **Required secrets** | DocuSeal API key |
| **Status** | 🟡 **Partial — referenced in provider onboarding flow** |
| **Risk if broken** | Provider agreements cannot be signed digitally; manual process required |

---

## HubSpot CRM

| Field | Value |
|---|---|
| **What it powers** | New user sync, marketing contacts, deal pipeline, campaign tracking |
| **Backend service** | `server/hubspot.ts` — called fire-and-forget in `POST /api/auth/session` for new users |
| **Required secrets** | HubSpot API key / private app token |
| **Status** | 🟡 **Partial — non-blocking, failures logged** |
| **Risk if broken** | Marketing team loses new user data; CRM pipeline incomplete |

---

## WhatsApp

| Field | Value |
|---|---|
| **What it powers** | Customer messaging, provider communications |
| **Backend service** | `server/routes/messages.ts` |
| **Required secrets** | WhatsApp Business API credentials |
| **Status** | 🟡 **Partial — endpoint exists** |
| **Risk if broken** | WhatsApp communications unavailable |

---

## reCAPTCHA

| Field | Value |
|---|---|
| **What it powers** | Bot protection on email/password sign-in |
| **Backend service** | `server/routes/recaptcha.ts`, inline in `POST /api/auth/session` |
| **Required secrets** | `RECAPTCHA_SITE_KEY` (backend), `VITE_RECAPTCHA_SITE_KEY` (frontend) |
| **Status** | ✅ Live — with Turnstile fallback |
| **⚠️ Note** | Key mismatch check at startup (`server/index.ts` lines 196-213) |

---

## Weather

| Field | Value |
|---|---|
| **What it powers** | Walk/outdoor service weather advisory |
| **Backend service** | `server/routes/weather.ts` |
| **Required secrets** | Weather API key |
| **Status** | 🟡 **Partial — advisory only vs enforced policy unclear** |
| **Risk if broken** | No weather warnings for walk/outdoor service bookings |
