# PetIdentity Canonical Model — Design-Only Spike

**Issue:** Execution-queue #148, Priority 8 — "PetIdentity design-only spike"
**Date:** 2026-07-11
**Status:** DESIGN / DOCUMENTATION ONLY. No code or schema was changed. No cutover is proposed here.
**Author:** Architecture spike (grounded in current `main`).

> Scope note: this document maps the *current* fragmentation of pet data and proposes a
> canonical `PetIdentity` model on paper. It deliberately proposes **no migration and no
> code change** — those are follow-up tickets once the model is approved.

---

## 1. Every place pet data is stored today

There are **at least 8 distinct stores** of pet data across **3 backends** (Postgres via
Drizzle, a duplicate super-app Drizzle schema pair, and Firestore), plus denormalized
booking snapshots. The same logical pet (name / breed / photo / medical) is modeled 4+ times.

| # | Table / store | File:line | Backend | Owner key | Key fields | Written by (flow) |
|---|---------------|-----------|---------|-----------|-----------|-------------------|
| 1 | `pets` | `shared/schema.ts:8033` | Postgres | `userId` (Firebase UID, varchar) | name, species, breed, age, dateOfBirth, weight, gender, size, color, microchipId, countryOfBirth, **photoUrl**, medical block (allergies/medications/vet/vaccination + `medicalDataPrivate`/`medicalShareConsent`), temperament enum, `goodWith*`, lastWash/Walk/GroomDate, isActive | Read by booking flows: `server/services/booking-service.ts:207` (`verifyPetsOwnership`), `server/routes/booking-search.ts:438`, `server/routes/me-status.ts:112`. This is the intended canonical Postgres pet, but **no `/api/pets` writer inserts into it directly** (see §2). |
| 2 | `customerPets` | `shared/schema.ts:506` | Postgres | `customerId` → `customers.id` (serial, **legacy CRM identity, NOT Firebase UID**) | name, breed, sex, desexed, age, dateOfBirth, weight, specialRequirements, allergies, notes, washFrequency, lastWashDate, nextWashDue, nextVaccinationDate, reminderEnabled | `server/storage.ts:1424` (`createCustomerPet`); read by `server/routes.ts:16760` (`GET /api/pets` inline handler), `server/routes/user-activity.ts:60/213`, `server/services/K9000TransactionService.ts:112`. **Has NO `photoUrl` column and NO `userId` column** (see §3 bug). |
| 3 | Firestore `users/{uid}/pets/{petId}` | path `shared/firestore-schema.ts:766`; schema `petProfileSchema` `shared/firestore-schema.ts:57`; routes `server/routes/pets.ts` | Firestore | `uid` (Firebase UID) | name, photoUrl, species (enum), breed, birthday, weightKg, weight (string), microchip, vetName, medical fields, `deletedAt` | **This is what the live `/api/pets` router actually serves** (`server/routes/pets.ts` GET `/`, GET `/:petId`, POST `/`). The Pet Passport UI writes here. |
| 4 | `petProfilesForSitting` | `shared/schema.ts:4434` | Postgres | `userId` (Firebase UID) | name, breed, age, weight, photoUrl, specialNeeds, **structured `allergies` JSONB** (allergen/severity/highAlertFlag/notes), medications, vetContact, emergencyContact | `server/routes/sitter-suite.ts:735`. Sitter-suite-only duplicate of the pet, with its own richer allergy shape. FK target of `sitterBookings.petId` (`shared/schema.ts:4464`). |
| 5 | `bookingPets` | `shared/schema.ts:8587` | Postgres | link only | `bookingId`, `petId` → **`pets.id`**, notes | `server/services/booking-service.ts:572`, `server/services/BookingLifecycleService.ts:344`. Join table binding a canonical `pets` row to a booking. |
| 6 | `bookingRequestPets` | `shared/schema.ts:13726` | Postgres | link + **snapshot** | `bookingRequestId`, `petId` → `pets.id` (nullable!), **petName, petType, breed, sizeCategory, ageYears, weightKg, gender, specialNotes** + pricing snapshot | `server/routes/booking-requests.ts:646`, `server/services/quoteEngine.ts:590`. Denormalizes pet identity into the booking request; `petId` is optional so a pet can be booked with **no link to any pet record at all**. |
| 7 | `pets` (super-app) | `shared/super-app-schema.ts:74` | Postgres (duplicate model) | `userId` | Near-identical to #1 but temperament is free-text `varchar` (no enum), no `countryOfBirth`, no consent flags, no `temperamentArchived` | Legacy/duplicate super-app schema. |
| 8 | `pets` (super-app v2) | `shared/super-app-schema-v2.ts:94` | Postgres (duplicate model) | `userId` | Byte-for-byte the same as #7 | Second duplicate. Three `pgTable("pets", …)` definitions exist in the repo (#1, #7, #8), all targeting table name `pets`. |
| — | `petAvatars` | `shared/schema.ts:4086` | Postgres | `userId` | `petName` (string, **not an FK**), photoUrl, thumbnail, landmark/animation config, outfit/accessories | `server/routes/avatars.ts:427`. Cosmetic AI-avatar feature; identifies the pet only by a free-text `petName`, so it cannot be reliably joined to any pet row. |

