# INTEGRATION_HEALTH_MASTER.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit

---

## Integration Status Summary

| Service | Status | Startup Validation | Fatal if Missing | Business Risk |
|---|---|---|---|---|
| Google Service Account (JSON) | **DANGEROUS** | `fatalInProd: false` | ❌ NO | 10 services fail silently |
| Google Calendar | LIVE | On first call | ❌ NO | Walk/booking calendar sync |
| Google Sheets | PARTIAL | None | ❌ NO | Booking export, tracking sheets |
| Google Maps | LIVE | +10s background | ❌ NO | Geocoding, walker location |
| Gemini / Vertex AI | **DANGEROUS** | None | ❌ NO | ALL AI features (KYC, spam guard, triage) |
| SendGrid | LIVE | `fatalInProd: true` | ✓ YES | All transactional email |
| Twilio | LIVE | `fatalInProd: true` | ✓ YES | All SMS (OTP, booking alerts) |
| FCM (Firebase Push) | LIVE | None (Firebase Admin implicit) | ❌ NO | Push notifications |
| HubSpot | **DANGEROUS** | None | ❌ NO | Replit-only connector — crashes on Cloud Run |
| Nayax | LIVE | `fatalInProd: true` (MERCHANT_ID) | ✓ YES | K9000 payments, vouchers, marketplace |
| Tranzila | **DANGEROUS** | FATAL if bypass flag set | Partial | `charge()` NOT IMPLEMENTED |
| DocuSeal | PARTIAL | None | ❌ NO | E-signatures; 503 if no API key |
| Spotify | **DANGEROUS** | None | ❌ NO | Replit-only connector — crashes on Cloud Run |
| Weather | PARTIAL | None | ❌ NO | AI weather recommendations |

---

## 1. Google Service Account (`GOOGLE_SERVICE_ACCOUNT_JSON`)

- **Entry Point:** server/index.ts:96-101
- **Status: DANGEROUS** — highest single-point-of-failure
- 10 services fail silently with warnings only (not fatal in prod)
- Services affected: Calendar, Sheets, Gmail, Wallet, Cloud Storage, Translation, Vision, Cloud Messaging, Business Profile, Gemini/Vertex
- **Recommendation:** Add health check endpoint that tests each dependent service on startup and reports to `/api/status`

---

## 2. Google Calendar

- **Entry Point:** server/routes/calendar.ts, server/services/GoogleCalendarIntegrationService.ts:24
- **Status: LIVE**
- Routes: `/api/calendar/status`, `/api/calendar/add-booking`, `/api/calendar/booking/:bookingId`
- Graceful fallback to Replit connector in dev (line 44-55)
- Returns null with warning if unavailable

---

## 3. Google Sheets

- **Entry Point:** server/services/googleSheetsIntegration.ts
- **Status: PARTIAL** — 51 templates defined, not all written to
- Used by `BookingExportService`
- Silent failure with warning if unavailable

---

## 4. Google Maps (`GOOGLE_MAPS_API_KEY`)

- **Entry Point:** server/services/location/MapsService.ts
- **Status: LIVE**
- Startup background validation at +10s (server/index.ts:273-306)
- Logs CRITICAL if key is invalid
- Features: geocoding, place search, distance calculation

---

## 5. Gemini / Vertex AI

- **Entry Point:** server/lib/gemini-client.ts
- **Status: DANGEROUS** — no startup validation, silent failure
- Env var priority: `FIREBASE_SERVICE_ACCOUNT_KEY` (Vertex) > `AI_INTEGRATIONS_GEMINI_API_KEY` > `GEMINI_API_KEY` > `GOOGLE_API_KEY`
- **NOTE:** Previous bug (deleting GEMINI_API_KEY on startup when GOOGLE_API_KEY exists) was fixed in prior PR
- Powers: KYC document analysis, spam guard, booking AI triage, weather AI, platform security scoring
- Graceful fallback returns `null` on error — silent feature degradation

