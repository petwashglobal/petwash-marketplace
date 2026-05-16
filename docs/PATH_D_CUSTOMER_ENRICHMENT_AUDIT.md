# Path D Forensic Audit — Customer Profile + Pet Enrichment

**Status:** Audit + architecture proposal. No code change in this PR.
**Parent docs:**
- `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` — Path A signup architecture (merged).
- `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` — strategic rebuild plan (merged).
**Companion:** `docs/PATH_E_PROVIDER_REBUILD_AUDIT.md` (separate doc — provider infrastructure).
**Mission:** Post-signup customer profile + pet enrichment. **Luxury ecosystem onboarding, not bureaucratic forms.** Pattern: Apple Wallet / Uber profile / Revolut progressive enrichment / premium pet ecosystem identity.
**Date stamped:** 2026-05-16.

---

## §0 TL;DR

**~80% of customer profile + pet enrichment infrastructure already exists in
the codebase. It is NOT WIRED.** Path A (signup) ends with a thin, deterministic
identity record. Path D picks up from there and builds the luxury ecosystem feel
without bloating the signup itself.

**Key insight:** the pet onboarding wizard (`PetOnboardingShell.tsx`, 6 steps,
feature-flagged) already exists on disk but is not routed in production. The
profile photo upload to Google Cloud Storage works for customers. Pet photo
upload UI exists but writes nowhere. Schema gaps are minimal.

**Path D ships in 5 PRs over ~1 week** of engineering time. No legal/CPA gates.
No protected systems touched. All schema changes are additive.

**Architectural rule (CEO directive):** Path D **must behave like a luxury
ecosystem onboarding**, not a form. Think:
- **Apple Wallet** — passes that auto-populate, never feel like data entry.
- **Uber** — profile completion shown as progress milestones unlocking benefits.
- **Revolut** — progressive enrichment surfaces over weeks, not seconds.
- **Premium pet ecosystem identity** — the pet IS the user's brand inside the app.

No multi-page wizards that feel like government forms. No "fill this in or you
can't proceed." Every enrichment step is **optional but valuable** — completing
unlocks visible perks (priority booking, loyalty bonus, faster checkout).

---

## §1 What exists today

### §1.1 Customer profile photo upload — WORKING

| Component | File:Line | Status |
|---|---|---|
| Upload endpoint | `server/routes/profile-settings.ts:558-706` | POST + DELETE wired |
| Storage backend | `admin.storage().bucket()` via Firebase Admin | GCS, encrypted at rest (CMEK 256-bit AES) |
| Upload constraints | `server/routes/profile-settings.ts:601` | 5MB max, JPEG/PNG/WebP, Multer memory |
| Schema column | `users.profileImageUrl` at `shared/schema.ts:43` | varchar, nullable |
| Audit trail | Firestore `profile_change_audit` collection | written on every upload |
| Access control | Public URL via `makePublic()` at line 618 | no signed URLs needed for display |

**Gate:** `server/routes/profile-settings.ts:588-595` requires `email + phone
verified`. Phone-OTP users have phone verified ✓; email is conditional. **Edge
case:** Apple users who hide email cannot upload profile photo until they verify
their email later.

### §1.2 Pet profile CRUD — WORKING (Firestore)

| Component | File:Line | Status |
|---|---|---|
| Routes | `server/routes/pets.ts:21-186` | GET list, GET one, POST create, PATCH update, DELETE (soft) |
| Backend | Firestore subcollection `users/{uid}/pets/{petId}` | line 25-28 |
| Schema | `petProfileSchema` at `shared/firestore-schema.ts:57-79` | name, species, breed, gender, birthday, weightKg, allergies, microchip, vetName, vaccineDates |
| Allergies | `allergies: z.string().optional()` line 66 | **Free-text only — see §3.1 decision** |
| Soft delete | `deletedAt` timestamp | restorable for 30 days |

### §1.3 Pet onboarding wizard — EXISTS BUT NOT ROUTED

| Component | File:Line | Status |
|---|---|---|
| Shell | `client/src/pages/onboarding/PetOnboardingShell.tsx:1-150` | 6 steps wired client-side |
| Step order | `client/src/pages/onboarding/types.ts:21-36` | welcome → name → species → breed → photo → review |
| Draft state | In-memory React context (PetOnboardingContext.tsx) | NOT persisted to backend |
| Feature flag | `VITE_PET_ONBOARDING_SHELL_ENABLED='true'` | default off |
| Routing | `client/src/App.tsx:1056-1070` | `/onboarding/pet/:step`, feature-flagged |
| Immersive mode | `client/src/lib/immersive-routes.ts:90` | `/onboarding/pet` listed ✓ |