Related (not pet-identity, excluded from the model but noted for completeness):
`petWashStations` (enterprise), `petwashPassAccounts`/`…Transactions` (wallet), `pettrek*`
(trip/GPS), `petAwarenessDays`, `petfinderListings`, `petWashVouchers2025` — these are
station / wallet / marketing objects, not pet profiles.

---

## 2. Duplication & divergence map

### 2.1 The same pet is modeled 4+ times with different shapes
A dog "Buddy" owned by one user can simultaneously exist as:
- a Firestore doc under `users/{uid}/pets` (what the Passport UI reads/writes),
- a Postgres `pets` row (what the booking engine reads via `bookingPets`/`bookingRequestPets`),
- a `customerPets` row (what the K9000 / CRM / wash-history flows read),
- a `petProfilesForSitting` row (what the sitter suite reads), and
- a denormalized `bookingRequestPets` snapshot per booking request.

Nothing keeps these in sync. Editing the pet in the Passport (Firestore) does not touch the
Postgres `pets` row the booking engine trusts.

### 2.2 The `/api/pets` split-brain (the worst divergence)
Two different `GET /api/pets` handlers exist against two different backends:

- **Router (wins):** `server/routes/pets.ts` mounted at `server/routes.ts:11370`
  (`app.use('/api/pets', …)`) — **Firestore**, Firebase-token auth. Because it is mounted
  first, Express routes `GET /api/pets` here.
- **Inline (dead / shadowed):** `server/routes.ts:16749` `app.get('/api/pets', …)` — reads
  **Postgres `customerPets`**, session-cookie auth. Registered *after* the router mount, so
  for the bare `/api/pets` path it is effectively unreachable.

So the Pet Passport UI (`client/src/pages/AddPetPassport.tsx` → `POST /api/pets`,
`PetPassportHome.tsx` → `GET /api/pets`) transacts entirely with **Firestore**, while the
booking engine reads Postgres `pets`, and CRM/wash reads Postgres `customerPets`. Three
different sources of truth answer "what pets does this user have?" depending on the code path.

### 2.3 Divergent ownership keys (identity mismatch)
| Store | Owner column | Identity space |
|-------|--------------|----------------|
| `pets`, `petProfilesForSitting`, `petAvatars`, Firestore, super-app `pets` | `userId` / `uid` | **Firebase UID (string)** |
| `customerPets` | `customerId` | **`customers.id` serial — a separate legacy CRM identity** |

`customers` (`shared/schema.ts:463`) is keyed by serial `id` + unique `email`, with **no
Firebase-UID column**. So `customerPets` cannot be joined to the Firebase-UID pet stores
without an email/manual bridge. This mirrors the known "one user_id" tension in the Master
Bible.

