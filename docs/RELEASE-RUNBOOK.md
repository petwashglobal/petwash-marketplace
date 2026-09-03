# Pet Wash — Release Runbook

Deploy + rollback for the release on branch
`returning-user-auth-architecture`. Covers everything shipped since
scope-freeze on 2026-09-02 (A + B + C sections of
`docs/RELEASE-BLOCKERS.md`, closed via `docs/RELEASE-AUTH-GATE.md`
and `docs/RELEASE-QA-MATRIX.md`).

Written 2026-09-02.

---

## 1 · What ships

**Feature summary** — returning-user auth complete + all fail-safe
hardening from the 2026-09-02 audit. Detail lives in the three gate
docs referenced above. This runbook is the deploy artefact.

**Backwards-compatible?** Yes for everything except two deliberately
retired endpoints:

- `PUT /api/profile` → **410 Gone** (canonical writer is `PATCH
  /api/profile`). Any surviving client sees the 410 with `Location:
  /api/profile` and a Zod-safe JSON body. No known first-party client
  writes to PUT.
- `POST /api/simple-auth/login` and `POST /api/simple-auth/logout` →
  410 Gone (already retired earlier; unchanged this release).

**New environment variables** — all have safe defaults and NONE are
required at boot:

| Env var                       | Default | What it controls                                      |
| ----------------------------- | ------- | ----------------------------------------------------- |
| `SYSTEM_CONFIG_REFRESH_MS`    | `30000` | Fleet-wide flag refresh cadence (B1).                 |
| `FISCAL_OUTBOX_TICK_MS`       | `60000` | Fiscal outbox drainer tick interval (A3+A4+A5).       |
| `IDEMPOTENCY_PENDING_LEASE_MS`| `300000`| Pre-existing; B7 fix makes finalize failure release the lease. |
| `SMS_IP_SEND_LIMIT`           | `12`    | Pre-existing; per-IP SMS send window cap.             |
| `PROVIDER_DECLARATIONS_ENFORCE` | `on` | B2 already defaulted-on. Set `off` for shadow-only.   |
| `RECONFIRMATION_ENFORCE`      | `off`   | B2. `on` enforces, DB error → 503 GATE_UNAVAILABLE.   |

Missing / malformed values default per the code — no boot-blockers.

**Required infrastructure** — the release assumes what production
already has:

- Redis reachable via `REDIS_URL` (rate limiters, one-tap handoff,
  idempotency). If REDIS_URL is unset the app boots and all the
  Redis-backed limiters fail closed (return `false` / `null`) —
  writes that need Redis will refuse rather than fall back to
  per-pod state.
- Postgres reachable via `DATABASE_URL` (new tables + system_config).

---

## 2 · Migrations to run

**Two migrations land this release. Both are additive (no drop, no
column rename).**

| # | File                                                    | What it adds                                                  |
| - | ------------------------------------------------------- | ------------------------------------------------------------- |
| 1 | `migrations/0142_fiscal_document_outbox_2026_09_02.sql` | `fiscal_document_outbox` table + UNIQUE (kind, source_key) + drainer index. |
| 2 | `migrations/0143_system_config_shared_store_2026_09_02.sql` | `system_config` (key, value_json, updated_at, updated_by) + updated_at index. |

**Order:** run 0142 first, then 0143. Order does not actually matter
(they touch disjoint tables) but 0142 is the older release-blocker.

**Runtime coupling:** the app code that WRITES to either table is
idempotent — an `IF NOT EXISTS` migration re-run is a no-op.

---

## 3 · Deploy sequence

1. **Merge** branch `returning-user-auth-architecture` into `main`.
   (Rebase if `main` moved. Do not squash — commit history is the
   audit trail and each commit ships an independently-reviewable
   release-blocker fix.)
2. **Apply migrations** on the production DB (0142 then 0143). Both
   are `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`,
   so re-running is safe.
3. **Deploy** the built image to Cloud Run using the existing
   pipeline. No new env-var is required for the release to boot —
   the defaults above ship the release-blocker fixes ON.
4. **Watch for the two boot logs** confirming the new subsystems
   started (both are non-blocking on failure, so the app still
   boots):
   - `[SystemConfig] hydrate` — B1 shared flag store.
   - `[FiscalOutboxDrainer] started { tickMs: 60000 }` — A3/A4/A5
     drainer.
5. **Perform the external smoke** (see §5) from a workstation with
   normal internet egress.
6. **If §5 passes**, deploy is done. If it fails, run §6 rollback.

Estimated dependency-free downtime: **none** (migrations are
additive; no column rewrite; no destructive DDL).

