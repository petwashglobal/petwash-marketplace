# Pet Wash™ - Complete Background Jobs Schedule

**Generated:** October 25, 2025  
**Total Jobs:** 24 Automated Tasks  
**Status:** ✅ All jobs running successfully

---

## 📋 Job Categories

### 🔔 Customer Communications (3 jobs)
1. **Appointment Reminders** - `* * * * *` (Every minute)
2. **Birthday Discounts** - `0 8 * * *` (Daily, 8 AM Israel time)
3. **Vaccine Reminders** - `0 9 * * *` (Daily, 9 AM Israel time)

### 💰 Financial & Reporting (4 jobs)
4. **Daily Revenue Report** - `0 9 * * *` (Daily, 9 AM Israel time)
5. **Monthly Revenue Report** - `0 10 1 * *` (1st of month, 10 AM Israel time)
6. **Yearly Revenue Report** - `0 11 1 1 *` (January 1st, 11 AM Israel time)
7. **Observances Processing** - `0 10 * * *` (Daily, 10 AM Israel time)

### 🏪 Station Management (6 jobs)
8. **Smart Monitoring - Status Updates** - `*/5 * * * *` (Every 5 minutes)
9. **Smart Monitoring - Offline Reminders** - `0 * * * *` (Every hour)
10. **Low Stock Alerts** - `10 7 * * *` (Daily, 7:10 AM Israel time)
11. **Utility Renewal Alerts** - `20 7 * * *` (Daily, 7:20 AM Israel time)
12. **Google Sheets Sync** - `30 7 * * *` (Daily, 7:30 AM Israel time)
13. **Data Integrity Check** - `0 0 * * 0` (Weekly, Sunday midnight Israel time)

### 💳 Payment Monitoring (3 jobs)
14. **Nayax Pending Transactions** - `*/5 * * * *` (Every 5 minutes)
15. **Nayax Inactive Stations** - `0 * * * *` (Every hour)
16. **Nayax Daily Report** - `0 7 * * *` (Daily, 7 AM Israel time)

### 💾 Backups & Data (3 jobs)
17. **Firestore Backup (Legacy)** - `0 0 * * *` (Daily, midnight Israel time)
18. **Weekly Code Backup (GCS)** - `0 2 * * 0` (Sunday, 2 AM Israel time)
19. **Daily Firestore Export (GCS)** - `0 1 * * *` (Daily, 1 AM Israel time)

### 🔒 Compliance & Security (4 jobs)
20. **Legal Compliance Check** - `0 8 * * *` (Daily, 8 AM Israel time)
21. **Israeli Government Compliance** - `0 9 * * *` (Daily, 9 AM Israel time)
22. **Security Updates Check** - `0 3 * * *` (Daily, 3 AM Israel time)
23. **Dependency Audit** - `0 4 * * 1` (Weekly, Monday 4 AM Israel time)

### 🧹 Maintenance (1 job)
24. **Log Cleanup** - `0 * * * *` (Every hour)

---

## 📊 Detailed Job Specifications

### 1. Appointment Reminders
- **Schedule:** Every minute (`* * * * *`)
- **Function:** `processAppointmentReminders()`
- **Purpose:** Send email/SMS reminders for upcoming pet wash appointments
- **Features:**
  - Retry logic with exponential backoff (1s, 5s, 15s, 60s)
  - Max 3 retry attempts per reminder
  - Supports email, SMS, or both
  - Concurrent processing prevention
- **Dependencies:** EmailService, SmsService, Storage

### 2. Birthday Discounts
- **Schedule:** Daily at 8:00 AM Israel time (`0 8 * * *`)
- **Function:** `processBirthdayDiscounts()`
- **Purpose:** Send birthday vouchers to pets celebrating their special day
- **Features:**
  - Checks all users for birthdays matching today's date
  - Creates cryptographically secure birthday voucher
  - Sends personalized birthday email
  - Prevents duplicate vouchers per year
  - Tracks last birthday voucher sent
