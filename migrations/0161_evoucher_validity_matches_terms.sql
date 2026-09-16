-- 2026-09-17: gift cards that were sold with a 1-year expiry instead of 5.
--
-- Our published Terms say, in English and in Hebrew:
--   "E-vouchers are valid for 60 months (5 years) from purchase date"
--   "שוברים דיגיטליים תקפים ל-60 חודשים (5 שנים) מתאריך הרכישה"
-- and, for anything issued before that policy:
--   "retain their original expiry date or 5 years from purchase, whichever is
--    longer".
--
-- server/nayaxService.ts stamped `expires_at = now + 365 days` onto every
-- voucher bought through the Nayax rail. The redeem routes test expires_at, so
-- on day 366 the remaining balance was refused — a customer's paid-for money,
-- gone four years before we said it could be. The code is fixed; this is the
-- half the code cannot fix, the cards already sold.
--
-- ONLY EXTENDS. The WHERE clause matches rows whose expiry is EARLIER than the
-- promise, and sets it to exactly the promise, so no card is ever shortened and
-- re-running changes nothing. Cards with no expiry recorded are left alone —
-- redemption already treats NULL as valid, and writing a date there would take
-- something away.
--
-- Plain statements only: scripts/apply-pending-migrations.ts splits on ';'.

UPDATE e_vouchers
   SET expires_at = created_at + INTERVAL '60 months'
 WHERE expires_at IS NOT NULL
   AND expires_at < created_at + INTERVAL '60 months';
