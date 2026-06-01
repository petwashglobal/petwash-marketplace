import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft, ShieldCheck, AlertTriangle, Mail } from "lucide-react";
import { Link } from "wouter";

export default function Trademarks() {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const isRtl = language === "he" || language === "ar";

  return (
    <div className={`min-h-screen luxury-bg-mesh ${isRtl ? "rtl" : "ltr"}`}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-6 flex items-center gap-2 luxury-btn-primary">
            <ArrowLeft className="h-4 w-4" />
            {isHebrew ? "חזרה לעמוד הבית" : "Back to home"}
          </Button>
        </Link>

        <div className="luxury-glass-card luxury-shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 luxury-glass-minimal rounded-2xl bg-amber-50">
              <ShieldCheck className="h-8 w-8 text-amber-700" />
            </div>
            <h1 className="luxury-heading-xl text-gray-900">
              {isHebrew ? "הודעה על סימני מסחר" : "Trademark Notice"}
            </h1>
          </div>

          <p className="text-gray-700 mb-8 leading-relaxed">
            {isHebrew
              ? "סימני המסחר, הלוגואים, שמות המוצרים והשירותים המופיעים בפלטפורמת PetWash® מוגנים על-פי דין. השימוש בהם כפוף לתנאי הרישוי המפורטים להלן."
              : "The trademarks, logos, product names, and service names displayed on the PetWash® platform are protected by law. Use of these marks is subject to the licensing conditions set out below."}
          </p>

          {/* Registered Marks */}
          <section className="mb-10">
            <h2 className="luxury-heading-lg text-gray-900 mb-4">
              {isHebrew ? "סימני מסחר רשומים" : "Registered Trademarks"}
            </h2>

            <div className="luxury-glass-minimal rounded-2xl p-6 bg-white/60 border border-amber-200">
              <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                <h3 className="text-2xl font-semibold text-gray-900">PetWash®</h3>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  {isHebrew ? "רשום" : "REGISTERED"}
                </span>
              </div>

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">{isHebrew ? "רשות הרישום" : "Issuing authority"}</dt>
                  <dd className="text-gray-900 font-medium">
                    {isHebrew ? "רשות הפטנטים — מדינת ישראל" : "Israel Patent Office (ILPO)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{isHebrew ? "מספר רישום" : "Registration No."}</dt>
                  <dd className="text-gray-900 font-medium">381713</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{isHebrew ? "סוג" : "Class"}</dt>
                  <dd className="text-gray-900 font-medium">
                    {isHebrew
                      ? "סיווג 44 — שירותי שטיפה, ניקוי וטיפוח חיות מחמד"
                      : "Class 44 — Pet washing, cleaning, and grooming services"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{isHebrew ? "טריטוריה" : "Territory"}</dt>
                  <dd className="text-gray-900 font-medium">{isHebrew ? "ישראל" : "Israel"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{isHebrew ? "תאריך רישום" : "Registered"}</dt>
                  <dd className="text-gray-900 font-medium">02/03/2026</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{isHebrew ? "תוקף עד" : "Valid through"}</dt>
                  <dd className="text-gray-900 font-medium">05/03/2035</dd>
                </div>
              </dl>

              <p className="text-xs text-gray-500 mt-4">
                {isHebrew
                  ? "הסימן ™PetWash, הלוגו של PetWash, וכל הסימנים הנלווים מוחזקים תחת רישוי לטובת חברת Pet Wash Ltd. כל הזכויות שמורות."
                  : "The PetWash® mark, the PetWash logo, and all related marks are held under license for the benefit of Pet Wash Ltd. All rights reserved."}
              </p>
            </div>
          </section>

          {/* Unregistered marks */}
          <section className="mb-10">
            <h2 className="luxury-heading-lg text-gray-900 mb-4">
              {isHebrew ? "סימני מסחר נוספים (™)" : "Additional Trademarks (™)"}
            </h2>
            <p className="text-gray-700 mb-4 leading-relaxed">
              {isHebrew
                ? "הסימנים הבאים משמשים את חברת Pet Wash Ltd כסימני מסחר במהלך עסקיה הרגיל. סימנים אלה אינם רשומים אך זכויות החברה בהם שמורות על-פי הדין הכללי."
                : "The following marks are used by Pet Wash Ltd as trademarks in the ordinary course of business. These marks are not registered, but the Company's rights in them are reserved under common-law principles."}
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              {["K9000™", "PetWash Academy™", "The Sitter Suite™", "Walk My Pet™", "PetWash Prestige™", "Pet Wash Pass™"].map((m) => (
                <span
                  key={m}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200"
                >
                  {m}
                </span>
              ))}
            </div>
          </section>

          {/* Usage rules */}
          <section className="mb-10">
            <h2 className="luxury-heading-lg text-gray-900 mb-4">
              {isHebrew ? "כללי שימוש" : "Permitted Use"}
            </h2>
            <ul className="space-y-3 text-gray-700 leading-relaxed">
              <li className="flex gap-3">
                <span className="text-amber-600 font-bold mt-1">•</span>
                <span>
                  {isHebrew
                    ? "אין להשתמש בסימני המסחר של PetWash® ללא היתר בכתב מראש מחברת Pet Wash Ltd."
                    : "The PetWash® marks may not be used without prior written consent from Pet Wash Ltd."}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-600 font-bold mt-1">•</span>
                <span>
                  {isHebrew
                    ? "אין לשנות, לעוות, להוסיף אלמנטים או לשלב את הסימן עם סימנים אחרים באופן שעלול ליצור בלבול."
                    : "The marks may not be altered, distorted, combined with other marks, or otherwise modified in a manner likely to cause confusion."}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-600 font-bold mt-1">•</span>
                <span>
                  {isHebrew
                    ? "אין להשתמש בסימן באופן שמרמז על קשר עסקי, מסחרי או חסות של PetWash מבלי שקיים הסכם רשום."
                    : "The marks may not be used in a manner suggesting a business, commercial, or sponsorship relationship with PetWash without a written agreement."}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-600 font-bold mt-1">•</span>
                <span>
                  {isHebrew
                    ? "שימוש לצורכי עיתונאות, ביקורת או דיווח חדשותי מותר, ובלבד שמצוין הבעלים של הסימן."
                    : "Use for news reporting, commentary, or review is permitted, provided the mark owner is clearly attributed."}
                </span>
              </li>
            </ul>
          </section>

          {/* Enforcement notice */}
          <section className="mb-10">
            <div className="flex items-start gap-4 p-5 luxury-glass-minimal rounded-2xl bg-red-50 border border-red-200">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">
                  {isHebrew ? "אכיפת זכויות" : "Enforcement"}
                </h3>
                <p className="text-sm text-red-900 leading-relaxed">
                  {isHebrew
                    ? "Pet Wash Ltd שומרת לעצמה את הזכות לפעול משפטית כנגד כל שימוש בלתי מורשה בסימני המסחר שלה, לרבות אך לא רק: פתיחת עסק מתחרה תחת שם או לוגו דומה, רישום שמות מתחם דומים, יצירת חשבונות ברשתות חברתיות תחת השם, או שיווק מוצרים ושירותים תחת הסימן ללא רישיון. הפרות יטופלו על פי חוק סימני המסחר התשל״ב-1972 ודינים נלווים."
                    : "Pet Wash Ltd reserves the right to pursue legal action against any unauthorized use of its trademarks, including but not limited to: opening competing businesses under similar names or logos, registering similar domain names, creating social-media accounts under the name, or marketing products and services under the mark without a license. Infringements will be pursued under the Israeli Trademarks Ordinance 1972 and related statutes."}
                </p>
              </div>
            </div>
          </section>

          {/* Licensing contact */}
          <section className="mb-4">
            <h2 className="luxury-heading-lg text-gray-900 mb-4">
              {isHebrew ? "בירורי רישוי" : "Licensing Inquiries"}
            </h2>
            <p className="text-gray-700 mb-3 leading-relaxed">
              {isHebrew
                ? "לפניות בנושא רישוי, שותפויות אסטרטגיות, או דיווח על שימוש בלתי מורשה, פנו אלינו:"
                : "For licensing inquiries, strategic partnerships, or to report unauthorized use, contact us:"}
            </p>
            <a
              href="mailto:legal@petwash.co.il"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              <Mail className="h-4 w-4" />
              legal@petwash.co.il
            </a>
          </section>

          <div className="border-t border-gray-200 pt-6 mt-8">
            <p className="text-xs text-gray-500 leading-relaxed">
              {isHebrew
                ? "© Pet Wash Ltd. כל הזכויות שמורות. הודעה זו עודכנה לאחרונה בעקבות אישור רישום סימן המסחר ביום 02/03/2026."
                : "© Pet Wash Ltd. All rights reserved. This notice was last updated following the trademark registration on March 2, 2026."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
