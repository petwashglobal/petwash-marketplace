# Pet Wash Marketplace — Architecture Audit 2025

> **Scope**: Full-stack integration audit across auth, booking, Google services, weather ops, loyalty, provider systems, marketing, dead code, and duplicate systems.
> **Method**: Evidence-based static analysis with file:line citations.
> **This document is the authoritative record of what is live, partial, dead, or duplicated.**

---

## What PetWash Is Trying to Achieve

**Business mission**: Build Israel's leading multi-sided pet services marketplace — connecting pet owners with groomers, walkers, sitters, and trainers — while operating a network of physical K9000 self-wash stations.

**User groups**:
- **Pet owners**: Book grooming, walking, sitting, training, and physical station washes.
- **Service providers**: Groomers, dog walkers, pet sitters, trainers — apply, get vetted (KYC), and get bookings and payouts.
- **Franchise / enterprise operators**: License the PetWash brand and operate K9000 stations.
- **Admins**: Manage all of the above through an ops dashboard.

**Revenue model**: Commission per booking, loyalty membership fees, K9000 station revenue, franchise fees, and potentially gift cards.

**Key architectural challenge**: Too many partial implementations, duplicate paths, and competing systems. Features are present in code, secrets, and UI but not all are wired end-to-end. This creates a platform that feels random to users and operators.

---

## TABLE 1: System Integration Matrix

