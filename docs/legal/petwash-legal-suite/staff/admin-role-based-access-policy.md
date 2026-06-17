---
title: Admin Role-Based Access Policy
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 2
gate: requireAdminPermission("admin.rbac.policy")
language: EN (Hebrew controlling once translated)
---

# Admin Role-Based Access Policy (RBAC)

Defines roles, permissions, and separation of duties at **PET WASH LTD** (no. 517145033).

## 1. Personal, named roles
Permissions are granted to **individuals via named accounts**, never to shared logins. Each admin is assigned one or more roles; the system enforces `requireAdminPermission(...)` on every protected action.

## 2. Roles & permissions
| Role | Key permissions | Explicitly denied |
|------|-----------------|-------------------|
| Support agent | View booking/account status, reply to messages, issue routine refunds within cap | Tax docs, payout approval, secrets, marketing exports |
| Marketing | Manage campaigns, consented audience lists | Invoices, financial records, national IDs, KYC docs |
| Developer | Deploy code, read schemas, test data | Production secrets, plaintext customer PII, payout approval |
| Provider-reviewer | View provider KYC/insurance, mark verified/rejected | **Payout approval**, customer financial data |
| Finance / payout-approver | Approve payouts, view invoices/tax docs | Source code, security secrets, provider KYC editing |
| CLO / DPO | Audit-log review, document oversight | (oversight role; no money-movement) |
| CEO / owner | Org-wide oversight, secret-store access | — |

## 3. Separation of duties (mandatory)
- The admin who **reviews/verifies a provider** must not be the admin who **approves their payout**.
- The admin who **issues a large refund** must not be the one who **approves** it (four-eyes above cap).
- Developers must not approve payouts or hold production secrets.

## 4. Least privilege & periodic review
Grant the minimum role needed. Access is reviewed quarterly; unused/excess permissions are revoked. Role changes are logged.

## 5. Joiners / movers / leavers
- Joiner: role provisioned on signed [Confidentiality Agreement](./staff-confidentiality-agreement.md).
- Mover: old role revoked when new role granted.
- Leaver: all access revoked same day.

## 6. Enforcement
Attempting to act beyond your role is a disciplinary matter and may breach the Computers Law, 5755-1995.
