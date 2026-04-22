import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft, Shield, Lock, FileText } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className={`min-h-screen luxury-bg-mesh ${(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}`}>
      <div className="luxury-container luxury-section">
        <Link href="/sitter-suite">
          <Button variant="ghost" className="mb-8 flex items-center gap-2 luxury-btn-ghost luxury-animate-fade-in">
            <ArrowLeft className="h-4 w-4" />
            {isHebrew ? 'חזרה ל-⁦The Sitter Suite™⁩' : 'Back to ⁦The Sitter Suite™⁩'}
          </Button>
        </Link>

        <div className="luxury-section-compact">
          <div className="text-center luxury-animate-fade-in mb-8">
            <h1 className="luxury-heading-xl mb-4">
              {isHebrew ? 'מדיניות פרטיות' : 'Privacy Policy'}
            </h1>
            <div className="luxury-badge luxury-badge-gold inline-flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {isHebrew ? 'עודכן לאחרונה: 29 באוקטובר 2025' : 'Last Updated: October 29, 2025'}
            </div>
          </div>

          <div className="luxury-gap-lg flex flex-col">
            {/* Introduction */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '1. מבוא' : '1. Introduction'}
                </h2>
              </div>
              <p className="luxury-text-body mb-4">
                {isHebrew ? (
                  <>Pet Wash Ltd ("אנחנו", "שלנו", או "Pet Wash") מפעילה פלטפורמת מרקטפלייס מקוונת המחברת בין בעלי חיות מחמד לשמרטפי חיות מחמד מקצועיים באמצעות "⁦The Sitter Suite™⁩" ("הפלטפורמה"). אנו מתחייבים להגן על פרטיות המשתמשים שלנו ולעמוד בחוקי הגנת המידע של ישראל, GDPR, ותקני פרטיות בינלאומיים.</>
                ) : (
                  <>Pet Wash Ltd ("we", "our", or "Pet Wash") operates an online marketplace platform connecting pet owners with professional pet sitters through ⁦The Sitter Suite™⁩ ("the Platform"). We are committed to protecting the privacy of our users and complying with Israeli privacy laws, GDPR, and international privacy standards.</>
                )}
              </p>
              <p className="luxury-text-body">
                {isHebrew ? (
                  <>Pet Wash פועלת כפלטפורמת מקשרת בלבד (כמו cars.com.au או Airbnb) - אנחנו מאפשרים חיבור בין שני צדדים עצמאיים ולוקחים עמלת תיווך קטנה. אנו לא מעסיקים שמרטפים ולא מספקים את השירותים ישירות.</>
                ) : (
                  <>Pet Wash operates as a connector platform only (like cars.com.au or Airbnb) - we facilitate connections between two independent parties and take a small brokerage commission. We do not employ sitters nor provide services directly.</>
                )}
              </p>
            </div>

            {/* Information We Collect */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '2. מידע שאנו אוספים' : '2. Information We Collect'}
                </h2>
              </div>
              
              <h3 className="luxury-heading-sm mb-3">
                {isHebrew ? '2.1 מידע שאתה מספק' : '2.1 Information You Provide'}
              </h3>
              <ul className={`space-y-3 ${isHebrew ? 'mr-6' : 'ml-6'}`}>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'פרטים אישיים: שם מלא, תאריך לידה, דוא"ל, טלפון' : 'Personal Details: Full name, date of birth, email, phone'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'כתובת מגורים: רחוב, דירה, עיר, מדינה, מיקוד, מדינה' : 'Home Address: Street, apartment, city, state/province, postal code, country'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'מידע פיננסי: פרטי תשלום מעובדים באמצעות Nayax (אנו לא שומרים פרטי כרטיסי אשראי)' : 'Financial Information: Payment details processed through Nayax (we do not store credit card details)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'פרטי חיית מחמד: שם, גזע, גיל, משקל, תמונות, אלרגיות, צרכים מיוחדים' : 'Pet Information: Name, breed, age, weight, photos, allergies, special needs'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'מסמכי אימות (שמרטפים): תעודת זהות, אישורי רקע, תעודות ביטוח' : 'Verification Documents (Sitters): ID documents, background checks, insurance certificates'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'מידע בריאותי: אלרגיות אישיות, סטטוס עישון (שמרטפים)' : 'Health Information: Personal allergies, smoking status (Sitters)'}</span>
                </li>
              </ul>

              <h3 className="luxury-heading-sm mb-3 mt-6">
                {isHebrew ? '2.2 מידע שנאסף אוטומטית' : '2.2 Automatically Collected Information'}
              </h3>
              <ul className={`space-y-3 ${isHebrew ? 'mr-6' : 'ml-6'}`}>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'מיקום גיאוגרפי: נתוני GPS למצוא שמרטפים קרובים' : 'Geolocation Data: GPS data to find nearby sitters'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'מידע התקן: כתובת IP, סוג דפדפן, מערכת הפעלה' : 'Device Information: IP address, browser type, operating system'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'Cookies ו-טכנולוגיות דומות' : 'Cookies and similar technologies'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'נתוני שימוש: דפים שביקרת, זמן שהותך באתר' : 'Usage Data: Pages visited, time spent on site'}</span>
                </li>
              </ul>
            </div>

            {/* How We Use Information */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '3. כיצד אנו משתמשים במידע' : '3. How We Use Your Information'}
                </h2>
              </div>
              <ul className={`space-y-3 ${isHebrew ? 'mr-6' : 'ml-6'}`}>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'לאפשר הזמנות ותשלומים בין בעלים לשמרטפים' : 'To facilitate bookings and payments between owners and sitters'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'לאמת זהויות וערוך בדיקות רקע (שמרטפים)' : 'To verify identities and conduct background checks (Sitters)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'לעבד תשלומים באמצעות Nayax עם אסקרו 24 שעות' : 'To process payments via Nayax with 24-hour escrow'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'לחשב ולאכוף עמלת תיווך של 7%' : 'To calculate and enforce 7% brokerage commission'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'לשלוח התראות הזמנה, עדכוני סטטוס, הודעות בטיחות' : 'To send booking confirmations, status updates, safety notifications'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'למנוע הונאה ואבטחה (מערכת תלונות שקטה)' : 'To prevent fraud and ensure safety (Silent complaint system)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'לשפר את הפלטפורמה שלנו (ניתוח, A/B testing)' : 'To improve our Platform (analytics, A/B testing)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'לעמוד בדרישות חוקיות (דיווח מס, תאימות)' : 'To comply with legal requirements (tax reporting, compliance)'}</span>
                </li>
              </ul>
            </div>

            {/* Data Sharing */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '4. שיתוף מידע' : '4. Information Sharing'}
                </h2>
              </div>
              <p className="luxury-text-body mb-4">
                {isHebrew ? 'אנו משתפים מידע בנסיבות הבאות:' : 'We share information in the following circumstances:'}
              </p>
              <ul className={`space-y-3 ${isHebrew ? 'mr-6' : 'ml-6'}`}>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'עם הצד השני:' : 'With the Other Party:'}</strong> {isHebrew ? 'בעלים רואים פרופילי שמרטפים (שם, תמונה, ביוגרפיה, ביקורות). שמרטפים רואים פרטי חיות מחמד ומידע ליצירת קשר בעת אישור הזמנה.' : 'Owners see sitter profiles (name, photo, bio, reviews). Sitters see pet details and contact information upon booking confirmation.'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'ספקי שירות:' : 'Service Providers:'}</strong> {isHebrew ? 'Nayax (תשלומים), Firebase (אימות), SendGrid (דוא"ל), Meta WhatsApp Business (הודעות), Google Cloud (אחסון)' : 'Nayax (payments), Firebase (authentication), SendGrid (email), Meta WhatsApp Business (messaging), Google Cloud (storage)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'רשויות חוקיות:' : 'Legal Authorities:'}</strong> {isHebrew ? 'כאשר נדרש על ידי חוק או לצורכי אכיפת חוק' : 'When required by law or for law enforcement purposes'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'בעלי רישיון פוטנציאליים:' : 'Potential Franchisees:'}</strong> {isHebrew ? 'נתוני שוק מצטברים (לא מזהים אישי)' : 'Aggregated market data (non-personally identifiable)'}</span>
                </li>
              </ul>
              <div className="mt-6 p-4 luxury-glass-panel border-l-4 border-purple-500">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-purple-600" />
                  <p className="luxury-text-body font-semibold">
                    {isHebrew ? 'אנו לא מוכרים את המידע האישי שלך לצדדים שלישיים.' : 'We do NOT sell your personal information to third parties.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Data Retention */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '5. שמירת מידע' : '5. Data Retention'}
                </h2>
              </div>
              <ul className={`space-y-3 ${isHebrew ? 'mr-6' : 'ml-6'}`}>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'פרופילי משתמש פעילים: כל עוד החשבון פעיל' : 'Active User Profiles: As long as the account is active'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'היסטוריית הזמנות: 7 שנים (דרישות חוקיות ישראליות)' : 'Booking History: 7 years (Israeli legal requirements)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'רישומי תשלום: 7 שנים (דרישות מס)' : 'Payment Records: 7 years (tax requirements)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'תלונות ותקריות בטיחות: 10 שנים' : 'Complaints & Safety Incidents: 10 years'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'בדיקות רקע: 5 שנים לאחר סיום פעילות שמרטף' : 'Background Checks: 5 years after sitter deactivation'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'חשבונות שנמחקו: 30 יום תקופת מחיקה רכה (שחזור אפשרי)' : 'Deleted Accounts: 30-day soft delete period (recovery possible)'}</span>
                </li>
              </ul>
            </div>

            {/* Your Rights */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '6. הזכויות שלך' : '6. Your Rights'}
                </h2>
              </div>
              <p className="luxury-text-body mb-4">
                {isHebrew ? 'תחת GDPR וחוקי פרטיות ישראליים, יש לך:' : 'Under GDPR and Israeli privacy laws, you have the right to:'}
              </p>
              <ul className={`space-y-3 ${isHebrew ? 'mr-6' : 'ml-6'}`}>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'גישה:' : 'Access:'}</strong> {isHebrew ? 'בקש עותק של המידע האישי שלך' : 'Request a copy of your personal data'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'תיקון:' : 'Rectification:'}</strong> {isHebrew ? 'תקן מידע לא מדויק או לא שלם' : 'Correct inaccurate or incomplete information'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'מחיקה:' : 'Erasure:'}</strong> {isHebrew ? 'בקש מחיקת החשבון שלך ("זכות להישכח")' : 'Request deletion of your account ("Right to be Forgotten")'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'ניידות:' : 'Portability:'}</strong> {isHebrew ? 'קבל את הנתונים שלך בפורמט מובנה' : 'Receive your data in a structured format'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'התנגדות:' : 'Object:'}</strong> {isHebrew ? 'התנגד לעיבוד מידע למטרות שיווק' : 'Object to processing for marketing purposes'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span><strong>{isHebrew ? 'משיכת הסכמה:' : 'Withdraw Consent:'}</strong> {isHebrew ? 'משוך הסכמה בכל עת (עשוי להגביל שירותים)' : 'Withdraw consent at any time (may limit services)'}</span>
                </li>
              </ul>
              <p className="luxury-text-body mt-4">
                {isHebrew ? (
                  <>ליצירת קשר עם נציב הגנת המידע שלנו (DPO): <a href="mailto:privacy@petwash.co.il" className="luxury-text-gradient hover:underline font-semibold">privacy@petwash.co.il</a></>
                ) : (
                  <>To exercise these rights, contact our Data Protection Officer (DPO): <a href="mailto:privacy@petwash.co.il" className="luxury-text-gradient hover:underline font-semibold">privacy@petwash.co.il</a></>
                )}
              </p>
            </div>

            {/* Security */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '7. אבטחת מידע' : '7. Data Security'}
                </h2>
              </div>
              <p className="luxury-text-body mb-4">
                {isHebrew ? 'אנו משתמשים באמצעי אבטחה ברמת בנקאות:' : 'We employ banking-level security measures:'}
              </p>
              <ul className={`space-y-3 ${isHebrew ? 'mr-6' : 'ml-6'}`}>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'הצפנת TLS 1.3 לכל העברת נתונים' : 'TLS 1.3 encryption for all data transmission'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'אימות WebAuthn/Passkey (ביומטרי)' : 'WebAuthn/Passkey authentication (biometric)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'Firebase App Check (זיהוי בוטים)' : 'Firebase App Check (bot detection)'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'גיבויים אוטומטיים יומיים ל-Google Cloud Storage' : 'Daily automated backups to Google Cloud Storage'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'שרת Blockchain-style audit trail למניעת הונאה' : 'Blockchain-style audit trail for fraud prevention'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'ניטור AI למעקב אחר תקריות אבטחה' : 'AI-powered monitoring for security incidents'}</span>
                </li>
                <li className="luxury-text-body flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{isHebrew ? 'בדיקות חדירה רבעוניות' : 'Quarterly penetration testing'}</span>
                </li>
              </ul>
            </div>

            {/* Children's Privacy */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '8. פרטיות ילדים' : '8. Children\'s Privacy'}
                </h2>
              </div>
              <p className="luxury-text-body">
                {isHebrew ? (
                  <>הפלטפורמה שלנו אינה מיועדת לאנשים מתחת לגיל 18. שמרטפים חייבים להיות בני 18+ (מאומת באמצעות תאריך לידה). אנו לא אוספים במודע מידע מילדים מתחת לגיל 13.</>
                ) : (
                  <>Our Platform is not intended for individuals under 18. Sitters must be 18+ (verified via date of birth). We do not knowingly collect information from children under 13.</>
                )}
              </p>
            </div>

            {/* International Transfers */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '9. העברות בינלאומיות' : '9. International Data Transfers'}
                </h2>
              </div>
              <p className="luxury-text-body">
                {isHebrew ? (
                  <>הנתונים שלך מאוחסנים בשרתים מאובטחים באיזור אירופה (Google Cloud - בלגיה). העברות למדינות מחוץ לאיחוד האירופי מתבצעות עם הגנות מתאימות (סעיפי חוזה סטנדרטיים של האיחוד האירופי).</>
                ) : (
                  <>Your data is stored on secure servers in the European region (Google Cloud - Belgium). Transfers to countries outside the EU are made with appropriate safeguards (EU Standard Contractual Clauses).</>
                )}
              </p>
            </div>

            {/* Changes to Policy */}
            <div className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '10. שינויים למדיניות זו' : '10. Changes to This Policy'}
                </h2>
              </div>
              <p className="luxury-text-body">
                {isHebrew ? (
                  <>אנו עשויים לעדכן מדיניות זו מעת לעת. נודיע לך על שינויים מהותיים באמצעות דוא"ל או התראה בפלטפורמה לפחות 30 יום לפני שהשינויים ייכנסו לתוקף.</>
                ) : (
                  <>We may update this policy from time to time. We will notify you of material changes via email or in-platform notification at least 30 days before changes take effect.</>
                )}
              </p>
            </div>

            {/* Contact */}
            <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-slide-up luxury-delay-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="luxury-heading-md">
                  {isHebrew ? '11. יצירת קשר' : '11. Contact Us'}
                </h2>
              </div>
              <div className="luxury-glass-panel p-6 space-y-3">
                <p className="luxury-text-body font-semibold">Pet Wash Ltd</p>
                <p className="luxury-text-body">
                  {isHebrew ? 'ממונה הגנת מידע (DPO) — מנהל/ת ציות ופרטיות' : 'Data Protection Officer (DPO) — Head of Compliance & Privacy'}
                </p>
                <p className="luxury-text-body luxury-text-small text-gray-500">
                  {isHebrew
                    ? 'בהתאם לתיקון 13 לחוק הגנת הפרטיות (אוגוסט 2025), מינינו ממונה הגנת מידע פנימי האחראי על ציות, ניהול פניות נושאי מידע, ודיווח לרשות הגנת הפרטיות.'
                    : 'Pursuant to Amendment 13 to the Israeli Privacy Protection Law (in force August 2025), Pet Wash has designated an internal Data Protection Officer responsible for compliance, data subject requests, and reporting to the Privacy Protection Authority (PPA).'}
                </p>
                <p className="luxury-text-body">
                  {isHebrew ? 'דוא"ל:' : 'Email:'} <a href="mailto:privacy@petwash.co.il" className="luxury-text-gradient hover:underline font-semibold">privacy@petwash.co.il</a>
                </p>
                <p className="luxury-text-body">
                  {isHebrew ? 'אתר:' : 'Website:'} <a href="https://www.petwash.co.il" className="luxury-text-gradient hover:underline font-semibold">www.petwash.co.il</a>
                </p>
                <div className="luxury-divider"></div>
                <p className="luxury-text-small">
                  {isHebrew ? (
                    <>יש לך גם את הזכות להגיש תלונה לרשות הגנת המידע הישראלית אם אתה מאמין שהפרנו את פרטיותך.</>
                  ) : (
                    <>You also have the right to lodge a complaint with the Israeli Privacy Protection Authority if you believe we have violated your privacy.</>
                  )}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="luxury-glass-panel p-6 text-center luxury-animate-fade-in mt-8">
              <p className="luxury-text-small">© 2026 Pet Wash Ltd. {isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
              <p className="luxury-text-small mt-2">
                {isHebrew ? 'מדיניות זו מותאמת מפרקטיקות מובילות בתעשייה (Airbnb, Booking.com) לשוק טיפול בחיות מחמד.' : 'This policy is adapted from industry-leading practices (Airbnb, Booking.com) for the pet care marketplace.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
