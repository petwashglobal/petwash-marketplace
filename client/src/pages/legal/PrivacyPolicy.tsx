import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/sitter-suite">
          <button className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400">
            <ArrowLeft className="h-4 w-4" />
            {isHebrew ? 'חזרה ל-The Sitter Suite™' : 'Back to The Sitter Suite™'}
          </button>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {isHebrew ? 'מדיניות פרטיות' : 'Privacy Policy'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
            {isHebrew ? 'עודכן לאחרונה: 29 באוקטובר 2025' : 'Last Updated: October 29, 2025'}
          </p>

          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '1. מבוא' : '1. Introduction'}
              </h2>
              <p className="leading-relaxed">
                {isHebrew ? (
                  <>Pet Wash Ltd ("אנחנו", "שלנו", או "Pet Wash") מפעילה פלטפורמת מרקטפלייס מקוונת המחברת בין בעלי חיות מחמד לשמרטפי חיות מחמד מקצועיים באמצעות "The Sitter Suite™" ("הפלטפורמה"). אנו מתחייבים להגן על פרטיות המשתמשים שלנו ולעמוד בחוקי הגנת המידע של ישראל, GDPR, ותקני פרטיות בינלאומיים.</>
                ) : (
                  <>Pet Wash Ltd ("we", "our", or "Pet Wash") operates an online marketplace platform connecting pet owners with professional pet sitters through The Sitter Suite™ ("the Platform"). We are committed to protecting the privacy of our users and complying with Israeli privacy laws, GDPR, and international privacy standards.</>
                )}
              </p>
              <p className="leading-relaxed mt-4">
                {isHebrew ? (
                  <>Pet Wash פועלת כפלטפורמת מקשרת בלבד (כמו cars.com.au או Airbnb) - אנחנו מאפשרים חיבור בין שני צדדים עצמאיים ולוקחים עמלת תיווך קטנה. אנו לא מעסיקים שמרטפים ולא מספקים את השירותים ישירות.</>
                ) : (
                  <>Pet Wash operates as a connector platform only (like cars.com.au or Airbnb) - we facilitate connections between two independent parties and take a small brokerage commission. We do not employ sitters nor provide services directly.</>
                )}
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '2. מידע שאנו אוספים' : '2. Information We Collect'}
              </h2>
              
              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
                {isHebrew ? '2.1 מידע שאתה מספק' : '2.1 Information You Provide'}
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'פרטים אישיים: שם מלא, תאריך לידה, דוא"ל, טלפון' : 'Personal Details: Full name, date of birth, email, phone'}</li>
                <li>{isHebrew ? 'כתובת מגורים: רחוב, דירה, עיר, מדינה, מיקוד, מדינה' : 'Home Address: Street, apartment, city, state/province, postal code, country'}</li>
                <li>{isHebrew ? 'מידע פיננסי: פרטי תשלום מעובדים באמצעות Nayax (אנו לא שומרים פרטי כרטיסי אשראי)' : 'Financial Information: Payment details processed through Nayax (we do not store credit card details)'}</li>
                <li>{isHebrew ? 'פרטי חיית מחמד: שם, גזע, גיל, משקל, תמונות, אלרגיות, צרכים מיוחדים' : 'Pet Information: Name, breed, age, weight, photos, allergies, special needs'}</li>
                <li>{isHebrew ? 'מסמכי אימות (שמרטפים): תעודת זהות, אישורי רקע, תעודות ביטוח' : 'Verification Documents (Sitters): ID documents, background checks, insurance certificates'}</li>
                <li>{isHebrew ? 'מידע בריאותי: אלרגיות אישיות, סטטוס עישון (שמרטפים)' : 'Health Information: Personal allergies, smoking status (Sitters)'}</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-gray-800 dark:text-gray-200">
                {isHebrew ? '2.2 מידע שנאסף אוטומטית' : '2.2 Automatically Collected Information'}
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'מיקום גיאוגרפי: נתוני GPS למצוא שמרטפים קרובים' : 'Geolocation Data: GPS data to find nearby sitters'}</li>
                <li>{isHebrew ? 'מידע התקן: כתובת IP, סוג דפדפן, מערכת הפעלה' : 'Device Information: IP address, browser type, operating system'}</li>
                <li>{isHebrew ? 'Cookies ו-טכנולוגיות דומות' : 'Cookies and similar technologies'}</li>
                <li>{isHebrew ? 'נתוני שימוש: דפים שביקרת, זמן שהותך באתר' : 'Usage Data: Pages visited, time spent on site'}</li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '3. כיצד אנו משתמשים במידע' : '3. How We Use Your Information'}
              </h2>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'לאפשר הזמנות ותשלומים בין בעלים לשמרטפים' : 'To facilitate bookings and payments between owners and sitters'}</li>
                <li>{isHebrew ? 'לאמת זהויות וערוך בדיקות רקע (שמרטפים)' : 'To verify identities and conduct background checks (Sitters)'}</li>
                <li>{isHebrew ? 'לעבד תשלומים באמצעות Nayax עם אסקרו 24 שעות' : 'To process payments via Nayax with 24-hour escrow'}</li>
                <li>{isHebrew ? 'לחשב ולאכוף עמלת תיווך של 7%' : 'To calculate and enforce 7% brokerage commission'}</li>
                <li>{isHebrew ? 'לשלוח התראות הזמנה, עדכוני סטטוס, הודעות בטיחות' : 'To send booking confirmations, status updates, safety notifications'}</li>
                <li>{isHebrew ? 'למנוע הונאה ואבטחה (מערכת תלונות שקטה)' : 'To prevent fraud and ensure safety (Silent complaint system)'}</li>
                <li>{isHebrew ? 'לשפר את הפלטפורמה שלנו (ניתוח, A/B testing)' : 'To improve our Platform (analytics, A/B testing)'}</li>
                <li>{isHebrew ? 'לעמוד בדרישות חוקיות (דיווח מס, תאימות)' : 'To comply with legal requirements (tax reporting, compliance)'}</li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '4. שיתוף מידע' : '4. Information Sharing'}
              </h2>
              <p className="leading-relaxed mb-4">
                {isHebrew ? 'אנו משתפים מידע בנסיבות הבאות:' : 'We share information in the following circumstances:'}
              </p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li><strong>{isHebrew ? 'עם הצד השני:' : 'With the Other Party:'}</strong> {isHebrew ? 'בעלים רואים פרופילי שמרטפים (שם, תמונה, ביוגרפיה, ביקורות). שמרטפים רואים פרטי חיות מחמד ומידע ליצירת קשר בעת אישור הזמנה.' : 'Owners see sitter profiles (name, photo, bio, reviews). Sitters see pet details and contact information upon booking confirmation.'}</li>
                <li><strong>{isHebrew ? 'ספקי שירות:' : 'Service Providers:'}</strong> {isHebrew ? 'Nayax (תשלומים), Firebase (אימות), SendGrid (דוא"ל), Meta WhatsApp Business (הודעות), Google Cloud (אחסון)' : 'Nayax (payments), Firebase (authentication), SendGrid (email), Meta WhatsApp Business (messaging), Google Cloud (storage)'}</li>
                <li><strong>{isHebrew ? 'רשויות חוקיות:' : 'Legal Authorities:'}</strong> {isHebrew ? 'כאשר נדרש על ידי חוק או לצורכי אכיפת חוק' : 'When required by law or for law enforcement purposes'}</li>
                <li><strong>{isHebrew ? 'בעלי רישיון פוטנציאליים:' : 'Potential Franchisees:'}</strong> {isHebrew ? 'נתוני שוק מצטברים (לא מזהים אישי)' : 'Aggregated market data (non-personally identifiable)'}</li>
              </ul>
              <p className="leading-relaxed mt-4 font-semibold">
                {isHebrew ? '🔒 אנו לא מוכרים את המידע האישי שלך לצדדים שלישיים.' : '🔒 We do NOT sell your personal information to third parties.'}
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '5. שמירת מידע' : '5. Data Retention'}
              </h2>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'פרופילי משתמש פעילים: כל עוד החשבון פעיל' : 'Active User Profiles: As long as the account is active'}</li>
                <li>{isHebrew ? 'היסטוריית הזמנות: 7 שנים (דרישות חוקיות ישראליות)' : 'Booking History: 7 years (Israeli legal requirements)'}</li>
                <li>{isHebrew ? 'רישומי תשלום: 7 שנים (דרישות מס)' : 'Payment Records: 7 years (tax requirements)'}</li>
                <li>{isHebrew ? 'תלונות ותקריות בטיחות: 10 שנים' : 'Complaints & Safety Incidents: 10 years'}</li>
                <li>{isHebrew ? 'בדיקות רקע: 5 שנים לאחר סיום פעילות שמרטף' : 'Background Checks: 5 years after sitter deactivation'}</li>
                <li>{isHebrew ? 'חשבונות שנמחקו: 30 יום תקופת מחיקה רכה (שחזור אפשרי)' : 'Deleted Accounts: 30-day soft delete period (recovery possible)'}</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '6. הזכויות שלך' : '6. Your Rights'}
              </h2>
              <p className="leading-relaxed mb-4">
                {isHebrew ? 'תחת GDPR וחוקי פרטיות ישראליים, יש לך:' : 'Under GDPR and Israeli privacy laws, you have the right to:'}
              </p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li><strong>{isHebrew ? 'גישה:' : 'Access:'}</strong> {isHebrew ? 'בקש עותק של המידע האישי שלך' : 'Request a copy of your personal data'}</li>
                <li><strong>{isHebrew ? 'תיקון:' : 'Rectification:'}</strong> {isHebrew ? 'תקן מידע לא מדויק או לא שלם' : 'Correct inaccurate or incomplete information'}</li>
                <li><strong>{isHebrew ? 'מחיקה:' : 'Erasure:'}</strong> {isHebrew ? 'בקש מחיקת החשבון שלך ("זכות להישכח")' : 'Request deletion of your account ("Right to be Forgotten")'}</li>
                <li><strong>{isHebrew ? 'ניידות:' : 'Portability:'}</strong> {isHebrew ? 'קבל את הנתונים שלך בפורמט מובנה' : 'Receive your data in a structured format'}</li>
                <li><strong>{isHebrew ? 'התנגדות:' : 'Object:'}</strong> {isHebrew ? 'התנגד לעיבוד מידע למטרות שיווק' : 'Object to processing for marketing purposes'}</li>
                <li><strong>{isHebrew ? 'משיכת הסכמה:' : 'Withdraw Consent:'}</strong> {isHebrew ? 'משוך הסכמה בכל עת (עשוי להגביל שירותים)' : 'Withdraw consent at any time (may limit services)'}</li>
              </ul>
              <p className="leading-relaxed mt-4">
                {isHebrew ? (
                  <>ליצירת קשר עם נציב הגנת המידע שלנו (DPO): <a href="mailto:privacy@petwash.co.il" className="text-blue-600 hover:underline">privacy@petwash.co.il</a></>
                ) : (
                  <>To exercise these rights, contact our Data Protection Officer (DPO): <a href="mailto:privacy@petwash.co.il" className="text-blue-600 hover:underline">privacy@petwash.co.il</a></>
                )}
              </p>
            </section>

            {/* Security */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '7. אבטחת מידע' : '7. Data Security'}
              </h2>
              <p className="leading-relaxed mb-4">
                {isHebrew ? 'אנו משתמשים באמצעי אבטחה ברמת בנקאות:' : 'We employ banking-level security measures:'}
              </p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'הצפנת TLS 1.3 לכל העברת נתונים' : 'TLS 1.3 encryption for all data transmission'}</li>
                <li>{isHebrew ? 'אימות WebAuthn/Passkey (ביומטרי)' : 'WebAuthn/Passkey authentication (biometric)'}</li>
                <li>{isHebrew ? 'Firebase App Check (זיהוי בוטים)' : 'Firebase App Check (bot detection)'}</li>
                <li>{isHebrew ? 'גיבויים אוטומטיים יומיים ל-Google Cloud Storage' : 'Daily automated backups to Google Cloud Storage'}</li>
                <li>{isHebrew ? 'שרת Blockchain-style audit trail למניעת הונאה' : 'Blockchain-style audit trail for fraud prevention'}</li>
                <li>{isHebrew ? 'ניטור AI למעקב אחר תקריות אבטחה' : 'AI-powered monitoring for security incidents'}</li>
                <li>{isHebrew ? 'בדיקות חדירה רבעוניות' : 'Quarterly penetration testing'}</li>
              </ul>
            </section>

            {/* Children's Privacy */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '8. פרטיות ילדים' : '8. Children\'s Privacy'}
              </h2>
              <p className="leading-relaxed">
                {isHebrew ? (
                  <>הפלטפורמה שלנו אינה מיועדת לאנשים מתחת לגיל 18. שמרטפים חייבים להיות בני 18+ (מאומת באמצעות תאריך לידה). אנו לא אוספים במודע מידע מילדים מתחת לגיל 13.</>
                ) : (
                  <>Our Platform is not intended for individuals under 18. Sitters must be 18+ (verified via date of birth). We do not knowingly collect information from children under 13.</>
                )}
              </p>
            </section>

            {/* International Transfers */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '9. העברות בינלאומיות' : '9. International Data Transfers'}
              </h2>
              <p className="leading-relaxed">
                {isHebrew ? (
                  <>הנתונים שלך מאוחסנים בשרתים מאובטחים באיזור אירופה (Google Cloud - בלגיה). העברות למדינות מחוץ לאיחוד האירופי מתבצעות עם הגנות מתאימות (סעיפי חוזה סטנדרטיים של האיחוד האירופי).</>
                ) : (
                  <>Your data is stored on secure servers in the European region (Google Cloud - Belgium). Transfers to countries outside the EU are made with appropriate safeguards (EU Standard Contractual Clauses).</>
                )}
              </p>
            </section>

            {/* Changes to Policy */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '10. שינויים למדיניות זו' : '10. Changes to This Policy'}
              </h2>
              <p className="leading-relaxed">
                {isHebrew ? (
                  <>אנו עשויים לעדכן מדיניות זו מעת לעת. נודיע לך על שינויים מהותיים באמצעות דוא"ל או התראה בפלטפורמה לפחות 30 יום לפני שהשינויים ייכנסו לתוקף.</>
                ) : (
                  <>We may update this policy from time to time. We will notify you of material changes via email or in-platform notification at least 30 days before changes take effect.</>
                )}
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '11. יצירת קשר' : '11. Contact Us'}
              </h2>
              <div className="bg-blue-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="font-semibold mb-2">Pet Wash Ltd</p>
                <p>{isHebrew ? 'נציג הגנת מידע (DPO)' : 'Data Protection Officer (DPO)'}</p>
                <p className="mt-2">
                  {isHebrew ? 'דוא"ל:' : 'Email:'} <a href="mailto:privacy@petwash.co.il" className="text-blue-600 hover:underline">privacy@petwash.co.il</a>
                </p>
                <p>
                  {isHebrew ? 'אתר:' : 'Website:'} <a href="https://www.petwash.co.il" className="text-blue-600 hover:underline">www.petwash.co.il</a>
                </p>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  {isHebrew ? (
                    <>יש לך גם את הזכות להגיש תלונה לרשות הגנת המידע הישראלית אם אתה מאמין שהפרנו את פרטיותך.</>
                  ) : (
                    <>You also have the right to lodge a complaint with the Israeli Privacy Protection Authority if you believe we have violated your privacy.</>
                  )}
                </p>
              </div>
            </section>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 text-center">
              <p>© 2025 Pet Wash Ltd. {isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
              <p className="mt-2">
                {isHebrew ? 'מדיניות זו מותאמת מפרקטיקות מובילות בתעשייה (Airbnb, Booking.com) לשוק טיפול בחיות מחמד.' : 'This policy is adapted from industry-leading practices (Airbnb, Booking.com) for the pet care marketplace.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
