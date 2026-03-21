# PetWash Wallet — Monitoring Runbook

> Environment: Cloud Run (`me-west1`, project `signinpetwash`)
> Production URL: `petwash.co.il`
> Last updated: 2026-03-21

---

## 1. What the reconciliation job does

The wallet reconciliation job runs **every 5 minutes** at startup. Each pass:

1. **Scans drifted bookings** — any `booking_requests` or `trainer_bookings` where `finance_state = 'hold_active'` but the booking has moved to a terminal status (`completed | cancelled | rejected`). Heals up to 25 per run via idempotent release/debit.

2. **Stuck-hold detection** — emits `[ALERT][StuckHold] WARN` for:
   - Walkers / sitters: `status = pending`, `finance_state = hold_active`, `created_at < NOW() - INTERVAL '2 hours'`
   - Academy: same but `4 hours`

3. **Integrity alerts** — after every pass:
   - Any wallet bucket with a negative balance → `[ALERT][NegativeBalance] CRITICAL`
   - Any user where `pending_balance_cents ≠ SUM(ledger hold - debit - release)` → `[ALERT][PendingDrift] HIGH`
   - Clean → `Integrity checks passed — no negative balances, no pending drift`

---

## 2. Alert levels and response

| Alert | Severity | SLA | Action |
|---|---|---|---|
| `[ALERT][StuckHold]` | WARN | 30 min | Identify booking. Decide cancel (→ `releaseBookingHold`) or chase provider. |
| `[ALERT][PendingDrift]` | HIGH | 15 min | Run user audit for affected user. Identify orphaned ledger entry. May require manual `walletService.releaseBookingHold()`. |
| `[ALERT][NegativeBalance]` | CRITICAL | 5 min | Stop new bookings for affected user. Run `SELECT * FROM wallets WHERE user_id = ?`. Identify source. File incident. |

---

## 3. How to search logs

**On Cloud Run (via Cloud Logging):**

```bash
# All ALERT-level wallet events
gcloud logging read 'resource.type="cloud_run_revision" jsonPayload.message=~"\[ALERT\]"' \
  --project=signinpetwash --limit=50 --format=json

# Stuck-hold alerts only
gcloud logging read 'resource.type="cloud_run_revision" jsonPayload.message=~"StuckHold"' \
  --project=signinpetwash --limit=20 --format=json

# Negative balance alerts
gcloud logging read 'resource.type="cloud_run_revision" jsonPayload.message=~"NegativeBalance"' \
  --project=signinpetwash --limit=10 --format=json

# Recon summary for last 24h
gcloud logging read 'resource.type="cloud_run_revision" jsonPayload.message=~"WalletReconciliation"' \
  --project=signinpetwash --freshness=24h --format=json
```

**In Replit dev (local):**
```bash
grep '\[ALERT\]' /tmp/logs/Start_application_*.log
grep 'WalletReconciliation' /tmp/logs/Start_application_*.log | tail -20
```

---

## 4. Daily ops checklist

Run these checks each morning before opening hours:

