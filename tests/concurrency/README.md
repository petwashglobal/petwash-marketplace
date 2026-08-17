# tests/concurrency — Lane B confirm/refund race regressions

These specs pin the source-level guards Lane B introduced (2026-08-17)
against confirm/refund double-execute races. They are grep-based
regressions in the same style as `server/tests/*.regression.test.ts` and
`server/tests/emergencyWalkSlotLock.regression.test.ts` — they do NOT
require a live Postgres instance and run in the default `vitest` project.

Why not live `Promise.all([mutateSameRow(), mutateSameRow()])` tests
against a real DB: the repo does not include a Postgres test fixture in
CI (`btree_gist` is unavailable in Vitest — see
`server/tests/marketplaceSlotLock.test.ts` for the same rationale used
by the existing double-book guard). The live-DB integration lives in
`tests/integration/booking-fullcircle.test.ts` and only runs when
`API_URL` + `JWT_SECRET_TEST` are supplied, matching the shape of these
regressions.

A Lane B follow-up (out of scope for this branch, requires shared DB
fixture) should add live `Promise.all()` tests once the CI Postgres
fixture is stood up.