---

## 4 · Feature flags at release time

`ff.returning_user.new_door.enabled` defaults **false** in
`server/services/SystemConfig.ts`. The new door (`ReturnLogin`)
therefore only renders when:

- URL override: `/signin?door=new`.
- localStorage override: `pw_ff_new_door = '1'`.
- Cohort: flag ON AND hint-holder falls inside the cohort percent.

**Recommended post-deploy sequence for the returning-user door:**

1. Flip `ff.returning_user.new_door.percent` to `1` via `PATCH
   /api/admin/system-config`.
2. Flip `ff.returning_user.new_door.enabled` to `true`.
3. Watch success rate + support tickets.
4. Ratchet the percent up (10, 25, 50, 100) at the CEO's pace.

Reverting is `PATCH /api/admin/system-config` back to
`enabled:false`. Change propagates fleet-wide within
`SYSTEM_CONFIG_REFRESH_MS` (default 30s).

---

## 5 · External smoke (Section F item that this session can't run)

Egress from this workstation is blocked; the following must run from
a machine with normal internet. It's a one-pass checklist —
**everything must pass to close the release.**

1. `curl -sSI https://petwash.co.il/` → 200 or 301 to `www` (or
   vice-versa, whichever is canonical).
2. `curl -sSI https://petwash.co.il/api/config/public` → 200, body
   is exactly `{ returningUser: { newDoor: { enabled, percent } } }`.
3. Open `https://petwash.co.il/signin` in a private-window desktop
   browser — legacy door (`SignUpLuxury`) renders.
4. Open `https://petwash.co.il/signin?door=new` — `ReturnLogin` door
   renders (or silently falls back to `/signin` if the browser has no
   passkey / hint — this is the correct behaviour).
5. Sign in with a real Google / SMS / passkey account.
6. `/pet-parent/home` loads with an active session cookie.
7. Open Account Security → "Sign out this device" clears the cookie.
8. Sign back in — same identity, no duplicate `users` row.

Log the timestamp + result in this file's §7 changelog.

---

## 6 · Rollback

**Design goal:** any commit in this release can be reverted
independently because each release-blocker was landed as its own
commit with its own behavioural test.

**Full release rollback** (if §5 fails end-to-end):

```
git checkout main
git revert -m 1 <merge-commit-sha>
# push, redeploy previous image
```

The additive migrations do NOT need to roll back. `fiscal_document_outbox`
and `system_config` are empty on the rolled-back image; the code
that would query them is gone. No data loss.

**Selective rollback** (if one release-blocker misbehaves):

Each fix is one commit. The relevant SHAs (in commit order):

| # | Fix                                        | Commit      | Files             |
| - | ------------------------------------------ | ----------- | ----------------- |
| 1 | #240 admin migration                       | `ce888f3f9` | 47 route files    |
| 2 | adminAuth refinement                       | `0b3711db1` | 1 file            |
| 3 | #216 handoff behavioural test              | `d44bc8d22` | 1 test            |
| 4 | #222 OTP redactor behavioural test         | `9d38a0e31` | 1 test            |
| 5 | A1+A2 kill-switch / idempotency fail-closed| `1cb54bd95` | 5 files           |
| 6 | A3+A4+A5 fiscal outbox                     | `620ad5878` | 6 files + 0142    |
| 7 | A6+B3 Redis-backed limiters                | `44941f2ac` | 7 files           |
| 8 | B2+B6+B7+B8 fail-closed on infra failure   | `9660d2d39` | 5 files           |
| 9 | B1+B4+B5 shared flags, canonical writer, single mount | `dcb65da82` | 5 files + 0143 |
| 10 | Section C gate report                     | `8b2bc25a9` | 2 docs            |
| 11 | Section D+E gate report                   | `3fcc0c13f` | 2 docs            |
| 12 | A3/A4/A5 drainer worker                   | `3c13551ab` | 4 files           |

`git revert <sha>` on any of these is safe on its own — the tests
still pass because none of these fixes cross-depend on each other's
new code paths (only on the shared-libs shipped in #5 and #6, which
predate the callers).

**Data safety:** every write in this release is either:
- durable + idempotent (outbox, system_config), or
- a session-cookie / rate-limit read (no persistent artefact).

There is no state that "gets corrupted on rollback." Worst case, an
outbox row that would have retried post-rollback simply persists
until the next deploy of the drainer.

---

## 7 · Change log

- **2026-09-02** — Release ready. All A + B + C boxes green. Drainer
  landed as `3c13551ab`. Awaiting external smoke to close Section F.