| # | Feature | Entry Point | Frontend Component | Backend Route | External Service | Env Var Required | DB Tables | Status | Canonical/Legacy | Missing Wiring | Risk if Broken |
|---|---------|-------------|-------------------|---------------|-----------------|-----------------|-----------|--------|-----------------|---------------|----------------|
| 1 | Google OAuth (Firebase) | Sign In page | `SignIn.tsx:2` | Firebase SDK | Firebase Auth | `VITE_FIREBASE_*` (7 vars) | `users` | **Live** | Canonical | None | Auth completely fails |
| 2 | Google One Tap | Auto-prompt | `GoogleOneTap.tsx:32` | Firebase token verify | Google Identity Services | `VITE_GOOGLE_CLIENT_ID` | `users` | **Live** | Canonical | None | One-tap disabled, falls back to button |
| 3 | Apple OAuth | Sign In page | `SignIn.tsx:2` via `iosAuthHandler.ts:122` | Firebase SDK | Apple ID | `VITE_FIREBASE_*` | `users` | **Live** | Canonical | None | Apple users cannot sign in |
| 4 | Facebook OAuth | Sign In page | `SignIn.tsx:2` via `iosAuthHandler.ts:134` | Firebase SDK | Facebook Login | `VITE_FIREBASE_*` | `users` | **Live** | Canonical | None | Facebook users cannot sign in |
| 5 | Phone/SMS Auth | Sign In page | `SignIn.tsx:109` | `server/routes/publicAuthRoutes.ts` | Twilio SMS | `TWILIO_*` | `users`, OTP table | **Live** | Canonical | None | Phone users locked out |
| 6 | Passkey / WebAuthn | Sign In page | `SignIn.tsx:25`, `webauthn.ts:58` | `webauthn.ts:57` | Browser WebAuthn API | `VITE_WEBAUTHN_RP_ID` | `webauthnCredentials` | **Live** | Canonical | None | Passkey users cannot auth |
| 7 | Account Linking | OAuth collision | `SignIn.tsx:1565–1586` | Firebase `linkWithCredential` | Firebase Auth | — | `users` | **Live** | Canonical | None | Duplicate accounts created |
| 8 | OAuth Consent Audit | Post-OAuth | `SignIn.tsx:1047–1073` | `routes.ts:1362` POST `/api/consent/oauth` | — | — | `oauthConsents` | **Live** | Canonical | None | GDPR compliance gap |
| 9 | **Booking — Primary** | Multi-pet wizard | `MultiPetBookingWizard.tsx:33` | `bookings.ts:40` POST `/api/bookings/create` | — | `DATABASE_URL` | `bookings`, `bookingPets`, `bookingStatusHistory` | **Live** | **Canonical** | — | Users cannot book services |
| 10 | **Booking — Requests** | Marketplace flow | `MarketplaceBookingFlow.tsx` | `booking-requests.ts:94` POST `/api/booking-requests` | — | `DATABASE_URL` | `bookingRequests` | **Live** | Canonical (marketplace) | — | Marketplace bookings fail |
| 11 | **Booking — Marketplace Create** | Marketplace page | `MarketplaceBookingFlow.tsx` | `marketplace-bookings.ts:177` POST `/api/marketplace-bookings/create` | — | `DATABASE_URL` | `bookings` | **Live** | ⚠️ Duplicate of #9 | Unclear which to deprecate | Booking source confusion |
| 12 | **Booking — Super App** | Platform pages | Platform-specific pages | `super-app-bookings.ts:85` POST `/api/platforms/:platformId/bookings` | — | `DATABASE_URL` | `bookings` | **Live** | ⚠️ Duplicate of #9 | — | Platform bookings silently fail |
| 13 | **Booking — Walk My Pet** | Walk booking page | `walk-my-pet/BookingFlow.tsx` | `walk-my-pet.ts:448` | — | `DATABASE_URL` | `walkBookings` **(separate table!)** | **Live** | Canonical (walks) | Different table from main bookings | Walk data siloed from reports |
| 14 | **Booking — Academy** | Academy booking | `academy/BookingFlow.tsx` | `academy.ts:197` POST `/api/academy/bookings` | — | `DATABASE_URL` | `bookings` | **Live** | Canonical (academy) | — | Academy bookings fail |
| 15 | **Booking — Octopus V1** | None | None | `octopus-engine.ts:76` intercepted → 410 Gone | — | — | — | **Dead** | Legacy (410 blocked) | Properly blocked | None |
| 16 | **Google Calendar** | Post-booking confirm | `BookingGoogleHub.tsx` | `calendar.ts:17` POST `/api/calendar/add-booking`; `CalendarIntegrationService.ts:106` | Google Calendar API v3 | `GOOGLE_SERVICE_ACCOUNT_JSON` or Replit connector | External | **Live** | Canonical | Async job CREATE_CALENDAR_EVENT was a no-op (now fixed) | Calendar events not created |
| 17 | **Google Maps** | Address input, provider search | Address components | `google-services.ts:269,378,527,612`; `MapsService.ts:32` | Google Maps Platform | `GOOGLE_MAPS_API_KEY` | — | **Live** | Canonical | None | Address lookup fails |
| 18 | **Google Sheets** | Post-booking, post-form | Server-side only | `googleSheetsIntegration.ts:322`; 28 sheet tabs (`lines:15–51`) | Google Sheets API | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_FORMS_SPREADSHEET_ID` | External | **Live** | Canonical | — | Form data not logged |
| 19 | **Google Forms Config** | Admin panel | Admin components | `google-forms.ts:19–179` | Google Forms | `GOOGLE_SERVICE_ACCOUNT_JSON` | `googleFormsConfig` | **Live** | Canonical | — | Form URLs not configurable |
| 20 | **Gmail API (email fallback)** | Email send failure | — | `gmail.ts:54–76`; `emailService.ts:93` | Gmail API v1 | Replit connector or service account | — | **Live** | Fallback (behind SendGrid) | Replit connector dependency | Email delivery degraded |
| 21 | **SendGrid (primary email)** | All transactional emails | — | `emailService.ts:62`; `lib/sendgrid.ts:20` | SendGrid | `SENDGRID_API_KEY` | — | **Live** | **Canonical** (primary) | — | All emails fail; Gmail fallback activates |
| 22 | **Gemini AI** | Chat, weather advice, admin | AI chat components | `gemini.ts:16`; `booking-chat.ts:22`; `weather.ts:999`; `avatars.ts:13` | Google Gemini (Vertex AI) | `GEMINI_API_KEY` or `AI_INTEGRATIONS_GEMINI_API_KEY` | — | **Live** | Canonical | — | AI chat/advisor non-functional |
| 23 | **Google Wallet** | Loyalty card save | Loyalty page components | `google-wallet.ts:36–234` | Google Wallet API | `GOOGLE_SERVICE_ACCOUNT_JSON` | External | **Live** | Canonical | — | Digital passes not issuable |
| 24 | **Apple Wallet / PKPASS** | Loyalty card save | — | `appleWallet.ts`; `pass-universal.ts` | Apple Wallet | APNs certificates | — | **Partial** | Canonical | APNs push has TODO at `appleWallet.ts:553` | Pass updates not pushed |
| 25 | **reCAPTCHA Enterprise** | Auth forms, high-risk actions | `ReCaptcha.tsx:66` | `captcha-probe.ts:315`; `verifyCaptcha.ts:53` | Google reCAPTCHA Enterprise | `RECAPTCHA_SECRET_KEY`, `VITE_RECAPTCHA_SITE_KEY` | — | **Live** | Canonical | — | Bot protection fails |
| 26 | **Cloudflare Turnstile** | Alternative CAPTCHA | `TurnstileWidget.tsx:22` | Server verification | Cloudflare | `VITE_TURNSTILE_SITE_KEY` | — | **Live** | Alternative to #25 | — | CAPTCHA fallback lost |
| 27 | **Weather — Multi-source** | Booking advisory, planner | `BookingWeatherAlert.tsx:43` | `weather.ts:912` GET `/api/weather/booking-check`; `MultiSourceWeatherService.ts:231` | Open-Meteo (primary), OpenWeatherMap, WeatherAPI | `OPENWEATHER_API_KEY`, `WEATHERAPI_KEY` (optional) | `walkHealthData` (historical) | **Live** | Canonical | ⚠️ Advisory only — never blocks bookings (`canProceed` always `true` at `weather.ts:1041`) | Stale/missing weather advice |
| 28 | **Weather — Google Weather** | — | — | `unifiedLocationWeather.ts:9` | Google Weather API | `GOOGLE_WEATHER_API_KEY` | — | **Dead** | Placeholder | Key referenced, never called | None |
| 29 | **Weather Notifications** | Background job | — | `weatherNotifications.ts:164–219` | Twilio/FCM | `TWILIO_*` | `notificationHistory` | **Partial** | Canonical | `sendWeatherNotification()` has TODO stubs at lines 177–193 | Weather alerts not delivered |
| 30 | **Loyalty / Privilege** | Privilege signup page | `PrivilegeSignup.tsx:115` | `privilege-loyalty.ts:79` POST `/api/privilege-loyalty/register` | Firebase Auth (same scopes) | `DATABASE_URL` | `privilege_members` | **Live** | Canonical | — | Loyalty enrollment fails |
| 31 | **Loyalty Auto-Enroll** | Post-OAuth sign-in | `SignIn.tsx:1024–1044` | `loyalty.ts` POST `/api/loyalty/auto-enroll` | — | — | loyalty tables | **Live** | Canonical | — | New users miss loyalty |
| 32 | **Provider Onboarding** | `/provider-onboarding` page | `ProviderOnboarding.tsx:440` | `provider-onboarding.ts:400` POST `/api/provider-onboarding/apply` | KYC, Google Sheets | `DATABASE_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON` | `providerApplications` (main schema) | **Live** | **Canonical** | — | Providers cannot apply via this path |
| 33 | **Provider Applications (dup)** | `/become-provider` page | `BecomeProvider.tsx:232` | `provider-applications.ts:214` POST `/api/provider-applications` | Google Sheets, Twilio | `DATABASE_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON` | `providerApplicants` (enterprise schema) | **Live** | ⚠️ Duplicate of #32 | Different table AND different schema from #32 | Confusion; data split across two tables |
| 34 | **Provider Payout** | Post-booking completion | — | `ProviderPayoutService.ts:3`; `payoutLedger.ts:310` | Israeli bank transfers (NO Stripe) | `DATABASE_URL` | payout/earnings tables | **Live** | Canonical | — | Providers not paid |
| 35 | **Nayax Payments** | K9000 wash stations, marketplace | Payment modals | `nayax-payments.ts`; `NayaxOnlinePaymentService.ts:84` | Nayax | `NAYAX_API_KEY`, `NAYAX_MERCHANT_ID` | payment tables | **Live** | Canonical | — | Payments fail |
| 36 | **Tranzila Payments** | Gift cards, e-commerce | Payment modals | `TranzilaService.ts:67`; `tranzila-webhooks.ts` | Tranzila | `TRANZILA_API_KEY`, `TRANZILA_WEBHOOK_SECRET` | payment tables | **Partial** | Canonical (secondary) | 7 feature flags all default `false` (`payment-flags.ts:71–121`) | Features mostly disabled |
| 37 | **HubSpot CRM** | Registration, loyalty join | — | `hubspot.ts`; `complete-registration.ts:135`; `privilege-loyalty.ts:216` | HubSpot | `HUBSPOT_ACCESS_TOKEN` | External | **Live** | Canonical | — | CRM sync breaks; leads lost |
| 38 | **Google Analytics 4** | All pages | `client/index.html:220–241`; `lib/analytics.ts` | — | GA4 | Hardcoded `G-B30RXHEX6R` | — | **Live** | Canonical | — | Analytics dark |
| 39 | **Marketing Pixels** | Consent-gated | `marketing-pixels.ts` | — | GTM, Facebook, TikTok, MS Clarity | IDs must be configured at runtime | — | **Partial** | Canonical | Pixel IDs not hardcoded | Tracking incomplete |
| 40 | **Sentry** | All pages | `lib/sentry.ts`; `App.tsx` | — | Sentry | `VITE_SENTRY_DSN`, `VITE_APP_VERSION` | — | **Live** | Canonical | — | Error monitoring blind |
| 41 | **Tawk.to Live Chat** | All pages | `LiveChatWidget.tsx:26` | — | Tawk.to | `VITE_TAWK_PROPERTY_ID`, `VITE_TAWK_WIDGET_ID` | — | **Live** | Canonical | — | Live chat widget gone |
| 42 | **Twilio SMS** | OTP, notifications | — | `TwilioSMSService.ts:99`; `RegistrationOTPService.ts:403` | Twilio | `TWILIO_*` | — | **Live** | Canonical | — | OTP/SMS fail |
| 43 | **Google Messaging (alt SMS)** | Background jobs | — | `GoogleMessagingService.ts:124`; `backgroundJobs.ts:555` | Google Cloud Messaging | `GOOGLE_SERVICE_ACCOUNT_JSON` | — | **Live** | ⚠️ Duplicate of #42 | Overlaps Twilio; no documented priority | Double-send possible |
| 44 | **FCM Push Notifications** | Token registration | Push components | `FCMService.ts:24`; `fcm.ts:17` | Firebase Cloud Messaging | `FIREBASE_SERVICE_ACCOUNT_KEY`, `VITE_FIREBASE_VAPID_KEY` | `fcmTokens` | **Live** | Canonical | — | Push notifications fail |
| 45 | **Push Notifications (alt route)** | Admin broadcast | — | `push-notifications.ts:75` POST `/api/push-notifications/send` | FCM (same as #44) | same | — | **Live** | ⚠️ Duplicate of #44 | Separate route duplicating FCMService | — |
| 46 | **Dialogflow CX** | AI Chat | Chat components | `AiChatService.ts:9` | Google Dialogflow CX | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_AGENT_ID`, `GOOGLE_AGENT_LOCATION` | — | **Live** | Canonical | — | AI chat non-functional |
| 47 | **Google Cloud Translation** | Multi-language | — | `TranslationService.ts:1` | Google Translate API v2 | `GOOGLE_SERVICE_ACCOUNT_JSON` | — | **Live** | Canonical | — | UI stuck in one language |
| 48 | **Google Cloud Storage** | Documents/backup | — | `gcsBackupService.ts:6`; `biometricStorage.ts:11` | Google Cloud Storage | `GOOGLE_SERVICE_ACCOUNT_JSON` | — | **Live** | Canonical | — | Uploads/backups fail |
| 49 | **DocuSeal (E-Signatures)** | Contracts | — | `contracts.ts:222`; `esign.ts:36` | DocuSeal | `DOCUSEAL_API_KEY` | contracts tables | **Live** | Canonical | — | E-signature flow broken |
| 50 | **Spotify** | Ambiance music | — | `spotify.ts:15` | Spotify via Replit connector | `REPLIT_CONNECTORS_HOSTNAME` | — | **Dead** | Legacy | Hard Replit dependency; no client component calls it | None (nice-to-have) |
| 51 | **Israeli Tax (Rasa)** | Invoice generation | — | `israeliTax.ts:21` | Rasa tax API | `RASA_API_ENDPOINT`, `RASA_SUPPLIER_API_KEY`, `VAT_RATE` | — | **Partial** | Canonical | Credentials unverified | Tax invoices not generated |
| 52 | **Mizrahi Bank** | Bank reconciliation | — | `mizrahiBank.ts:13` | Bank aggregator API | `BANK_AGGREGATOR_URL`, `BANK_AGGREGATOR_SECRET_KEY`, `MIZRAHI_ACCOUNT_ID` | — | **Partial** | Canonical | Credentials unverified | Bank reconciliation silent fail |
| 53 | **WhatsApp Business** | Webhooks | — | `enterprise/routes.ts:61` | Meta WhatsApp Business | `META_WEBHOOK_SECRET` | — | **Partial** | Canonical | Graceful fallback if no secret | WhatsApp integration down |
| 54 | **Newsletter Signup** | Footer/CTA | Newsletter form | `globalForms.ts:107` POST `/api/forms/newsletter` | Google Sheets | `GOOGLE_SERVICE_ACCOUNT_JSON` | External | **Live** | Canonical | — | Signups lost |
| 55 | **Contact Form** | Contact page | Contact form | `globalForms.ts:23` POST `/api/forms/contact` | Sheets + SendGrid | `GOOGLE_SERVICE_ACCOUNT_JSON`, `SENDGRID_API_KEY` | External | **Live** | Canonical | — | Inquiries lost |
| 56 | **Sales Lead Form** | B2B page | Lead form | `globalForms.ts:325` POST `/api/forms/sales-lead` | Sheets + SendGrid | same | External | **Live** | Canonical | — | Sales leads lost |
| 57 | **Franchise Inquiry** | Franchise page | Franchise form | `globalForms.ts:138` POST `/api/forms/franchise-inquiry` | Sheets + SendGrid | same | External | **Live** | Canonical | — | Franchise leads lost |
| 58 | **CRM Database** | Internal | — | `enterprise-sales-crm.ts` | — | `DATABASE_URL` | `crmLeads`, `crmCommunications`, `crmOpportunities`, `crmTasks`, `crmActivities` | **Live** | Canonical | — | Internal CRM fails |
| 59 | **PromoAd Popup** | Homepage auto-trigger | `PromoAdPopup.tsx` (App.tsx:38) | — | — | — | — | **Live** | Canonical | — | Promo not shown |
| 60 | **Redis Cache** | Session/rate limiting | — | `services/redis.ts` | Redis | `REDIS_URL` | — | **Partial** | Optional | Graceful fallback to in-memory | Performance degraded |
| 61 | **Social OAuth (TikTok/Instagram)** | Social linking | Social profile components | `social-oauth.ts:79,93` | TikTok/Instagram APIs | OAuth keys | — | **Live** | Canonical | — | Social linking fails |
| 62 | **Legacy Auth (register/login)** | None | None | `auth.ts:76,87` returns `ENDPOINT_DEPRECATED` | — | — | — | **Dead** | Legacy | Returns deprecated; still mounted | None |
| 63 | **Gmail OAuth Button** | Admin/premium feature | `GmailOAuthButton.tsx:37` | `gmail.ts` | Gmail API | Replit connector | — | **Live** | Canonical | Requests 4 Gmail scopes (readonly, send, compose, modify) — separate from user auth | Gmail features non-functional |
| 64 | **Google Business Profile** | Admin | — | `google-services.ts:25–29` | Google Business Profile API | `GOOGLE_BUSINESS_CLIENT_ID`, `_SECRET`, `_REFRESH_TOKEN`, `_ACCOUNT_ID` | — | **Partial** | Canonical | Config defined; usage unclear | Business profile sync fails |

