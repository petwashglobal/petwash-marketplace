# Tax Receipt Sequence — Concurrency Hardening (CRITICAL, legal)

**Severity: HIGH / legal.** Found 2026-06-14 by the load audit + verified.

## The bug
`server/services/TaxSequenceService.ts` `allocateTaxSequenceNumber()` and
`server/services/TaxDocumentService.ts` `issueTaxDocument()` guard ITA sequence
numbering with `pg_advisory_lock` via `db.execute(...)`. But **`db` is a connection
pool** — every `db.execute` / `db.select` / `db.insert` checks out a *different*
pooled connection, and `pg_advisory_lock` is **session (connection) scoped**. So:

- The lock is acquired on connection A.
- The `SELECT MAX(sequence_number)` runs on connection C (does **not** hold the lock).
- The `INSERT` runs on connection E (does **not** hold the lock).
- The "reentrant refcount 2→1" comment in `issueTaxDocument` is **wrong** — the second
  `pg_advisory_lock` may land on a *different* connection, so it isn't reentrant.

**Result:** the lock provides ~no protection. Two concurrent receipt issues can read
the same MAX and both write the same `sequence_number`. There is **NO unique constraint**
on `pw_tax_documents (document_type, sequence_year, sequence_number)` as a backstop →
**duplicate ITA receipt numbers are possible** = non-compliant.

Low probability today (low volume), but it's a correctness/legal landmine under any
spike. Callers: `IsraeliDigitalReceiptService.ts:151`, `TaxDocumentService.ts:82`.

## Fix — two parts (apply in order)

### Part 1 — DB backstop (do this first; makes duplicates IMPOSSIBLE)
**Step 1a — check prod for existing duplicates BEFORE adding the constraint:**
```sql
SELECT document_type, sequence_year, sequence_number, COUNT(*)
FROM pw_tax_documents
WHERE sequence_number IS NOT NULL
GROUP BY 1,2,3 HAVING COUNT(*) > 1;
```
If this returns rows, resolve them (void + reissue the later one) before Step 1b, or the
index creation will fail.

**Step 1b — add the unique index** (partial, ignores not-yet-numbered rows):
```sql
CREATE UNIQUE INDEX CONCURRENTLY uq_pw_tax_doc_seq
  ON pw_tax_documents (document_type, sequence_year, sequence_number)
  WHERE sequence_number IS NOT NULL;
```
(Use `CONCURRENTLY` + run outside a migration transaction, or a plain `CREATE UNIQUE
INDEX` inside the migration if the table is small.) After this, a duplicate **errors**
instead of silently writing an illegal receipt. `issueTaxDocument` already returns null
on failure, so the worst case becomes a *retryable missing* receipt, not a *duplicate*.

### Part 2 — correct the lock (so it stops erroring, done with a load test)
Run lock + SELECT-MAX + INSERT in **one transaction** on **one connection**, using a
**transaction-scoped** lock (`pg_advisory_xact_lock`, auto-released at commit/rollback):
```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`); // held until commit
  const [{ maxSeq }] = await tx.select({ maxSeq: max(pwTaxDocuments.sequenceNumber) })
    .from(pwTaxDocuments)
    .where(and(eq(pwTaxDocuments.documentType, documentType), sql`sequence_year = ${year}`));
  const next = (maxSeq ?? 0) + 1;
  await tx.insert(pwTaxDocuments).values({ /* …, sequenceYear: year, sequenceNumber: next */ });
});
```
- Refactor `allocateTaxSequenceNumber` to accept the caller's `tx` and use `pg_advisory_xact_lock`.
- Drop the manual `pg_advisory_lock`/`pg_advisory_unlock` (and the bogus "reentrant" comment).
- Update both callers to wrap allocate + INSERT in the same `db.transaction`.
- **Verify with a concurrency test** (e.g. fire 50 parallel receipt issues, assert no dup/gap)
  before trusting it — this is why it wasn't blind-shipped in the long session.

## Why this wasn't auto-merged
Per the CEO operating standard (*money real, no sorry after, no green check without
proof*): a blind, un-load-tested change to the legal receipt-numbering path is riskier
than the latent bug. Part 1 needs a **prod dup-check + your migration apply**; Part 2
needs a **concurrency test**. Do Part 1 now (safe guarantee), Part 2 next (tested).
