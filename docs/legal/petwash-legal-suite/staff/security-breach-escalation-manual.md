---
title: Security Breach Escalation Manual
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 1
gate: requireAdminPermission("security.escalate")
language: EN (Hebrew controlling once translated)
---

# Security Breach Escalation Manual

Operational manual for handling suspected security or data breaches at **PET WASH LTD** (no. 517145033).

## 1. What is a breach
Unauthorised access to or exposure of personal data, secrets/credentials (e.g. leaked signing key), unauthorised money movement, account takeover, malware, or any loss/leak of customer/provider/financial data.

## 2. Report immediately — do not investigate alone
Any staff member who suspects a breach must report it **immediately** to the CLO/DPO and CEO. Speed matters. Do not stay silent, do not "fix it quietly", do not tip off a suspected insider.

## 3. First actions (containment)
1. Contain: revoke/rotate the affected secret, disable the compromised account/session, isolate the affected system.
2. Preserve evidence: logs, timestamps — do not destroy.
3. Stop further exposure (e.g. take an exposed endpoint offline).

## 4. Assessment
CLO/DPO assess: what data, how many data subjects, whether sensitive data (national IDs, health, payment), and the risk to individuals.

## 5. Notification duties (Israel)
Under the Protection of Privacy Law (incl. Amendment 13) and the Privacy Protection (Data Security) Regulations, a serious security event may require notification to the **Privacy Protection Authority (PPA)** and to affected data subjects. The CLO decides and times notifications. Do not notify externally without CLO authorisation.

## 6. Secret exposure
Any exposed credential (incl. anything found in git history) is rotated **immediately** and treated as an incident, even if no misuse is confirmed.

## 7. Record
Log the incident timeline, scope, actions, decisions, and notifications. Retain for accountability.

## 8. Post-incident
Conduct a blameless review; close gaps; update controls. Reporting in good faith is protected — non-reporting is a serious violation.