---

## TABLE 2: Risk Matrix

| # | Feature | Risk Level | Root Cause | Recommended Action |
|---|---------|-----------|------------|-------------------|
| 1 | **8 duplicate booking endpoints** | 🔴 HIGH | Creation spread across `bookings.ts:40`, `booking-requests.ts:94`, `marketplace-bookings.ts:177`, `super-app-bookings.ts:85`, `academy.ts:197`, `walk-my-pet.ts:448`, `unified-booking.ts:90`, `octopus-engine.ts:76` (dead). Walk bookings use separate `walkBookings` table. | Consolidate to 3 canonical paths: (a) main booking, (b) walk, (c) academy. Migrate `walkBookings` to main `bookings` table with `serviceType='walk'` discriminator. |
| 2 | **Duplicate provider onboarding** | 🔴 HIGH | Two active submit endpoints with different schemas AND different DB tables: `/api/provider-onboarding/apply` (canonical, `providerApplications`) from `ProviderOnboarding.tsx` AND `/api/provider-applications` (duplicate, `providerApplicants`) from `BecomeProvider.tsx`. `/become-provider` route IS active in App.tsx. | Decide which table is the source of truth, migrate data, and deprecate the losing endpoint. Redirect BecomeProvider.tsx to canonical flow. |
| 3 | **Single Google service-account dependency (10 services)** | 🔴 HIGH | `GOOGLE_SERVICE_ACCOUNT_JSON` powers Calendar, Sheets, Gmail, Wallet, Cloud Storage, Translation, Dialogflow, Vision, Cloud Messaging, Business Profile. No startup validation existed until this PR. | Added to startup validation. Consider splitting into per-service credentials over time. Add `/api/admin/integration-health` endpoint (added in this PR). |
| 4 | **Triple email cascade, no idempotency** | 🔴 HIGH | SendGrid primary → Gmail inline fallback (`emailService.ts:93`) → Gmail async worker (`AsyncJobWorker.ts:162`). No idempotency key between inline and async. | Add idempotency token in `AsyncJobWorker.ts` `SEND_GMAIL_FALLBACK` handler, or remove the async fallback (the inline fallback is sufficient). |
| 5 | **CREATE_CALENDAR_EVENT was a no-op** | 🔴 HIGH | `AsyncJobWorker.ts:155–159` logged "not yet implemented" and returned true — calendar events from the async job queue were silently never created. | **Fixed in this PR**: wired to `CalendarIntegrationService.createBookingEvent()`. |
| 6 | **Dual SMS providers, no priority** | 🟡 MEDIUM | `TwilioSMSService.ts:99` and `GoogleMessagingService.ts:124` both send SMS from different background jobs. No documented routing rule. | Declare Twilio as primary. Gate `GoogleMessagingService` behind feature flag. |
| 7 | **Duplicate push notification dispatch** | 🟡 MEDIUM | `FCMService.ts:24` and `push-notifications.ts:75` both dispatch to FCM independently. | Consolidate: `push-notifications.ts` route should delegate entirely to `FCMService`. |
| 8 | **Weather advisory-only — no blocking** | 🟡 MEDIUM | `weather.ts:1041` always returns `canProceed: true`. Thunderstorm message says "Providers may cancel" but no enforcement. Notification stubs at `weatherNotifications.ts:177–193` are TODO. | Implement configurable weather-block threshold for outdoor services. Complete notification stubs. |
| 9 | **96% of DB tables have zero INSERTs** | 🟡 MEDIUM | 413 of 430 tables in `shared/schema.ts` have no INSERT statements anywhere in server code. Schema massively over-provisioned. | Audit which tables are needed. Remove dead tables to reduce migration complexity. |
| 10 | **Walk bookings in separate table** | 🟡 MEDIUM | `walk-my-pet.ts:448` inserts into `walkBookings` instead of main `bookings`. Walk data siloed from main reporting and dashboards. | Migrate to unified `bookings` table with `serviceType='walk'` discriminator. |
| 11 | **Enterprise credentials unverified at startup** | 🟡 MEDIUM | Israeli Tax (`israeliTax.ts:21`), Mizrahi Bank (`mizrahiBank.ts:13`), WhatsApp (`enterprise/routes.ts:61`) all mounted but no startup health check confirms credentials. | Now visible via `/api/admin/integration-health` (added in this PR). Add startup warnings for enterprise services. |
| 12 | **Dual payment processors, no routing docs** | 🟡 MEDIUM | `PaymentGatewayService.ts:19–22` imports both Nayax and Tranzila. No documented rule for which handles which flow. | Document: Nayax for physical terminals + core online; Tranzila for secondary features. |
| 13 | **Tranzila mostly disabled** | 🟢 LOW | 7 feature flags in `payment-flags.ts:71–121` all default `false`. Code exists but is gated off. | Enable needed flags or remove dead code. |
| 14 | **Apple Wallet push not implemented** | 🟢 LOW | `appleWallet.ts:553` has TODO: implement APNs push. Passes created but never updated. | Implement APNs or document limitation to users. |
| 15 | **Spotify integration dead** | 🟢 LOW | `spotify.ts:15` requires `REPLIT_CONNECTORS_HOSTNAME`. No client component calls it. | Remove file. |
| 16 | **Legacy auth routes still mounted** | 🟢 LOW | `auth.ts:76,87` return `ENDPOINT_DEPRECATED` but still registered. Unnecessary attack surface. | Remove routes entirely or return 404. |
| 17 | **Marketing pixels need runtime config** | 🟢 LOW | GTM, Facebook Pixel, TikTok Pixel, MS Clarity IDs not hardcoded — must be injected at runtime. | Verify all pixel IDs are present in production env config. |
| 18 | **PremiumGoogleOAuthConsent unused** | 🟢 LOW | `PremiumGoogleOAuthConsent.tsx:49–53` shows calendar permission text but **not used in any active flow**. Source of the confusing "Google consent appearing during loyalty" reports. Loyalty uses same standard Firebase scopes (profile + email only). | Remove component or add comment clarifying it is unused. |
| 19 | **Google Weather API placeholder** | 🟢 LOW | `unifiedLocationWeather.ts:9` references `GOOGLE_WEATHER_API_KEY` but actual weather uses Open-Meteo/OpenWeatherMap/WeatherAPI. | Remove placeholder reference or implement. |
| 20 | **In-memory email rate limiter** | 🟢 LOW | `emailService.ts:25` uses in-memory limiter with TODO to move to Redis. Resets on restart. | Migrate to Redis when `REDIS_URL` available. |
| 21 | **CRM communication logging schema mismatch** | 🟢 LOW | `emailService.ts:1568,1979,2540` all have TODO: "Log to CRM communication logs (schema mismatch)" — 3 occurrences. | Fix schema mismatch and enable CRM logging. |
| 22 | **Gemini AI compliance pre-screening disabled** | 🟢 LOW | `compliance.ts:701` has TODO: "Integrate with Gemini AI for auto pre-screening". | Implement or remove TODO. |