```sql
-- 1. Any negative wallet buckets?
SELECT user_id, cash_balance_cents, egift_balance_cents, promo_balance_cents,
       referral_balance_cents, pending_balance_cents
FROM wallets
WHERE cash_balance_cents < 0
   OR egift_balance_cents < 0
   OR promo_balance_cents < 0
   OR referral_balance_cents < 0
   OR pending_balance_cents < 0;

-- 2. Any bookings stuck in hold > 2h (walker/sitter)?
SELECT request_id, owner_id, service_type, wallet_hold_cents, created_at,
       NOW() - created_at AS age
FROM booking_requests
WHERE status = 'pending'
  AND finance_state = 'hold_active'
  AND wallet_hold_cents > 0
  AND created_at < NOW() - INTERVAL '2 hours'
ORDER BY created_at;

-- 3. Any academy bookings stuck in hold > 4h?
SELECT booking_id, user_id, wallet_hold_cents, created_at,
       NOW() - created_at AS age
FROM trainer_bookings
WHERE booking_status = 'pending'
  AND finance_state = 'hold_active'
  AND wallet_hold_cents > 0
  AND created_at < NOW() - INTERVAL '4 hours'
ORDER BY created_at;

-- 4. Pending drift check
SELECT w.user_id,
       w.pending_balance_cents AS wallet_pending,
       COALESCE(SUM(
         CASE WHEN wl.event_type = 'hold'    THEN wl.amount_cents
              WHEN wl.event_type = 'debit'   THEN -wl.amount_cents
              WHEN wl.event_type = 'release' THEN -wl.amount_cents
              ELSE 0 END
       ), 0) AS ledger_pending,
       w.pending_balance_cents - COALESCE(SUM(
         CASE WHEN wl.event_type = 'hold'    THEN wl.amount_cents
              WHEN wl.event_type = 'debit'   THEN -wl.amount_cents
              WHEN wl.event_type = 'release' THEN -wl.amount_cents
              ELSE 0 END
       ), 0) AS drift_cents
FROM wallets w
LEFT JOIN wallet_ledger wl ON wl.wallet_id = w.wallet_id
GROUP BY w.user_id, w.pending_balance_cents
HAVING ABS(w.pending_balance_cents - COALESCE(SUM(
  CASE WHEN wl.event_type = 'hold'    THEN wl.amount_cents
       WHEN wl.event_type = 'debit'   THEN -wl.amount_cents
       WHEN wl.event_type = 'release' THEN -wl.amount_cents
       ELSE 0 END
), 0)) > 10;
```

---

## 5. Rollback procedure

### 5a. Revert a bad code deploy

```bash
# From Cloud Shell (Google Cloud)
cd ~/petwash-marketplace

# Find the last good commit
git log --oneline -10

# Revert to a known good commit (replace SHA)
git revert --no-commit <bad-sha>..HEAD
git commit -m "rollback: revert to last known good state"
git push origin main
# CI/CD will redeploy to Cloud Run automatically
```

### 5b. Force re-deploy last stable image

```bash
# List recent Cloud Run revisions
gcloud run revisions list --service=petwash-app --region=me-west1 --project=signinpetwash

# Migrate traffic to a specific stable revision
gcloud run services update-traffic petwash-app \
  --to-revisions=<stable-revision-name>=100 \
  --region=me-west1 --project=signinpetwash
```

### 5c. Emergency wallet freeze (disable all holds)

If you need to stop new wallet holds while investigating:

1. Set env var `WALLET_HOLDS_DISABLED=true` in Cloud Run environment variables
2. The `WalletService.holdBookingWallet()` checks this flag and returns early with `{ txnId: 'disabled', alreadyHeld: false }` — booking proceeds without a hold

> **Note**: This env var guard is not currently implemented. File as P1 if a freeze mechanism is needed before production launch.

---

## 6. Manual reconciliation trigger

The reconciliation job runs automatically on a 5-minute interval. To trigger it immediately in production:

```bash
curl -X POST https://petwash.co.il/api/admin/wallet/reconcile \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"
```

Or in Cloud Shell, restart the Cloud Run service (triggers on-startup run):

```bash
gcloud run services update petwash-app --region=me-west1 --project=signinpetwash \
  --set-env-vars FORCE_RECON=$(date +%s)
```

---

## 7. Key files

| File | Purpose |
|---|---|
| `server/jobs/wallet-reconciliation.ts` | Reconciliation job, stuck-hold detection, integrity alerts |
| `server/services/WalletService.ts` | Hold / release / debit / refund primitives |
| `server/services/WalletLedger.ts` | Ledger write layer, idempotency key enforcement |
| `server/routes/academy.ts` | Academy booking wallet lifecycle |
| `server/routes/prestige-pass.ts` | Wallet admin endpoints, user audit |
| `shared/schema.ts` | `wallets`, `wallet_ledger`, `booking_requests`, `trainer_bookings` schemas |
