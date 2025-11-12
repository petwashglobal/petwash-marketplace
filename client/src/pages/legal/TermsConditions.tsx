import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function TermsConditions() {
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
            {isHebrew ? 'תנאים והגבלות' : 'Terms & Conditions'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
            {isHebrew ? 'עודכן לאחרונה: 29 באוקטובר 2025' : 'Last Updated: October 29, 2025'}
          </p>

          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* Agreement */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '1. הסכם' : '1. Agreement'}
              </h2>
              <p className="leading-relaxed">
                {isHebrew ? (
                  <>על ידי גישה או שימוש ב-The Sitter Suite™ המופעלת על ידי Pet Wash Ltd ("הפלטפורמה"), אתה מסכים להיות מחויב לתנאים אלה. אם אינך מסכים לכל התנאים, אל תשתמש בפלטפורמה.</>
                ) : (
                  <>By accessing or using The Sitter Suite™ operated by Pet Wash Ltd ("the Platform"), you agree to be bound by these Terms. If you do not agree to all Terms, do not use the Platform.</>
                )}
              </p>
            </section>

            {/* Platform Role */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '2. תפקיד הפלטפורמה - פלטפורמת מקשרת בלבד' : '2. Platform Role - Connector Platform Only'}
              </h2>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-r-4 border-yellow-500 p-6 rounded-lg">
                <p className="font-bold mb-2">{isHebrew ? '⚠️ חשוב: Pet Wash היא פלטפורמת מקשרת' : '⚠️ IMPORTANT: Pet Wash is a Connector Platform'}</p>
                <ul className="list-disc list-inside space-y-2 mr-6">
                  <li>{isHebrew ? 'אנו מקשרים בין בעלי חיות מחמד לשמרטפים עצמאיים (כמו cars.com.au או Airbnb)' : 'We connect pet owners with independent sitters (like cars.com.au or Airbnb)'}</li>
                  <li>{isHebrew ? 'אנו לא מעסיקים שמרטפים - הם קבלנים עצמאיים' : 'We do NOT employ sitters - they are independent contractors'}</li>
                  <li>{isHebrew ? 'אנו לא מספקים שירותי טיפול בחיות מחמד ישירות' : 'We do NOT provide pet care services directly'}</li>
                  <li>{isHebrew ? 'אנו לוקחים עמלת תיווך של 7% עבור חיבור מוצלח' : 'We take a 7% brokerage commission for successful connections'}</li>
                  <li>{isHebrew ? 'כל הזמנה דורשת הסכמה דו-צדדית (בעל + שמרטף)' : 'All bookings require two-sided consent (owner + sitter)'}</li>
                </ul>
              </div>
            </section>

            {/* Eligibility */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '3. זכאות' : '3. Eligibility'}
              </h2>
              <p className="leading-relaxed mb-4">{isHebrew ? 'כדי להשתמש בפלטפורמה, אתה חייב:' : 'To use the Platform, you must:'}</p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'להיות בן 18 ומעלה (שמרטפים מאומתים באמצעות תאריך לידה)' : 'Be 18 years or older (Sitters verified via date of birth)'}</li>
                <li>{isHebrew ? 'להיות חבר תוכנית נאמנות מאומת (בעלים)' : 'Be a verified loyalty program member (Owners)'}</li>
                <li>{isHebrew ? 'לספק מידע מדויק ושלם במהלך הרישום' : 'Provide accurate and complete information during registration'}</li>
                <li>{isHebrew ? 'לעמוד בבדיקות אימות (שמרטפים: תעודת זהות, בדיקת רקע, הכשרה)' : 'Pass verification checks (Sitters: ID, background check, training)'}</li>
              </ul>
            </section>

            {/* Account Responsibilities */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '4. אחריות חשבון' : '4. Account Responsibilities'}
              </h2>
              <p className="leading-relaxed mb-4">{isHebrew ? 'אתה אחראי ל:' : 'You are responsible for:'}</p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'שמירה על פרטי החשבון שלך בביטחון' : 'Maintaining the security of your account credentials'}</li>
                <li>{isHebrew ? 'כל הפעילויות שמתרחשות תחת החשבון שלך' : 'All activities that occur under your account'}</li>
                <li>{isHebrew ? 'עדכון המידע שלך (כתובת, טלפון, מדיניות בית)' : 'Updating your information (address, phone, house policies)'}</li>
                <li>{isHebrew ? 'הודעה מיידית על כל שימוש לא מורשה' : 'Immediately notifying us of any unauthorized use'}</li>
              </ul>
            </section>

            {/* Booking Process */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '5. תהליך הזמנה' : '5. Booking Process'}
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
                {isHebrew ? '5.1 הזמנת שירות' : '5.1 Booking a Service'}
              </h3>
              <ol className="list-decimal list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'בעל בוחר שמרטף לפי מיקום, מחיר, ביקורות' : 'Owner selects a sitter based on location, price, reviews'}</li>
                <li>{isHebrew ? 'בעל שולח בקשת הזמנה עם פרטי חיית מחמד ותאריכים' : 'Owner submits booking request with pet details and dates'}</li>
                <li>{isHebrew ? 'שמרטף סוקר הבקשה ומחליט לאשר/לדחות' : 'Sitter reviews request and decides to accept/reject'}</li>
                <li>{isHebrew ? 'שני הצדדים חייבים לתת הסכמה (בעל מסכים לתנאים, שמרטף מסכים לכללי בית)' : 'Both parties must consent (Owner agrees to terms, Sitter accepts house rules)'}</li>
                <li>{isHebrew ? 'תשלום מעובד דרך Nayax עם אסקרו 24 שעות' : 'Payment processed via Nayax with 24-hour escrow'}</li>
                <li>{isHebrew ? 'הזמנה מאושרת רק לאחר שני הצדדים חתמו דיגיטלית' : 'Booking confirmed only after both parties digitally sign'}</li>
              </ol>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-gray-800 dark:text-gray-200">
                {isHebrew ? '5.2 הארכת הזמנה' : '5.2 Booking Extensions'}
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'כל אחד מהצדדים יכול לבקש הארכת תקופת הטיפול' : 'Either party can request to extend the sitting period'}</li>
                <li>{isHebrew ? 'חישוב אוטומטי מחדש: ימים נוספים × תעריף יומי + עמלת תיווך של 7%' : 'Automatic recalculation: Additional days × daily rate + 7% broker commission'}</li>
                <li>{isHebrew ? 'הצד השני חייב לאשר את ההארכה' : 'The other party must approve the extension'}</li>
                <li>{isHebrew ? 'תשלום נוסף נגבה דרך Nayax' : 'Additional payment charged via Nayax'}</li>
              </ul>
            </section>

            {/* Payments & Fees */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '6. תשלומים ועמלות' : '6. Payments & Fees'}
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
                {isHebrew ? '6.1 מבנה מחירים' : '6.1 Pricing Structure'}
              </h3>
              <div className="bg-blue-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="font-semibold mb-2">{isHebrew ? 'סיכום עמלות:' : 'Fee Breakdown:'}</p>
                <ul className="space-y-1">
                  <li>{isHebrew ? '• מחיר בסיס: תעריף השמרטף × ימים' : '• Base Price: Sitter\'s rate × days'}</li>
                  <li>{isHebrew ? '• עמלת שירות פלטפורמה: 10% (נראית לבעל)' : '• Platform Service Fee: 10% (visible to owner)'}</li>
                  <li className="font-bold">{isHebrew ? '• עמלת תיווך: 7% (מנוכה מתשלום השמרטף)' : '• Broker Commission: 7% (deducted from sitter payout)'}</li>
                  <li>{isHebrew ? '• תשלום שמרטף: 93% מהמחיר הבסיס' : '• Sitter Payout: 93% of base price'}</li>
                </ul>
              </div>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-gray-800 dark:text-gray-200">
                {isHebrew ? '6.2 תהליך תשלום' : '6.2 Payment Process'}
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'כל התשלומים מעובדים דרך Nayax בלבד' : 'All payments processed exclusively through Nayax'}</li>
                <li>{isHebrew ? 'כספים מוחזקים באסקרו למשך 24 שעות לאחר השלמת השירות' : 'Funds held in escrow for 24 hours after service completion'}</li>
                <li>{isHebrew ? 'שמרטפים מקבלים תשלום 24 שעות לאחר סיום הזמנה (אם אין תלונות)' : 'Sitters receive payout 24 hours after booking ends (if no complaints)'}</li>
                <li>{isHebrew ? 'החזרים מעובדים תוך 5-7 ימי עסקים' : 'Refunds processed within 5-7 business days'}</li>
              </ul>
            </section>

            {/* Cancellation Policy */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '7. מדיניות ביטול' : '7. Cancellation Policy'}
              </h2>
              <p className="leading-relaxed mb-4">{isHebrew ? 'מדיניות ביטול משתנה לפי בחירת השמרטף:' : 'Cancellation policy varies by sitter\'s choice:'}</p>
              
              <div className="space-y-4">
                <div className="border-r-4 border-green-500 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="font-bold mb-2">{isHebrew ? '✅ גמיש:' : '✅ Flexible:'}</p>
                  <p>{isHebrew ? 'החזר מלא עד 24 שעות לפני תחילת השירות' : 'Full refund up to 24 hours before service start'}</p>
                </div>
                <div className="border-r-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <p className="font-bold mb-2">{isHebrew ? '⚠️ מתון:' : '⚠️ Moderate:'}</p>
                  <p>{isHebrew ? 'החזר מלא עד 5 ימים לפני, 50% החזר עד 48 שעות לפני' : 'Full refund up to 5 days before, 50% refund up to 48 hours before'}</p>
                </div>
                <div className="border-r-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-bold mb-2">{isHebrew ? '🚫 קפדני:' : '🚫 Strict:'}</p>
                  <p>{isHebrew ? 'החזר מלא עד 7 ימים לפני, 50% החזר עד 14 ימים לפני, אין החזר לאחר מכן' : 'Full refund up to 7 days before, 50% refund up to 14 days before, no refund after'}</p>
                </div>
              </div>
            </section>

            {/* Sitter Vetting */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '8. תהליך אימות שמרטפים' : '8. Sitter Vetting Process'}
              </h2>
              <p className="leading-relaxed mb-4">{isHebrew ? 'כל השמרטפים עוברים תהליך אימות מחמיר:' : 'All sitters undergo a strict vetting process:'}</p>
              <ol className="list-decimal list-inside space-y-2 mr-6">
                <li><strong>{isHebrew ? 'אימות תעודת זהות:' : 'ID Verification:'}</strong> {isHebrew ? 'העלאת מסמך זהות תקף' : 'Upload valid government ID'}</li>
                <li><strong>{isHebrew ? 'בדיקת רקע:' : 'Background Check:'}</strong> {isHebrew ? 'בדיקת רישום פלילי (ספציפית למדינה)' : 'Criminal record check (country-specific)'}</li>
                <li><strong>{isHebrew ? 'הכשרה:' : 'Training:'}</strong> {isHebrew ? 'השלמת מודולי בטיחות וטיפול בחיות מחמד' : 'Complete pet care and safety training modules'}</li>
                <li><strong>{isHebrew ? 'ביטוח:' : 'Insurance:'}</strong> {isHebrew ? 'תעודת ביטוח תקפה (מומלץ)' : 'Valid insurance certificate (recommended)'}</li>
                <li><strong>{isHebrew ? 'אקטיבציה:' : 'Activation:'}</strong> {isHebrew ? 'אושרו על ידי Pet Wash לפני רשימה ציבורית' : 'Approved by Pet Wash before public listing'}</li>
              </ol>
            </section>

            {/* Safety & Complaints */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '9. בטיחות ומערכת תלונות' : '9. Safety & Complaint System'}
              </h2>
              <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
                {isHebrew ? '9.1 התראות בטיחות גבוהות' : '9.1 High Alert Safety Banners'}
              </h3>
              <p className="leading-relaxed mb-4">
                {isHebrew ? (
                  <>כאשר חיות מחמד יש להן אלרגיות חמורות או צרכים מיוחדים, המערכת מציגה באנרים אדומים של התראת בטיחות כדי להבטיח שהשמרטפים מודעים לסיכונים.</>
                ) : (
                  <>When pets have severe allergies or special needs, the system displays RED HIGH ALERT SAFETY BANNERS to ensure sitters are aware of risks.</>
                )}
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6 text-gray-800 dark:text-gray-200">
                {isHebrew ? '9.2 מערכת תלונות שקטה' : '9.2 Silent Complaint System'}
              </h3>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'דווח על חששות בטיחות, הטרדה, הונאה, רשלנות ישירות ל-Pet Wash' : 'Report safety concerns, harassment, fraud, negligence directly to Pet Wash'}</li>
                <li>{isHebrew ? 'העלה ראיות (תמונות, סרטונים, צילומי מסך)' : 'Upload evidence (photos, videos, screenshots)'}</li>
                <li>{isHebrew ? 'התלונות נשארות שקטות - הצד המדווח לא רואה את התלונה' : 'Complaints remain silent - reported party doesn\'t see the complaint'}</li>
                <li>{isHebrew ? 'צוות Pet Wash חוקר ונוקט פעולה (אזהרה, השעיה, חסימה)' : 'Pet Wash team investigates and takes action (warning, suspension, ban)'}</li>
              </ul>
            </section>

            {/* Prohibited Activities */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '10. פעילויות אסורות' : '10. Prohibited Activities'}
              </h2>
              <p className="leading-relaxed mb-4">{isHebrew ? 'המשתמשים אסורים מ:' : 'Users are prohibited from:'}</p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'עקיפת דמי הפלטפורמה בתשלום ישיר' : 'Bypassing platform fees with direct payments'}</li>
                <li>{isHebrew ? 'שיתוף פרטי ליצירת קשר לפני אישור הזמנה' : 'Sharing contact details before booking confirmation'}</li>
                <li>{isHebrew ? 'מתן מידע כוזב במהלך רישום או אימות' : 'Providing false information during registration or verification'}</li>
                <li>{isHebrew ? 'התנהגות מטרידה, פוגענית או מפלה' : 'Harassing, abusive, or discriminatory behavior'}</li>
                <li>{isHebrew ? 'רשימת חיות מחמד עם מחלות מדבקות ידועות מבלי לגלות' : 'Listing pets with known contagious diseases without disclosure'}</li>
                <li>{isHebrew ? 'פעילות הונאתית או תלונות כוזבות' : 'Fraudulent activity or false complaints'}</li>
              </ul>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '11. הגבלת אחריות' : '11. Limitation of Liability'}
              </h2>
              <div className="bg-red-50 dark:bg-red-900/20 border-r-4 border-red-500 p-6 rounded-lg">
                <p className="font-bold mb-4">{isHebrew ? '⚠️ כלל חשוב:' : '⚠️ IMPORTANT NOTICE:'}</p>
                <p className="leading-relaxed mb-4">
                  {isHebrew ? (
                    <>Pet Wash Ltd היא פלטפורמת מקשרת בלבד ואינה צד לעסקה בין בעלים לשמרטפים. <strong>אנו לא אחראים ל:</strong></>
                  ) : (
                    <>Pet Wash Ltd is a connector platform only and is not a party to the transaction between owners and sitters. <strong>We are NOT liable for:</strong></>
                  )}
                </p>
                <ul className="list-disc list-inside space-y-2 mr-6">
                  <li>{isHebrew ? 'איכות או בטיחות של שירותי טיפול בחיות מחמד' : 'Quality or safety of pet care services'}</li>
                  <li>{isHebrew ? 'פציעות או מחלות של חיות מחמד במהלך הטיפול' : 'Injuries or illnesses to pets during care'}</li>
                  <li>{isHebrew ? 'נזק לרכוש של בעלים או שמרטפים' : 'Property damage to owners\' or sitters\' homes'}</li>
                  <li>{isHebrew ? 'מחלוקות בין בעלים לשמרטפים' : 'Disputes between owners and sitters'}</li>
                  <li>{isHebrew ? 'פעולות או רשלנות של שמרטפים עצמאיים' : 'Actions or negligence of independent sitters'}</li>
                </ul>
                <p className="leading-relaxed mt-4 font-semibold">
                  {isHebrew ? (
                    <>האחריות המקסימלית שלנו מוגבלת לסכום עמלת התיווך ששולמה עבור אותה הזמנה ספציפית.</>
                  ) : (
                    <>Our maximum liability is limited to the amount of broker commission paid for that specific booking.</>
                  )}
                </p>
              </div>
            </section>

            {/* Dispute Resolution */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '12. פתרון מחלוקות' : '12. Dispute Resolution'}
              </h2>
              <ol className="list-decimal list-inside space-y-2 mr-6">
                <li><strong>{isHebrew ? 'משא ומתן ישיר:' : 'Direct Negotiation:'}</strong> {isHebrew ? 'הצדדים צריכים תחילה לנסות לפתור מחלוקות ישירות' : 'Parties should first attempt to resolve disputes directly'}</li>
                <li><strong>{isHebrew ? 'תיווך Pet Wash:' : 'Pet Wash Mediation:'}</strong> {isHebrew ? 'אם התקשורת הישירה נכשלת, Pet Wash יכולה לתווך' : 'If direct communication fails, Pet Wash can mediate'}</li>
                <li><strong>{isHebrew ? 'בוררות מחייבת:' : 'Binding Arbitration:'}</strong> {isHebrew ? 'מחלוקות בלתי פתירות יועברו לבוררות תחת החוק הישראלי' : 'Unresolved disputes will go to arbitration under Israeli law'}</li>
              </ol>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '13. סיום' : '13. Termination'}
              </h2>
              <p className="leading-relaxed mb-4">{isHebrew ? 'אנו שומרים את הזכות להשעות או לסיים חשבונות בגין:' : 'We reserve the right to suspend or terminate accounts for:'}</p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'הפרת תנאים אלה' : 'Violation of these Terms'}</li>
                <li>{isHebrew ? 'פעילות הונאתית או מטעה' : 'Fraudulent or deceptive activity'}</li>
                <li>{isHebrew ? 'תלונות בטיחות חוזרות' : 'Repeated safety complaints'}</li>
                <li>{isHebrew ? 'אי עמידה בדרישות אימות (שמרטפים)' : 'Failure to meet verification requirements (Sitters)'}</li>
                <li>{isHebrew ? 'ביקורות שליליות עקביות (<3 כוכבים)' : 'Consistently negative reviews (<3 stars)'}</li>
              </ul>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '14. חוק שופט' : '14. Governing Law'}
              </h2>
              <p className="leading-relaxed">
                {isHebrew ? (
                  <>תנאים אלה כפופים לחוקי מדינת ישראל. כל מחלוקת תיפתר בבתי המשפט של תל אביב, ישראל.</>
                ) : (
                  <>These Terms are governed by the laws of the State of Israel. Any disputes will be resolved in the courts of Tel Aviv, Israel.</>
                )}
              </p>
            </section>

            {/* Changes to Terms */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '15. שינויים לתנאים' : '15. Changes to Terms'}
              </h2>
              <p className="leading-relaxed">
                {isHebrew ? (
                  <>אנו עשויים לעדכן תנאים אלה מעת לעת. משתמשים יקבלו הודעה 30 יום לפני שינויים מהותיים. המשך שימוש לאחר שינויים מהווה קבלה.</>
                ) : (
                  <>We may update these Terms from time to time. Users will be notified 30 days before material changes. Continued use after changes constitutes acceptance.</>
                )}
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '16. יצירת קשר' : '16. Contact Us'}
              </h2>
              <div className="bg-blue-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="font-semibold mb-2">Pet Wash Ltd</p>
                <p className="mt-2">
                  {isHebrew ? 'דוא"ל תמיכה:' : 'Support Email:'} <a href="mailto:Support@PetWash.co.il" className="text-blue-600 hover:underline">Support@PetWash.co.il</a>
                </p>
                <p>
                  {isHebrew ? 'אתר:' : 'Website:'} <a href="https://www.petwash.co.il" className="text-blue-600 hover:underline">www.petwash.co.il</a>
                </p>
              </div>
            </section>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 text-center">
              <p>© 2025 Pet Wash Ltd. {isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
              <p className="mt-2">
                {isHebrew ? 'תנאים אלה מותאמים מפרקטיקות מובילות בתעשייה (Airbnb, Booking.com) למרקטפלייס טיפול בחיות מחמד.' : 'These Terms are adapted from industry-leading practices (Airbnb, Booking.com) for the pet care marketplace.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
