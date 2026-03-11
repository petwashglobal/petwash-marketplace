import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft, Shield, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function Disclaimer() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className={`min-h-screen luxury-bg-mesh ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/sitter-suite">
          <Button variant="ghost" className="mb-6 flex items-center gap-2 luxury-btn-primary">
            <ArrowLeft className="h-4 w-4" />
            {isHebrew ? 'חזרה ל-⁦The Sitter Suite™⁩' : 'Back to ⁦The Sitter Suite™⁩'}
          </Button>
        </Link>

        <div className="luxury-glass-card luxury-shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 luxury-glass-minimal rounded-2xl bg-red-50">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="luxury-heading-xl text-red-600">
              {isHebrew ? 'כתב ויתור משפטי' : 'Legal Disclaimer'}
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
            {isHebrew ? 'עודכן לאחרונה: 29 באוקטובר 2025' : 'Last Updated: October 29, 2025'}
          </p>

          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* Critical Notice */}
            <div className="bg-red-50 dark:bg-red-900/20 border-4 border-red-600 p-8 rounded-xl">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-12 w-12 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl font-bold mb-4 text-red-900 dark:text-red-400">
                    {isHebrew ? '⚠️ הודעה קריטית - קרא בעיון' : '⚠️ CRITICAL NOTICE - READ CAREFULLY'}
                  </h2>
                  <p className="text-lg font-bold leading-relaxed">
                    {isHebrew ? (
                      <>Pet Wash Ltd היא <u>אך ורק פלטפורמת מקשרת</u> (כמו cars.com.au או Booking.com). אנו לא מעסיקים שמרטפים, לא מספקים שירותי טיפול בחיות מחמד, ו<strong>לא נושאים באחריות לאף פעולה, רשלנות, או תוצאה</strong> הנובעת משימוש בפלטפורמה.</>
                    ) : (
                      <>Pet Wash Ltd is <u>ONLY a connector platform</u> (like cars.com.au or Booking.com). We do NOT employ sitters, do NOT provide pet care services, and <strong>bear NO responsibility for any action, negligence, or outcome</strong> arising from use of the Platform.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Role */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '1. תפקיד הפלטפורמה - מקשר בלבד' : '1. Platform Role - Connector Only'}
              </h2>
              <p className="leading-relaxed mb-4">{isHebrew ? 'Pet Wash Ltd פועלת במודל עסקי הדומה ל:' : 'Pet Wash Ltd operates in a business model similar to:'}</p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li><strong>cars.com.au:</strong> {isHebrew ? 'מחבר קונים ומוכרים, לא מוכר מכוניות' : 'Connects buyers and sellers, doesn\'t sell cars'}</li>
                <li><strong>Airbnb:</strong> {isHebrew ? 'מחבר אורחים ומארחים, לא מפעיל מלונות' : 'Connects guests and hosts, doesn\'t operate hotels'}</li>
                <li><strong>Booking.com:</strong> {isHebrew ? 'מציג רשימות, לא מנהל נכסים' : 'Lists properties, doesn\'t manage properties'}</li>
              </ul>
              <p className="leading-relaxed mt-4 font-bold">
                {isHebrew ? (
                  <>תפקידנו הבלעדי: לאפשר חיבור בין שני צדדים עצמאיים ולגבות עמלת תיווך של 7%.</>
                ) : (
                  <>Our SOLE role: Enable connections between two independent parties and collect a 7% brokerage commission.</>
                )}
              </p>
            </section>

            {/* Zero Liability */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '2. אפס אחריות - Pet Wash Ltd לא אחראית' : '2. Zero Liability - Pet Wash Ltd Not Responsible'}
              </h2>
              <p className="leading-relaxed mb-4 font-bold">
                {isHebrew ? (
                  <>Pet Wash Ltd, הדירקטורים, העובדים, השותפים, והסוכנים שלה אינם אחראים ב<u>כל צורה או דרך</u> עבור:</>
                ) : (
                  <>Pet Wash Ltd, its directors, employees, partners, and agents are NOT liable in <u>ANY way, shape, or form</u> for:</>
                )}
              </p>
              
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{isHebrew ? '🚫 אין אחריות לפציעות או מוות' : '🚫 NO Liability for Injury or Death'}</h3>
                  <ul className="list-disc list-inside space-y-1 mr-6 text-sm">
                    <li>{isHebrew ? 'פציעות, מחלות, או מוות של חיות מחמד במהלך או לאחר שירותי טיפול' : 'Injuries, illnesses, or death of pets during or after care services'}</li>
                    <li>{isHebrew ? 'פגיעה רגשית או טראומה לחיות מחמד' : 'Emotional harm or trauma to pets'}</li>
                    <li>{isHebrew ? 'תגובות אלרגיות או תופעות לוואי של תרופות' : 'Allergic reactions or medication side effects'}</li>
                    <li>{isHebrew ? 'פציעות לבני אדם (בעלים, שמרטפים, צדדים שלישיים)' : 'Injuries to humans (owners, sitters, third parties)'}</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{isHebrew ? '🚫 אין אחריות לנזק רכוש' : '🚫 NO Liability for Property Damage'}</h3>
                  <ul className="list-disc list-inside space-y-1 mr-6 text-sm">
                    <li>{isHebrew ? 'נזק לבית, רהיטים, או חפצים של בעלים' : 'Damage to homes, furniture, or belongings of owners'}</li>
                    <li>{isHebrew ? 'נזק לרכוש השמרטף על ידי חיות מחמד' : 'Damage to sitter\'s property by pets'}</li>
                    <li>{isHebrew ? 'אובדן או גניבת חפצים אישיים' : 'Loss or theft of personal items'}</li>
                    <li>{isHebrew ? 'נזק לרכב, חצר, או מתקני חוץ' : 'Damage to vehicles, yards, or outdoor facilities'}</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{isHebrew ? '🚫 אין אחריות לרשלנות' : '🚫 NO Liability for Negligence'}</h3>
                  <ul className="list-disc list-inside space-y-1 mr-6 text-sm">
                    <li>{isHebrew ? 'רשלנות או התנהגות לא מקצועית של שמרטפים' : 'Negligence or unprofessional behavior by sitters'}</li>
                    <li>{isHebrew ? 'אי ציות להוראות טיפול או לוחות זמנים של תרופות' : 'Failure to follow care instructions or medication schedules'}</li>
                    <li>{isHebrew ? 'מידע כוזב או מטעה שסופק על ידי כל אחד מהצדדים' : 'False or misleading information provided by either party'}</li>
                    <li>{isHebrew ? 'אי גילוי של בעיות בריאות, אלרגיות, או בעיות התנהגות' : 'Non-disclosure of health issues, allergies, or behavioral problems'}</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{isHebrew ? '🚫 אין אחריות להונאה או פעילות פלילית' : '🚫 NO Liability for Fraud or Criminal Activity'}</h3>
                  <ul className="list-disc list-inside space-y-1 mr-6 text-sm">
                    <li>{isHebrew ? 'זהויות כוזבות או מסמכי אימות מזויפים' : 'False identities or forged verification documents'}</li>
                    <li>{isHebrew ? 'גניבה, הונאה, או תרמית על ידי כל אחד מהצדדים' : 'Theft, fraud, or scams by either party'}</li>
                    <li>{isHebrew ? 'פעולות פליליות (תקיפה, הטרדה, פריצה)' : 'Criminal acts (assault, harassment, break-ins)'}</li>
                    <li>{isHebrew ? 'התנהגות בלתי חוקית במקום השמרטף או הבעל' : 'Illegal conduct at sitter or owner premises'}</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{isHebrew ? '🚫 אין אחריות לכשלים טכניים' : '🚫 NO Liability for Technical Failures'}</h3>
                  <ul className="list-disc list-inside space-y-1 mr-6 text-sm">
                    <li>{isHebrew ? 'הפסקות פלטפורמה, השבתות, או זמן השבתה' : 'Platform outages, downtimes, or unavailability'}</li>
                    <li>{isHebrew ? 'אובדן נתונים, כשלי גיבוי, או שחיתות מסד נתונים' : 'Data loss, backup failures, or database corruption'}</li>
                    <li>{isHebrew ? 'כשלי עיבוד תשלומים (Nayax, בנקים, ספקי תשלום)' : 'Payment processing failures (Nayax, banks, payment providers)'}</li>
                    <li>{isHebrew ? 'הפרות אבטחה, פריצות, או התקפות סייבר' : 'Security breaches, hacks, or cyberattacks'}</li>
                  </ul>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{isHebrew ? '🚫 אין אחריות למחלוקות' : '🚫 NO Liability for Disputes'}</h3>
                  <ul className="list-disc list-inside space-y-1 mr-6 text-sm">
                    <li>{isHebrew ? 'מחלוקות בין בעלים ושמרטפים (תמחור, שירות, ביקורות)' : 'Disputes between owners and sitters (pricing, service, reviews)'}</li>
                    <li>{isHebrew ? 'ביטולי הזמנה או בקשות החזר כספי' : 'Booking cancellations or refund requests'}</li>
                    <li>{isHebrew ? 'בקשות הארכה שנדחו או חילוקי דעות בתמחור' : 'Rejected extension requests or pricing disagreements'}</li>
                    <li>{isHebrew ? 'תלונות, ביקורות שליליות, או דירוגים' : 'Complaints, negative reviews, or ratings'}</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Biometric Verification */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '3. אימות ביומטרי - חובה אך לא מובטח' : '3. Biometric Verification - Required But Not Guaranteed'}
              </h2>
              <p className="leading-relaxed mb-4">
                {isHebrew ? (
                  <>כל המשתמשים (חברי נאמנות + שמרטפים) נדרשים לספק:</>
                ) : (
                  <>All users (loyalty members + sitters) are required to provide:</>
                )}
              </p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li><strong>{isHebrew ? 'תמונת סלפי נוכחית:' : 'Current Selfie Photo:'}</strong> {isHebrew ? 'פנים ברורות, מואר היטב' : 'Clear face, well-lit'}</li>
                <li><strong>{isHebrew ? 'תעודת זהות ממשלתית:' : 'Government ID:'}</strong> {isHebrew ? 'תמונה של תעודת זהות, דרכון, או רישיון נהיגה חוקי' : 'Photo of valid ID, passport, or driver\'s license'}</li>
                <li><strong>{isHebrew ? 'התאמה ביומטרית:' : 'Biometric Match:'}</strong> {isHebrew ? 'המערכת משתמשת ב-Google Vision API כדי להשוות פנים' : 'System uses Google Vision API to match faces'}</li>
              </ul>
              
              <div className="bg-white dark:bg-yellow-900/20 border-r-4 border-yellow-500 p-6 rounded-lg mt-4">
                <p className="font-bold mb-2">{isHebrew ? '⚠️ כתב ויתור לאימות:' : '⚠️ Verification Disclaimer:'}</p>
                <p className="leading-relaxed">
                  {isHebrew ? (
                    <>למרות שאנו משתמשים בטכנולוגיה מתקדמת, <strong>אנו לא מבטיחים 100% דיוק</strong> באימות זהות. Pet Wash Ltd אינה אחראית ל:</>
                  ) : (
                    <>While we use advanced technology, <strong>we do NOT guarantee 100% accuracy</strong> in identity verification. Pet Wash Ltd is not liable for:</>
                  )}
                </p>
                <ul className="list-disc list-inside space-y-1 mr-6 mt-2 text-sm">
                  <li>{isHebrew ? 'זהויות מזויפות או מסמכים מזויפים שעוברים אימות' : 'Fake identities or forged documents passing verification'}</li>
                  <li>{isHebrew ? 'כשלים או אי-דיוקים של Google Vision API' : 'Google Vision API failures or inaccuracies'}</li>
                  <li>{isHebrew ? 'גניבת זהות או שימוש בזהויות של אחרים' : 'Identity theft or use of others\' identities'}</li>
                  <li>{isHebrew ? 'בדיקות רקע מזויפות או אישורי ביטוח שקריים' : 'Fake background checks or false insurance certificates'}</li>
                </ul>
              </div>
            </section>

            {/* Force Majeure */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '4. כוח עליון - אירועים מחוץ לשליטתנו' : '4. Force Majeure - Events Beyond Our Control'}
              </h2>
              <p className="leading-relaxed mb-4">
                {isHebrew ? (
                  <>Pet Wash Ltd אינה אחראית לכל הפסקת שירות, אובדן נתונים, או נזק הנובע מ:</>
                ) : (
                  <>Pet Wash Ltd is not liable for any service interruption, data loss, or damage resulting from:</>
                )}
              </p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'אסונות טבע (רעידות אדמה, שיטפונות, סופות, שריפות)' : 'Natural disasters (earthquakes, floods, storms, fires)'}</li>
                <li>{isHebrew ? 'מלחמה, טרור, פעולות אויב, או אי-שקט אזרחי' : 'War, terrorism, acts of enemy, or civil unrest'}</li>
                <li>{isHebrew ? 'מגיפות, התפרצויות מחלות, או מגבלות בריאות ציבורית' : 'Pandemics, disease outbreaks, or public health restrictions'}</li>
                <li>{isHebrew ? 'הפסקות חשמל, כשלי אינטרנט, או כשלי תשתית' : 'Power outages, internet failures, or infrastructure failures'}</li>
                <li>{isHebrew ? 'פעולות ממשלתיות, צווי בית משפט, או שינויים חוקיים' : 'Government actions, court orders, or legal changes'}</li>
                <li>{isHebrew ? 'כשלי ספק צד שלישי (Nayax, Firebase, Google Cloud, SendGrid)' : 'Third-party provider failures (Nayax, Firebase, Google Cloud, SendGrid)'}</li>
                <li>{isHebrew ? 'התקפות סייבר, DDOS, פריצות, או ניסיונות פריצה' : 'Cyberattacks, DDOS, hacking, or hacking attempts'}</li>
              </ul>
            </section>

            {/* Independent Contractors */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '5. קבלנים עצמאיים - לא עובדים' : '5. Independent Contractors - Not Employees'}
              </h2>
              <div className="bg-blue-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="font-bold mb-2">{isHebrew ? 'הצהרה חשובה:' : 'Important Declaration:'}</p>
                <p className="leading-relaxed">
                  {isHebrew ? (
                    <>כל השמרטפים ב-⁦The Sitter Suite™⁩ הם <strong>קבלנים עצמאיים</strong> - לא עובדים, סוכנים, או נציגים של Pet Wash Ltd. אנו לא:</>
                  ) : (
                    <>All sitters on ⁦The Sitter Suite™⁩ are <strong>independent contractors</strong> - NOT employees, agents, or representatives of Pet Wash Ltd. We do NOT:</>
                  )}
                </p>
                <ul className="list-disc list-inside space-y-2 mr-6 mt-2">
                  <li>{isHebrew ? 'נשלט את הזמנים או לוחות הזמנים שלהם' : 'Control their hours or schedules'}</li>
                  <li>{isHebrew ? 'ספק ציוד, אספקה, או כלים' : 'Provide equipment, supplies, or tools'}</li>
                  <li>{isHebrew ? 'מפקח על עבודתם או נותן הנחיות יומיות' : 'Supervise their work or give daily instructions'}</li>
                  <li>{isHebrew ? 'מציע הטבות (בריאות, פנסיה, חופשה)' : 'Offer benefits (health, retirement, vacation)'}</li>
                  <li>{isHebrew ? 'מנכה מסים או תרומות ביטוח לאומי' : 'Withhold taxes or social security contributions'}</li>
                </ul>
              </div>
            </section>

            {/* User Responsibilities */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '6. אחריות המשתמשים' : '6. User Responsibilities'}
              </h2>
              <p className="leading-relaxed mb-4 font-bold">
                {isHebrew ? 'על ידי שימוש בפלטפורמה, אתה מקבל כי:' : 'By using the Platform, you acknowledge that:'}
              </p>
              <ul className="list-disc list-inside space-y-2 mr-6">
                <li>{isHebrew ? 'אתה אחראי באופן בלעדי לבחירת השמרטף או הקבלת הזמנות' : 'You are solely responsible for selecting a sitter or accepting bookings'}</li>
                <li>{isHebrew ? 'עליך לבצע בדיקת רקע והתייחסות עצמאית משלך' : 'You must conduct your own independent due diligence and reference checks'}</li>
                <li>{isHebrew ? 'עליך לעמוד בכל החוקים המקומיים (רישיונות, ביטוח, מסים)' : 'You must comply with all local laws (licenses, insurance, taxes)'}</li>
                <li>{isHebrew ? 'עליך לשמור על כיסוי ביטוח מתאים' : 'You must maintain appropriate insurance coverage'}</li>
                <li>{isHebrew ? 'אתה משחרר את Pet Wash Ltd מכל תביעה, דרישה, או נזק' : 'You release Pet Wash Ltd from all claims, demands, or damages'}</li>
              </ul>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '7. שיפוי - אתה מגן על Pet Wash' : '7. Indemnification - You Protect Pet Wash'}
              </h2>
              <div className="bg-red-50 dark:bg-red-900/20 border-r-4 border-red-600 p-6 rounded-lg">
                <p className="font-bold mb-4">
                  {isHebrew ? (
                    <>אתה מסכים לשפות, להגן, ולפטור את Pet Wash Ltd (וכל הדירקטורים, עובדים, שותפים, וסוכנים שלה) מכל:</>
                  ) : (
                    <>You agree to indemnify, defend, and hold harmless Pet Wash Ltd (and all its directors, employees, partners, and agents) from any:</>
                  )}
                </p>
                <ul className="list-disc list-inside space-y-2 mr-6">
                  <li>{isHebrew ? 'תביעות משפטיות או דרישות הקשורות לשימוש שלך בפלטפורמה' : 'Legal claims or demands related to your use of the Platform'}</li>
                  <li>{isHebrew ? 'נזקים או פציעות שנגרמו על ידך או לחיית המחמד שלך' : 'Damages or injuries caused by you or your pet'}</li>
                  <li>{isHebrew ? 'הפרה של תנאים אלה או כל חוק רלוונטי' : 'Breach of these Terms or any applicable law'}</li>
                  <li>{isHebrew ? 'מידע כוזב או מטעה שסיפקת' : 'False or misleading information you provided'}</li>
                  <li>{isHebrew ? 'כל פעולות שנעשו תחת החשבון שלך' : 'Any actions taken under your account'}</li>
                </ul>
              </div>
            </section>

            {/* Maximum Liability Cap */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '8. תקרת אחריות מקסימלית' : '8. Maximum Liability Cap'}
              </h2>
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="font-bold text-xl mb-4">
                  {isHebrew ? (
                    <>במקרה הבלתי סביר שבית משפט ימצא את Pet Wash Ltd אחראית:</>
                  ) : (
                    <>In the unlikely event a court finds Pet Wash Ltd liable:</>
                  )}
                </p>
                <p className="text-2xl font-bold text-center py-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  {isHebrew ? (
                    <>האחריות המקסימלית מוגבלת ל: <u>עמלת תיווך של 7% עבור אותה הזמנה ספציפית</u></>
                  ) : (
                    <>Maximum Liability Limited To: <u>7% broker commission for that specific booking</u></>
                  )}
                </p>
                <p className="mt-4 text-sm">
                  {isHebrew ? (
                    <>זו האחריות המקסימלית המוחלטת שלנו בכל נסיבות. ללא נזקים עונשיים, עקיפים, תוצאתיים, או מיוחדים מעולם לא יוענקו נגד Pet Wash Ltd.</>
                  ) : (
                    <>This is our absolute maximum liability under any circumstances. No punitive, indirect, consequential, or special damages will EVER be awarded against Pet Wash Ltd.</>
                  )}
                </p>
              </div>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '9. חוק שופט ובוררות' : '9. Governing Law & Arbitration'}
              </h2>
              <p className="leading-relaxed mb-4">
                {isHebrew ? (
                  <>כל מחלוקות יפתרו באמצעות בוררות מחייבת בתל אביב, ישראל, תחת החוק הישראלי. אתה מוותר על זכותך למשפט בפני חבר מושבעים.</>
                ) : (
                  <>All disputes will be resolved through binding arbitration in Tel Aviv, Israel, under Israeli law. You waive your right to a jury trial.</>
                )}
              </p>
            </section>

            {/* Acceptance */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '10. קבלה של כתב ויתור זה' : '10. Acceptance of This Disclaimer'}
              </h2>
              <div className="bg-blue-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="leading-relaxed font-bold">
                  {isHebrew ? (
                    <>על ידי שימוש ב-⁦The Sitter Suite™⁩, אתה מאשר ומקבל את כל תנאי כתב הויתור הזה. אם אינך מסכים, אל תשתמש בפלטפורמה.</>
                  ) : (
                    <>By using ⁦The Sitter Suite™⁩, you acknowledge and accept ALL terms of this Disclaimer. If you do not agree, do NOT use the Platform.</>
                  )}
                </p>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {isHebrew ? '11. יצירת קשר' : '11. Contact Us'}
              </h2>
              <div className="bg-blue-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="font-semibold mb-2">Pet Wash Ltd</p>
                <p className="mt-2">
                  {isHebrew ? 'דוא"ל משפטי:' : 'Legal Email:'} <a href="mailto:legal@petwash.co.il" className="text-blue-600 hover:underline">legal@petwash.co.il</a>
                </p>
                <p>
                  {isHebrew ? 'אתר:' : 'Website:'} <a href="https://www.petwash.co.il" className="text-blue-600 hover:underline">www.petwash.co.il</a>
                </p>
              </div>
            </section>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 text-center">
              <p>© 2026 Pet Wash Ltd. {isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}</p>
              <p className="mt-2 font-bold text-red-600 dark:text-red-400">
                {isHebrew ? (
                  <>כתב ויתור זה מספק הגנה משפטית מקסימלית ל-Pet Wash Ltd כפלטפורמת מקשרת.</>
                ) : (
                  <>This Disclaimer provides maximum legal protection for Pet Wash Ltd as a connector platform.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
