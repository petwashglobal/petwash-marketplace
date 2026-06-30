# PetWash Ltd Legal Protection Pack 2026 — repo index + process map

**The CEO's original legal-draft pack**, now committed to the repo (was only in `~/Downloads`).
Source PDFs: `client/public/documents/legal/legal-protection-pack-2026/` (served at `/documents/legal/legal-protection-pack-2026/<file>`).
Status: **DRAFT — for Israeli lawyer review.** Not legal advice. The repo's declaration/agreement TEXT was transcribed from these.

## The 12 documents → where each lives in the process

| # | PDF | Audience | Maps to in-app / process |
|---|---|---|---|
| 00 | `petwash_legal_protection_manual.pdf` | Master | The umbrella manual; source for `docs/legal/petwash-master-legal-framework-he-2026-06-23.md` |
| 01 | `customer_terms_of_service_draft.pdf` | Customer | Customer ToS → `docs/legal/petwash-terms-of-service-draft` + signup consent |
| **02** | **`provider_agreement_draft.pdf`** | **Provider** | **The provider contract** → declaration `provider_service_agreement` ([[providerProtectionDeclarations]]) + `shared/legal/providerHostAgreement.ts` |
| 03 | `petwash_not_insurance_disclaimer.pdf` | Both | Declaration `insurance_disclosure` + insurance-matrix (not-insurance) |
| 04 | `provider_host_premises_addendum.pdf` | Provider (hosting) | Declaration `home_hosting_protocol` (PET_SITTER_HOSTING scope) |
| 05 | `customer_premises_addendum.pdf` | Provider (owner-home) | Declaration `owner_home_visit_protocol` (PET_SITTER_OWNER_HOME) |
| 06 | `privacy_policy_operational_draft.pdf` | Both | Declaration `privacy_data_handling` + privacy policy (Amendment 13) |
| 07 | `cancellation_refund_policy_draft.pdf` | Both | Cancellation/refund policy → refund rail + booking cancellation terms |
| 08 | `ip_copyright_brand_terms.pdf` | Both | Brand/IP rules → `docs/legal/petwash-brand-ip-licence-draft` |
| 09 | `provider_tax_insurance_declaration.pdf` | Provider | Declaration `tax_business_status` + `insurance_disclosure` |
| 10 | `incident_claim_report_form.pdf` | Both | Declaration `incident_reporting` + incident/case-management |
| 11 | `online_shop_custom_product_terms.pdf` | Customer | Shop terms → `docs/legal/petwash-online-shop-terms-draft` |

## Provider-facing subset (what a provider signs)
02 (agreement) · 03 (not-insurance) · 04 or 05 (premises addendum by service) · 06 (privacy) · 09 (tax/insurance) · 10 (incident). These back the provider declarations in `shared/providerProtectionDeclarations.ts`.

## Still blocked before providers can SIGN (not code — see [[provider-legal-documents-map-2026-06-30]])
1. Counsel reviews + approves each → flip `reviewedByCounsel: true`.
2. Professional Hebrew translation replaces the draft stubs.
3. Create DocuSeal templates (one per declaration).
4. Flip `PROVIDER_DECLARATIONS_ENFORCE=on`.

These PDFs are the **canonical source pack** the lawyer reviews; the in-app declaration text derives from them.
