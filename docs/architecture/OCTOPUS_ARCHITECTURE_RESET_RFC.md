# Octopus Architecture Reset RFC

## Status

Production architecture reset plan. No visual redesign. This plan changes wiring, routing, role boundaries, state machines, data ownership, and backend/frontend contracts while preserving the current luxury visual system.

## Objective

Restore the platform to the documented Octopus model:

- Octopus is the central brain.
- Each vertical remains a separate domain.
- Shared services live above the verticals.
- Customers, providers, station operators, franchise owners, finance users, support users, and super admins do not share the same dashboard logic.
- Wallet, e-gift, wash package, voucher, redemption, payment, escrow, and payout logic must be treated as financial infrastructure, not UI fragments.

Reference products for UX efficiency and flow quality:

- MadPaws and Rover for pet-service onboarding, provider profiles, trust, reviews, booking clarity, and service filtering.
- Airbnb for marketplace booking flow, calendar availability, host/provider dashboard separation, listing quality, and clear status states.
- Uber-style role separation: rider, driver, restaurant/merchant, admin, and finance are separate experiences under one account identity.

## Non-goals

Do not change visual design in this RFC.

No changes to:

- logo placement
- header layout
- homepage creative direction
- color system
- typography choices
- luxury look and feel
- public page visual styling

The goal is structure, logic, routing, data truth, and reliability.

## Core law

One identity, many role experiences.

A user account can have multiple capabilities, but the UI and data exposed must be role-scoped.

Examples:

- A pet parent sees pets, bookings, wallet, loyalty, saved addresses, PawFinder, e-gifts, and wash packages.
- A sitter sees service profile, availability, job requests, earnings, payout status, reviews, and KYC.
- A walker sees walking jobs, routes, GPS history, earnings, availability, and reviews.
- A trainer sees training categories, sessions, certification data, bookings, and earnings.
- A transport provider sees vehicles, trips, route/trip jobs, and trip compliance.
- A station/franchise operator sees machines, faults, stock, wash sessions, terminal settlements, and location performance.
- Finance sees ledger, VAT events, wallet liability, voucher liability, escrow, payouts, reversals, and breakage.
- Support sees cases, disputes, users, bookings, refund/no-refund scripts, and wallet/redeem lookup.
- Super admin sees everything through RBAC and audit logging.

## Target architecture

```txt
PetWash Ecosystem
|
|-- Octopus Brain
|   |-- Identity and auth
|   |-- Role routing
|   |-- RBAC and permissions
|   |-- Loyalty and Prestige
|   |-- Wallet, voucher, e-gift, wash package ledger visibility
|   |-- Notifications
|   |-- Support and CRM
|   |-- KYC and compliance
|   |-- Analytics
|   |-- Audit logging
|   |-- Finance control
|
|-- Domain 1: K9000 station network
|   |-- machines
|   |-- wash sessions
|   |-- Nayax terminal payments
|   |-- telemetry
|   |-- faults and maintenance
|   |-- station stock and service
|   |-- wash packages and machine redemption
|
|-- Domain 2: Sitter marketplace
|   |-- sitter profiles
|   |-- availability
|   |-- sitter bookings
|   |-- escrow and payouts
|   |-- ratings and reviews
|
|-- Domain 3: Walker marketplace
|   |-- walker profiles
|   |-- walk jobs
|   |-- GPS routes
|   |-- walk bookings
|   |-- earnings and reviews
|
|-- Domain 4: Trainer / Academy marketplace
|   |-- trainer profiles
|   |-- lesson categories
|   |-- academy bookings
|   |-- certificates and trust badges
|
|-- Domain 5: PetTrek transport
|   |-- drivers
|   |-- vehicles
|   |-- trips
|   |-- route and pickup/dropoff logic
|
|-- Domain 6: Grooming marketplace
|   |-- groomers
|   |-- service menu
|   |-- salon/mobile appointments
|   |-- grooming bookings
```

## Backend reset

