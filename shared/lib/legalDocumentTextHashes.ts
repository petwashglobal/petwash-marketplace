/**
 * Legal document text hashes (2026-09-12).
 *
 * `staticClientPage` documents render from a bundled React page; the server
 * image does not ship client sources, so at acceptance time it cannot hash the
 * text the member saw. This file pins the SHA-256 of each page SOURCE at the
 * registry's current version, so a legal_acceptances row always carries a real
 * evidence hash (plus the public URL of the page).
 *
 * RULE (enforced by server/tests/consentP0Remainder.regression.test.ts): when a
 * legal page changes, bump `currentVersion` in legalDocumentRegistry.ts AND
 * regenerate the hash here. A wording change with the same version is a legal
 * evidence defect, and CI fails on it.
 */

export interface LegalDocumentTextHash { clientPath: string; sha256: string; version: string; }

export const LEGAL_DOCUMENT_TEXT_HASHES: Readonly<Record<string, LegalDocumentTextHash>> = {
  customer_tos: { clientPath: 'client/src/pages/legal/CustomerTerms.tsx', sha256: '3fd1661df5454c53546cc91ee9ed9bdddd9fc9c4792ba1cf156e4283f9aec627', version: 'v1' },
  privacy_policy: { clientPath: 'client/src/pages/legal/PrivacyPolicy.tsx', sha256: '5a43172007bce5c3f2525e3b3f2383d3587273e56dab309fa9168ce3dcd54dea', version: 'v1' },
  cancellation_refund_14g: { clientPath: 'client/src/pages/legal/CancellationRefundPolicy.tsx', sha256: 'd8ba3f13b9a0d7e9fc9ced2a447645ba4b456a9ad1be6848b315464917bbb867', version: 'v1' },
  booking_rules: { clientPath: 'client/src/pages/legal/BookingRules.tsx', sha256: 'b913861de40d8fe134b325e9fd5027da3a8154f5de615aa9dfcc22f9f16194a2', version: 'v1' },
  pet_owner_responsibility: { clientPath: 'client/src/pages/legal/PetOwnerResponsibility.tsx', sha256: 'b443055fe83f384a28de5b1664c94b3a61938839b9dcd841ab2c52edf6589b36', version: 'v1' },
  emergency_vet_authorisation: { clientPath: 'client/src/pages/legal/EmergencyVetAuthorisation.tsx', sha256: '8adf3a0d2f76f011dad277b9fb196dfeddd2050f79b49f9de3c15a9452409984', version: 'v1' },
  wallet_egift_terms: { clientPath: 'client/src/pages/legal/WalletEGiftTerms.tsx', sha256: '3dee8330372a596d68d31d3f5e31eb12ed1f9415d6cd1217e1acb189ae266072', version: 'v1' },
  reviews_content_policy: { clientPath: 'client/src/pages/legal/ReviewsContentPolicy.tsx', sha256: '9f6f9f5b471ef709acc34f8feec11b630029ca27f9e86556602058e331ee0636', version: 'v1' },
  community_guidelines: { clientPath: 'client/src/pages/legal/CommunityGuidelines.tsx', sha256: '036a3dbf53106f5a94cb903e5a73960017f2d77766eb6bdd4e17c14774b6c8e9', version: 'v1' },
  home_access_property_authority: { clientPath: 'client/src/pages/legal/HomeAccessPropertyAuthority.tsx', sha256: '4abae57c49d055d38692939d349366c697d823faabce452ac4cefdedc5e1775f', version: 'v1' },
  provider_self_declaration_no_convictions: { clientPath: 'client/src/pages/legal/ProviderTruthDeclaration.tsx', sha256: '03d5f0ccddf5a6793e2bbfa3f49f42822c99b4cb75e7f1b85d23b60d8404b65d', version: 'v1' },
  provider_background_check_consent: { clientPath: 'client/src/pages/legal/ProviderDocumentUpload.tsx', sha256: 'e246738a655e0e3f55e86019227f1ae8a8725ce03b1443d4319315c3d8613868', version: 'v1' },
  provider_reconfirmation: { clientPath: 'client/src/pages/legal/ProviderReconfirmation.tsx', sha256: 'd5d5a7634e047484afb252f660c3558a65a7ed489d635167392e6359035a4077', version: 'v1' },
  provider_truth_declaration: { clientPath: 'client/src/pages/legal/ProviderTruthDeclaration.tsx', sha256: '03d5f0ccddf5a6793e2bbfa3f49f42822c99b4cb75e7f1b85d23b60d8404b65d', version: 'v1' },
  provider_confidentiality: { clientPath: 'client/src/pages/legal/ProviderConfidentiality.tsx', sha256: '2cf87a23f65489a15022a9b58843e7a2ebd884f30fb9472b6c078f6e264450d0', version: 'v1' },
  provider_brand_use: { clientPath: 'client/src/pages/legal/ProviderBrandUse.tsx', sha256: '7674fb5206c383c21799ba1fc52b7a21eb59a3ebc93c1bdaa00ced0e9cd00961', version: 'v1' },
  provider_payout_rules: { clientPath: 'client/src/pages/legal/ProviderPayoutRules.tsx', sha256: '1801de082dbb9ca1a7de2ad60fef8278901ca19e771d4631292a3d95e8b0c653', version: 'v1' },
  provider_cancellation: { clientPath: 'client/src/pages/legal/ProviderCancellation.tsx', sha256: '7b5d8a9c9ef83569d09b0afd0262fc4df3f9566a9be92dd93836cead778b55e6', version: 'v1' },
  provider_no_circumvention: { clientPath: 'client/src/pages/legal/NoCircumvention.tsx', sha256: '17b0616389df920bcc3bccec13f2b5fdf4cc0953e107860be18239af9c643498', version: 'v1' },
} as const;

/** Public page for each document, used as `snapshot_url` evidence. */
export const LEGAL_DOCUMENT_PUBLIC_PATHS: Readonly<Record<string, string>> = {
  customer_tos: '/legal/customer-terms',
  privacy_policy: '/legal/privacy',
  cancellation_refund_14g: '/legal/cancellation-refund-policy',
  booking_rules: '/legal/booking-rules',
  pet_owner_responsibility: '/legal/pet-owner-responsibility',
  emergency_vet_authorisation: '/legal/emergency-vet-authorisation',
  wallet_egift_terms: '/legal/wallet-egift-terms',
  reviews_content_policy: '/legal/reviews-content-policy',
  community_guidelines: '/legal/community-guidelines',
  home_access_property_authority: '/legal/home-access-property-authority',
  provider_self_declaration_no_convictions: '/legal/provider-truth-declaration',
  provider_background_check_consent: '/legal/provider-document-upload',
  provider_reconfirmation: '/legal/provider-reconfirmation',
  provider_truth_declaration: '/legal/provider-truth-declaration',
  provider_confidentiality: '/legal/provider-confidentiality',
  provider_brand_use: '/legal/provider-brand-use',
  provider_payout_rules: '/legal/provider-payout-rules',
  provider_cancellation: '/legal/provider-cancellation',
  provider_no_circumvention: '/legal/no-circumvention',
} as const;

export function legalDocumentPublicUrl(key: string, base = 'https://petwash.co.il'): string | null {
  const p = LEGAL_DOCUMENT_PUBLIC_PATHS[key];
  return p ? `${base}${p}` : null;
}
