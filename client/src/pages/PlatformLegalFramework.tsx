import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft, Shield, AlertTriangle, FileText, Scale, Lock, Eye, Check } from "lucide-react";
import { Link } from "wouter";

export default function PlatformLegalFramework() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link href="/">
          <button className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400" data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4" />
            {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
          </button>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
              <Scale className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {isHebrew ? 'מסגרת משפטית של הפלטפורמה' : 'Platform Legal Framework'}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
              {isHebrew ? 'Pet Wash™ - פלטפורמת מקשרת בלבד (כמו Uber)' : 'Pet Wash™ - Connector Platform Only (Like Uber)'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {isHebrew ? 'עודכן לאחרונה: 29 באוקטובר 2025' : 'Last Updated: October 29, 2025'}
            </p>
          </div>

          {/* CRITICAL DISCLAIMER */}
          <div className="bg-red-50 dark:bg-red-900/20 border-4 border-red-500 rounded-xl p-8 mb-12">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-12 w-12 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-red-900 dark:text-red-200 mb-4">
                  {isHebrew ? '⚠️ הצהרה קריטית: אחריות אפסית' : '⚠️ CRITICAL DISCLAIMER: ZERO LIABILITY'}
                </h2>
                <div className="space-y-3 text-red-800 dark:text-red-300 font-medium">
                  <p className="text-lg leading-relaxed">
                    {isHebrew ? (
                      <>Pet Wash Ltd היא <strong>פלטפורמת טכנולוגיה בלבד</strong> המקשרת בין לקוחות לספקי שירותים עצמאיים. אנו פועלים בדיוק כמו Uber, Airbnb, או DoorDash.</>
                    ) : (
                      <>Pet Wash Ltd is a <strong>TECHNOLOGY PLATFORM ONLY</strong> that connects customers with independent service providers. We operate exactly like Uber, Airbnb, or DoorDash.</>
                    )}
                  </p>
                  <p className="text-lg leading-relaxed">
                    {isHebrew ? (
                      <><strong>אנו לא אחראים אף פעם</strong> על:</>
                    ) : (
                      <><strong>WE ARE NEVER LIABLE</strong> for:</>
                    )}
                  </p>
                  <ul className="space-y-2 text-base mr-6">
                    <li>✗ {isHebrew ? 'איכות שירותים שמסופקים על ידי קבלנים עצמאיים' : 'Quality of services provided by independent contractors'}</li>
                    <li>✗ {isHebrew ? 'פעולות או רשלנות של שמרטפים, מטיילים, או מפעילי תחנות' : 'Actions or negligence of sitters, walkers, or station operators'}</li>
                    <li>✗ {isHebrew ? 'נזק לחיות מחמד, רכוש, או אנשים במהלך שירות' : 'Damage to pets, property, or people during service'}</li>
                    <li>✗ {isHebrew ? 'סכסוכים בין ספקי שירותים ללקוחות' : 'Disputes between service providers and customers'}</li>
                    <li>✗ {isHebrew ? 'תוצאות רפואיות, התנהגותיות, או פיזיות' : 'Medical, behavioral, or physical outcomes'}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Services Overview */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              {isHebrew ? 'שירותי הפלטפורמה - מודל העסקי' : 'Platform Services - Business Model'}
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* K9000 Wash Stations */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="text-xl font-bold mb-3 text-blue-900 dark:text-blue-200">
                  {isHebrew ? 'תחנות רחצה K9000' : 'K9000 Wash Stations'}
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-4">
                  {isHebrew ? 'פלטפורמה מקשרת - תשלום ישיר למפעילי תחנות' : 'Connector Platform - Direct payment to station operators'}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'אנו מקשרים לקוחות לתחנות עצמאיות' : 'We connect customers to independent stations'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'עמלת פלטפורמה בלבד' : 'Platform commission only'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="font-semibold">{isHebrew ? 'אחריות אפסית על תוצאות רחצה' : 'Zero liability for wash outcomes'}</span>
                  </div>
                </div>
              </div>

              {/* Walk My Pet */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-700">
                <h3 className="text-xl font-bold mb-3 text-purple-900 dark:text-purple-200">
                  Walk My Pet™
                </h3>
                <p className="text-sm text-purple-800 dark:text-purple-300 mb-4">
                  {isHebrew ? 'פלטפורמת שוק - 24% עמלת תיווך גולמית' : 'Marketplace Platform - 24% gross take rate'}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'קבלנים עצמאיים בלבד' : 'Independent contractors only'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'בעל משלם 6%, מטייל משלם 18%' : 'Owner pays 6%, Walker pays 18%'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="font-semibold">{isHebrew ? 'אחריות אפסית על הליכה או נזק' : 'Zero liability for walk or damage'}</span>
                  </div>
                </div>
              </div>

              {/* The Sitter Suite */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-700">
                <h3 className="text-xl font-bold mb-3 text-green-900 dark:text-green-200">
                  The Sitter Suite™
                </h3>
                <p className="text-sm text-green-800 dark:text-green-300 mb-4">
                  {isHebrew ? 'שוק Airbnb - עמלת תיווך 7%' : 'Airbnb-style marketplace - 7% broker commission'}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'התאמה בין בעלים ושמרטפים' : 'Match owners with sitters'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{isHebrew ? 'מערכת תשלום מאובטחת עם אסקרו' : 'Secure payment with escrow'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="font-semibold">{isHebrew ? 'אחריות אפסית על טיפול בחיות מחמד' : 'Zero liability for pet care'}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Legal Protection Principles */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-3">
              <Lock className="h-8 w-8 text-purple-600" />
              {isHebrew ? 'עקרונות הגנה משפטית' : 'Legal Protection Principles'}
            </h2>
            
            <div className="space-y-6">
              {/* Independent Contractor Status */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                  {isHebrew ? '1. סטטוס קבלן עצמאי' : '1. Independent Contractor Status'}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  {isHebrew ? (
                    <>כל ספקי השירותים (שמרטפים, מטיילים, מפעילי תחנות) הם <strong>קבלנים עצמאיים</strong>, לא עובדים של Pet Wash Ltd. הם:</>
                  ) : (
                    <>All service providers (sitters, walkers, station operators) are <strong>independent contractors</strong>, NOT employees of Pet Wash Ltd. They:</>
                  )}
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 mr-6">
                  <li>✓ {isHebrew ? 'קובעים את המחירים שלהם' : 'Set their own prices'}</li>
                  <li>✓ {isHebrew ? 'בוחרים את לוח הזמנים שלהם' : 'Choose their own schedules'}</li>
                  <li>✓ {isHebrew ? 'מנהלים את העסקים שלהם' : 'Run their own businesses'}</li>
                  <li>✓ {isHebrew ? 'נושאים באחריות מלאה על שירותיהם' : 'Bear full responsibility for their services'}</li>
                  <li>✓ {isHebrew ? 'נדרשים לביטוח ורישיונות משלהם' : 'Required to have their own insurance & licenses'}</li>
                </ul>
              </div>

              {/* Platform Role */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                  {isHebrew ? '2. תפקיד הפלטפורמה - מקשרת טכנולוגית בלבד' : '2. Platform Role - Technology Connector Only'}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  {isHebrew ? 'Pet Wash מספקת רק:' : 'Pet Wash provides ONLY:'}
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 mr-6">
                  <li>✓ {isHebrew ? 'תשתית טכנולוגית (אתר, אפליקציה, מסד נתונים)' : 'Technology infrastructure (website, app, database)'}</li>
                  <li>✓ {isHebrew ? 'עיבוד תשלומים (דרך Nayax)' : 'Payment processing (via Nayax)'}</li>
                  <li>✓ {isHebrew ? 'אימות ובדיקת רקע ראשונית' : 'Initial verification & background checks'}</li>
                  <li>✓ {isHebrew ? 'מערכת דירוגים וביקורות' : 'Rating & review system'}</li>
                  <li>✓ {isHebrew ? 'תמיכת לקוחות (למערכת הפלטפורמה)' : 'Customer support (for platform system)'}</li>
                </ul>
                <p className="text-red-700 dark:text-red-400 font-bold mt-4">
                  {isHebrew ? '❌ אנו לא מספקים, מפקחים, או אחראים על השירותים עצמם' : '❌ We do NOT provide, supervise, or have responsibility for the services themselves'}
                </p>
              </div>

              {/* Customer Acknowledgment */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-3 text-yellow-900 dark:text-yellow-200">
                  {isHebrew ? '3. הכרת לקוח' : '3. Customer Acknowledgment'}
                </h3>
                <p className="text-yellow-800 dark:text-yellow-300 leading-relaxed font-medium">
                  {isHebrew ? (
                    <>על ידי שימוש ב-Pet Wash, אתה מכיר ומסכים בפירוש ש:</>
                  ) : (
                    <>By using Pet Wash, you expressly acknowledge and agree that:</>
                  )}
                </p>
                <ul className="space-y-2 text-yellow-800 dark:text-yellow-300 mt-4 mr-6">
                  <li>• {isHebrew ? 'אתה מתקשר ישירות עם קבלן עצמאי' : 'You are contracting directly with an independent contractor'}</li>
                  <li>• {isHebrew ? 'Pet Wash לא צד לחוזה שלך עם ספק השירות' : 'Pet Wash is NOT a party to your contract with the service provider'}</li>
                  <li>• {isHebrew ? 'אתה לוקח את כל הסיכונים הקשורים לשירות' : 'You assume all risks associated with the service'}</li>
                  <li>• {isHebrew ? 'יש לך ביטוח מתאים (חיות מחמד, אחריות, רכוש)' : 'You have appropriate insurance (pet, liability, property)'}</li>
                  <li>• {isHebrew ? 'Pet Wash לא תהיה אחראית לתוצאות כלשהן' : 'Pet Wash will NOT be held liable for any outcomes'}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Security & Identity Protection */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-3">
              <Eye className="h-8 w-8 text-green-600" />
              {isHebrew ? 'אבטחה והגנת זהות' : 'Security & Identity Protection'}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Biometric KYC */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-700">
                <h3 className="text-lg font-bold mb-3 text-green-900 dark:text-green-200">
                  {isHebrew ? 'אימות KYC ביומטרי (רמת בנקאות)' : 'Biometric KYC Verification (Banking-Level)'}
                </h3>
                <ul className="space-y-2 text-sm text-green-800 dark:text-green-300">
                  <li>• {isHebrew ? 'סלפי בזמן אמת + העלאת תעודת זהות ממשלתית' : 'Live selfie + government ID upload'}</li>
                  <li>• {isHebrew ? 'התאמת פנים בעזרת Google Vision AI' : 'Face matching using Google Vision AI'}</li>
                  <li>• {isHebrew ? 'ציון התאמה >85% נדרש' : 'Match score >85% required'}</li>
                  <li>• {isHebrew ? 'בדיקת רקע מסד נתונים' : 'Background database checks'}</li>
                </ul>
              </div>

              {/* Transaction Security */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="text-lg font-bold mb-3 text-blue-900 dark:text-blue-200">
                  {isHebrew ? 'אבטחת עסקאות' : 'Transaction Security'}
                </h3>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                  <li>• {isHebrew ? 'תשלומים דרך Nayax בלבד (PCI-DSS מוסמך)' : 'Nayax-only payments (PCI-DSS certified)'}</li>
                  <li>• {isHebrew ? 'אסקרו 24 שעות למניעת הונאה' : '24-hour escrow for fraud prevention'}</li>
                  <li>• {isHebrew ? 'שרשרת בלוקצ\'יין לתיעוד עמיד בשינויים' : 'Blockchain chain for tamper-proof records'}</li>
                  <li>• {isHebrew ? 'צפנת מקצה לקצה (SSL/TLS)' : 'End-to-end encryption (SSL/TLS)'}</li>
                </ul>
              </div>

              {/* Data Protection */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-700">
                <h3 className="text-lg font-bold mb-3 text-purple-900 dark:text-purple-200">
                  {isHebrew ? 'הגנת נתונים' : 'Data Protection'}
                </h3>
                <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-300">
                  <li>• {isHebrew ? 'תאימות GDPR (אירופה) + חוק הגנת הפרטיות הישראלי 2025' : 'GDPR compliant (Europe) + Israeli Privacy Law 2025'}</li>
                  <li>• {isHebrew ? 'שמירת יומנים למשך 7 שנים לציות' : '7-year log retention for compliance'}</li>
                  <li>• {isHebrew ? 'איתור אנומליות מונע על ידי AI' : 'AI-powered anomaly detection'}</li>
                  <li>• {isHebrew ? 'ניטור ביקורת אבטחה בזמן אמת' : 'Real-time security audit monitoring'}</li>
                </ul>
              </div>

              {/* Fraud Prevention */}
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border-2 border-red-200 dark:border-red-700">
                <h3 className="text-lg font-bold mb-3 text-red-900 dark:text-red-200">
                  {isHebrew ? 'מניעת הונאה' : 'Fraud Prevention'}
                </h3>
                <ul className="space-y-2 text-sm text-red-800 dark:text-red-300">
                  <li>• {isHebrew ? 'מניעת הוצאה כפולה (שרשרת בלוקצ\'יין)' : 'Double-spend prevention (blockchain chain)'}</li>
                  <li>• {isHebrew ? 'זיהוי מכשירים ומעקב IP' : 'Device fingerprinting & IP tracking'}</li>
                  <li>• {isHebrew ? 'הגבלת קצב ואתגרי reCAPTCHA' : 'Rate limiting & reCAPTCHA challenges'}</li>
                  <li>• {isHebrew ? 'מערכת תלונות שקטה לדיווח על תרמית' : 'Silent complaint system for fraud reporting'}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Clear Expectations */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              {isHebrew ? 'ציפיות ברורות - שני הצדדים' : 'Clear Expectations - Both Sides'}
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Customer Expectations */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="text-xl font-bold mb-4 text-blue-900 dark:text-blue-200">
                  {isHebrew ? '👤 ציפיות לקוחות' : '👤 Customer Expectations'}
                </h3>
                <div className="space-y-3 text-blue-800 dark:text-blue-300">
                  <div>
                    <p className="font-semibold mb-1">{isHebrew ? 'מה מקבלים:' : 'What You Get:'}</p>
                    <ul className="text-sm space-y-1 mr-6">
                      <li>✓ {isHebrew ? 'גישה לספקי שירותים מאומתים' : 'Access to verified service providers'}</li>
                      <li>✓ {isHebrew ? 'מערכת דירוגים שקופה' : 'Transparent rating system'}</li>
                      <li>✓ {isHebrew ? 'תשלום מאובטח עם אסקרו' : 'Secure payment with escrow'}</li>
                      <li>✓ {isHebrew ? 'תיקון סכסוכים בסיסי (למערכת הפלטפורמה)' : 'Basic dispute resolution (for platform system)'}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">{isHebrew ? 'מה לא מקבלים:' : 'What You DON\'T Get:'}</p>
                    <ul className="text-sm space-y-1 mr-6">
                      <li>✗ {isHebrew ? 'ערבות על איכות שירות' : 'Service quality guarantee'}</li>
                      <li>✗ {isHebrew ? 'אחריות על נזקים' : 'Liability for damages'}</li>
                      <li>✗ {isHebrew ? 'אחריות על תוצאות רפואיות' : 'Medical outcome responsibility'}</li>
                      <li>✗ {isHebrew ? 'השתתפות ישירה של Pet Wash בשירות' : 'Pet Wash direct service involvement'}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Service Provider Expectations */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-700">
                <h3 className="text-xl font-bold mb-4 text-purple-900 dark:text-purple-200">
                  {isHebrew ? '🛠️ ציפיות ספקי שירותים' : '🛠️ Service Provider Expectations'}
                </h3>
                <div className="space-y-3 text-purple-800 dark:text-purple-300">
                  <div>
                    <p className="font-semibold mb-1">{isHebrew ? 'מה מקבלים:' : 'What You Get:'}</p>
                    <ul className="text-sm space-y-1 mr-6">
                      <li>✓ {isHebrew ? 'זרימת לקוחות עקבית' : 'Consistent customer flow'}</li>
                      <li>✓ {isHebrew ? 'תשלום מאובטח דרך אסקרו' : 'Secure payment via escrow'}</li>
                      <li>✓ {isHebrew ? 'כלי ניהול וקביעת לוח זמנים' : 'Management & scheduling tools'}</li>
                      <li>✓ {isHebrew ? 'מערכת הגנה מפני הונאה' : 'Fraud protection system'}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">{isHebrew ? 'האחריות שלכם:' : 'Your Responsibilities:'}</p>
                    <ul className="text-sm space-y-1 mr-6">
                      <li>• {isHebrew ? 'שירות מקצועי ובטיחות' : 'Professional service & safety'}</li>
                      <li>• {isHebrew ? 'ביטוח עסקי תקף' : 'Valid business insurance'}</li>
                      <li>• {isHebrew ? 'רישיונות וסמכות' : 'Licenses & certifications'}</li>
                      <li>• {isHebrew ? 'אחריות מלאה על שירותיכם' : 'Full liability for your services'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Final Legal Notice */}
          <div className="bg-gray-900 dark:bg-gray-950 text-white rounded-xl p-8 border-4 border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {isHebrew ? '📜 הודעה משפטית סופית' : '📜 Final Legal Notice'}
            </h2>
            <p className="text-center text-lg leading-relaxed">
              {isHebrew ? (
                <>Pet Wash Ltd פועלת <strong>כפלטפורמת טכנולוגיה בלבד</strong>. אנו <strong>לא מספקים שירותים ישירות</strong> ו<strong>לא נישא באחריות</strong> לפעולות של ספקי שירותים עצמאיים. כל השירותים מסופקים על ידי <strong>קבלנים עצמאיים</strong> שאינם עובדי Pet Wash.</>
              ) : (
                <>Pet Wash Ltd operates <strong>as a technology platform only</strong>. We <strong>DO NOT provide services directly</strong> and <strong>ARE NOT LIABLE</strong> for the actions of independent service providers. All services are provided by <strong>independent contractors</strong> who are not employees of Pet Wash.</>
              )}
            </p>
            <p className="text-center mt-6 text-sm text-gray-400">
              {isHebrew ? 'על ידי שימוש בפלטפורמה, אתה מסכים לכל התנאים המפורטים לעיל.' : 'By using the platform, you agree to all terms outlined above.'}
            </p>
          </div>

          {/* Related Links */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {isHebrew ? 'מסמכים משפטיים קשורים' : 'Related Legal Documents'}
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/sitter-suite/terms-conditions">
                <button className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-left transition-colors">
                  <p className="font-semibold text-blue-900 dark:text-blue-200">
                    {isHebrew ? 'תנאי Sitter Suite' : 'Sitter Suite Terms'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {isHebrew ? 'תנאים ספציפיים לשירות' : 'Service-specific terms'}
                  </p>
                </button>
              </Link>
              <Link href="/sitter-suite/privacy-policy">
                <button className="w-full p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg text-left transition-colors">
                  <p className="font-semibold text-purple-900 dark:text-purple-200">
                    {isHebrew ? 'מדיניות פרטיות' : 'Privacy Policy'}
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    {isHebrew ? 'הגנת נתונים' : 'Data protection'}
                  </p>
                </button>
              </Link>
              <Link href="/sitter-suite/disclaimer">
                <button className="w-full p-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-left transition-colors">
                  <p className="font-semibold text-red-900 dark:text-red-200">
                    {isHebrew ? 'כתב ויתור' : 'Disclaimer'}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {isHebrew ? 'הודעות משפטיות' : 'Legal notices'}
                  </p>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
