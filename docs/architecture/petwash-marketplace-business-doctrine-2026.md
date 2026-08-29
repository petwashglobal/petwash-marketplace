# PetWash Marketplace Business Doctrine — 2026

Author: CEO directive 2026-08-29
Status: DOCTRINE (source of truth for implementation lanes)
Scope: multi-role marketplace, bookings, communication, documents
Companion: `petwash-marketplace-integrity-and-communications-2026.md`

## 0. How to read this document

This is the canonical business model PetWash implements. Every module (routing,
storage, capabilities, chat, payments, documents) MUST map to the entities and
rules here. When a code file and this doctrine disagree, code is wrong.

Rules for changes:

- No schema migration, production payment change, fiscal classification change,
  or mass rewrite until this map proves the need. (§97)
- Safe work continues: docs, read models, adapters, tests, feature-flagged UI,
  behavioral E2E. (§97)
- Business tests, not code tests, are the acceptance criteria. (§98)

## 1. Foundational rule (§ Foundational)

- ONE HUMAN. ONE canonical PetWash account. ONE Firebase UID.
- That human may simultaneously carry:
  - PET PARENT capability
  - PRESTIGE entitlement
  - PROVIDER capability
  - STAFF / ADMIN capability (where separately authorized)
- These are ADDITIVE. They do NOT replace one another.

## 2. Identity vs transaction role (§ Most Important Distinction)

USER IDENTITY ≠ TRANSACTION ROLE.

Every commercial transaction stores its ACTORS explicitly. The system MUST NEVER
decide business authority from `users.role === 'provider'` alone.

Worked example — Nir (UID `abc123`, Pet Parent + Prestige + Sitter + Walker):

| When | Transaction | Actor as | Actor as |
| --- | --- | --- | --- |
| Mon 10:00 | Nir books Maya to walk Bruno | Nir = BOOKER | Maya = PROVIDER |
| Mon 18:00 | David books Nir to sit Bella | David = BOOKER | Nir = PROVIDER |
| Tue | Nir buys shampoo from Shop | Nir = BUYER | PetWash = MERCHANT |
| Wed | Nir buys K9000 wash | Nir = CUSTOMER | K9000 station = FULFILMENT |

Same UID, four different transaction capacities.

## 3. Canonical entity model

### 3.1 HumanAccount

Single canonical account. Fields (conceptual):

