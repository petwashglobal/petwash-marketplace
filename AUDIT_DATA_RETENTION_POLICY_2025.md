# 🔐 Blockchain Audit Data Retention Policy
**Pet Wash™️ CRM - 7-Year Compliance Framework**
*Effective Date: October 27, 2025*

---

## 📋 Legal Requirement
Israeli Privacy Law (Amendment 13, 2023) and tax regulations require **7-year minimum data retention** for financial transactions, audit trails, and compliance records.

---

## 🗂️ Data Categories & Retention

### 1. Audit Ledger Records
**Table:** `audit_ledger`
**Retention Period:** **INDEFINITE** (immutable blockchain records)
**Legal Basis:** Financial audit, fraud prevention, compliance evidence

#### Covered Events:
- Wallet pass generation (Apple/Google Wallet)
- Voucher redemptions (e-vouchers, gift cards)
- Loyalty tier changes (tier upgrades, VIP status)
- Points transactions (earned, spent, expired)
- Discount code usage
- Wash package redemptions

#### Data Stored:
- Cryptographic hash chain (previousHash, currentHash)
- Block number (sequential integrity)
- Event metadata (userId, entityType, entityId, action)
- Transaction states (previousState, newState)
- Security context (IP address, user agent, device ID)
- Fraud scoring (fraudScore, fraudSignals)
- Immutable timestamp

**Purge Policy:** **NEVER PURGE** - Blockchain integrity requires complete chain preservation

---

### 2. Voucher Redemptions
**Table:** `voucher_redemptions`
**Retention Period:** **7 years minimum** from redemption date
**Legal Basis:** Tax compliance, financial auditing, fraud prevention

#### Data Stored:
- Unique voucher ID (prevents double-spend)
- User ID (customer link)
- Redemption code (one-time use token)
- Transaction amount, station ID, franchise ID
- Cryptographic redemption hash
- Audit ledger reference (immutable link)
- Timestamp

**Purge Policy:** Delete records older than 7 years on annual audit cleanup (Jan 1st)

---

### 3. Discount Usage Log
**Table:** `discount_usage_log`
**Retention Period:** **7 years minimum** from usage date
**Legal Basis:** Tax compliance, promotional campaign auditing, fraud prevention

#### Data Stored:
- Discount code, user ID
- Usage token (one-time enforcement)
- Discount amount, original/final prices
- Station ID
- Cryptographic usage hash
- Audit ledger reference
- Timestamp

**Purge Policy:** Delete records older than 7 years on annual audit cleanup (Jan 1st)

---

### 4. Merkle Snapshots
**Table:** `merkle_snapshots`
**Retention Period:** **INDEFINITE** (integrity verification proof)
**Legal Basis:** Tamper detection, compliance evidence

#### Data Stored:
- Snapshot date
- Merkle root hash (daily integrity proof)
- Total records in snapshot
- Start/end block numbers
- Timestamp

**Purge Policy:** **NEVER PURGE** - Required for chain verification

---

## 🔄 Automated Processes

### Daily Operations (2:00 AM Israel Time)
**Cron Job:** `0 2 * * *` (backgroundJobs.ts, line 289)

1. **Merkle Snapshot Creation**
   - Compute Merkle tree root hash
   - Store snapshot metadata
   - Log verification status
   - Lock prevents concurrent execution

2. **Integrity Verification**
   - Verify hash chain continuity
   - Detect tampering attempts
   - Generate alerts for anomalies

### Annual Cleanup (January 1st, 3:00 AM Israel Time)
**Cron Job:** `0 3 1 1 *` (future enhancement)

1. **Identify Expired Records**
   - Query voucher_redemptions where `createdAt < NOW() - INTERVAL '7 years'`
   - Query discount_usage_log where `createdAt < NOW() - INTERVAL '7 years'`
   - EXCLUDE audit_ledger (never purge)
   - EXCLUDE merkle_snapshots (never purge)

2. **Archive to Google Cloud Storage**
   - Export deleted records to GCS bucket: `petwash-audit-archive/`
   - Filename pattern: `{table_name}_archive_{year}.json.gz`
   - SHA-256 checksum for each archive file
   - Firestore audit log entry