---

## Key Answers

### Is booking truly connected to Google Calendar?
**Yes, but conditionally — and the async path was broken until this PR.**

The inline path (`CalendarIntegrationService.ts:106`) creates calendar events post-booking-confirmation when the Replit connector or service account is available. The async job queue path (`AsyncJobWorker.ts`) had a `CREATE_CALENDAR_EVENT` case that was a **no-op** ("not yet implemented") — **fixed in this PR** to call `CalendarIntegrationService.createBookingEvent()`.

### Why does Google consent appear during loyalty signup?
**The component causing confusion is orphaned, not active.**

`PremiumGoogleOAuthConsent.tsx` shows calendar permission text but is **not mounted in any active flow**. Loyalty signup (`PrivilegeSignup.tsx:115`) uses exactly the same Firebase scopes as regular sign-in (`profile` + `email` only). The Google consent dialog is the standard Google sign-in popup — no extra scopes are requested.

### Is weather truly blocking bookings?
**No. Weather is advisory-only.**

`weather.ts:1041` always returns `canProceed: true`. No booking is ever rejected due to weather. Weather notifications also have incomplete TODO stubs at `weatherNotifications.ts:177–193`.

### Are Google Maps wired?
**Yes, fully.** `MapsService.ts:32` and `google-services.ts` provide geocoding, directions, and place lookup. Requires `GOOGLE_MAPS_API_KEY`.