### 2.4 The `customerPets.userId` code-vs-schema bug
`GET /api/pets` inline handler filters `eq(customerPets.userId, userId)`
(`server/routes.ts:16761`), but `customerPets` has **no `userId` column** — the DDL
(`migrations/0000_acoustic_steel_serpent.sql:447`) and the Drizzle model
(`shared/schema.ts:506`) only define `customerId`. No migration ever adds `user_id` to
`customer_pets`. This handler would throw at runtime if it were ever reached — it survives
only because §2.2 shadows it. (Flagged as a real defect; not fixed in this design-only spike.)

### 2.5 Field-shape divergence for the same concept
- **photoUrl:** present on `pets`, `petProfilesForSitting`, Firestore, `petAvatars`; **absent
  on `customerPets`**. (Matches the historical note that the pet schema lacked photoUrl —
  it was added to `pets`/Firestore but never to `customerPets`.)
- **allergies:** free `text` on `pets`/`customerPets`; **structured JSONB with
  severity + `highAlertFlag`** on `petProfilesForSitting`. Same safety-critical concept,
  incompatible shapes.
- **temperament:** enum `petTemperamentEnum` on `pets`; free-text `varchar` on the super-app
  duplicates — a data-quality/enum-safety regression the CEO's temperament work fixed only in #1.
- **species vs petType:** `species` (enum in Firestore, varchar in Postgres) vs `bookingRequestPets.petType` vs `customers.petType` — three vocabularies.
- **age:** integer `age` AND `dateOfBirth`/`birthday` coexist in most stores; `bookingRequestPets` uses `ageYears` (decimal). No single derivation.

### 2.6 Booking snapshots have no anchor
`bookingRequestPets.petId` is **nullable** (`shared/schema.ts:13729`) and fully
denormalizes name/breed/type. A booking can therefore reference a pet that exists in no pet
table — pricing and provider handover run off an orphan snapshot.

---

## 3. Proposed canonical `PetIdentity` model (design only)

**Goal:** one authoritative pet record per real animal, owner-keyed by the platform's single
user identity, that every other store references or snapshots *from* — without a cutover.

### 3.1 Canonical store & ownership
- **Canonical table:** promote the Postgres `pets` table (`shared/schema.ts:8033`, table #1)
  to be the single `PetIdentity`. It already has the richest correct shape (enum temperament,
  consent flags, photoUrl, countryOfBirth, archived-temperament audit).
- **Ownership:** `pets.userId` = the platform's **one Firebase UID** (per the "one user_id"
  rule in [[MASTER-BIBLE]] and [[payout-rails-identity]]). A pet belongs to exactly one owner
  UID. Provider access is never by ownership — it is a scoped, consent-gated, per-booking view
  (see `server/lib/petPrivacy.ts` `filterPetForProvider`), never a copy.
- **Retire the duplicates:** the two duplicate `pgTable("pets")` in
  `super-app-schema.ts` / `super-app-schema-v2.ts` are declared redundant and should be
  deleted in a later ticket (design flags them; no removal here).

### 3.2 Canonical fields (superset, deduplicated)
Identity: `id` (serial, canonical PK), `userId` (owner UID), `name`, `species` (single enum —
adopt the 8-type Passport vocabulary: DOG/CAT/FISH/BIRD/SNAKE/RABBIT/GUINEA_PIG/OTHER per
[[pet-passport-canonical-spec-2026-07-07]]), `breed`, `dateOfBirth` (canonical; `age` becomes
a derived read-only view, never stored twice), `weight` (single unit — kg), `gender`, `size`,
`color`, `microchipId`, `countryOfBirth`, `photoUrl`.
Medical (private-by-default, consent-gated): `allergies` **(migrate to the structured JSONB
shape from `petProfilesForSitting` — severity + `highAlertFlag`, the safety-critical superset)**,
`medications`, `specialNeeds`, `vetName`/`vetPhone`, vaccination block,
`medicalDataPrivate`/`medicalShareConsent`/`medicalConsentUpdatedAt`.
Behavioral: `temperament` (enum only), `goodWithKids/Dogs/Cats`, `notes`.
Activity: `lastWashDate`/`lastWalkDate`/`lastGroomDate`, `isActive`, timestamps.

