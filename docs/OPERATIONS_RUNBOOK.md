# Pet Wash Ltd - Operations Runbook
## Operational Procedures for Production Systems

Last Updated: November 11, 2025

---

## Overview

This runbook covers day-to-day operational tasks for Pet Wash Ltd's marketplace platform, including job dispatch, payment processing, IoT monitoring, and franchise management.

**Target Audience:** DevOps engineers, site reliability engineers, on-call staff

---

## Table of Contents

1. [System Health Checks](#system-health-checks)
2. [Auto-Void Cron Management](#auto-void-cron-management)
3. [Payment Testing](#payment-testing)
4. [Job Offer Flow Verification](#job-offer-flow-verification)
5. [Database Operations](#database-operations)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Incident Response](#incident-response)
8. [Deployment Procedures](#deployment-procedures)

---

## System Health Checks

### Daily Checklist (8 AM Israel Time)

```bash
# 1. Check auto-void cron status
grep "AutoVoid" logs/server.log | tail -20

# Expected: "No expired payments found" or "Voided X payments"
# Alert if: Errors or no logs in past 24 hours

# 2. Verify payment intent integrity
psql $DATABASE_URL -c "
SELECT COUNT(*) as stale_authorizations 
FROM payment_intents 
WHERE status = 'authorized' 
AND expires_at < NOW() - INTERVAL '1 hour';
"

# Expected: 0
# Alert if: > 0 (cron job failing)

# 3. Check operator presence staleness
psql $DATABASE_URL -c "
SELECT COUNT(*) as stale_operators 
FROM operator_presence 
WHERE is_available = true 
AND last_seen_at < NOW() - INTERVAL '15 minutes';
"

# Expected: <5% of total operators
# Alert if: >10%

# 4. Review error logs
grep "ERROR" logs/server.log | wc -l

# Expected: <10 errors/day
# Alert if: >50 errors/day
```

### Weekly Checklist (Monday 9 AM Israel Time)

```bash
# 1. Database backup verification
gsutil ls gs://petwash-backups/postgres/ | tail -10

# Expected: Daily backups for past 7 days
# Alert if: Missing any day

# 2. Payment reconciliation
npm run finance:reconcile -- --start-date=$(date -d '7 days ago' +%Y-%m-%d)

# Expected: All Nayax transactions match database records
# Alert if: Discrepancies found

# 3. Performance metrics review
curl https://petwash.co.il/api/metrics | jq '.api_latency_p95'

# Expected: <500ms
# Alert if: >1000ms

# 4. Security audit log review
psql $DATABASE_URL -c "
SELECT COUNT(*) 
FROM audit_logs 
WHERE severity = 'critical' 
AND created_at > NOW() - INTERVAL '7 days';
"

# Expected: 0
# Alert if: >0
```

---

## Auto-Void Cron Management

### Check Cron Status

```bash
# View recent cron executions
grep "AutoVoid" logs/server.log | tail -50

# Expected output:
# [AutoVoid] Starting expired payment scan
# [AutoVoid] Found 3 expired payments
# [AutoVoid] Voided payment: payment_abc123
# [AutoVoid] Scan complete
```

### Restart Auto-Void Cron

**When to Restart:**
- Cron hasn't run in >10 minutes
- Errors in cron logs
- Stale authorized payments accumulating

**Procedure:**

```bash
# 1. Check current status
pm2 status

# 2. Restart the application (cron runs on app startup)
pm2 restart petwash-api

# 3. Verify cron started
grep "AutoVoid.*initialized" logs/server.log | tail -1

# Expected: "[AutoVoid] Cron job started successfully"

# 4. Monitor first execution
tail -f logs/server.log | grep "AutoVoid"

# Expected: Execution within 5 minutes
```

### Manual Void Trigger (Emergency Only)

**Use Case:** Cron failed and expired payments accumulating

```bash
# Run manual void operation
npm run payments:void-expired

# This will:
# 1. Query all authorized payments where expires_at < NOW()
# 2. Call Nayax API to void each payment
# 3. Update payment_intents status to 'voided'
# 4. Log all operations to audit trail
```

### Troubleshooting Auto-Void Issues

**Issue**: Cron running but not voiding expired payments

```bash
# 1. Check for errors
grep "AutoVoid.*ERROR" logs/server.log

# 2. Verify database connectivity
psql $DATABASE_URL -c "SELECT 1"

# 3. Check Nayax API credentials
curl -H "Authorization: Bearer $NAYAX_API_KEY" \
  https://api.nayax.com/v1/health

# 4. Manual query to see what should be voided
psql $DATABASE_URL -c "
SELECT pi.id, pi.booking_id, pi.expires_at, pi.status,
       jo.id as job_offer_id, jo.status as job_status
FROM payment_intents pi
LEFT JOIN job_offers jo ON jo.payment_intent_id = pi.id
WHERE pi.status = 'authorized'
AND pi.expires_at < NOW()
ORDER BY pi.expires_at ASC
LIMIT 10;
"
```

**Issue**: Cron voiding payments for accepted jobs

```bash
# This should NEVER happen after bugfix
# If it does, EMERGENCY STOP and investigate

# 1. Stop the cron immediately
pm2 stop petwash-api

# 2. Check recent void operations
psql $DATABASE_URL -c "
SELECT pi.id, pi.voided_at, jo.status as job_status
FROM payment_intents pi
LEFT JOIN job_offers jo ON jo.payment_intent_id = pi.id
WHERE pi.voided_at > NOW() - INTERVAL '1 hour'
AND jo.status IN ('accepted', 'in_progress', 'completed');
"

# 3. If any rows returned: CRITICAL BUG - contact engineering immediately
# 4. Manually reverse affected voids and compensate customers
```

---

## Payment Testing

### Test Payment Flow End-to-End

**Environment:** Staging only (never test on production)

```bash
# 1. Create test job offer with payment authorization
curl -X POST https://staging.petwash.co.il/api/job-offers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_API_KEY" \
  -d '{
    "platform": "walk-my-pet",
    "customerId": "test-customer-123",
    "customerName": "Test Customer",
    "customerPaymentToken": "test-token-456",
    "serviceType": "dog-walking",
    "serviceDate": "2025-11-15T10:00:00Z",
    "duration": 60,
    "location": {
      "latitude": 32.0853,
      "longitude": 34.7818,
      "address": "Tel Aviv, Israel"
    },
    "totalCharge": 50.00,
    "currency": "ILS"
  }'

# Expected response:
# {
#   "success": true,
#   "jobOfferId": "job_xyz789",
#   "paymentIntentId": "pi_abc123"
# }

# 2. Verify payment authorized in database
psql $STAGING_DATABASE_URL -c "
SELECT id, booking_id, amount_cents, currency, status, expires_at
FROM payment_intents
WHERE id = 'pi_abc123';
"

# Expected:
# - status = 'authorized'
# - amount_cents = 5000 (50.00 ILS * 100)
# - expires_at ~ 15 minutes from now

# 3. Test accept flow (capture payment)
curl -X POST https://staging.petwash.co.il/api/job-offers/job_xyz789/accept \
  -H "Authorization: Bearer $TEST_OPERATOR_API_KEY" \
  -d '{"operatorId": "test-operator-123"}'

# Expected:
# - payment_intents.status = 'succeeded'
# - payment_intents.captured_at = NOW()
# - job_offers.status = 'accepted'

# 4. Test reject flow (void payment)
# Create another test offer, then reject it
curl -X POST https://staging.petwash.co.il/api/job-offers/job_xyz790/reject \
  -H "Authorization: Bearer $TEST_OPERATOR_API_KEY"

# Expected:
# - payment_intents.status = 'voided'
# - payment_intents.voided_at = NOW()
# - job_offers.status = 'rejected'

# 5. Test auto-void timeout
# Create offer and wait 16 minutes (do NOT accept or reject)
# Cron should automatically void the payment

# Wait 16 minutes...
sleep 960

# Check payment status
psql $STAGING_DATABASE_URL -c "
SELECT status, voided_at FROM payment_intents WHERE id = 'pi_abc789';
"

# Expected: status = 'voided', voided_at within past minute
```

### Verify Payment Amounts

**Critical Test**: Ensure currency conversion works correctly

```bash
# Test various amounts and currencies
for amount in 10.00 50.99 100.00 999.99; do
  echo "Testing amount: $amount ILS"
  
  # Create payment
  response=$(curl -s -X POST https://staging.petwash.co.il/api/payments/authorize \
    -d "{\"amount\": $amount, \"currency\": \"ILS\"}")
  
  # Extract payment ID
  payment_id=$(echo $response | jq -r '.paymentIntentId')
  
  # Verify amount in database (should be amount * 100)
  db_amount=$(psql $STAGING_DATABASE_URL -t -c \
    "SELECT amount_cents FROM payment_intents WHERE id = '$payment_id'")
  
  expected=$((${amount%.*}${amount#*.})) # Remove decimal point
  
  if [ "$db_amount" == "$expected" ]; then
    echo "✅ PASS: $amount ILS = $db_amount agora"
  else
    echo "❌ FAIL: $amount ILS = $db_amount agora (expected $expected)"
  fi
done
```

---

## Job Offer Flow Verification

### Verify Job Dispatch Data Path

```bash
# 1. Check job offers table
psql $DATABASE_URL -c "
SELECT jo.id, jo.booking_id, jo.platform, jo.status,
       pi.id as payment_id, pi.status as payment_status
FROM job_offers jo
LEFT JOIN payment_intents pi ON jo.payment_intent_id = pi.id
WHERE jo.created_at > NOW() - INTERVAL '1 hour'
ORDER BY jo.created_at DESC
LIMIT 10;
"

# Expected:
# - All job_offers have matching payment_intents
# - Status pairs are valid:
#   - (pending, authorized)
#   - (accepted, succeeded)
#   - (rejected, voided)
#   - (expired, voided)

# 2. Check for orphaned payments
psql $DATABASE_URL -c "
SELECT pi.id, pi.booking_id, pi.status, pi.job_offer_id
FROM payment_intents pi
LEFT JOIN job_offers jo ON pi.job_offer_id = jo.id
WHERE pi.created_at > NOW() - INTERVAL '1 day'
AND pi.job_offer_id IS NOT NULL
AND jo.id IS NULL;
"

# Expected: 0 rows (all payments linked to valid job offers)
# Alert if: Any orphaned payments found

# 3. Verify operator presence data
psql $DATABASE_URL -c "
SELECT platform, COUNT(*) as operator_count,
       COUNT(CASE WHEN is_available THEN 1 END) as available_count,
       COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as active_count
FROM operator_presence
GROUP BY platform;
"

# Expected:
# - Each platform has >0 operators
# - Available operators > 0
# - Active operators (last seen <5min) > 0
```

### Test Push Notifications

```bash
# Send test push notification to operator
node -e "
const { sendPush } = require('./server/actions/sendPush');

sendPush(
  'test-fcm-token-here',
  'Test Job Offer',
  'Dog walking request nearby - ₪50 for 1 hour',
  {
    data: { jobId: 'test-123', type: 'job_offer' },
    priority: 'high'
  }
).then(() => console.log('✅ Push sent successfully'))
  .catch(err => console.error('❌ Push failed:', err));
"

# Expected: "✅ Push sent successfully"
# Check device: Notification should appear within 5 seconds
```

---

## Database Operations

### Safe Schema Migration

```bash
# 1. Backup database first
npm run db:backup

# 2. Update schema in shared/schema.ts
# (make your changes)

# 3. Preview changes
npm run db:push

# Expected: Shows SQL statements that will be executed
# Review carefully - do NOT change primary key types!

# 4. Apply changes (use --force to skip confirmation)
npm run db:push --force

# 5. Verify migration succeeded
psql $DATABASE_URL -c "\d job_offers"

# 6. Test application
curl https://localhost:5000/health

# Expected: {"status": "healthy"}
```

### Rollback Schema Changes

```bash
# 1. Stop the application
pm2 stop petwash-api

# 2. Restore from backup
pg_restore --dbname=$DATABASE_URL --clean --if-exists \
  backups/postgres-$(date -d yesterday +%Y%m%d).dump

# 3. Revert code changes
git revert HEAD
git push

# 4. Restart application
pm2 start petwash-api

# 5. Verify rollback
curl https://petwash.co.il/health
```

### Database Performance Tuning

```bash
# Find slow queries
psql $DATABASE_URL -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 10;
"

# Rebuild indexes if needed
psql $DATABASE_URL -c "
REINDEX INDEX CONCURRENTLY idx_job_offers_geohash;
REINDEX INDEX CONCURRENTLY idx_payment_intents_expires_at;
"

# Analyze table statistics
psql $DATABASE_URL -c "ANALYZE job_offers, payment_intents, operator_presence;"
```

---

## Monitoring & Alerts

### Alert Configuration

**Critical Alerts** (page on-call immediately):
- Auto-void cron errors
- Payment authorization failures >5% rate
- Database connection pool exhausted
- Backup failures
- Security intrusion detected

**Warning Alerts** (email/Slack):
- API latency p95 >1000ms
- Operator staleness >10%
- Disk space >80%
- Memory usage >85%

**Info Alerts** (dashboard only):
- New job offers created
- Payments captured
- Operators coming online/offline

### Monitoring Dashboard

Access: https://petwash.co.il/admin/monitoring

**Key Metrics:**
- Job offer creation rate (per hour)
- Payment success rate (% authorized that capture)
- Average time to acceptance (minutes)
- Operator availability (by platform and region)
- API response times (p50, p95, p99)
- Database query performance
- Auto-void cron success rate

---

## Incident Response

### Payment Authorization Failures

**Symptoms:**
- Users cannot create job offers
- Error: "Payment authorization failed"
- Nayax API returning errors

**Diagnosis:**

```bash
# 1. Check Nayax API status
curl https://status.nayax.com

# 2. Test API credentials
curl -H "Authorization: Bearer $NAYAX_API_KEY" \
  https://api.nayax.com/v1/test

# 3. Check recent authorization attempts
grep "Payment authorization" logs/server.log | tail -50

# 4. Verify IP allowlist
grep "Unauthorized IP" logs/server.log | tail -20
```

**Resolution:**
- If Nayax down: Wait for service restoration, queue jobs
- If credentials invalid: Rotate API keys (contact Nayax support)
- If IP blocked: Add Replit IP to Nayax allowlist

### Auto-Void Cron Stopped

**Symptoms:**
- Authorized payments accumulating past expiration
- No "AutoVoid" logs in past 10 minutes
- Customer complaints about holds not releasing

**Immediate Action:**

```bash
# 1. Restart application
pm2 restart petwash-api

# 2. Manually trigger void for accumulated payments
npm run payments:void-expired

# 3. Monitor cron restart
tail -f logs/server.log | grep "AutoVoid"
```

**Root Cause Analysis:**
```bash
# Check for errors before failure
grep "AutoVoid.*ERROR" logs/server.log | tail -100

# Common causes:
# - Database connection timeout
# - Nayax API rate limiting
# - Out of memory crash
# - Unhandled exception in cron logic
```

### Database Connection Issues

**Symptoms:**
- API returning 500 errors
- Logs show "connection pool exhausted"
- Dashboard showing high connection count

**Diagnosis:**

```bash
# Check active connections
psql $DATABASE_URL -c "
SELECT COUNT(*), state
FROM pg_stat_activity
GROUP BY state;
"

# Expected: <50 active connections
# Alert if: >90 connections (pool size = 100)
```

**Resolution:**

```bash
# 1. Kill long-running queries
psql $DATABASE_URL -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
AND query_start < NOW() - INTERVAL '5 minutes';
"

# 2. Restart application to reset pool
pm2 restart petwash-api

# 3. If persistent: Increase pool size in config
# Edit: server/db.ts, change pool: { max: 150 }
```

---

## Deployment Procedures

### Standard Deployment

```bash
# 1. Run pre-deployment checks
npm run test
npm run lint
npm run db:backup

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
npm ci

# 4. Run database migrations (if any)
npm run db:push --force

# 5. Restart application
pm2 restart petwash-api --update-env

# 6. Verify deployment
curl https://petwash.co.il/health
grep "Server ready" logs/server.log | tail -1

# 7. Monitor for 15 minutes
tail -f logs/server.log | grep "ERROR"

# Expected: No errors
```

### Rollback Deployment

```bash
# 1. Identify last good commit
git log --oneline | head -10

# 2. Revert to last good version
git revert HEAD
git push

# 3. Restart application
pm2 restart petwash-api

# 4. Restore database if needed (see "Rollback Schema Changes")
```

### Hotfix Deployment

**Use case:** Critical bug in production

```bash
# 1. Create hotfix branch
git checkout -b hotfix/payment-bug

# 2. Make minimal fix
# (edit code)

# 3. Test locally
npm test

# 4. Deploy directly to production (skip staging)
git push origin hotfix/payment-bug
pm2 deploy production

# 5. Monitor closely
tail -f logs/server.log

# 6. Merge back to main after verification
git checkout main
git merge hotfix/payment-bug
git push
```

---

## Appendix

### Useful Commands

```bash
# View application logs
pm2 logs petwash-api --lines 100

# Database console
psql $DATABASE_URL

# Restart application
pm2 restart petwash-api

# Check system resources
htop

# Test API endpoint
curl -v https://petwash.co.il/api/health

# Generate test data
npm run seed:test-data

# Clear Redis cache
redis-cli FLUSHALL
```

### Emergency Contacts

- **On-Call Engineer**: +972-XX-XXX-XXXX
- **Nayax Support**: support@nayax.com
- **Neon Database**: support@neon.tech
- **Security Team**: security@petwash.co.il

### Useful Links

- [Nayax API Documentation](https://docs.nayax.com)
- [Neon Console](https://console.neon.tech)
- [Sentry Dashboard](https://sentry.io/petwash)
- [Monitoring Dashboard](https://petwash.co.il/admin/monitoring)

---

*Document Version: 1.0*  
*Last Updated: November 11, 2025*  
*Next Review: December 11, 2025*
