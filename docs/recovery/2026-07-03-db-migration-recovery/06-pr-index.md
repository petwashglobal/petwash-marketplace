# 06 — PR Index & Commit SHAs (#1255–#1260)

All merged to `main`. Links use the canonical repo `petwashglobal/petwash-marketplace`.

| PR | Merge SHA | Title | Domain | Touches DB? |
|---|---|---|---|---|
| [#1255](https://github.com/petwashglobal/petwash-marketplace/pull/1255) | `45cd5f416` | feat(provider): structured-ID default onboarding — no forced image, post-only docs | Provider onboarding | Reuses existing `kycDocumentType`/`kycDocumentExpiry` columns (no new migration) |
| [#1256](https://github.com/petwashglobal/petwash-marketplace/pull/1256) | `87f69cb85` | fix(k9000): fail-closed refund when a paid wash never starts | K9000 money runtime | No schema change (marks nayax txn failed) |
| [#1257](https://github.com/petwashglobal/petwash-marketplace/pull/1257) | `4278079eb` | feat(trust): escalate off-platform dealing to a tracked TRUST case | Trust/incidents | Uses existing `incident_reports`; new incident type (enum in code) |
| [#1258](https://github.com/petwashglobal/petwash-marketplace/pull/1258) | `09b280e8a` | fix(migrations): tolerate 42883/42704 drift so the walker reaches new migrations | Migration tooling | Runner only — **carried the 2026-07-03 proving run** |
| [#1259](https://github.com/petwashglobal/petwash-marketplace/pull/1259) | `3dcfb3907` | feat(trust): address-match fraud signal — link booker & provider | Trust/incidents | New `server/lib/addressMatch.ts`; reads `users` address fields; new incident type |
| [#1260](https://github.com/petwashglobal/petwash-marketplace/pull/1260) | `6e50cbc10` | fix(migrations): legacy-baseline drift skip ends the endless catch-up | Migration tooling | Runner only — durable insurance vs future legacy poison codes |

## Migration-relevant history

- **#1258** added PG codes `42883` / `42704` to the runner's tolerated-drift set. This is what
  let run `28633508916` skip the two orphaned legacy files and reach `0088`.
- **#1260** added `MIGRATION_BASELINE` (default 88): in `--lenient` mode any error on a file with
  prefix `<= baseline` is skipped as legacy drift; files `> baseline` still fail closed. Ends the
  "add one code per merge" cycle.
- Neither changes any migration SQL, schema, money, or runtime behavior.

## New tables reaching prod via these PRs

- `0088_host_stay_journey.sql` → `host_stay_details`, `booking_handover_events` — **applied 2026-07-03**
  (came in with the Host Stay Journey feature work, unblocked by #1258/#1260). See file 05 for verify.
