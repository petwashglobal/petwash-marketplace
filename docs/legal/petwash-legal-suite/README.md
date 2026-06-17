# PetWash™ Legal Document Suite

**PET WASH LTD / פט וואש בע״מ · No. 517145033 · Israel**

The complete original legal, safety, privacy, payment, provider, station,
Academy, supplier, staff and partner document set — **role-specific,
Israel-specific, original wording** (no competitor text), built to be **wired to
software gates** (consent / per-service approval / payout / supplier-payment /
admin-permission), version-controlled, and stored as signed evidence — not PDFs
in a drawer.

## Status
All documents are **`1.0-DRAFT` — pending CLO/legal sign-off** (not binding until
approved). They are **AI-verified against current 2026 Israeli sources** — see
[`COMPLIANCE-BASIS.md`](./COMPLIANCE-BASIS.md), the authoritative reference every
document must conform to (VAT 18%, Invoice-Israel thresholds ₪10k/₪5k, Privacy
Amendment 13, distance-sale cancellation 14d / 5%-or-₪100, contractor test,
e-signature validity, osek ₪122,833, accessibility WCAG 2.0 AA).

## Groups (99 documents)
| Group | Count | Folder |
|---|---|---|
| Member / public | 18 | [`member/`](./member/index.md) |
| Provider | 21 | [`provider/`](./provider/index.md) |
| Service manuals (walking / sitting / grooming / training) | 4 | [`manuals/`](./manuals/index.md) |
| Academy | 10 | [`academy/`](./academy/index.md) |
| Supplier / contractor | 13 | [`supplier/`](./supplier/index.md) |
| Staff / admin (+ ops manuals) | 12 | [`staff/`](./staff/index.md) |
| Location partner / franchise | 14 | [`partner/`](./partner/index.md) |

## How each document is wired
Every file carries front-matter with: `role`, `version`, `signatureLevel`
(1 checkbox / 2 typed-name / 3 OTP+name), and the `gate` that enforces it
(e.g. `requireConsent('terms')` before a wallet pass,
`requireProviderServiceApproval(...)` before booking/payout,
`requireSupplierPaymentApproval(...)` before supplier payment). The existing
consent-evidence layer (`user_consents` + `consent_snapshots` + hash-chained
`audit_ledger`) records who accepted which version, when, with what hash.

## Before launch
Confirm the items flagged **LIKELY/UNCERTAIN** in `COMPLIANCE-BASIS.md` against
the consolidated statute text, then promote each document from `DRAFT` to a
versioned `effectiveDate` and connect its gate. Provider booking / payouts must
not go live until the provider + service-specific docs and their gates are active.
