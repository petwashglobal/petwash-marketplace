/**
 * Unified append-only, double-entry ledger v2 — Drizzle definitions.
 *
 * Mirrors migrations/0115_ledger_v2.sql EXACTLY. Foundation for
 * docs/design/2026-08-08-unified-append-only-ledger.md. DARK: no production code
 * queries these yet (LEDGER_V2_ENABLED default OFF). Isolated in its own module
 * (like schema-finance / schema-loyalty) so the main schema.ts is untouched.
 */

import {
  pgTable,
  varchar,
  integer,
  bigint,
  bigserial,
  serial,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
// NOTE: no `import { sql }` here on purpose. The DB columns carry DEFAULT '{}'::jsonb
// (migration 0115), so we don't need a Drizzle-level sql default — and avoiding the
// module-load sql`` call keeps this schema importable under tests that mock drizzle-orm.

// ── 7c. ledger_transactions — balance-enforcing envelope + idempotency anchor ──
export const ledgerTransactions = pgTable("ledger_v2_transactions", {
  transactionId:  varchar("transaction_id",  { length: 80 }).primaryKey(),
  idempotencyKey: varchar("idempotency_key",  { length: 160 }).notNull().unique(),
  eventType:      varchar("event_type",       { length: 60 }).notNull(),
  totalDebits:    integer("total_debits").notNull(),
  totalCredits:   integer("total_credits").notNull(),
  responseJson:   jsonb("response_json"),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── 7a. ledger_accounts — chart of accounts ──
export const ledgerAccounts = pgTable("ledger_v2_accounts", {
  id:          serial("id").primaryKey(),
  accountId:   varchar("account_id",   { length: 160 }).notNull().unique(),
  accountType: varchar("account_type", { length: 20 }).notNull(),
  ownerType:   varchar("owner_type",   { length: 20 }).notNull(),
  ownerId:     varchar("owner_id",     { length: 128 }),
  bucket:      varchar("bucket",       { length: 40 }).notNull(),
  currency:    varchar("currency",     { length: 3 }).default("ILS").notNull(),
  normalSide:  varchar("normal_side",  { length: 10 }).notNull(),
  isActive:    boolean("is_active").default(true).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── 7d. ledger_pending_transfers — holds / J5 / escrow (resolve ONCE) ──
export const ledgerPendingTransfers = pgTable("ledger_v2_pending_transfers", {
  id:              serial("id").primaryKey(),
  pendingId:       varchar("pending_id",        { length: 80 }).notNull().unique(),
  kind:            varchar("kind",              { length: 30 }).notNull(),
  fromAccountId:   varchar("from_account_id",   { length: 160 }).notNull(),
  toAccountId:     varchar("to_account_id",     { length: 160 }).notNull(),
  amountCents:     integer("amount_cents").notNull(),
  status:          varchar("status",            { length: 12 }).default("open").notNull(),
  bookingId:       varchar("booking_id",        { length: 120 }),
  paymentRef:      varchar("payment_ref",       { length: 120 }),
  idempotencyKey:  varchar("idempotency_key",   { length: 160 }).unique(),
  openEntryTxn:    varchar("open_entry_txn",    { length: 80 }),
  resolveEntryTxn: varchar("resolve_entry_txn", { length: 80 }),
  expiresAt:       timestamp("expires_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt:      timestamp("resolved_at", { withTimezone: true }),
});

// ── 7b. ledger_entries — append-only, double-entry ──
export const ledgerEntries = pgTable("ledger_v2_entries", {
  id:             bigserial("id", { mode: "number" }).primaryKey(),
  entryId:        varchar("entry_id",        { length: 80 }).notNull().unique(),
  transactionId:  varchar("transaction_id",  { length: 80 }).notNull(),
  accountId:      varchar("account_id",      { length: 160 }).notNull(),
  direction:      varchar("direction",       { length: 10 }).notNull(),
  amountCents:    integer("amount_cents").notNull(),
  currency:       varchar("currency",        { length: 3 }).default("ILS").notNull(),
  eventType:      varchar("event_type",      { length: 60 }).notNull(),
  divisionCode:   varchar("division_code",   { length: 40 }),
  sourceType:     varchar("source_type",     { length: 40 }),
  idempotencyKey: varchar("idempotency_key", { length: 160 }),
  bookingId:      varchar("booking_id",      { length: 120 }),
  paymentRef:     varchar("payment_ref",     { length: 120 }),
  pendingId:      varchar("pending_id",      { length: 80 }),
  reversalOf:     varchar("reversal_of",     { length: 80 }),
  vatMode:        varchar("vat_mode",        { length: 24 }),
  createdBy:      varchar("created_by",      { length: 128 }).notNull(),
  ipAddress:      varchar("ip_address",      { length: 45 }),
  metadata:       jsonb("metadata"),
  previousHash:   varchar("previous_hash",   { length: 64 }).notNull(),
  entryHash:      varchar("entry_hash",      { length: 64 }).notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ledger_v2_entries_txn_idx").on(table.transactionId),
  index("ledger_v2_entries_acct_id_idx").on(table.accountId, table.id),
  index("ledger_v2_entries_booking_idx").on(table.bookingId),
  index("ledger_v2_entries_idem_idx").on(table.idempotencyKey),
  index("ledger_v2_entries_payment_idx").on(table.paymentRef),
  index("ledger_v2_entries_event_idx").on(table.eventType),
  index("ledger_v2_entries_created_idx").on(table.createdAt),
  index("ledger_v2_entries_division_idx").on(table.divisionCode),
]);

// ── 7e. ledger_balance_cache — DERIVED, non-authoritative ──
export const ledgerBalanceCache = pgTable("ledger_v2_balance_cache", {
  accountId:      varchar("account_id",   { length: 160 }).primaryKey(),
  availableCents: integer("available_cents").default(0).notNull(),
  pendingCents:   integer("pending_cents").default(0).notNull(),
  postedCents:    integer("posted_cents").default(0).notNull(),
  lastEntryId:    bigint("last_entry_id", { mode: "number" }).default(0).notNull(),
  rebuiltAt:      timestamp("rebuilt_at", { withTimezone: true }).defaultNow().notNull(),
});