3. **Permanent Deletion**
   - Execute DELETE queries after successful GCS upload
   - Verify deletion counts match expected records
   - Log completion status

---

## 📦 Long-Term Storage Architecture

### Google Cloud Storage Buckets
**Primary Bucket:** `petwash-audit-archive`
**Backup Bucket:** `petwash-audit-archive-backup` (cross-region replication)

### Storage Classes
- **Nearline Storage** (Years 1-3): Fast retrieval for recent audits
- **Coldline Storage** (Years 4-7): Lower cost, slower retrieval
- **Archive Storage** (Year 7+): Minimum cost, legal compliance only

### Access Controls
- **IAM Role:** `audit-archive-admin` (petwash-ops@petwash.co.il)
- **Audit Logging:** All GCS access logged to Firestore
- **Encryption:** Google-managed encryption keys (CMEK)
- **Lifecycle Policy:** Auto-transition to cheaper storage classes

---

## 🛡️ Security & Compliance

### Immutability Guarantees
1. **Database Constraints**
   - `blockNumber` UNIQUE constraint (prevents forks)
   - `currentHash` UNIQUE constraint (prevents duplicates)
   - `voucherId` UNIQUE constraint (prevents double-spend)
   - `[discountCode, userId]` UNIQUE constraint (prevents race conditions)

2. **Transaction Locking**
   - SELECT FOR UPDATE on ledger tail (serializes writes)
   - Prevents concurrent chain forks
   - Database-level enforcement

3. **Cryptographic Verification**
   - SHA-256 hash chaining
   - Merkle tree daily snapshots
   - Tamper detection algorithms

### Audit Trail Access
**Customer Access:** `/audit-trail` page (personal records only)
**Admin Access:** `/admin/fraud-dashboard` (full system view, RBAC-protected)
**Legal Requests:** GCS archive retrieval via admin API

### Data Subject Rights (GDPR/Israeli Privacy Law)
**Right to Access:** Customer audit trail page
**Right to Rectification:** NOT APPLICABLE (immutable ledger)
**Right to Erasure:** NOT APPLICABLE (7-year legal obligation)
**Right to Portability:** JSON export of personal audit records

Note: Blockchain immutability conflicts with "right to be forgotten" - Legal retention overrides erasure requests for 7 years.

---

## 📊 Compliance Monitoring

### Daily Checks (Automated)
- Merkle snapshot creation success rate
- Hash chain continuity verification
- Fraud score anomaly detection
- Storage quota monitoring

### Monthly Reviews (Manual)
- Audit log completeness
- GCS archive integrity (checksum verification)
- Retention policy compliance
- Legal requirement updates

### Annual Audits (External)
- Penetration testing of audit system
- Israeli Tax Authority compliance certification
- Privacy Law compliance review (DPO)
- GCS archive accessibility test

---

## 🚨 Incident Response

### Data Breach Scenario
1. Lock audit ledger writes
2. Export full chain to offline storage
3. Run Merkle verification
4. Identify compromised blocks
5. Notify authorities (72-hour GDPR deadline)
6. Customer notification (Israeli Privacy Law)

### Chain Fork Detection
1. Alert triggered by duplicate blockNumber
2. Lock ledger writes immediately
3. Identify fork point via hash mismatch
4. Manual resolution by blockchain admin
5. Post-mortem analysis

### Retention Violation
1. Identify missing records (>7 years, deleted prematurely)
2. Restore from GCS archive
3. Verify restoration via Merkle proof
4. Document incident in Firestore audit log
5. Update retention procedures

---

## 📞 Contact & Responsibility

**Data Protection Officer (DPO):** [To be assigned]
**Blockchain Audit Admin:** petwash-ops@petwash.co.il
**Legal Compliance Team:** legal@petwash.co.il
**Technical Lead:** CTO

**Emergency Contact:** +972-XX-XXXXXXX (24/7 security hotline)

---

## 📝 Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Oct 27, 2025 | Initial policy | Replit Agent |

**Next Review Date:** April 27, 2026 (6-month intervals)

---

**Pet Wash™️ - Blockchain-Grade Data Governance** 🐾