**Critical gap:** all 6 steps work client-side; data is lost on unmount or
browser close. No `/api/pets/draft/*` endpoints. No "resume later" across
sessions.

### §1.4 Pet photo upload — CLIENT ONLY, NO PERSISTENCE

| Component | File:Line | Status |
|---|---|---|
| Photo uploader | `client/src/pages/onboarding/components/PhotoUploader.tsx:1-112` | File picker → FileReader → base64 |
| Photo cropper | `client/src/pages/onboarding/components/PhotoCropper.tsx` | Circular crop UI |
| Photo step | `client/src/pages/onboarding/steps/PhotoStep.tsx:1-85` | Empty → cropping → confirmed phases |
| Network call | NONE | data URL stored in draft only |
| Storage write | NONE | no endpoint exists |

**Pet photo is optional in the current shell** (PhotoStep.tsx:13). Customer can
skip and continue.

### §1.5 Progressive enrichment tracking — PARTIAL

| Component | File:Line | Status |
|---|---|---|
| API | `server/routes/onboarding.ts:29-82` | GET checklist + POST milestone done |
| Milestones | Lines 11-18 | pet_profile, pet_photo, address_added, first_booking, first_review_given, loyalty_joined |
| Schema | `onboardingMilestones` at `shared/schema.ts:12968-12983` | userId, role, milestone, completedAt |
| Login gate | NONE | no "complete your profile" prompt fires on login |
| Dashboard surface | NONE | no progress badge / unlock perks UI |

**The infrastructure exists but no UI consumes it.** This is the biggest gap.

---

## §2 What's broken / fragmented

### §2.1 Pet species — 7 parallel definitions

The species enum is defined inconsistently in 7 files:

| Source | Definition | File:Line |
|---|---|---|
| Postgres `customer_pets.petType` | `varchar` free text | `shared/schema.ts:7812` |
| Postgres `booking_request_pets.petType` | `varchar(40)` w/ comment | `shared/schema.ts:13205` |
| Firestore `petProfileSchema.species` | `enum [dog, cat, other]` | `shared/firestore-schema.ts:61` |
| Client form (Pets.tsx) | `enum [dog, cat, other]` | `client/src/pages/Pets.tsx:44` |
| MyAccount pet manager | hardcoded `[dog, cat, rabbit, bird, fish, hamster, turtle, other]` (8 values) | `client/src/pages/MyAccount.tsx:482-491` |
| Booking wizard | `type "dog" \| "cat" \| "other"` | `client/src/pages/booking/MultiPetBookingWizard.tsx:36` |
| Master plan doc | proposed 15-value canonical list | `docs/product/pet-profile-luxury-onboarding-master-plan.md` §2.2 |

**Concrete bug example:** user adds a rabbit in MyAccount (line 485 allows it) →
tries to book a sitter via MultiPetBookingWizard (line 36 only knows dog/cat/
other) → rabbit becomes "other" → provider has no species hint.

### §2.2 Duplicate `/api/pets` route mounts

`server/routes.ts:9892` mounts the Firestore-backed pets router. `server/routes.ts:14999` (approx) mounts a Postgres-backed pets router on the same path. **Whichever resolves first wins.** This is a routing land-mine. Confirmed by prior audit.

### §2.3 Profile photo upload fragile gate

`server/routes/profile-settings.ts:588-595` requires BOTH email AND phone
verified. Apple users who hide email cannot upload until email verified later.
No retry / recovery UX.

---

## §3 Schema gaps

### §3.1 Pet photo URL — missing

`petProfileSchema` (`shared/firestore-schema.ts:57-79`) has every other field
but no `photoUrl`. Need:

```typescript
photoUrl: z.string().url().optional()
```

### §3.2 Allergies — decision needed (§4 below)

Current: `allergies: z.string().optional()` (free text).

Options:
- **Free text** — flexible, untyped, hard to search
- **Predefined checkboxes** — `z.array(z.enum([...]))` — searchable, safer for provider matching
- **Hybrid** — predefined checkboxes + "other" free-text input

### §3.3 Profile completion flag — exists but unused

`users.profileCompletedAt` (`shared/schema.ts:119`) exists. Not checked on login.
Not surfaced in UI. Not tied to milestones API.

---

## §4 Decisions awaiting CEO

Before any Path D code ships:

- **D-A.** Pet photo — required or optional?
  *Recommendation: optional (current). Raise to required only for "verified premium" tier later.*
- **D-B.** Pet allergies format — free text / predefined checkbox / hybrid?
  *Recommendation: hybrid. Predefined common allergens (chicken, beef, grain, fish, dairy, eggs, soy, wheat) + "other" free-text. Searchable AND flexible.*
