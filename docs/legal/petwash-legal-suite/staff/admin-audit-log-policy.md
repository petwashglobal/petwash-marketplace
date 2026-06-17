---
title: Admin Audit-Log Policy
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 2
gate: requireAdminPermission("admin.auditlog.policy")
language: EN (Hebrew controlling once translated)
---

# Admin Audit-Log Policy

Governs the immutable audit log at **PET WASH LTD** (no. 517145033).

## 1. What is logged
Every privileged action and sensitive read, including: logins/MFA, document views (with reason), record reads of customer/provider/financial data, refunds, payout approvals, provider verification decisions, permission/role changes, secret-store access, and data exports.

## 2. Log fields
Each entry records: actor identity (named account), action, target record/document, **stated reason** (where required), result, timestamp (UTC), and source IP/session.

## 3. Immutability
Logs are append-only. No admin — including engineers — can edit or delete entries. Attempts to tamper are themselves logged and alerted.

## 4. Reason capture
Sensitive document/record access requires a reason **before** access is granted (see [Document Viewing Rules](./admin-document-viewing-rules.md)). Missing reason = access denied.

## 5. Retention
Audit logs are retained **7 years** to meet tax/record-keeping and privacy-accountability obligations.

## 6. Review & alerting
- The CLO/DPO reviews logs periodically for anomalous patterns (off-hours access, bulk reads, self/VIP lookups).
- Automated alerts fire on high-risk events (mass export, secret access, repeated denied attempts).

## 7. Access to the logs
Read access to audit logs is restricted to CLO/DPO and CEO. Support/marketing/developers cannot read others' audit entries.

## 8. Legal basis
Logging supports accountability obligations under the Protection of Privacy Law (incl. Amendment 13) and serves as evidence under Israeli law in disciplinary or legal proceedings.
