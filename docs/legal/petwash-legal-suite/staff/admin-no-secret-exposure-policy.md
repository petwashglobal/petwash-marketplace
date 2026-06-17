---
title: Admin No-Secret-Exposure Policy
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 2
gate: requireAdminPermission("admin.secrets.policy")
language: EN (Hebrew controlling once translated)
---

# Admin No-Secret-Exposure Policy

Protects production secrets, keys, and credentials at **PET WASH LTD** (no. 517145033).

## 1. Definition of "secret"
API keys, signing keys (e.g. Apple Wallet, JWT), database URLs, payment-processor credentials (SUMIT/UPay/Nayax), Twilio/SendGrid keys, OAuth client secrets, and any credential granting system or money access.

## 2. Developers do not hold production secrets
Developers work against test/sandbox credentials only. Production secrets live in the managed secret store (GitHub Actions secrets / GCP Secret Manager) and are injected at deploy — never pasted into code, logs, tickets, chat, or local files.

## 3. No secrets in code or VCS
- No secret in source, config committed to git, comments, or test fixtures.
- Secret scanning runs on every push; hits block the merge.
- Source maps and verbose error output must not leak secrets to clients.

## 4. Least privilege for secret access
Access to the production secret store is restricted to named operators (CEO/ops + CLO). Each access is logged. No shared accounts.

## 5. Rotation
Any secret that is exposed (e.g. leaked in git history) must be **rotated immediately** and the exposure logged as a security incident (see [Security Breach Escalation Manual](./security-breach-escalation-manual.md)).

## 6. Prohibited
- Printing secrets to logs or telemetry.
- Sharing secrets over email/chat/screenshare.
- Copying secrets to personal machines or password managers outside Company control.

## 7. Enforcement
Violation is a serious disciplinary matter and may breach the Computers Law, 5755-1995 and contractual confidentiality.
