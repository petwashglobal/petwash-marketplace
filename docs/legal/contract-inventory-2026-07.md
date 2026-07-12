# PetWash™ — Contract & Legal Document Inventory (2026-07)

Every legal document in the repo, Hebrew + English. All are **bilingual (He/En)** React
pages built on the shared `LegalPage`/`LegalSection` components (text, not PDF), rendered
under `/legal/*` and linked from `LegalIndex.tsx` (מרכז משפטי ומדריכים).

> **Counsel gate:** these bind users. Text may be reviewed/edited but the *binding* version
> must have PetWash counsel (עו״ד/רו״ח) sign-off, and DocuSeal e-sign must be wired before
> the digital-signature evidence clause is relied on.

## Provider & Host (the "provider signup legal")
| Document | He | File |
|---|---|---|
| **Provider & Host Services Agreement** (master, 19 §) | הסכם נותן שירות ומארח | `legal/ProviderAgreement.tsx` |
| Independent Contractor Status | מעמד קבלן עצמאי | `legal/ProviderIndependentStatus.tsx` |
| Tax & Business Status Declaration | הצהרת מס ומעמד עסקי | `legal/ProviderTaxBusinessDeclaration.tsx` |
| Provider Truth Declaration | הצהרת אמת של נותן השירות | `legal/ProviderTruthDeclaration.tsx` |
| Provider Payout Rules | כללי תשלום לנותן שירות | `legal/ProviderPayoutRules.tsx` |
| Provider Cancellation | ביטולים — נותן שירות | `legal/ProviderCancellation.tsx` |
| Provider Insurance & Licence | ביטוח ורישיון — נותן שירות | `legal/ProviderInsuranceLicence.tsx` |
| Provider Confidentiality | סודיות נותן השירות | `legal/ProviderConfidentiality.tsx` |
| Provider Brand-Use Rules | שימוש במותג — נותן שירות | `legal/ProviderBrandUse.tsx` |
| Provider Document Upload | העלאת מסמכים — נותן שירות | `legal/ProviderDocumentUpload.tsx` |
| Provider Incident Reporting | דיווח אירועים — נותן שירות | `legal/ProviderIncidentReporting.tsx` |
| Re-confirmation — Every 6 Months | אישור מחדש — כל 6 חודשים | `legal/ProviderReconfirmation.tsx` |
| No Circumvention | איסור עקיפת הפלטפורמה | `legal/NoCircumvention.tsx` |
| Home Access & Property Authority | אישור גישה לבית וסמכות על הנכס | `legal/HomeAccessPropertyAuthority.tsx` |
| Provider Declarations (bundle) | הצהרות נותן שירות | `pages/ProviderDeclarations.tsx` |

## Customer / Member
| Document | He | File |
|---|---|---|
| Customer / Member Terms | תנאי שימוש ללקוח / חבר מועדון | `legal/CustomerTerms.tsx` |
| Booking Rules | כללי הזמנה | `legal/BookingRules.tsx` |
| Cancellation & Refund Policy | מדיניות ביטול והחזר כספי | `legal/CancellationRefundPolicy.tsx` |
| Pet Owner Responsibility | אחריות בעל חיית המחמד | `legal/PetOwnerResponsibility.tsx` |
| Wallet & eGift Terms | תנאי ארנק ו-eGift | `legal/WalletEGiftTerms.tsx` |
| Reviews & Content Policy | מדיניות ביקורות ותוכן | `legal/ReviewsContentPolicy.tsx` |
| Community Guidelines | הנחיות הקהילה | `legal/CommunityGuidelines.tsx` |
| Station Use Terms | תנאי שימוש בעמדה | `legal/StationUseTerms.tsx` |
| Support & Incident Reporting (Customers) | תמיכה ודיווח אירועים (לקוחות) | `legal/SupportIncidentReporting.tsx` |

## Protection / Insurance / Claims
| Document | He | File |
|---|---|---|
| Protection — No-Insurance Notice | הודעה: הגנה — אין ביטוח אוטומטי | `legal/ProtectionNoInsuranceNotice.tsx` |
| Support & Protection Policy | מדיניות הגנה ותמיכה | `legal/SupportProtectionPolicy.tsx` |
| Claim Procedure (Conditional) | נוהל תביעה (מותנה) | `legal/ClaimProcedure.tsx` |
| Emergency Vet Authorisation | הרשאה לטיפול וטרינרי בחירום | `legal/EmergencyVetAuthorisation.tsx` |

## Privacy / Data / Platform / Misc
| Document | He | File |
|---|---|---|
| Privacy Policy | מדיניות פרטיות | `legal/PrivacyPolicy.tsx`, `pages/PrivacyPolicy.tsx` |
| Pet Profile & Health Data Notice | הודעה על פרופיל ומידע בריאותי | `legal/PetProfileHealthDataNotice.tsx` |
| Terms / Terms & Conditions | תנאי שימוש | `legal/Terms.tsx`, `legal/TermsConditions.tsx`, `pages/Terms.tsx` |
| Marketplace Terms | תנאי מרקטפלייס | `legal/MarketplaceTerms.tsx` |
| Comprehensive Legal Terms | תנאים משפטיים מקיפים | `components/legal/ComprehensiveLegalTerms.tsx` |
| Marketplace Legal Content | תוכן משפטי — מרקטפלייס | `components/legal/MarketplaceLegalContent.tsx` |
| Disclaimer | כתב ויתור | `legal/Disclaimer.tsx` |
| Trademarks | סימני מסחר | `legal/Trademarks.tsx` |
| Accessibility Statement | הצהרת נגישות | `legal/AccessibilityStatement.tsx` |

## External (CEO-authored PDFs, not in repo)
- **Provider & Host Services Agreement** — `~/Downloads/# PET WASH LTD # PROVIDER & HOST SERVICES AGREEMENT … בע"מ.pdf` (May 2026, 8 pp, EN). The source for the 2026-07 merge below.
- **PetWash Legal Protection Manual** — `~/Downloads/00_petwash_legal_protection_manual_FIXED.pdf`.

## 2026-07 merge — what changed & what's still open
The CEO's PDF had four protective clauses missing from the live master agreement.
Merged into `legal/ProviderAgreement.tsx` (now 19 §, bilingual, renumbered):
- **§6 Background Checks & Verification** (consent) — NEW
- **§14 Insurance Disclaimer** ("not an insurance company" + required provider insurances) — strengthened
- **§15 Limitation of Liability** (as-is/as-available, no income guarantee, no indirect damages) — NEW
- **§18 Digital Signature & Consent** (electronic evidence) — NEW

Kept the repo's Israel-specific strengths the PDF lacked: payout gates, 6-month re-confirmation,
no-auto-approval, Bituach Leumi, עוסק פטור/מורשה, Tel-Aviv jurisdiction, full bilingual text.

**Still open:** (1) **counsel sign-off** on §6/§14/§15/§18 before they're relied on as binding;
(2) **DocuSeal e-sign** wiring (unhooked per the earlier audit) before §18's evidence clause holds;
(3) optional — the ~15 standalone provider docs overlap the master and could be consolidated or
clearly scoped as annexes.