- **Dependencies:** EmailService, Firestore, Birthday Voucher System
- **Monitoring:** Records execution in cron monitoring

### 3. Vaccine Reminders
- **Schedule:** Daily at 9:00 AM Israel time (`0 9 * * *`)
- **Function:** `processVaccineReminders()`
- **Purpose:** Send reminders 7 days before vaccine due dates
- **Features:**
  - Queries pets with upcoming vaccine due dates
  - Sends email reminders to pet owners
  - Tracks reminder sent status
- **Dependencies:** EmailService, Vaccine Reminder Service
- **Monitoring:** Records execution with sent/error counts

### 4. Daily Revenue Report
- **Schedule:** Daily at 9:00 AM Israel time (`0 9 * * *`)
- **Function:** `generateDailyRevenueReport()`
- **Purpose:** Generate and email yesterday's revenue summary
- **Features:**
  - Aggregates all transactions from previous day
  - Breaks down by payment method, station, service type
  - Calculates key metrics (total revenue, transaction count, average)
  - Emails to management team
- **Dependencies:** RevenueReportService, EmailService
- **Monitoring:** Tracks execution success/failure

### 5. Monthly Revenue Report
- **Schedule:** 1st of month at 10:00 AM Israel time (`0 10 1 * *`)
- **Function:** `generateMonthlyRevenueReport()`
- **Purpose:** Generate comprehensive monthly financial summary
- **Features:**
  - Full month revenue aggregation
  - Comparison with previous month
  - Station performance breakdown
  - Service type analysis
  - Customer metrics
- **Dependencies:** RevenueReportService, EmailService

### 6. Yearly Revenue Report
- **Schedule:** January 1st at 11:00 AM Israel time (`0 11 1 1 *`)
- **Function:** `generateYearlyRevenueReport()`
- **Purpose:** Generate annual financial summary for tax/planning
- **Features:**
  - Full year revenue aggregation
  - Year-over-year comparison
  - Quarterly breakdown
  - Tax preparation data
  - Business growth metrics
- **Dependencies:** RevenueReportService, EmailService

### 7. Observances Processing
- **Schedule:** Daily at 10:00 AM Israel time (`0 10 * * *`)
- **Function:** `processObservances()`
- **Purpose:** Send promotional emails for pet holidays and special events
- **Features:**
  - Checks for active observances/pet holidays
  - Sends targeted promotional emails
  - Tracks email sent status per user per observance
  - Prevents duplicate sends
- **Dependencies:** Observance Evaluator, EmailService
- **Monitoring:** Records sent/error/skipped counts

### 8. Smart Monitoring - Status Updates
- **Schedule:** Every 5 minutes (`*/5 * * * *`)
- **Function:** `updateAllStationStatuses()` + `updateAllStationUptime()`
- **Purpose:** Monitor station health and calculate uptime
- **5-State Machine:**
  1. **Maintenance** (highest priority)
  2. **Fault** (errors detected)
  3. **Offline** (heartbeat > 30 minutes)
  4. **Warning Low Activity** (transactions stopped but heartbeat OK)
  5. **Idle/Online** (normal operation)
- **Features:**
  - Heartbeat-based offline detection (NOT transaction-based)
  - Daily and weekly uptime percentage calculation
  - Status history tracking
  - Automatic alert generation on status changes
- **Critical:** Offline = heartbeat stopped, NOT transactions stopped
- **Dependencies:** Stations Service, Firestore

### 9. Smart Monitoring - Offline Reminders
- **Schedule:** Every hour (`0 * * * *`)
- **Function:** `sendOfflineReminderEmails()`
- **Purpose:** Two-tier alerting for offline stations
- **Features:**
  - First alert: Immediate email when station goes offline
  - Reminder alerts: Every 6 hours for long-offline stations
  - Prevents alert spam
  - Tracks last reminder sent timestamp