---

## 6. SendGrid (`SENDGRID_API_KEY`)

- **Entry Point:** server/lib/sendgrid.ts, server/emailService.ts
- **Status: LIVE** — hard startup failure in production if missing
- Must start with "SG." and be 20+ chars (server/index.ts:70-76)
- Rate limits: 100 emails/hour, 500/day per recipient
- Gmail is the async fallback on SendGrid failure (emailService.ts:86-91)

---

## 7. Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`)

- **Entry Point:** server/services/TwilioSMSService.ts
- **Status: LIVE** — hard startup failure if neither phone number nor messaging service is set
- Rate limits: 5 SMS/day per phone, 150/day global, 60s resend cooldown
- 26 country prefixes supported
- Alphanumeric sender 'PetWash' where supported

---

## 8. FCM (Firebase Cloud Messaging)

- **Entry Point:** server/services/FCMService.ts, server/routes/fcm.ts
- **Status: LIVE** — uses Firebase Admin SDK (implicitly validated by Firebase startup)
- Token storage: Firestore `users/{userId}/fcmTokens`
- Invalid tokens cleaned up on send failure

---

## 9. HubSpot

- **Entry Point:** server/hubspot.ts
- **Status: DANGEROUS** — Replit OAuth connector only
- **WILL CRASH on Cloud Run** with "X_REPLIT_TOKEN not found"
- No Cloud Run credentials implementation

---

## 10. Nayax

- **Entry Point:** server/nayaxService.ts, server/services/Nayax*.ts
- **Status: LIVE** — MERCHANT_ID fatal in production; demo mode without API credentials
- Wired for: K9000 payments, e-vouchers, terminal QR redemptions, marketplace bookings
- TERMINAL_SECRET required for terminal wallet redemptions — no fallback

---

## 11. Tranzila (Israeli Payments)

- **Entry Point:** server/services/TranzilaService.ts, server/routes/tranzila-webhooks.ts
- **Status: DANGEROUS** — `charge()` method NOT IMPLEMENTED (TODO comment at line 134)
- `verifyWebhookSignature()` NOT IMPLEMENTED (line 137)
- Startup: FATAL if bypass flag set in prod/staging (prevents insecure webhook bypass)
- Redis-backed idempotency (24h TTL), IP allowlist, rate limiter all in place
- **Action required:** Implement `charge()` and `verifyWebhookSignature()` before enabling Israeli card payments

---

## 12. DocuSeal

- **Entry Point:** server/services/DocuSealService.ts, server/routes/esign.ts
- **Status: PARTIAL** — demo mode if `DOCUSEAL_API_KEY` missing; returns 503 on real calls
- Routes: `/api/esign/create-session`, `/api/israeli-2025-esign`

---

## 13. Spotify

- **Entry Point:** server/routes/spotify.ts, server/spotify.ts
- **Status: DANGEROUS** — Replit OAuth connector only
- **WILL CRASH on Cloud Run**
- Routes: `/api/spotify/profile`, `/api/spotify/now-playing`, `/api/spotify/status`

---

## Resilience Recommendations

### Health Check Endpoint (HIGH PRIORITY)
Create `GET /api/health/integrations` (admin only) that tests each integration:
- Check Google Service Account can initialize each dependent service
- Check Gemini can complete a test completion
- Check Nayax API key is valid
- Return: `{ service, status: 'ok'|'degraded'|'down', latencyMs }`

### Startup Validation Gaps
Add startup warnings (not fatal) for:
- Gemini/Vertex AI: log when no AI key is available
- Google Service Account: enumerate which services will be degraded

### Immediate Action Items
1. **Tranzila:** Implement `charge()` and `verifyWebhookSignature()` before Israeli card payments go live
2. **HubSpot & Spotify:** Add Cloud Run auth or gate behind environment check to prevent crashes
3. **Gemini:** Add `[DEGRADED_MODE]` log when no AI key — currently silent
