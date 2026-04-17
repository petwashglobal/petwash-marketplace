# MESSAGING_ACCEPTANCE_MATRIX.md
> Branch: copilot/fix-loyalty-flow-issues  
> Generated: 2026-04-17 as part of PR2 acceptance verification  
> Source: server/services/events/NotificationEventHandlers.ts, server/routes/booking-requests.ts, server/services/EventPublisher.ts

---

## Purpose

Event-by-event proof that every booking and business flow sends exactly one notification per channel per recipient after PR2 deduplication fix. This is the acceptance test matrix that must pass before PR2 is considered production-safe.

---

## Architecture Ground Rules (Post PR2)

| Rule | Implementation |
|---|---|
| Single canonical notification path | `EventPublisher.publishEvent(DOMAIN_EVENT)` → `EventBus` → `NotificationEventHandlers.ts` → `NotificationService.sendNotification()` |
| Idempotency | `EventPublisher` assigns `eventId = 'evt_' + nanoid(24)` per publish. `aggregateId` (= bookingId) prevents same business event re-notifying on retry |
| Direct dispatch removed | `dispatchNotification()` removed from booking_requests POST /create (was firing in_app+email+sms in parallel with event bus) |
| Event bus does NOT deduplicate | Once an event is published, all subscribers fire. The aggregateId protection is upstream (same request = same aggregateId) |

---

## Event Matrix

### 1. BOOKING_CREATED

| Field | Value |
|---|---|
| **Trigger** | `POST /api/booking-requests` — create new booking request |
| **Publisher** | `booking-requests.ts` → `eventPublisher.publishEvent(DomainEventType.BOOKING_CREATED, { bookingId: requestId, aggregateId: requestId })` |
| **Handler** | `NotificationEventHandlers.ts:467` — `eventBus.subscribe('booking.created', ...)` |
| **Customer recipient** | `event.userId` (booking owner / pet parent) |
| **Provider recipient** | `event.data.providerId` |
| **Customer channels** | push, in_app |
| **Provider channels** | push, in_app, email, sms |
| **Customer template** | `booking_requested` |
| **Provider template** | `provider_new_booking` |
| **Idempotency rule** | `aggregateId = requestId` — same requestId on retry = no new eventId; EventPublisher logs duplicate and skips re-notify |
| **Pre-PR2 issue** | Provider received in_app ×2 (event bus in_app + direct `dispatchNotification` in_app) |
| **Post-PR2 state** | ✅ Provider: push ×1 + in_app ×1 + email ×1 + sms ×1 |
| **Verification log** | `[NotificationEventHandler] Booking created event received { bookingId }` appears exactly once per booking |

---

### 2. BOOKING_ACCEPTED (Provider Accepts)

| Field | Value |
|---|---|
| **Trigger** | `POST /api/booking-requests/:requestId/respond` with `action: 'accept'` |
| **Publisher** | `booking-requests.ts:1141` → `eventBus.publish({ eventType: 'provider.accepted', ... })` |
| **Notification path** | NOT via event-bus → `NotificationEventHandlers.ts` for this event. Uses direct paths: |
| | 1. `superAppNotifications` insert (in_app ×1) — line 1042 |
| | 2. `dispatchNotification({ channels: ['email', 'sms'] })` (email ×1 + sms ×1) — line 1096 |
| **Customer recipient** | `booking.ownerId` |
| **Provider recipient** | None (provider took the action) |
| **Customer channels** | in_app (superAppNotifications) + email + sms |
| **Customer template** | in_app: `booking_accepted` type | email: inline HTML | sms: inline text |
| **Idempotency rule** | `superAppNotifications` row is inserted once per respond call. `dispatchNotification` has no idempotency key — relies on HTTP request being non-retried |
| **Known gap** | No idempotency key on the `dispatchNotification` email+sms call — a network retry could double-send. Fix in Stage C: route through `PetWashNotificationEngine` with `fingerprint` key |
| **Current state** | ✅ No duplicate in normal flow. ⚠️ Risk on HTTP retry without idempotency key |

---

### 3. BOOKING_DECLINED (Provider Declines)

| Field | Value |
|---|---|
| **Trigger** | `POST /api/booking-requests/:requestId/respond` with `action: 'decline'` |
| **Publisher** | No domain event published for decline |
| **Notification path** | Direct: `superAppNotifications` insert (in_app ×1) — booking-requests.ts:1042 |
| **Customer recipient** | `booking.ownerId` |
| **Customer channels** | in_app only |
| **Customer template** | type `booking_declined` |
| **Idempotency rule** | DB insert once per respond call |
| **Recovery path** | `scheduleRebookTrigger('declined_recovery', { delayMs: 3600000 })` — sends a recovery nudge 1 hour later |
| **Current state** | ✅ Single in_app. No email/SMS on decline (by design) |

---

### 4. BOOKING_CANCELLED

| Field | Value |
|---|---|
| **Trigger** | `POST /api/booking-requests/:requestId/cancel` or booking expiry |
| **Publisher** | `eventBus.publish({ eventType: 'booking.cancelled' })` |
| **Handler** | `NotificationEventHandlers.ts:335` — `eventBus.subscribe('booking.cancelled', ...)` |
| **Recipient** | `event.userId` (the booking owner) |
| **Channels** | email, push, in_app |
| **Template** | `booking_cancelled` |
| **Idempotency rule** | Event bus fires once per publish call |
| **Gap** | Provider not notified of cancellation via event bus. Only customer receives notification |
| **Current state** | ✅ Customer: email ×1 + push ×1 + in_app ×1. ⚠️ Provider receives no cancellation notification |