- **D-C.** Customer profile photo — required for all OR providers only?
  *Recommendation: optional for customers, required for providers (Path E scope).*
- **D-D.** Camera capture UX — HTML native `capture="user"` OR react-webcam library?
  *Recommendation: HTML native. Lighter bundle, OS camera app integration, no new dependency.*
- **D-E.** Progressive enrichment UI — dashboard card OR login modal OR sticky banner?
  *Recommendation: dashboard card + optional login-time prompt (7-day dismissible). Not aggressive. Apple Wallet feel.*

---

## §5 Luxury ecosystem architecture (per CEO directive)

Path D must feel like **Apple Wallet / Uber / Revolut**, not government forms.
Concrete rules:

### §5.1 The deterministic onboarding state machine (CEO directive #5)

```
anonymous
   ↓
verified  (phone OTP confirmed, Firebase auth, server session)
   ↓
identified  (firstName + DOB + terms — PR-Z1 + Z1.5, ALL users)
   ↓
enriched  (NEW — Path D — optional but progressive)
   ↓
[customer/provider intent selected]
   ↓
approved | pending | restricted
```

- **No hidden fallback states.** Every state is named.
- **No soft redirects.** State transitions are explicit + reversible.
- **No silent role inference.** Role is set by intent capture, not guessed.
- **No undefined dashboard state.** Every state has exactly one canonical home.

### §5.2 What "luxury ecosystem" means in practice

| Anti-pattern (forms) | Luxury (ecosystem) |
|---|---|
| 7-step wizard you must complete | Optional cards that unlock perks |
| "Please fill in your profile" modal blocking the app | Subtle progress badge in header |
| Mandatory pet photo | "Add a photo and your pet's profile sparkles" |
| Submit button greyed out until all fields filled | Save-as-you-go; "Skip for now" available everywhere |
| Generic placeholder name "Your Pet" | "Tell us who lives with you" |
| Tax-form-style date pickers | Wallet-pass-style cards |
| Long single-page forms | Single-question screens with progress bars |
| Modal popups demanding attention | Inline cards within the natural flow |

### §5.3 Progressive enrichment unlocks

Every enrichment step unlocks a visible benefit. **Customer SEES the value of
filling it in.** This is Uber's playbook + Revolut's playbook.

| Enrichment step | Visible unlock |
|---|---|
| Profile photo uploaded | Avatar appears in app header (no more initials) |
| First pet added | Wash booking available + loyalty tier "Bronze" |
| Pet photo added | Pet's avatar appears in booking cards |
| Pet DOB added | Birthday reminder + birthday treat unlock |
| Pet allergies added | "Pet-safe products only" badge on bookings |
| Address added | Location-based booking + delivery |
| Phone verified | SMS confirmations + faster checkout |
| Email verified | Email receipts + wallet pass delivery |

---

## §6 5-PR sequence (Path D delivery plan)

### PR-D1 — Route the existing pet onboarding wizard + draft persistence

**Files:**
- `shared/schema.ts` — new `petOnboardingDrafts` table (id, userId, petId, stepId, partialData JSONB, expiresAt, createdAt)
- `server/routes/pet-drafts.ts` (new) — GET, POST, PATCH, finalize
- `client/src/pages/onboarding/PetOnboardingContext.tsx` — wire fetchDraft / saveDraft (currently stubbed)
- `.env.local` — flip `VITE_PET_ONBOARDING_SHELL_ENABLED=true`

**Schema migration:** new table only, additive. Drizzle.
**Risk:** LOW. Draft is internal scratchpad.
**Rollback:** disable flag + drop draft table.
**Mobile Safari:** mandatory verification of step-to-step navigation.
**Interruption recovery:** 30-day TTL on drafts; resume from any device with same login.

### PR-D2 — Pet photo upload + GCS persistence

**Files:**
- `shared/firestore-schema.ts` — add `photoUrl: z.string().url().optional()`
- `server/routes/pet-photos.ts` (new) — `POST /api/pets/:petId/photo`, `DELETE /api/pets/:petId/photo`
- `client/src/pages/onboarding/steps/PhotoStep.tsx` — on review-step continue, POST base64 to server
- Reuse GCS bucket from customer profile photo (`profile-photos/` → `pet-photos/{uid}/{petId}/`)

**Risk:** LOW. Same storage backend as customer profile photo.
**Rollback:** DELETE endpoint removes GCS file, photoUrl column nullable.
**iPhone Safari:** native `<input type="file" accept="image/*" capture="environment">` (rear camera for pets). Test on both iPhone + iPad.

### PR-D3 — Pet allergies (decision-gated)

