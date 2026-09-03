# Pet Wash — Post-Release Engineering Backlog

Severity-ranked. Continuously improved AFTER release. Not required to
close the current release.

New findings land here by default. Something only jumps to
`RELEASE-BLOCKERS.md` if it is a P0 security / money / data-loss
issue, a direct regression of a release-blocker fix, or a test the
release requires that we can't ship without.

---

## P1

- **`IsraeliDigitalReceiptService.ts:1294-1301` — SUMIT credit-note
  stamp UPDATE swallowed on error.** Local `sumitDocumentId` not
  written; ops can re-issue in SUMIT and produce the double-credit
  scenario the comment warns about. Fix: enqueue a retry into the
  `fiscal_document_outbox` (drainer already shipped this release —
  just needs the SUMIT-stamp path to write a row on failure).

- **Fiscal outbox admin surface** — a small `/api/admin/fiscal-outbox`
  read + `POST /api/admin/fiscal-outbox/:id/force-retry` and
  `POST /api/admin/fiscal-outbox/:id/mark-reviewed` so ops can act on
  `failed_needs_review` rows the drainer flags. Drainer + retry loop
  already ship — only the surface is deferred.

## P2 — hygiene / observability

- Per-file grep-scanning pins that overlap the invariant pins already
  in `server/tests/*.regression.test.ts`. Consolidate to reduce
  duplication.

- Dependabot alert stream on the repo (3 high, 4 moderate at last
  push). Triage and land the safe ones.

- `tsc --noEmit` full-repo run takes > 3 minutes in this environment.
  Investigate whether the tsconfig `include` is over-broad or if a
  `tsc --incremental` cache would help CI.

- Playwright `returning-user-passkey.e2e.spec.ts` uses stubbed
  endpoints. When the live-app-E2E infra lands (booted server +
  Firebase emulator + DB), rewrite the same scenarios against real
  runtime.

## P3 — deferred product decisions

- **#135 Pet Finder** — CEO marked "off-instructions". Awaiting product
  decision before any code moves.

- **#166 Nayax letter** — external partner communication; drafted, not
  sent. Blocked on business channel.

- **#90 D-series follow-up defects** — no source documents in the repo;
  reconstruct from audit logs before actioning.

---

## Rules for editing this list

1. Every entry has file:line or endpoint anchor and one-line why.
2. Nothing moves back to `RELEASE-BLOCKERS.md` without a P0 label
   AND a written justification (security / money / data-loss / direct
   regression of a release fix).
3. When something ships, delete the entry — don't strike-through
   forever. Git history is the audit.
