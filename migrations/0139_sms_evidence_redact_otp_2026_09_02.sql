-- AUDIT-SMS-7 / #222 — retroactively scrub any 4-8 digit run from historical
-- sms_evidence.rendered_text rows where message_type = 'OTP'.
--
-- Motivation: the sms_evidence table stores every rendered SMS body so we can
-- prove — years later — that a given message actually went out. For OTP
-- messages, that meant every historical row carried a fully-usable, reusable
-- OTP code in plain text. Anyone with SELECT on this table (SRE with prod DB
-- access, a leaked backup, an admin tool) got a working OTP for the destination
-- phone number in the same row. The canonical verifier lives in
-- verification_challenges.code_hash — the scrubbed digits are not needed for
-- evidence-of-delivery (the row itself, plus the destination + timestamp, is
-- the evidence).
--
-- Idempotent: repeat runs are safe because regexp_replace on already-scrubbed
-- text is a no-op (the ****** placeholder contains no digits).

UPDATE sms_evidence
   SET rendered_text = regexp_replace(rendered_text, '\d{4,8}', '******', 'g')
 WHERE message_type = 'OTP'
   AND rendered_text ~ '\d{4,8}';