**Files:**
- `shared/firestore-schema.ts` — replace `allergies: string` with hybrid:
  ```typescript
  allergyTags: z.array(z.enum([
    "chicken", "beef", "grain", "fish", "dairy",
    "eggs", "soy", "wheat", "other"
  ])).optional(),
  allergyOther: z.string().optional(),
  ```
- New onboarding step: `client/src/pages/onboarding/steps/AllergiesStep.tsx`
- Backfill script for existing free-text allergies (`server/scripts/migrate-allergies.ts`)

**Risk:** MEDIUM. Existing free-text data must be preserved during migration.
**Rollback:** keep old column, add new alongside (non-destructive).
**Decision needed:** D-B above.

### PR-D4 — Progressive enrichment dashboard card + login prompt

**Files:**
- `client/src/components/ProfileCompletionCard.tsx` (new) — dashboard card showing % complete + perks unlocked
- `client/src/components/ProfileCompletionPrompt.tsx` (new) — optional login-time modal, 7-day dismissible
- `server/routes/onboarding.ts` — extend `/api/onboarding/checklist` with completion %
- Schema: `users.profileEnrichmentLastPromptedAt` (optional, prevents prompt fatigue)

**Risk:** LOW. UI surface only.
**Rollback:** comment out card mount in App.tsx.
**Apple Wallet feel:** card looks like a wallet pass with subtle gradient + unlock icons.

### PR-D5 — Species enum canonicalization (cleanup, deferrable)

**Files:**
- `shared/data/pet-species.ts` (new) — single canonical enum (15 values per master plan)
- Update all 7 sites listed in §2.1 to import from shared
- Migration script to map legacy free-text → enum (fuzzy match)

**Risk:** HIGH. Touches booking logic + existing data.
**Rollback:** revert each file independently; keep old columns.
**Defer until:** D1-D4 ship + soak 1 week in staging.

---

## §7 Five-filter analysis (per SKILL.md §0.8)

| Filter | Verdict |
|---|---|
| Better? | ✓✓✓ Existing wizard wired = immediate value; luxury card UX beats form |
| Cheaper? | ✓✓✓ ~80% of code exists; ~1 week to ship D1-D4 |
| Faster? | ✓✓ Compared to building from scratch |
| Easier? | ✓✓ Schema is additive only; no protected systems |
| Luxurious? | ✓✓✓ Per CEO doctrine — Apple Wallet feel, not forms |

**Honest miss:** progressive enrichment requires SUSTAINED user attention to
"complete your profile" prompts. If we're too aggressive, customers feel
nagged. If too subtle, completion rates stay low. Tune the cadence in
stabilization.

---

## §8 Strategic equation check (§0.7)

```
PetWash™ =
  premium pet-care infrastructure       ← pet photo + name + breed in profile ✓
  + safer everyday washing               ← allergies inform wash chemistry ✓
  + cleaner urban living                 ← N/A here
  + eco-conscious operations             ← N/A here
  + scalable deployment system           ← profile completion unlocks features ✓
  + luxury brand discipline              ← Apple Wallet feel ✓
```

Path D strengthens 4 of 6 terms. No degradation.

---

## §9 PR template requirements (per CEO directive #6)

Every Path D PR ships with all of:

- ✅ iPhone Safari verification (mandatory)
- ✅ iPad Safari verification (mandatory)
- ✅ Interruption recovery behavior described (network drop, back button, browser close)
- ✅ Exact route/state diagram (showing transitions between anonymous → verified → identified → enriched → role-bound states)
- ✅ Fallback analysis (what happens if photo upload fails? What if draft API 500s?)
- ✅ Legal-risk notes (none expected for Path D, but explicit "n/a" required)

---

## §10 What this PR does NOT do

- No code changes
- No schema migration
- No new dependencies
- No CI workflow change
- No protected systems touched
- No Path E content (provider rebuild — separate doc)
- No PR-D1 through PR-D5 opened (gated on CEO decisions D-A through D-E)

---

## §11 References

- `docs/SIGNUP_ONBOARDING_FORENSIC_AUDIT.md` — Path A (signup determinism)
- `docs/MOBILE_FIRST_2026_REBUILD_AUDIT.md` — strategic rebuild plan
- `docs/product/pet-profile-luxury-onboarding-master-plan.md` — CEO product master plan
- `client/src/pages/onboarding/PetOnboardingShell.tsx` — existing wizard
- `server/routes/profile-settings.ts` — existing customer profile photo upload
- `server/routes/pets.ts` — existing pet CRUD (Firestore)
- `server/routes/onboarding.ts` — existing milestones API
- `shared/firestore-schema.ts:57-79` — pet schema
- `.claude/skills/petwash-platform/SKILL.md` §0 — luxury brand discipline

---

**End of Path D audit.** No code ships. Implementation gated on CEO decisions
D-A through D-E in §4.