- **Dependencies:** Stations Service, EmailService

### 10. Low Stock Alerts
- **Schedule:** Daily at 7:10 AM Israel time (`10 7 * * *`)
- **Function:** `checkLowStockAlerts()`
- **Purpose:** Alert when station supplies are running low
- **Features:**
  - Checks shampoo, conditioner, towel levels
  - Sends alerts when below threshold
  - Includes reorder recommendations
- **Dependencies:** Stations Alert Service, EmailService

### 11. Utility Renewal Alerts
- **Schedule:** Daily at 7:20 AM Israel time (`20 7 * * *`)
- **Function:** `checkUtilityRenewalAlerts()`
- **Purpose:** Remind about upcoming utility/service renewals
- **Features:**
  - Checks water, electricity, internet, rent renewals
  - Sends alerts 30/14/7 days before expiration
  - Prevents service interruptions
- **Dependencies:** Stations Alert Service, EmailService

### 12. Google Sheets Sync
- **Schedule:** Daily at 7:30 AM Israel time (`30 7 * * *`)
- **Function:** `syncStationsToGoogleSheets()`
- **Purpose:** Sync station data to Google Sheets for external access
- **Features:**
  - Exports all station information
  - Updates inventory levels
  - Syncs status and metrics
  - Provides backup data access
- **Dependencies:** Stations Alert Service, Google Sheets API

### 13. Data Integrity Check
- **Schedule:** Weekly on Sunday at midnight Israel time (`0 0 * * 0`)
- **Function:** `runDataIntegrityCheck()`
- **Purpose:** Verify database consistency and data quality
- **Checks:**
  - Orphaned records detection
  - Required field validation
  - Reference integrity
  - Data consistency across collections
  - Performance metrics validation
- **Dependencies:** Monitoring Service
- **Monitoring:** Records check results and failures

### 14. Nayax Pending Transactions
- **Schedule:** Every 5 minutes (`*/5 * * * *`)
- **Function:** `checkPendingNayaxTransactions()`
- **Purpose:** Monitor payment processing status
- **Features:**
  - Checks for stuck transactions
  - Retries failed payments
  - Alerts on payment issues
  - Updates transaction status
- **Dependencies:** Nayax Integration, Monitoring Service

### 15. Nayax Inactive Stations
- **Schedule:** Every hour (`0 * * * *`)
- **Function:** `checkInactiveNayaxStations()`
- **Purpose:** Detect payment terminals not processing
- **Features:**
  - Identifies stations with no transactions
  - Alerts on potential payment issues
  - Tracks terminal health
- **Dependencies:** Nayax Integration, Monitoring Service

### 16. Nayax Daily Report
- **Schedule:** Daily at 7:00 AM Israel time (`0 7 * * *`)
- **Function:** `sendDailyNayaxReport()`
- **Purpose:** Daily payment processing summary
- **Features:**
  - Yesterday's payment statistics
  - Transaction success/failure rates
  - Revenue by station
  - Payment method breakdown
- **Dependencies:** Nayax Integration, EmailService

### 17. Firestore Backup (Legacy)
- **Schedule:** Daily at midnight Israel time (`0 0 * * *`)
- **Function:** `performDailyBackup()`
- **Purpose:** Daily database backup (legacy system)
- **Features:**
  - Exports Firestore collections
  - Stores backup locally/cloud
  - Retention policy management
- **Note:** Being replaced by GCS-based backups
- **Dependencies:** Firestore Admin

### 18. Weekly Code Backup (GCS)
- **Schedule:** Sunday at 2:00 AM Israel time (`0 2 * * 0`)
- **Function:** `performWeeklyCodeBackup()`
- **Purpose:** Backup application source code to Google Cloud Storage
- **Features:**
  - Creates compressed archive of codebase
  - SHA-256 integrity verification
  - Uploads to `gs://petwash-code-backups`
  - Email notification with CSV manifest
  - Automatic cleanup of old backups
  - Audit logging in Firestore