### Is Google Sheets wired?
**Yes, fully.** `googleSheetsIntegration.ts:322` writes to 28 defined sheet tabs for all forms and booking logs. Requires `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_FORMS_SPREADSHEET_ID`.

### Is there Stripe?
**No — explicit mandate.** `ProviderPayoutService.ts:3` uses Israeli bank transfers only. Payments are Nayax (physical + online) and Tranzila (secondary, mostly feature-flagged off).

---

## The Single Most Critical Structural Risk

The repo has **16 active Google services** with 10 of them sharing one secret: `GOOGLE_SERVICE_ACCOUNT_JSON`. Calendar, Sheets, Gmail, Wallet, Cloud Storage, Translation, Dialogflow, Vision, Cloud Messaging, and Business Profile all depend on it. If this one secret is misconfigured or rotated without update, approximately half the product goes dark simultaneously. There was no startup health check for it before this PR. The new `/api/admin/integration-health` endpoint now surfaces this risk at runtime.

---

## Consolidation Priority Queue

### Phase 1 — Architecture Stabilization (do first)
1. **Deprecate duplicate provider submit path** — decide between `providerApplications` (main schema) and `providerApplicants` (enterprise schema); migrate data; deprecate losing endpoint
2. **Decide canonical booking architecture** — 3 paths: main, walk (migrate to main table), academy
3. **Fix email triple-cascade** — add idempotency key or remove async SEND_GMAIL_FALLBACK
4. **Define one SMS priority** — Twilio primary, Google Messaging gated by feature flag
5. **Consolidate push dispatch** — `push-notifications.ts` should delegate to `FCMService`

### Phase 2 — Loyalty Cleanup
6. Loyalty price source of truth
7. Loyalty card asset source of truth
8. Loyalty popup and consent flow cleanup
9. Loyalty wallet and pass verification

### Phase 3 — Business Logic
10. Weather enforcement rules (configurable blocking threshold for outdoor services)
11. Walk bookings unified into main reporting model
12. Feature-flag cleanup (Tranzila flags, payment flags)
13. Remove dead code (Spotify, legacy auth routes, placeholder Google Weather)
