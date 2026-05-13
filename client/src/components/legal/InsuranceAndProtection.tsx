/**
 * InsuranceAndProtection — safety disclaimer component.
 *
 * PR-LEGAL-B: previously this file rendered a multi-section
 * "Pet Wash™ Accident Cover" panel naming Harel Insurance
 * Company Ltd. as the underwriter, policy PW-2026-IL-001,
 * effective January 2026, with hard-coded coverage amounts
 * (₪20M general liability, ₪250K pet & property, ₪50K
 * emergency vet, etc.).
 *
 * Those claims contradicted §8 of the Provider & Host
 * Services Agreement merged in PR-LEGAL-A (#246):
 *
 *   "Pet Wash Ltd is not an insurance company, insurance
 *    broker or insurance adviser."
 *   "Pet Wash makes no guarantee that any claim will be
 *    approved or covered."
 *
 * The component now renders only the canonical safety
 * disclaimer approved by the CEO (chat 2026-05-12). NO
 * underwriter name, NO policy number, NO monetary coverage
 * amounts, NO "covered by us" claim.
 *
 * The component file is intentionally kept under its
 * existing name so its single importer
 * (client/src/pages/legal/MarketplaceTerms.tsx) continues
 * compiling. A follow-up cleanup PR may rename to
 * SafetyAndDisclaimer.
 *
 * Props are preserved for type compatibility; their values
 * no longer influence rendered content because there is
 * only one disclaimer body now.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

interface InsuranceAndProtectionProps {
  variant?: "provider" | "customer" | "full";
  className?: string;
  /**
   * Preserved for type compatibility with the previous
   * version. Has no effect on the rendered disclaimer.
   */
  flowType?:
    | "marketplace_booking"
    | "direct_platform_sale"
    | "egift_sale"
    | "wallet_topup";
}

// Approved bilingual disclaimer wording. CEO directive
// 2026-05-12. Do NOT edit without Counsel sign-off.
const HEADLINE_EN = "Safety information";
const HEADLINE_HE = "מידע בטיחות";

const DISCLAIMER_EN =
  "Providers may be required to maintain their own insurance " +
  "depending on the service type and applicable law. Pet Wash " +
  "is not an insurance company, broker or adviser.";

const DISCLAIMER_HE =
  "ספקים עשויים להידרש להחזיק בביטוח מתאים בהתאם לסוג השירות " +
  "והדין החל. פט וואש בע״מ אינה חברת ביטוח, סוכנות ביטוח או " +
  "יועצת ביטוח.";

const SUB_EN =
  "Pet Wash operates a technology marketplace connecting pet " +
  "owners with independent providers. Pet Wash does not " +
  "guarantee that any insurance claim will be approved or " +
  "covered. Providers should obtain independent legal and " +
  "insurance advice.";

const SUB_HE =
  "פט וואש מפעילה פלטפורמת טכנולוגיה המחברת בין בעלי חיות " +
  "מחמד לבין ספקים עצמאיים. פט וואש אינה מתחייבת כי תביעה " +
  "כלשהי תאושר או תכוסה. מומלץ לספק לקבל ייעוץ משפטי " +
  "וביטוחי עצמאי.";

export function InsuranceAndProtection({
  className = "",
}: InsuranceAndProtectionProps) {
  // Locale detection without coupling to react-i18next so
  // this component stays minimal and predictable.
  const isHebrew =
    typeof document !== "undefined" &&
    (document.documentElement.lang || "").toLowerCase().startsWith("he");
  const dir: "rtl" | "ltr" = isHebrew ? "rtl" : "ltr";

  const headline = isHebrew ? HEADLINE_HE : HEADLINE_EN;
  const disclaimer = isHebrew ? DISCLAIMER_HE : DISCLAIMER_EN;
  const sub = isHebrew ? SUB_HE : SUB_EN;

  return (
    <div className={className} dir={dir}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-gray-700" />
            </div>
            <CardTitle className="text-lg font-semibold">
              {headline}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-800 leading-relaxed">
            {disclaimer}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-3">
            {sub}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default InsuranceAndProtection;
