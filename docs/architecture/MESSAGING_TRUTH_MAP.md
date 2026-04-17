# MESSAGING_TRUTH_MAP.md
> Branch: copilot/fix-loyalty-flow-issues (HEAD)  
> Generated: 2026-04-17 from 8-agent platform recovery audit

---

## Email Architecture

| Layer | File | Purpose |
|---|---|---|
| Primary | server/emailService.ts:11 | SendGrid — ALL transactional email |
| Fallback | server/emailService.ts:86-91 | Gmail async fallback on SendGrid failure |
| Guard | server/emailService.ts:57 | Spend guard: 100/hour, 500/day per recipient |
| Admin | server/routes/admin-notifications.ts:57 | Stats, search, retry sweep |

---

## SMS Architecture

| Layer | File | Purpose |
|---|---|---|
| Primary | server/services/TwilioSMSService.ts | Twilio — all SMS |
| Rate limits | TwilioSMSService.ts:31-39 | 5/day per phone, 150/day global, 60s cooldown |
| Abuse detection | TwilioSMSService.ts:5 | `smsAbuseDetector` |
| Idempotency | TwilioSMSService.ts:6 | Redis-backed |

---

## Push Architecture

| Layer | File | Purpose |
|---|---|---|
| Primary | server/services/FCMService.ts:57 | Firebase Cloud Messaging — all push |
| Token store | Firestore `users/{userId}/fcmTokens` | Per-user token array |
| Cleanup | FCMService.ts:66-77 | Invalid tokens removed on failure |

---

## Notification Dispatchers — Three Competing Systems

### System 1: `dispatchNotification` (Firestore-backed)
- **File:** `server/lib/notificationDispatcher.ts`
- **Storage:** Firestore `/users/{uid}/inbox/{notificationId}`
- **Channels:** in_app (Firestore inbox) + email (SendGrid) + SMS (Twilio)
- **Idempotency:** NONE — fire-and-forget after inbox write
- **Used by:** booking-requests.ts, walk-my-pet.ts (new), sitter-suite.ts (new)

### System 2: `NotificationService` (Postgres-backed)
- **File:** `server/services/NotificationService.ts`
- **Storage:** `notificationLogs` table (Postgres)
- **Channels:** email, sms, whatsapp, push, in_app
- **Idempotency:** NONE at service level
- **Used by:** `NotificationEventHandlers.ts` — event-driven

### System 3: `PetWashNotificationEngine.dispatchNotifications` (Postgres with retry)
- **File:** `server/services/PetWashNotificationEngine.ts`
- **Storage:** `notificationLogs` table (Postgres)
- **Channels:** email, sms, push
- **Idempotency:** YES — `idempotencyKey` field (lines 209-230)
- **Retry:** YES — exponential backoff, max 3 retries (line 180: `5 * 3^retryCount`)
- **Used by:** walk-my-pet.ts:1954 (walk cancellation SMS)

**Architecture problem:** Three overlapping systems create confusion, maintenance cost, and risk of missed/duplicate sends. Stage C should consolidate to System 3 (has idempotency + retry) as the single dispatcher.

---

## ⚠️ Duplicate Send — `booking_requests` Creation

**CONFIRMED DUPLICATE:** Provider receives two notification dispatches when a booking_request is created.

| Path | File:Line | Channels | Via |
|---|---|---|---|
| Direct dispatch | booking-requests.ts:413-427 | in_app + email + sms | `dispatchNotification()` |
| Event-driven | booking-requests.ts:388 → NotificationEventHandlers.ts:467-517 | push + in_app | `eventPublisher.publishEvent(BOOKING_CREATED)` → `NotificationService.sendNotification()` |

**Risk:** Provider receives: 2× in-app notifications + 1 email + 1 SMS + 1 push = 5 notification events for 1 booking.

**Fix (Stage C):** Choose one path. Recommendation: keep the event-driven path (System 2) and remove the direct `dispatchNotification` call in booking-requests.ts:413. The event path is more maintainable and event subscribers can be extended without touching route code.

---

## ✅ Notifications Fixed in This PR

| Event | Before | After | File |
|---|---|---|---|
| walk_booking created → owner | ❌ MISSING — owner had no receipt | ✓ in_app via `dispatchNotification` | walk-my-pet.ts:527 |
| sitter_booking created → owner | ❌ MISSING — owner had no receipt | ✓ in_app via `dispatchNotification` | sitter-suite.ts:829 |

---

## ❌ Still Missing Notifications

| Event | File | Gap |
|---|---|---|
| walk_booking created → event bus | walk-my-pet.ts:448 | `'walk.booked'` event registered in EventBus but NO handler in NotificationEventHandlers.ts |
| sitter_booking created → event bus | sitter-suite.ts:732 | `'sitter.booking_requested'` registered but NO handler |
| trainer_booking created → any notification | academy.ts:252 | Zero notification code after trainer booking insert |
| walk_booking accepted → owner | walk-my-pet.ts (provider-respond) | No owner notification when walker accepts |
| sitter_booking accepted → owner | sitter-suite.ts (provider-respond) | No owner notification when sitter accepts |
| booking_requests → admin | — | No admin notification when new booking_request requires attention |

---

## Notification Log (Audit Table)

**Table:** `notificationLogs` (Postgres)  
**Columns:** templateKey, channel, recipientUserId, recipientEmail, recipientPhone, status, payload, sentAt, deliveredAt, failureReason, idempotencyKey, providerMessageId, retryCount, maxRetries, nextRetryAt, permanentlyFailed

**Read endpoints:**  
- `GET /api/admin/notifications/stats` — admin-notifications.ts:57  
- `GET /api/admin/notifications/search` — admin-notifications.ts:110 (by bookingId, userId, etc.)  
- `POST /api/admin/notifications/retry-sweep` — admin-notifications.ts:396

---

## Canonical Messaging Model (Target State)

```
Single event → PetWashNotificationEngine (System 3)
  ↓ idempotencyKey check → prevent duplicates
  ↓ Determine channels (user preferences + transactional override)
  ↓ email: SendGrid (primary) → Gmail (fallback)
  ↓ sms: Twilio
  ↓ push: FCM
  ↓ in_app: Firestore inbox OR superAppNotifications Postgres
  ↓ log: notificationLogs (Postgres)
  ↓ retry: exponential backoff on failure
```

Migration path: move all `dispatchNotification` and `NotificationService` calls to `PetWashNotificationEngine` in a single dedicated PR.
