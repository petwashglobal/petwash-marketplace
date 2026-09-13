import PrivacyPolicy from "./PrivacyPolicy";
import { useSEO, pageSEO } from "@/lib/seo";

// SEO lives in this wrapper, NOT in PrivacyPolicy.tsx: that file's bytes are the
// pinned consent-evidence hash for privacy_policy v1 (shared/lib/
// legalDocumentTextHashes.ts). Touching it for a non-text change would force a
// version bump — every customer re-accepting an unchanged policy.
// pageSEO.privacyPolicy hard-codes canonical /privacy-policy (a Redirect alias) —
// dropped so useSEO derives the canonical from the real route.
export const PRIVACY_POLICY_SEO = { ...pageSEO.privacyPolicy, canonical: undefined };

export default function PrivacyPolicyPage() {
  useSEO(PRIVACY_POLICY_SEO);
  return <PrivacyPolicy />;
}