- **Bucket:** `gs://petwash-code-backups`
- **Dependencies:** Google Cloud Storage, EmailService

### 19. Daily Firestore Export (GCS)
- **Schedule:** Daily at 1:00 AM Israel time (`0 1 * * *`)
- **Function:** `performFirestoreExport()`
- **Purpose:** Export Firestore database to Google Cloud Storage
- **Features:**
  - Full Firestore export
  - SHA-256 integrity verification
  - Uploads to `gs://petwash-firestore-backups`
  - Email notification with CSV manifest
  - Automatic cleanup (retains 30 days)
  - Audit logging in Firestore
- **Bucket:** `gs://petwash-firestore-backups`
- **Dependencies:** Google Cloud Storage, Firestore Admin, EmailService

### 20. Legal Compliance Check
- **Schedule:** Daily at 8:00 AM Israel time (`0 8 * * *`)
- **Function:** `checkLegalCompliance()`
- **Purpose:** Monitor legal document review deadlines
- **Features:**
  - Checks for overdue legal reviews
  - Alerts on upcoming deadlines
  - Tracks compliance status
  - Manages document lifecycle
- **Documents Tracked:**
  - Terms of Service
  - Privacy Policy
  - Cookie Policy
  - GDPR Compliance
  - Israeli Privacy Law (Amendment 13)
- **Dependencies:** Legal Compliance Tracker, EmailService

### 21. Israeli Government Compliance
- **Schedule:** Daily at 9:00 AM Israel time (`0 9 * * *`)
- **Function:** `checkIsraeliCompliance()`
- **Purpose:** Monitor Israeli regulatory compliance
- **Checks:**
  - Tax Authority reporting status
  - VAT calculation compliance
  - Israeli Privacy Law adherence
  - Bank reconciliation status
  - Invoice generation compliance
- **Dependencies:** Israeli Compliance Tracker, EmailService

### 22. Security Updates Check
- **Schedule:** Daily at 3:00 AM Israel time (`0 3 * * *`)
- **Function:** `checkSecurityUpdates()`
- **Purpose:** Monitor for security vulnerabilities
- **Checks:**
  - NPM package vulnerabilities
  - Browser security updates
  - SSL certificate expiration
  - Platform security patches
  - Firebase security rules
- **Dependencies:** Security Monitor, EmailService

### 23. Dependency Audit
- **Schedule:** Weekly on Monday at 4:00 AM Israel time (`0 4 * * 1`)
- **Function:** `runDependencyAudit()`
- **Purpose:** Weekly security audit of dependencies
- **Features:**
  - Runs `npm audit`
  - Identifies vulnerable packages
  - Provides upgrade recommendations
  - Tracks security debt
  - Sends detailed report to dev team
- **Dependencies:** NPM Audit, EmailService

### 24. Log Cleanup
- **Schedule:** Every hour (`0 * * * *`)
- **Function:** `cleanupOldLogs()`
- **Purpose:** Remove old communication logs to save space
- **Features:**
  - Deletes logs older than 30 days
  - Preserves important audit logs
  - Manages disk space
  - Archives critical logs
- **Retention:** 30 days for communication logs
- **Note:** Compliance logs retained for 7 years

---

## 🕐 Hourly Schedule (Israel Time)