### 1. Create domain boundaries

Each domain must expose its own API surface. Shared services are imported from Octopus services, not copied.

Required folders:

```txt
server/domains/k9000
server/domains/sitter
server/domains/walker
server/domains/academy
server/domains/pettrek
server/domains/grooming
server/octopus/auth
server/octopus/rbac
server/octopus/ledger
server/octopus/loyalty
server/octopus/notifications
server/octopus/kyc
server/octopus/calendar
server/octopus/maps
server/octopus/support
```

This does not require moving everything in one PR. Use adapter layers first.

### 2. Create one account role resolver

Backend canonical response:

```ts
type AccountContext = {
  userId: string;
  primaryRole: 'customer' | 'provider' | 'station_operator' | 'franchise_owner' | 'support' | 'finance' | 'admin' | 'super_admin';
  capabilities: string[];
  dashboards: Array<{
    key: string;
    label: string;
    route: string;
    reason: string;
  }>;
  requiredActions: string[];
  selectedDashboard: string;
};
```

Rules:

- Do not infer admin from customer profile completeness.
- Super admin allowlist wins early, before customer/provider routing.
- Provider with multiple service types gets provider dashboard with service modules.
- Customer with loyalty gets customer dashboard plus Prestige/loyalty module, not a separate incompatible identity.
- Station/franchise users must not be routed to provider marketplace dashboards.

### 3. Provider application model

One provider application can contain multiple selected services.

```ts
type ProviderServiceType =
  | 'sitter'
  | 'walker'
  | 'trainer'
  | 'transport'
  | 'groomer'
  | 'station_operator';

type ProviderApplication = {
  userId: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'pending_resubmission';
  selectedServices: ProviderServiceType[];
  kycStatus: string;
  complianceFlags: string[];
  serviceProfiles: Record<ProviderServiceType, { status: string; profileId?: string }>;
};
```

Rules:

- Join pages do not create separate disconnected identities.
- `/join/walker`, `/join/sitter`, `/join/trainer`, `/become-provider`, and `/provider-onboarding` all call the same provider intent/draft service.
- KYC is shared.
- Platform-specific profile details are separate.

### 4. Booking state machine

One shared lifecycle, with domain extensions.

Canonical shared statuses:

```ts
type BookingStatus =
  | 'draft'
  | 'requested'
  | 'pending_provider_acceptance'
  | 'accepted'
  | 'declined'
  | 'cancelled_by_customer'
  | 'cancelled_by_provider'
  | 'in_progress'
  | 'completed'
  | 'disputed'
  | 'no_show'
  | 'refunded'
  | 'closed';
```

Domain extensions:

- Walk: route tracking and GPS events.
- Sitter: home access, overnight, key holding.
- Academy: lesson type, trainer certificate.
- PetTrek: vehicle and route/trip details.
- Grooming: service menu, salon/mobile setting.
- K9000: no marketplace booking. It is wash session logic.

### 5. Calendar lifecycle

Provider marketplace bookings must call one calendar service.

Lifecycle:

- Requested: optional tentative hold.
- Accepted: create confirmed provider/customer calendar events.
- Rescheduled: update event.
- Cancelled: delete/cancel event.
- Completed: keep historical event or mark metadata.
- Provider unavailable dates: block search and booking.

Calendar events must store:

- bookingId
- providerId
- customerId
- platform
- eventId
- calendarAccountId
- lifecycle state

### 6. Maps and address object

Every address must use one object:

```ts
type AddressObject = {
  formattedAddress: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  lat: number;
  lng: number;
  placeId?: string;
};
```

Rules:

- No marketplace matching by text only.
- Nearby search uses lat/lng.
- Saved addresses use same shape.
- Provider service area uses same shape.
- Pickup/dropoff for PetTrek uses two AddressObjects.

### 7. Wallet, e-gift, wash package, voucher, redeem

All money instruments must go through one ledger brain.

Instrument types:

```ts
type FinancialInstrumentType =
  | 'wallet_credit'
  | 'e_gift'
  | 'wash_package'
  | 'platform_credit'
  | 'voucher'
  | 'coupon'
  | 'k9000_wash_entitlement';
```

Required ledger fields:

- instrumentId
- ownerUserId
- purchaserUserId if different
- type
- originalAmount
- remainingAmount
- currency
- status
- expiryAt
- sourcePaymentId
- createdAt
- redeemedAt
- idempotencyKey
- auditChainHash

Redeem rules:

- no double-spend
- idempotency key required
- replay protection for QR/token redemption
- all admin mutations audited
- wash package redemption can only redeem eligible K9000 sessions
- e-gift activation converts into wallet/platform credit only through ledger
- wallet top-up is a liability until redemption
- provider escrow is separate from K9000 machine payment

## Frontend reset

### 1. Keep visuals, change routing brain

Create one route resolver map:

```ts
type DashboardKey =
  | 'customer_home'
  | 'provider_os'
  | 'station_operator'
  | 'franchise_dashboard'
  | 'support_console'
  | 'finance_console'
  | 'admin_dashboard'
  | 'super_admin_dashboard';
```

Frontend should ask backend for `AccountContext`, not guess from scattered localStorage, claims, and route aliases.

### 2. Dashboard shell separation

Use separate shells:

```txt
CustomerShell
ProviderShell
StationOperatorShell
FranchiseShell
SupportShell
FinanceShell
AdminShell
```

Do not let one generic page decide everything.

### 3. Onboarding flow standard

Use MadPaws/Rover-style flow quality:

- quick role/service choice
- show progress steps
- save draft every step
- short questions first
- trust/KYC steps only when needed
- clear status after submission
- return to exact flow after OAuth
- never drop user to `/home` mid-application

### 4. Booking flow standard

Use Airbnb-style flow clarity:

- service
- pet
- location
- date/time
- provider selection
- price/payment summary
- confirmation
- status and chat

Do not use hidden or dead states.

### 5. Overlay discipline

Global overlays must not block core flows:

- promo popup
- cookie consent
- notification prompt
- PWA install prompt
- AI chat widget
- floating buttons
- bottom nav

Create z-index rules and hide overlays on onboarding/booking/payment screens.

## Migration approach

Do not rewrite the whole app in one PR.

### Phase 1 - stop the bleeding

- Shared post-login helper.
- Early super-admin backend sync.
- Provider intent/draft service.
- Loyalty signup contract.
- Overlay hide rules.

### Phase 2 - define control maps

- AccountContext endpoint.
- DashboardKey map.
- Provider service type map.
- Booking status map.
- Financial instrument map.

### Phase 3 - migrate domains behind adapters

- Keep current UI paths.
- Move business logic behind domain services.
- Replace duplicate route logic with adapters.
- Add tests around each adapter.

### Phase 4 - strengthen money and redemption

- Audit wallet/redeem/e-gift/wash package routes.
- Enforce idempotency.
- Enforce audit logs.
- Enforce replay protection.
- Add finance dashboard visibility.

### Phase 5 - calendar, maps, and search truth

- Calendar lifecycle wired to accepted/cancelled/rescheduled bookings.
- Address object used everywhere.
- Nearby provider search uses coordinates.
- Provider availability blocks booking.

## Acceptance criteria

- Super admin login always lands on admin dashboard.
- Customer login always lands on customer dashboard.
- Provider application always returns to provider onboarding/status.
- A provider can apply to one or more service platforms in one application.
- A user with both customer and provider capability can switch dashboards clearly.
- Loyalty/Prestige signup does not corrupt provider/customer role.
- Wallet, e-gift, wash package, and voucher redemptions are idempotent and audited.
- K9000 machine sessions are not treated as marketplace bookings.
- Calendar event lifecycle follows booking lifecycle.
- Maps/address matching uses lat/lng across all platforms.
- No overlay blocks onboarding, booking, payment, or Google address suggestions.
