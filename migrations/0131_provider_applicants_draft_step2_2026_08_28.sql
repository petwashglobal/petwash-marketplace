-- 0131 — Provider onboarding draft persistence for Step 2 + Step 3 fields.
-- CEO 2026-08-28 §31 non-negotiable: "Every provider section: SAVE SERVER-
-- SIDE. User closes browser. Returns tomorrow. Exact state survives."
--
-- Until this migration the wizard debounce-saved only Step 1 fields
-- (firstName, lastName, phoneNumber, dateOfBirth, streetAddress, city,
-- postalCode, country) — Step 2 (ID number, doc type/expiry, insurance
-- policy/provider/expiry, pet first aid number/expiry, tax status, driving
-- license) + Step 3 (14 declarations, residential history, background-
-- check consent, self-declaration, enhanced-verification reasons) all
-- lived in client React state only, so a browser close mid-form erased
-- everything the applicant had typed past personal details.
--
-- One opaque jsonb column keyed by shape { step2: {...}, step3: {...} }
-- keeps this migration additive: future onboarding sections drop in as
-- more top-level keys without another schema change. The application
-- SUBMIT path stays authoritative — this column is DRAFT-ONLY state,
-- never authoritative record of submitted answers.

ALTER TABLE provider_applicants
  ADD COLUMN IF NOT EXISTS draft_step2_step3 jsonb;

COMMENT ON COLUMN provider_applicants.draft_step2_step3 IS
  'Draft-only client-form-state for provider onboarding Step 2 (documents/insurance/tax/first-aid/driving license) and Step 3 (declarations/residential-history/consent). NOT the authoritative record of submitted answers — those live in provider_applications columns after /apply. Purge on status transition off draft.';