- `uid` (Firebase)
- `profile` (name, DOB, language)
- `contacts` (email verified, mobile verified)
- `pets[]` (Pet records — the human's animals)
- `preferences`
- `prestigeEntitlement` (none | active + tier + memberId)
- `providerCapability` (none | pending | approved + which services)
- `staffCapability` (none | staff | admin | super_admin)

The account is one row. Capabilities are separate axes read by the capability
resolver (`server/lib/userCapabilities.ts`).

### 3.2 Workspaces (§2)

A normal multi-role human uses TWO operating workspaces:

- **PET PARENT** — My Pets, Bookings, Shop, K9000, Wallet, eGift, Prestige,
  Messages, Receipts/Documents, Saved/Favourites
- **PROVIDER** — Requests, Jobs, Calendar, Services, Pricing, Availability,
  Clients, Messages, Earnings, Payouts, Documents, Compliance

**Prestige is NOT a workspace.** Prestige follows the human across both.

Workspace switching MUST:

- not log out
- not change UID
- not create a session
- not change entitlement

It changes VIEW / ACTING CONTEXT only.

### 3.3 Acting Context (§3)

Every request that needs business context resolves:

```ts
type ActingContext = {
  actorUid: string;
  workspaceContext: 'PET_PARENT' | 'PROVIDER' | 'ADMIN';
  transactionRole:
    | 'BOOKER'
    | 'PROVIDER'
    | 'BUYER'
    | 'MERCHANT'
    | 'RECIPIENT'
    | 'STAFF'
    | 'SYSTEM';
};
```

Authorization derives from:

1. authenticated UID (from Bearer / session — never body)
2. + relationship to the entity (booking actor, order buyer, thread party)

NOT from UI selection alone. UI selection can indicate the workspace intent; it
cannot grant authority.

### 3.4 Capability model (§74)

Do NOT overload `users.role` to answer:

- Can this person provide?
- Can this person book?
- Can this person get Prestige benefits?
- Can this person administer?
- Can they see this booking?

Each is a separate question resolved by a capability projection. The current
`server/lib/userCapabilities.ts` + `/api/me/capabilities` endpoint is the
correct place — extend it, do not fork it.

## 4. Provider service model (§4–§6, §16, §86)

### 4.1 Provider is not one service (§4)

A Provider can offer any subset of an extensible service catalog:

- `PET_SITTING`
- `DOG_WALKING`
- `DAYCARE`
- `HOME_VISIT`
- `TRAINING`
- `PET_TRANSPORT`
- future approved services

Each service is INDEPENDENT.

### 4.2 ProviderServiceOffer (§5)

```ts
type ProviderServiceOffer = {
  providerUid: string;
  serviceType: ServiceType;
  approvalStatus: 'not_started' | 'pending' | 'approved' | 'rejected';

  currency: 'ILS';
  baseRate: number;                    // in agorot (cents)
  rateUnit: RateUnit;                  // see §4.3
  extraPetPricing?: ExtraPetPricing;
  holidayPricing?: PricingRule[];
  weekendPricing?: PricingRule[];

  acceptedSpecies: Species[];          // ['dog','cat','bird','rabbit',...]
  acceptedPetSizes?: PetSize[];
  maxPets?: number;

  serviceArea: ServiceArea;            // radius + centre, or city list
  availability: AvailabilityRuleSet;   // PER service, not per provider (§16)

  locationModel: 'PROVIDER_HOME' | 'CUSTOMER_HOME' | 'REMOTE' | 'MOBILE';

  requirements?: string[];
  active: boolean;                     // provider-toggled
};
```

### 4.3 Rate unit MUST match service (§6)

| Service | Valid rate units |
| --- | --- |
| `DOG_WALKING` | `PER_WALK`, `PER_DURATION` |
| `HOME_VISIT` | `PER_VISIT` |
| `DAYCARE` | `PER_DAY` |
| `PET_SITTING` | `PER_NIGHT`, `PER_24H` |
| `TRAINING` | `PER_SESSION` |
| `PET_TRANSPORT` | `BASE_PLUS_DISTANCE` (if business enables) |

Never treat every provider price as `pricePerHour`.

### 4.4 Approval per service (§86)

Search / listing exposes only services with `approvalStatus === 'approved'`
AND `active === true`. Sitting-approved + daycare-pending → daycare hidden.

## 5. Multi-pet booking (§7–§11, §77–§78)

### 5.1 Booking Party

A booking does NOT have a single `petId`. It has a BookingParty (many pets).

```ts
type BookingPet = {
  bookingId: string;
  petId: string;
  species: Species;
  perPetCarePlan?: CarePlan;
};
```

### 5.2 Household-scope example (§8)

"Sitter, Fri–Sun, 2 dogs + 1 cat + feed the bird twice/day."
→ ONE household service request. BookingParty has 4 entries.
→ Provider offer must declare acceptedSpecies for this to book.

### 5.3 Mixed eligibility (§9, §78)

Owner: 2 dogs + 1 cat. Provider daycare accepts dogs only.

Server MUST NOT silently drop the cat. UX renders:

> Daycare provider accepts Bruno and Charlie. Milo is not eligible for this
> service.

Customer then explicitly chooses: proceed with 2 dogs, or find a different
provider. No silent pet removal.

### 5.4 Service compatibility (§10)

Server validates BEFORE booking confirmation:

- service type ↔ pet species
- pet count ≤ `maxPets`
- size / age requirements
- service-specific safety
- provider availability

### 5.5 Multi-pet pricing (§11)

Support the provider's actual model:

| Model | Example |
| --- | --- |
| First-pet base + extra | Daycare Dog1 ₪140 + Dog2 +₪90 = ₪230/day |
| Flat per pet | ₪75 × N |
| Care add-on | Bird feeding +₪X per visit |

Never `basePrice × arbitrary quantity` unless the provider declared that model.

## 6. Quote snapshot (§12)

When the customer receives / confirms a price, snapshot into the booking:

```ts
type QuoteSnapshot = {
  providerServiceOfferId: string;
  rateCardVersion: string;
  pets: BookingPet[];
  dates: DateRange;
  duration: Duration;
  addOns: AddOn[];
  discounts: DiscountLine[];   // Prestige where eligible
  fees: FeeLine[];
  totalCents: number;
  currency: 'ILS';
  snapshotAt: string;
};
```

Provider changing their future rate tomorrow MUST NOT change an already
confirmed booking's snapshot.

## 7. Booking object (§17)

```ts
type Booking = {
  bookingId: string;
  jobRef: string;                       // human-readable public id

  bookerUid: string;                    // authoritative — from session, not body
  providerUid: string;                  // authoritative — from offer join
  serviceType: ServiceType;
  providerServiceOfferId: string;

  bookingPets: BookingPet[];

  schedule: BookingSchedule;
  location: BookingLocation;

  status: BookingStatus;                // §8
  quoteSnapshot: QuoteSnapshot;         // §6

  paymentStatus: PaymentStatus;         // §8
  fulfillmentStatus: FulfillmentStatus;
  cancellationStatus: CancellationStatus;
  reviewStatus: ReviewStatus;

  createdAt: string;
};
```

## 8. State machines (§18)

These are SEPARATE axes. Do NOT infer one from another.

### 8.1 BookingStatus

`DRAFT → REQUESTED → QUOTED → ACCEPTED → CONFIRMED → IN_PROGRESS → COMPLETED`
plus terminal branches: `CANCELLED`, `DISPUTED`.

### 8.2 PaymentStatus

`NOT_REQUIRED | UNPAID | PENDING | AUTHORIZED | PAID | PARTIAL_REFUND | REFUNDED | FAILED`.

### 8.3 ProviderPayoutStatus

`NOT_ELIGIBLE | ACCRUED | HELD | SCHEDULED | PAID`.

### 8.4 FiscalStatus

`NOT_REQUIRED | PENDING | ISSUED | FAILED | CREDIT_PENDING | CREDIT_ISSUED`.

## 9. Request / quote workflow (§19)

Customer selects provider + pets + dates + requirements → Provider may:

- ACCEPT (as quoted)
- DECLINE
- PROPOSE CHANGE — new dates ("Saturday from 9 instead"), subset of pets ("dogs
  but not the bird"), or a modified quote ("₪260/night for three pets")

Customer MUST explicitly accept a modified quote before it becomes canonical.

## 10. Communication (§20–§34)

### 10.1 Chat is contextual (§20)

`Chat is NOT "Nir chats with Maya". Chat is Nir and Maya IN THE CONTEXT OF ENTITY X.`

Contexts:
- Booking `PW-BKG-123`
- Shop Order `PW-SHOP-99`
- Provider Application `APP-331`
- Support Case `CASE-992`
- Gift `GIFT-812`

### 10.2 Why (§21)

Same two humans may have Booking #1 this week + Booking #2 next month + a
dispute + another quote. Free-form single-conversation mixing prices, dates,
pets, cancellations is a defect.

### 10.3 One Inbox, many thread types (§22, §35, §36)

Inbox is a PROJECTION — not a new storage universe (§92). Sources:

- booking conversations (legacy `booking_messages` — read via adapter)
- `chat_threads` spine (`BOOKING | SUPPORT | K9000 | PAW_FINDER | SHOP_ORDER | GIFT | PROVIDER_APPLICATION | ADMIN`)
- attention / system activity

Customer Inbox filters: `ALL | MESSAGES | BOOKINGS | ORDERS | PAYMENTS & DOCUMENTS | SUPPORT`.

Provider Inbox filters: `ALL | REQUESTS | MESSAGES | ACTIVE JOBS | EARNINGS | COMPLIANCE | SUPPORT`.

### 10.4 InboxItem (§24)

```ts
type InboxItem = {
  threadId: string;
  threadType: ThreadType;
  entityId: string;
  workspaceContext: 'PET_PARENT' | 'PROVIDER';
  title: string;
  subtitle: string;
  otherParticipant: MaskedParticipant;   // §31
  petSummary?: string;
  serviceSummary?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  statusBadge?: string;
  primaryAction: InboxAction;
  secondaryActions: InboxAction[];
};
```

### 10.5 Chat cannot change money (§57) or status (§58)

Chat text like "I'll do it for ₪220" or "Sure, see you tomorrow" does NOT
change the booking. Only structured actions do — see §11.

### 10.6 System messages (§34)

Thread timeline can include SYSTEM events — `Request sent`, `Maya accepted`,
`Price changed to ₪230`, `Payment confirmed`, `Walk started`, `Walk completed`,
`Receipt available`. These are not editable user messages.

### 10.7 Same UID / two inbox contexts (§37)

Global badge, Pet Parent badge, Provider badge must be SEPARATE. Reading a
provider message does NOT mark a customer message as read.

### 10.8 Push + email are delivery only (§38, §39)

Server Inbox is the source of truth. Push may fail. Email deep links to the
exact entity, sign in if needed, return to the exact booking/order/document —
never to homepage.

### 10.9 Structured actions in chat (§62)

`Request booking | Accept booking | Suggest change | Send revised quote |
Extend booking | Add pet | Schedule Meet & Greet | Call | Report | Cancel |
Contact support`.

These are BUSINESS actions rendered in the chat surface. They mutate state
through structured endpoints — the free-text chat message does not.

## 11. Contact / call model (§28–§32, §82)

### 11.1 Progressive contact reveal

| Phase | Direct contact allowed? | UI |
| --- | --- | --- |
| PRE-REQUEST | No | in-app messaging only, controlled where policy dictates |
| REQUESTED | No raw contact | in-app message |
| ACCEPTED / CONFIRMED | Masked call may become available | `Call Provider` |
| IN_PROGRESS | Yes, prominent | `Call Owner`, emergency contact/action |
| COMPLETED | Masked contact expires per policy | chat archive |
| CANCELLED | Historical thread only | read-only |

### 11.2 No raw phone leak (§28, §31)

Never publish provider phone on listing pages. Preferred: PetWash relay /
masked number OR in-app calling.

### 11.3 Call is contextual (§29)

`Call from Booking #123 = CALL MAYA ABOUT BOOKING #123.` Record safe metadata
only: `bookingId, callerUid, recipientUid, startedAt, endedAt, result`. NOT
audio unless explicit lawful product requirement + consent.

### 11.4 Emergency override (§30, §49)

During active service pet safety beats marketplace-leakage concerns. Provider
can access owner, emergency contact, vet, service address as required —
structured, authorized access, audit logged.

### 11.5 Pet information in chat (§32, §33)

Never paste the full pet profile into chat. Structured Job Passport (§48) is
the surface. Chat is conversation.

If the owner has not shared optional medical details, provider sees
`Medical details were not shared for this booking.` — never hidden DB fields.

## 12. Documents (§45–§47, §83, §91)

### 12.1 Customer Document Center

One user-facing surface: **Documents & Receipts**, indexed by transaction.

- K9000 receipt
- Shop purchase receipt
- Booking fiscal document
- Refund / credit document
- eGift purchase receipt
- Prestige-related document if applicable

Filters: `All | Bookings | Shop | K9000 | eGift | Refunds`.

### 12.2 Fiscal authority stays with SUMIT (§46)

PetWash maintains a safe document INDEX:

```ts
type DocumentIndexEntry = {
  documentId: string;
  transactionId: string;
  jobRef: string;
  domain: 'BOOKING' | 'SHOP' | 'K9000' | 'EGIFT' | 'REFUND' | 'PROVIDER_EARNINGS';
  documentStatus: FiscalStatus;
  issuedAt?: string;
  amountCents: number;
  currency: 'ILS';
  officialProvider: 'SUMIT' | 'INTERNAL';
  externalDocumentRef?: string;
  externalDocumentUrl?: string;
};
```

The PetWash UI can show `Receipt available` without pretending it generated
the official document. Exact Israeli fiscal type stays accountant / SUMIT
configured.

### 12.3 Provider documents are separate (§47)

Provider workspace surface: **Earnings & Payouts**. Do NOT put a customer
purchase receipt into provider earnings just because the human is also a
provider — CONTEXT matters.

## 13. Transaction Passport (§48)

Every commercial transaction is traceable via:

```ts
type TransactionPassport = {
  transactionId: string;
  jobRef: string;
  correlationId: string;
  domain: 'BOOKING' | 'SHOP' | 'K9000' | 'EGIFT' | 'GIFT' | 'WALLET';
  actors: TransactionActor[];    // see §3.3
  reference: string;             // bookingId / orderId / giftId / stationTx
  money: MoneySnapshot;
  documents: DocumentIndexEntry[];
  fulfillment: FulfillmentSnapshot;
  thread?: { threadId: string; threadType: ThreadType };
  auditEvents: AuditEvent[];
};
```

## 14. Cross-cutting rules

### 14.1 Prestige when user is also provider (§13)

Prestige belongs to the HUMAN. When Nir books Maya, Prestige customer benefit
may apply. When David books Nir, DO NOT deduct Nir's Prestige customer
discount from Nir's provider earnings. Prestige entitlement and provider
commercial rate are separate dimensions.

### 14.2 Provider can use PetWash like any customer (§14)

Provider can own pets, add KYA, book another provider, buy Shop, use K9000,
send / receive eGift, join Prestige, hold wallet, have receipts. Never gate
these on `role === 'provider'`.

### 14.3 Overlapping bookings (§15, §79)

Different pets, same time: ALLOWED (Bruno with Maya + Charlie with Daniel at
08:00). Same pet, incompatible services, overlapping time: BLOCKED or requires
resolution. Compatibility engine per §5.4.

### 14.4 Self-booking (§53)

Server blocks `bookerUid === providerUid` unless explicit internal / admin /
test exception. Prevents fake bookings, fake reviews, rewards abuse, payment
laundering patterns.

### 14.5 Reviews (§54)

One review per eligible completed booking. Provider capability of reviewer is
irrelevant — a provider can be a customer. Provider cannot review themselves.

### 14.6 Cancellation (§56)

Server-deterministic cancellation quote (see `CancellationPolicyRegistry`).
Show fee, refund, wallet restoration, eGift restoration, provider effect,
document effect. Chat cannot change money directly.

### 14.7 Provider rate change (§85)

Old confirmed booking is snapshot-locked (§6). New search sees new rate.
Rebook flow surfaces the new rate BEFORE confirmation.

### 14.8 Security invariant (§73)

Never trust body fields `customerId | providerId | ownerId` for authority.
Server derives caller UID from Bearer / session, then verifies entity
relationship.

## 15. Persona × journey matrix (§75, §76)

### 15.1 Personas

| Persona | Capabilities |
| --- | --- |
| A | Pet Parent only |
| B | Pet Parent + Prestige |
| C | Pet Parent + Sitter Provider |
| D | Pet Parent + Sitter + Walker Provider |
| E | Pet Parent + Prestige + Sitter + Walker Provider |

### 15.2 Journeys

Each persona × each journey MUST pass the E2E:

| # | Journey |
| --- | --- |
| J1 | Sign up (canonical) — 4-button METHOD → identity → server resolves → collect missing → activate → destination |
| J2 | Book another provider (as BOOKER) |
| J3 | Buy Shop item |
| J4 | Use K9000 wash |
| J5 | Buy eGift, receive eGift |
| J6 | Join Prestige (in-app upgrade — never `/signup`) |
| J7 | Become approved provider for a NEW service |
| J8 | Receive provider request (as PROVIDER) |
| J9 | Complete provider job + receive payout |
| J10 | Cancel booking + refund |
| J11 | Multi-pet household booking (2 dogs + 1 cat + 1 bird) |
| J12 | Mixed eligibility (dogs booked, cat surfaced as not-supported) |
| J13 | Overlap protection (same pet, incompatible services) |
| J14 | Workspace switch preserves entity role (§72) |
| J15 | Inbox segmentation — customer unread vs provider unread |
| J16 | Chat isolation — two bookings, no crossing (§81) |
| J17 | Call permission progression (§82) |
| J18 | Documents visible per role (§83) |
| J19 | Rate change respects snapshot (§85) |
| J20 | Multi-role Prestige + Provider entitlements never collide (§87) |

## 16. Permission matrix (§65, §72)

| Action | Requires |
| --- | --- |
| Read booking | `actorUid ∈ {bookerUid, providerUid}` OR staff-scope |
| Message on booking thread | booking exists + actor is party + policy engine ALLOW |
| Change booking price | provider action + customer explicit acceptance |
| Cancel booking | party (customer OR provider) + policy engine (§14.6) |
| Add pet mid-booking | provider requests + customer accepts |
| Access owner contact | booking phase per §11.1 + policy engine |
| Access vet / emergency contact | active service + policy engine + audit |
| See provider earnings statement | `actorUid === providerUid` |
| See fiscal document | `actorUid === buyerUid` (customer) OR `actorUid === providerUid` (earnings variant) |
| Admin search | staff / admin role + audit-logged permission scope |
| Self-book | BLOCKED except explicit admin / test exception (§53) |

## 17. Priority (§94)

**P0** — the model must be correct before UI polish:

1. Identity / capability / transaction-role model
2. Booking ACTORS (bookerUid + providerUid — never body-trusted)
3. Multi-service provider catalog
4. Multi-pet booking relationship
5. Contextual messaging authorization
6. Booking / payment separation

**P1** — projections layered on the correct model:

1. Unified Inbox projection
2. Documents / receipt projection
3. Calls
4. Rebook / favourites
5. Journey Brain

## 18. Current repo → target map

### 18.1 Already correct — reuse

| Concern | File(s) |
| --- | --- |
| Capability projection | `server/lib/userCapabilities.ts`, `/api/me/capabilities` |
| Chat thread spine | `chat_threads` table + related routes |
| Prestige entitlement | `privilege_members` + `loyalty_profiles` + `users.is_club_member` |
| Prestige enrollment | `POST /api/prestige/join` (identity from `req.firebaseUser`) |
| Whoami DTO | `client/src/auth/useWhoami.ts` with `providerStatus`, `prestigeStatus`, `activeFlow` |
| Cancellation policy | `CancellationPolicyRegistry` |
| Cross-user leak fix | `/walk-session/:walkId/active` scoping |
| SUMIT fiscal | External SUMIT customer portal (leave authority external) |

### 18.2 Adapt — build read model / adapter, keep storage

| Concern | Source(s) | Target read model |
| --- | --- | --- |
| Inbox aggregation | booking chat + `chat_threads` + attention | `CommunicationHubService.listForUser(uid, workspace)` (§89) |
| Documents | SUMIT external + PetWash-side receipts | `DocumentIndexService.listForUser(uid, workspace)` (§91) |
| Transactions | bookings + shop orders + K9000 + eGift + wallet + refunds | `TransactionCenterService.listForUser(uid)` (§90) |
| Provider services | current provider profile fields | `ProviderServiceOfferService.listActive(providerUid)` |

### 18.3 Legacy — mark, do not fork

- `PrivilegeSignup.tsx` — retired (Prestige is now `/prestige/enroll` in-app upgrade).
- Booking chat storage that isn't `chat_threads` — keep temporarily, aggregate via §18.2 read model.

### 18.4 Bug shapes — search + fix under this doctrine

- Any handler that reads `req.body.customerId | providerId | ownerId | firebaseUid` for authority (§73)
- Any client component that decides "provider vs customer" from `users.role` (§74)
- Any booking helper that assumes a single `petId` (§7)
- Any provider price treated as `pricePerHour` (§6)
- Any global provider `availability` boolean covering multiple services (§16)
- Any chat surface that lets a text message change booking price / status (§57, §58)

### 18.5 Duplicate authority — reconcile

- Two "join Prestige" surfaces (retired PrivilegeSignup + new `/prestige/enroll`) — new is the only path
- Two `requireAdmin` implementations — already reconciled (task #17)
- Booking-side `pricePerHour` vs `ProviderServiceOffer.baseRate` — offer model wins after adapter lands

## 19. Business acceptance (§98)

Report to CEO as PRODUCT TRUTH, not test counts:

| Scenario | Status |
| --- | --- |
| MULTI-ROLE PERSON (E) | PASS / FAIL |
| MULTI-SERVICE PROVIDER (D or E) | PASS / FAIL |
| MULTI-PET BOOKING (dog + cat + bird) | PASS / FAIL |
| CUSTOMER → PROVIDER WORKSPACE SWITCH | PASS / FAIL |
| BOOKING CHAT ISOLATION (§81) | PASS / FAIL |
| PROVIDER CALL PERMISSION PROGRESSION | PASS / FAIL |
| UNIFIED INBOX | PASS / FAIL |
| CUSTOMER DOCUMENTS | PASS / FAIL |
| PROVIDER EARNINGS DOCUMENTS | PASS / FAIL |
| SELF-BOOK BLOCK (§53) | PASS / FAIL |
| OVERLAP PROTECTION (§79) | PASS / FAIL |
| PRESTIGE + PROVIDER (§87) | PASS / FAIL |

## 20. Non-goals (§97, §100)

- No schema migration prior to CEO approval on a specific PR
- No production payment activation
- No fiscal classification change
- No mass rewrite
- No Journey Brain expansion until Actor / Booking / Inbox lanes are complete

## 21. Final rule (§99)

> PETWASH MUST THINK LIKE A MARKETPLACE, NOT LIKE A LOGIN FORM.
>
> A PERSON CAN BUY TODAY, SELL TOMORROW, DO BOTH IN THE SAME DAY.
>
> THE TRANSACTION DEFINES THEIR CAPACITY. THE ACCOUNT DOES NOT FORCE ONE
> PERMANENT ROLE.
