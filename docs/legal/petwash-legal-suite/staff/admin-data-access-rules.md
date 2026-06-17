---
title: Admin Data Access Rules
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 2
gate: requireAdminPermission("admin.access.policy")
language: EN (Hebrew controlling once translated)
---

# Admin Data Access Rules

Binding rules for any administrator of **PET WASH LTD** (no. 517145033) accessing personal, financial, or operational data.

## 1. Personal login only
Each admin uses a personal, named account. Shared/role accounts are prohibited. MFA is required.

## 2. Access is need-to-know
You may access data **only** to perform a specific, current task. "Curiosity" access, accessing your own/friends'/public-figure records, or bulk exports without authorisation are prohibited.

## 3. Scope by role (least privilege)
| Role | May access | May NOT access |
|------|-----------|----------------|
| Support | Booking/account status, message history (masked payment data) | Tax docs, full card/bank data, secrets |
| Marketing | Aggregated/consented marketing lists | Invoices, financial records, national IDs |
| Developer | Code, schemas, anonymised/test data | Production secrets, customer PII in the clear |
| Provider-reviewer | Provider KYC docs (with reason) | Payout approval, customer financial data |
| Finance | Invoices, payouts, tax docs | Source code, security secrets |

## 4. Masking & minimisation
Sensitive fields (national ID, full card number, bank account) are masked by default. Unmasking requires a logged reason and the relevant permission.

## 5. Logging
Every read of a customer/provider/financial record is logged with: admin identity, timestamp, record, and stated reason (see [Audit-Log Policy](./admin-audit-log-policy.md)).

## 6. Prohibited actions
- Downloading/exporting data to personal devices or accounts.
- Sharing data via personal email, chat, or screenshots.
- Disabling or evading the audit log.

## 7. Enforcement
Violations are disciplinary matters and may constitute offences under the Protection of Privacy Law, 5741-1981 and Computers Law, 5755-1995.