### 3.3 How existing tables reference/derive from it (no cutover)
| Existing store | Future relationship (design target) |
|----------------|--------------------------------------|
| `bookingPets` | **Already correct** — keeps FK `petId → pets.id`. No change. |
| `bookingRequestPets` | Keep as a **snapshot** (pricing needs point-in-time truth), but make `petId → pets.id` **NOT NULL** so every booked pet anchors to a canonical identity. Snapshot fields stay as historical copies, not the source of truth. |
| `petProfilesForSitting` | Becomes a **view / thin projection** of `pets` for the sitter suite (or a FK `petId → pets.id` carrying only sitter-specific extras like `emergencyContact`). Its structured allergy shape is promoted *into* canonical `pets` (§3.2). |
| `customerPets` | Bridge, don't fork. Add a nullable `petId → pets.id` and/or resolve `customers.id ↔ users.id` so CRM/K9000/wash flows read canonical identity; `customerPets` degrades to CRM-only satellite fields (washFrequency, reminders). **Requires resolving the customerId↔UID identity gap first** (§2.3) — that is the real blocker and a prerequisite ticket. |
| Firestore `users/{uid}/pets` | Pick ONE system of record. Design recommendation: Postgres `pets` is canonical; Firestore becomes either a read cache or is retired, and `/api/pets` is unified to a single handler backed by canonical `pets`. Resolving the split-brain (§2.2) is the highest-value follow-up. |
| `petAvatars` | Add FK `petId → pets.id` (replace free-text `petName`) so avatars join reliably. |

### 3.4 One `/api/pets` contract (design intent)
Collapse the two handlers into one canonical `/api/pets` reading/writing canonical `pets`,
with `petPrivacy` filters (`withOwnerMedicalFields` / `filterPetForProvider` /
`filterPetPublic`) applied by audience. The Passport UI, booking engine, sitter suite, and
CRM then all resolve the same pet by `pets.id`.

---

## 4. Known constraints from memory / docs
- **Pixel-faithful Passport is fixed, DB is not** — [[pet-passport-canonical-spec-2026-07-07]]
  explicitly says wire the Passport home to existing `/api/pets` and **do NOT rebuild the pet
  DB now** ("his big schema is aspirational/future"). This spike therefore stays design-only
  and defers the schema build. The 8 pet types and medical-privacy rules there are adopted as
  the canonical vocabulary.
- **photoUrl history** — the pet schema historically lacked `photoUrl`; it was added to `pets`
  and Firestore but **never to `customerPets`** — a live gap this model closes by canonicalizing on `pets`.
- **One user_id** — [[MASTER-BIBLE-petwash-system-2026-06-26]] mandates a single user identity;
  the `customerId`↔Firebase-UID split (§2.3) is the core obstacle to unifying pet ownership and must be resolved before `customerPets` can join canonical `pets`.
- **Medical privacy is load-bearing** — `medicalDataPrivate`/`medicalShareConsent` +
  `server/lib/petPrivacy.ts` must remain the gate on every audience; provider sees a filtered
  view for a confirmed booking only. The canonical model keeps medical private-by-default.
- **Dead-code caution** — [[dead-code-inventory-2026-06-23]]: do not bulk-delete the duplicate
  `pets`/super-app tables blindly; retirement is a scoped follow-up, not part of this spike.

## 5. Recommended follow-up tickets (not done here)
1. **Fix the `/api/pets` split-brain** — one handler, one backend (highest value).
2. **Fix `customerPets.userId` defect** (`server/routes.ts:16761`) — column doesn't exist.
3. **Resolve `customers.id ↔ Firebase UID`** identity bridge (prerequisite for unifying `customerPets`).
4. Make `bookingRequestPets.petId` NOT NULL; add FK `petId` to `petAvatars`.
5. Retire duplicate `pgTable("pets")` in the two super-app schemas.