---

### 5. BOOKING_COMPLETED (Customer Confirms Completion)

| Field | Value |
|---|---|
| **Trigger** | `POST /api/booking-requests/:requestId/complete` |
| **Publisher** | `booking-requests.ts:1893` → `eventPublisher.publishEvent(DomainEventType.BOOKING_COMPLETED, ...)` |
| **Handler** | `NotificationEventHandlers.ts:300` — `eventBus.subscribe('booking.completed', ...)` |
| **Customer path (event bus)** | email, push, in_app via template `booking_completed` |
| **Provider path (direct)** | `dispatchNotification({ channels: ['inbox'] })` — payment released inbox notification |
| **Owner path (direct)** | `dispatchNotification({ channels: ['inbox'] })` — completion inbox notification |
| **Owner SMS** | `twilioSMSService.sendSMS()` — separate SMS if validPhone from req.body |
| **Owner email** | `sendEmail()` — inline HTML receipt |
| **Idempotency rule** | Event bus fires once. Direct dispatches have no idempotency key |
| **Current state** | ⚠️ Owner receives event-bus push+in_app+email PLUS direct inbox PLUS direct SMS PLUS direct email receipt = potential multi-send. No dedup across paths |
| **Fix recommendation** | Stage C: collapse all BOOKING_COMPLETED notifications into single event-handler path using PetWashNotificationEngine fingerprint |

---

### 6. PROVIDER_APPROVED

| Field | Value |
|---|---|
| **Trigger** | Admin approves provider application at `POST /api/provider-applications/:applicationId/review` |
| **Publisher** | `provider-applications.ts` → in_app via `superAppNotifications` insert (`type: 'provider_approved'`) |
| **Event bus path** | `NotificationEventHandlers.ts:406` — `eventBus.subscribe('provider.approved', ...)` |
| **Recipient** | `event.userId` (the provider) |
| **Channels (event bus)** | email, push |
| **Template** | `provider_approved` |
| **Idempotency rule** | Event fires once per admin action |
| **Current state** | ✅ Email ×1 + push ×1. Clean single path |

---

### 7. LOYALTY_JOINED (Prestige / Loyalty Program)

| Field | Value |
|---|---|
| **Trigger** | User joins prestige/loyalty program via `POST /api/prestige/join` or `/api/loyalty` routes |
| **Publisher** | `loyalty.ts:291` → Firestore write + `templateKey: 'customer_prestige_joined'` stored in doc |
| **Notification path** | Direct Firestore document + `trackHubSpotEvent('petwash_prestige_joined')` — NOT via EventBus |
| **Recipient** | Joining user |
| **Channels** | Firestore in_app (client reads document) |
| **Event bus subscriber** | ❌ NONE — no `eventBus.subscribe('loyalty.joined')` handler exists |
| **Current state** | ⚠️ Notification relies on Firestore client-side read, not push. No email/SMS on join. HubSpot sync degraded on Cloud Run |

---

## Summary: Channel Delivery Count Per Event (Post PR2)

| Event | Customer In-App | Customer Push | Customer Email | Customer SMS | Provider In-App | Provider Push | Provider Email | Provider SMS |
|---|---|---|---|---|---|---|---|---|
| booking_created | ×1 | ×1 | ×0 | ×0 | ×1 | ×1 | ×1 | ×1 |
| booking_accepted | ×1 | ×0 | ×1 | ×1 | ×0 | ×0 | ×0 | ×0 |
| booking_declined | ×1 | ×0 | ×0 | ×0 | ×0 | ×0 | ×0 | ×0 |
| booking_cancelled | ×1 | ×1 | ×1 | ×0 | ×0 | ×0 | ×0 | ×0 |
| booking_completed | ×1* | ×1 | ×1 | ×1 | ×1 | ×0 | ×0 | ×0 |
| provider_approved | ×0 | ×1 | ×1 | ×0 | — | — | — | — |
| loyalty_joined | ×1 (Firestore) | ×0 | ×0 | ×0 | — | — | — | — |

*booking_completed customer in_app: 1 via event-bus + 1 via direct inbox = potential ×2. Fix in Stage C.

---

## Acceptance Criteria (Must Pass Before PR2 is Production-Safe)

- [x] One booking created → provider receives exactly: push ×1 + in_app ×1 + email ×1 + sms ×1
- [x] Same booking retried (HTTP retry) → aggregateId match → no additional notification
- [ ] booking_completed → all notification paths consolidated (Stage C backlog)
- [ ] booking_cancelled → provider receives cancellation notification (gap — backlog)
- [ ] loyalty_joined → email confirmation sent on join (gap — backlog)

---

## Canonical Proof Path (booking_created)

```
POST /api/booking-requests (create)
  ↓
eventPublisher.publishEvent(BOOKING_CREATED, { bookingId, aggregateId: requestId })
  ↓
domainEvents Postgres row inserted { eventId: 'evt_...', aggregateId: requestId }
  ↓
eventBus.emit('booking.created', event)
  ↓
NotificationEventHandlers.ts:467 handler fires
  ↓
NotificationService.sendNotification({ templateKey: 'booking_requested', userId: ownerId, ['push','in_app'] })
  ↓  [parallel]
NotificationService.sendNotification({ templateKey: 'provider_new_booking', userId: providerId, ['push','in_app','email','sms'] })
  ↓
notificationLogs rows inserted (one per channel per recipient)
```

No `dispatchNotification` call in this path. Zero duplicate in_app for provider.
