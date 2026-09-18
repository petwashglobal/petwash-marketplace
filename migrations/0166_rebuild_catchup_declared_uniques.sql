-- 0166_rebuild_catchup_declared_uniques.sql  (2026-09-18, schema-rebuild catch-up 5 of 5)
--
-- ⚠️  LISTED IN migrations/.manual-migrations.txt — the production runner
--     records this file as bootstrapped and NEVER executes it. Read below
--     before removing that line.
--
-- These 20 UNIQUE indexes are declared in shared/schema*.ts, are NOT produced
-- by replaying migrations/, and — unlike everything else in this catch-up —
-- are NOT present in production either (checked against the committed prod
-- schema dump, docs/recovery/2026-07-03-db-migration-recovery/prod-schema-2026-07-03.sql).
--
-- So creating them is not a no-op: it is a real integrity change on live tables,
-- several of which are money tables whose uniqueness is the idempotency
-- guarantee (ledger_v2_entries.entry_id, ledger_v2_transactions.idempotency_key,
-- ledger_v2_pending_transfers.idempotency_key, refund_transactions.refund_id and
-- .idempotency_key, settlements(partner, period), contractor_earnings(booking,
-- type)). If any of those tables already holds duplicate rows, CREATE UNIQUE
-- INDEX fails with 23505 — which is exactly what happened with
-- 0124_concurrency_p0_uniques_2026_08_24 on 2026-08-24 and blocked every deploy
-- until it was allowlisted.
--
-- The file exists so that a database rebuilt from migrations/ alone matches
-- shared/schema*.ts completely (the PGlite rebuild gate in
-- server/tests/migrationsRebuildSchema.regression.test.ts applies every file
-- directly, so these DO get created there, on empty tables, safely).
--
-- TO APPLY IN PRODUCTION: run the read-only duplicate scan first --
--   Actions > "Declared-Unique Duplicate Scan (prod, read-only)" > Run workflow
-- (.github/workflows/declared-unique-duplicate-scan.yml, which runs
-- scripts/scan-declared-unique-duplicates.mjs and parses its target list out of
-- THIS file, so the two cannot drift apart). It issues nothing but
-- SELECT ... GROUP BY ... HAVING count(*) > 1 and prints counts, not rows.
--
-- GREEN: delete this file's line from migrations/.manual-migrations.txt and the
--        next deploy creates all 20 indexes.
-- RED:   the log names each table and how many duplicated keys it holds. Every
--        duplicate on an idempotency key is something written twice that was
--        meant to be written once -- decide what happens to those rows first.

CREATE UNIQUE INDEX IF NOT EXISTS adoption_favorites_user_id_listing_id_pk ON public.adoption_favorites USING btree (user_id, listing_id);
CREATE UNIQUE INDEX IF NOT EXISTS adoption_listings_legacy_paw_finder_post_id_unique ON public.adoption_listings USING btree (legacy_paw_finder_post_id);
CREATE UNIQUE INDEX IF NOT EXISTS adoption_listings_listing_key_unique ON public.adoption_listings USING btree (listing_key);
CREATE UNIQUE INDEX IF NOT EXISTS case_id_sequences_case_date_category_pk ON public.case_id_sequences USING btree (case_date, category);
CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_thread_id_unique ON public.chat_threads USING btree (thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS egift_guest_orders_external_id_unique ON public.egift_guest_orders USING btree (external_id);
CREATE UNIQUE INDEX IF NOT EXISTS egift_reservations_reservation_id_unique ON public.egift_reservations USING btree (reservation_id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_v2_accounts_account_id_unique ON public.ledger_v2_accounts USING btree (account_id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_v2_entries_entry_id_unique ON public.ledger_v2_entries USING btree (entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_v2_pending_transfers_idempotency_key_unique ON public.ledger_v2_pending_transfers USING btree (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_v2_pending_transfers_pending_id_unique ON public.ledger_v2_pending_transfers USING btree (pending_id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_v2_transactions_idempotency_key_unique ON public.ledger_v2_transactions USING btree (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS privilege_members_email_unique ON public.privilege_members USING btree (email);
CREATE UNIQUE INDEX IF NOT EXISTS privilege_members_member_id_unique ON public.privilege_members USING btree (member_id);
CREATE UNIQUE INDEX IF NOT EXISTS refund_transactions_idempotency_key_unique ON public.refund_transactions USING btree (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS refund_transactions_refund_id_unique ON public.refund_transactions USING btree (refund_id);
CREATE UNIQUE INDEX IF NOT EXISTS remittance_email_log_pk ON public.remittance_email_log USING btree (batch_id, provider_uid);
CREATE UNIQUE INDEX IF NOT EXISTS sumit_customers_sumit_customer_id_unique ON public.sumit_customers USING btree (sumit_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contractor_earnings_booking_type ON public.contractor_earnings USING btree (booking_id, contractor_type);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_settlements_partner_period ON public.settlements USING btree (partner_id, period_start, period_end);
