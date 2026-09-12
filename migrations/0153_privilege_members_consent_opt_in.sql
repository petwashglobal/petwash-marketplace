-- 2026-09-12 consent audit P0-7: privilege_members recorded affirmative marketing,
-- SMS and Terms consent BY DEFAULT, with a fabricated NOW() timestamp, for any row
-- created by any path. Consent is opt-in. Existing rows are NOT rewritten here —
-- which historical rows carried a real tick is a CEO/data decision.
ALTER TABLE privilege_members ALTER COLUMN marketing_consent SET DEFAULT FALSE;
ALTER TABLE privilege_members ALTER COLUMN sms_consent SET DEFAULT FALSE;
ALTER TABLE privilege_members ALTER COLUMN terms_consent SET DEFAULT FALSE;
ALTER TABLE privilege_members ALTER COLUMN terms_consent_at DROP DEFAULT;