```
00:00 - Firestore Backup (Legacy), Data Integrity Check (Sunday only)
01:00 - Daily Firestore Export (GCS)
02:00 - Weekly Code Backup (Sunday only)
03:00 - Security Updates Check
04:00 - Dependency Audit (Monday only)
05:00 - [No scheduled jobs]
06:00 - [No scheduled jobs]
07:00 - Nayax Daily Report
07:10 - Low Stock Alerts
07:20 - Utility Renewal Alerts
07:30 - Google Sheets Sync
08:00 - Birthday Discounts, Legal Compliance Check
09:00 - Vaccine Reminders, Daily Revenue Report, Israeli Compliance
10:00 - Observances Processing, Monthly Revenue Report (1st only)
11:00 - Yearly Revenue Report (Jan 1 only)
12:00-23:59 - [No scheduled jobs]

Every Minute: Appointment Reminders
Every 5 Minutes: Smart Monitoring Status, Nayax Pending Transactions
Every Hour: Log Cleanup, Smart Monitoring Offline Reminders, Nayax Inactive Stations
```

---

## 📈 Job Priority & Dependencies

### Critical Jobs (Must Never Fail)
1. **Smart Monitoring - Status Updates** - Station health monitoring
2. **Nayax Pending Transactions** - Payment processing
3. **Daily Firestore Export (GCS)** - Data backup
4. **Appointment Reminders** - Customer service

### High Priority
- Birthday Discounts
- Vaccine Reminders
- Daily Revenue Report
- Legal Compliance Check

### Medium Priority
- Station Management (Stock, Utilities, Sheets)
- Monthly/Yearly Reports
- Data Integrity Check

### Low Priority
- Log Cleanup
- Observances Processing
- Dependency Audit

---

## 🔧 Error Handling & Monitoring

### Retry Logic
- **Appointment Reminders:** Exponential backoff (1s → 5s → 15s → 60s), max 3 retries
- **Email Failures:** Automatic retry with delay
- **Firestore Errors:** Silent failure with debug logging (prevents crash)

### Monitoring
- All critical jobs log execution to `cronExecutions` collection
- Success/failure tracking with error messages
- Execution duration tracking
- Alert generation on repeated failures

### Firestore Error Handling
```typescript
try {
  await firestoreOperation();
} catch (error) {
  logger.debug('[JOB] Skipped due to error', { 
    error: error instanceof Error ? error.message : 'Unknown' 
  });
}
```

---

## 🚀 System Impact

### Performance
- **High Frequency (Every minute):** 2 jobs (Appointment Reminders)
- **Medium Frequency (Every 5 min):** 2 jobs (Smart Monitoring, Nayax)
- **Low Frequency (Hourly+):** 20 jobs

### Resource Usage
- **Database Queries:** ~500/hour during business hours
- **Email Sending:** Variable (depends on birthdays, appointments, alerts)
- **Storage:** Backups use ~5GB/month (with cleanup)

### Timezone Handling
- All Israel-based jobs use `timezone: 'Asia/Jerusalem'`
- Ensures consistent local time execution regardless of server location
- Handles daylight saving time automatically

---

## 📝 Configuration

### Environment Variables Required
```bash
# Email Service
SENDGRID_API_KEY=xxx

# SMS Service  
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=xxx

# GCS Backups
FIREBASE_SERVICE_ACCOUNT_KEY=xxx
GCS_BUCKET_CODE_BACKUPS=petwash-code-backups
GCS_BUCKET_FIRESTORE=petwash-firestore-backups

# Nayax Integration
NAYAX_API_KEY=xxx
NAYAX_MERCHANT_ID=xxx

# Reporting
REPORTS_EMAIL_TO=nirhadad1@gmail.com
REPORTS_EMAIL_CC=admin@petwash.co.il
```

### Job Initialization
```typescript
// server/index.ts
import { BackgroundJobProcessor } from './backgroundJobs';

// Start all background jobs
BackgroundJobProcessor.start();
```

---

## ✅ Status Dashboard

**All 24 jobs are currently:** ✅ **RUNNING**

Check logs for execution history:
```bash
grep "Background job processor started" logs/*.log
grep "Birthday processing complete" logs/*.log
grep "Vaccine reminders complete" logs/*.log
```

---

**Last Updated:** October 25, 2025  
**Document Owner:** Pet Wash™ Engineering Team  
**Review Schedule:** Monthly
