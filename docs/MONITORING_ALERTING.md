# Production Monitoring & Alerting System

## Overview
The Pet Wash platform includes a comprehensive monitoring and alerting system to ensure the luxury inbox features and automated workflows run smoothly without silent failures.

## System Components

### 1. **Cron Job Monitoring**
Tracks execution status of all automated background jobs:
- **Vaccine Reminders** (Daily @ 9 AM IST)
- **Birthday Coupons** (Daily @ 8 AM IST)  
- **Data Integrity Checks** (Weekly, Sunday @ Midnight IST)
- **Revenue Reports** (Daily/Monthly/Yearly)
- **Appointment Reminders** (Every minute)

**Implementation:** `server/monitoring.ts - recordCronExecution()`

### 2. **Firestore Metrics Tracking**
Monitors database usage patterns and detects anomalies:
- Read/Write operation counts
- Spike detection (>500 operations per check)
- Performance baselines

**Implementation:** `server/monitoring.ts - recordFirestoreMetrics()`

### 3. **Data Integrity Checks**
Weekly validation of critical data:
- User profiles completeness
- Pet profiles validation
- Vaccine records consistency
- Birthday voucher issuance
- Orphaned data detection

**Implementation:** `server/monitoring.ts - runDataIntegrityChecks()`

### 4. **Error Reporting**
Multi-channel alert system for critical issues:
- **Email Alerts** (via SendGrid)
- **Slack Notifications** (webhook integration)
- **Structured Logging** (Winston logger)

**Implementation:** `server/monitoring.ts - sendAlert()`

## Health Endpoints

### `/healthz` - Basic Health Check
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T13:15:04.190Z",
  "uptime": 3600,
  "service": "Pet Wash API"
}
```

### `/readiness` - Readiness Check
```json
{
  "status": "ready",
  "timestamp": "2025-10-13T13:15:04.190Z",
  "checks": {
    "database": "healthy",
    "firebase": "healthy"
  }
}
```

### `/api/health/monitoring` - Enhanced Monitoring Status
```json
{
  "timestamp": "2025-10-13T13:15:04.190Z",
  "cronJobs": {
    "Vaccine Reminder Job": {
      "lastRun": "2025-10-13T09:00:00.000Z",
      "status": "success",
      "error": null
    },
    "Birthday Discount Job": {
      "lastRun": "2025-10-13T08:00:00.000Z",
      "status": "success",
      "error": null
    },
    "Data Integrity Check": {
      "lastRun": "2025-10-13T00:00:00.000Z",
      "status": "success",
      "error": null
    }
  },
  "firestoreMetrics": {
    "reads": 1234,
    "writes": 567,
    "timestamp": "2025-10-13T13:15:04.190Z",
    "spikeDetected": false
  },
  "lastIntegrityCheck": {
    "timestamp": "2025-10-13T00:00:00.000Z",
    "overallStatus": "healthy",
    "checks": [
      {
        "name": "User Profiles",
        "passed": true,
        "message": "All user profiles valid"
      }
    ]
  }
}
```

## Alert Thresholds

### Firestore Spike Detection
- **Threshold:** >500 reads or writes per monitoring interval
- **Action:** Email + Slack alert to admin team
- **Response:** Investigate query patterns, check for loops

### Cron Job Failures
- **Threshold:** Any job execution failure
- **Action:** Immediate email + Slack alert with error details
- **Response:** Check logs, retry manually if needed

### Data Integrity Issues
- **Critical Issues:**
  - User profiles without required fields
  - Pet profiles with invalid vaccine dates
  - Birthday vouchers not issued when due
  
- **Action:** Weekly report + alert if critical issues found
- **Response:** Review and fix data inconsistencies

## Configuration

### Environment Variables
```bash
# Email Alerts (SendGrid)
SENDGRID_API_KEY=your_api_key
REPORTS_EMAIL_TO=admin@petwash.co.il

# Slack Alerts (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Alert Recipients
Primary: `REPORTS_EMAIL_TO` environment variable  
Fallback: `admin@petwash.co.il`

## Monitoring Integration Flow

```
┌─────────────────┐
│   Cron Job      │
│   Execution     │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  recordCronExecution│
│  (Success/Failure)  │
└────────┬────────────┘
         │
         ▼
   ┌────┴────┐
   │ Success │ Failure
   ▼         ▼
┌──────┐  ┌──────────────┐
│ Log  │  │  sendAlert() │
│ Only │  │  Email+Slack │
└──────┘  └──────────────┘
```

## Weekly Data Integrity Check Schedule

**Time:** Every Sunday at Midnight (Israel Time)  
**Duration:** ~5-10 minutes  
**Components Checked:**
1. User profiles (required fields)
2. Pet profiles (data validation)
3. Vaccine records (date consistency)
4. Birthday vouchers (issuance tracking)
5. Orphaned data detection

**Output:** Detailed report saved to Firestore + alerts if critical issues found

## Operational Procedures

### 1. Reviewing Monitoring Status
```bash
# Check health endpoint
curl https://petwash.co.il/api/health/monitoring

# Review logs
tail -f /tmp/logs/Start_application_*.log | grep -i "monitoring\|alert\|error"
```

### 2. Investigating Alerts
1. Check email/Slack for alert details
2. Review `/api/health/monitoring` endpoint
3. Check Firestore `monitoring_logs` collection
4. Review application logs for context

### 3. Manual Intervention
```typescript
// Force data integrity check
import { runDataIntegrityChecks } from './server/monitoring';
const result = await runDataIntegrityChecks();
console.log(result);

// Check Firestore metrics
import { recordFirestoreMetrics } from './server/monitoring';
await recordFirestoreMetrics(reads, writes);
```

## Known Limitations

### 1. TOCTOU Race Condition
**Issue:** Vaccine reminder de-duplication has potential race condition  
**Impact:** Very rare duplicate reminders (1 in 10,000+ cases)  
**Mitigation:** Acceptable for current scale  
**Future Fix:** Redis SETNX or Firestore transactions (v3)

### 2. Email Delivery
**Issue:** SendGrid rate limits may affect alert delivery during high-volume events  
**Impact:** Delayed alerts during mass failures  
**Mitigation:** Slack webhook as backup channel

## Performance Impact

- **Monitoring Overhead:** <5ms per cron execution
- **Storage:** ~1KB per job execution record
- **Firestore Operations:** +2 writes per monitored job
- **Memory:** Minimal (<10MB for tracking data)

## Future Enhancements (v3+)

1. **Real-time Dashboard:** Web UI for monitoring status
2. **Custom Metrics:** Track business KPIs (conversion, retention)
3. **Distributed Tracing:** APM integration (Datadog, New Relic)
4. **Auto-Remediation:** Self-healing for common failures
5. **SLA Monitoring:** Track uptime and response times

## Support & Troubleshooting

### Common Issues

**Q: Alerts not being sent**  
A: Check `SENDGRID_API_KEY` and `SLACK_WEBHOOK_URL` environment variables

**Q: False positive spike alerts**  
A: Adjust threshold in `server/monitoring.ts` (line 94)

**Q: Cron jobs not recording status**  
A: Verify `recordCronExecution()` is called in job wrapper

**Q: Data integrity check shows false negatives**  
A: Review validation logic in `runDataIntegrityChecks()`

### Emergency Contacts
- **Primary:** Development Team
- **Secondary:** DevOps Team  
- **Email:** admin@petwash.co.il

---

**Last Updated:** October 13, 2025  
**Version:** 1.0  
**Maintained by:** Pet Wash Development Team
