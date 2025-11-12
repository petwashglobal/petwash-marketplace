/**
 * Privacy Policy Page - Israel Amendment 13 Compliant
 * Complies with Protection of Privacy Law (Amendment 13, 2025)
 */

import { useLanguage } from "@/lib/languageStore";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BrandHeader } from "@/components/BrandHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  const { language, setLanguage } = useLanguage();
  
  if (language === 'he') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Header language={language} onLanguageChange={setLanguage} />
        <BrandHeader />
        
        <div className="max-w-4xl mx-auto px-4 py-12" dir="rtl">
          <h1 className="text-4xl font-bold mb-8 text-center">מדיניות פרטיות</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-8">
            עודכן לאחרונה: 17 באוקטובר 2025 | תואם לתיקון 13 לחוק הגנת הפרטיות
          </p>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. בקר המידע</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p><strong>שם החברה:</strong> Pet Wash™ Israel</p>
                <p><strong>כתובת:</strong> ישראל</p>
                <p><strong>אימייל:</strong> Support@PetWash.co.il</p>
                <p><strong>אתר:</strong> https://petwash.co.il</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. איזה מידע אנו אוספים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p><strong>מידע אישי בסיסי:</strong></p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>שם מלא, כתובת אימייל, מספר טלפון</li>
                  <li>כתובת (למשלוחים ושירותים)</li>
                  <li>פרטי חיות המחמד (שם, גזע, תאריך לידה)</li>
                </ul>
                
                <p className="mt-4"><strong>מידע רגיש במיוחד:</strong></p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>נתונים ביומטריים (Face ID, Touch ID, Passkey) - לאימות מאובטח בלבד</li>
                  <li>מידע פיננסי (פרטי כרטיס אשראי מוצפנים דרך Nayax Israel)</li>
                </ul>
                
                <p className="mt-4"><strong>מזהים מקוונים:</strong></p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>כתובת IP, מיקום גיאוגרפי (לשיפור שירות)</li>
                  <li>עוגיות (cookies) ומזהי מכשיר</li>
                  <li>היסטוריית שימוש באתר ובאפליקציה</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. למה אנו משתמשים במידע</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc mr-6 space-y-2">
                  <li><strong>מתן שירותים:</strong> עיבוד הזמנות, ניהול חשבון, שליחת תזכורות לחיסונים</li>
                  <li><strong>תקשורת:</strong> עדכונים על הזמנות, מבצעים, הטבות נאמנות</li>
                  <li><strong>שיפור שירות:</strong> ניתוח שימוש, התאמה אישית</li>
                  <li><strong>אבטחה:</strong> זיהוי הונאות, הגנה על המידע</li>
                  <li><strong>חובות חוקיות:</strong> דיווח מס, שמירת רישומים</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. שיתוף מידע</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>אנו משתפים מידע רק עם:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li><strong>ספקי שירות:</strong> Firebase (אחסון), Nayax Israel (תשלומים), SendGrid (אימייל)</li>
                  <li><strong>רשויות:</strong> כנדרש על פי חוק</li>
                  <li><strong>העברות עסקיות:</strong> במקרה של מיזוג או רכישה</li>
                </ul>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  אנו לא מוכרים מידע אישי לצדדים שלישיים.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. הזכויות שלך</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>על פי תיקון 13 לחוק הגנת הפרטיות, יש לך זכות:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li><strong>עיון:</strong> לראות את המידע שיש לנו עליך</li>
                  <li><strong>תיקון:</strong> לתקן מידע שגוי</li>
                  <li><strong>מחיקה:</strong> לבקש מחיקת מידע (בכפוף לחריגים חוקיים)</li>
                  <li><strong>ניידות:</strong> לקבל העתק של המידע שלך בפורמט נגיש</li>
                  <li><strong>משיכת הסכמה:</strong> לבטל הסכמה שניתנה בעבר</li>
                  <li><strong>התנגדות:</strong> להתנגד לשימושים מסוימים במידע</li>
                </ul>
                
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="font-semibold">כיצד לממש את זכויותיך:</p>
                  <p className="mt-2">שלח בקשה ל: <a href="mailto:Support@PetWash.co.il" className="text-blue-600 dark:text-blue-400 underline">Support@PetWash.co.il</a></p>
                  <p className="mt-2">או השתמש בעמוד <a href="/data-rights" className="text-blue-600 dark:text-blue-400 underline">זכויות מידע</a></p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">נענה תוך 30 יום</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>6. אבטחת מידע</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>אנו מיישמים אמצעי אבטחה מתקדמים:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>הצפנה מלאה (SSL/TLS) להעברת מידע</li>
                  <li>הצפנת מסדי נתונים (AES-256)</li>
                  <li>אימות דו-שלבי ו-Face ID/Touch ID</li>
                  <li>גיבויים יומיים ושבועיים ל-Google Cloud Storage</li>
                  <li>ניטור רציף ובדיקות אבטחה</li>
                  <li>הגבלת גישה למידע רק לעובדים מורשים</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>7. שמירת מידע</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>אנו שומרים מידע:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li><strong>לקוחות פעילים:</strong> כל עוד החשבון פעיל</li>
                  <li><strong>לקוחות לא פעילים:</strong> עד 7 שנים (דרישה חוקית)</li>
                  <li><strong>נתוני תשלום:</strong> עד 5 שנים (דרישת מס הכנסה)</li>
                  <li><strong>תקשורת שיווקית:</strong> עד ביטול הסכמה</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>8. עוגיות (Cookies)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>אנו משתמשים בעוגיות ל:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li><strong>עוגיות הכרחיות:</strong> תפעול האתר והתחברות</li>
                  <li><strong>עוגיות פונקציונליות:</strong> שפה, העדפות</li>
                  <li><strong>עוגיות אנליטיות:</strong> Google Analytics (אנונימי)</li>
                  <li><strong>עוגיות שיווק:</strong> Facebook Pixel, Google Ads (עם הסכמה)</li>
                </ul>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  ניתן לנהל עוגיות דרך הגדרות הדפדפן או <a href="/cookie-settings" className="text-blue-600 dark:text-blue-400 underline">מרכז העדפות עוגיות</a>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>9. תלונות ופניות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>יש לך זכות להגיש תלונה ל:</p>
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="font-semibold">רשות הגנת הפרטיות</p>
                  <p className="mt-2">טלפון: 02-6550505</p>
                  <p>פקס: 02-6550506</p>
                  <p>אימייל: privacy@justice.gov.il</p>
                  <p>כתובת: רחוב קניון ממילא 8, ירושלים 9419207</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>10. עדכונים למדיניות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>אנו עשויים לעדכן מדיניות זו מעת לעת. נודיע על שינויים מהותיים באמצעות:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>הודעה באתר</li>
                  <li>אימייל ללקוחות רשומים</li>
                  <li>הודעת SMS (לשינויים קריטיים)</li>
                </ul>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  המשך שימוש באתר לאחר עדכון מהווה הסכמה למדיניות המעודכנת.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>11. העברות מידע בינלאומיות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>חלק מהמידע עשוי להישמר בשרתים מחוץ לישראל (EEA), תוך שמירה על רמת הגנה שווה.</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ספקים: Firebase (Google Cloud EU), SendGrid (EU), Nayax Israel
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20">
              <CardHeader>
                <CardTitle>יצירת קשר</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2">לשאלות או בקשות בנושא פרטיות:</p>
                <p><strong>אימייל:</strong> <a href="mailto:Support@PetWash.co.il" className="text-blue-600 dark:text-blue-400 underline">Support@PetWash.co.il</a></p>
                <p><strong>נושא:</strong> [פרטיות] שאלה/בקשה</p>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  נענה תוך 5 ימי עסקים
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <Footer language={language} />
      </div>
    );
  }
  
  // English version
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Header language={language} onLanguageChange={setLanguage} />
      <BrandHeader />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">Privacy Policy</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-8">
          Last Updated: October 17, 2025 | Compliant with Israel's Amendment 13
        </p>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Data Controller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p><strong>Company Name:</strong> Pet Wash™ Israel</p>
              <p><strong>Address:</strong> Israel</p>
              <p><strong>Email:</strong> Support@PetWash.co.il</p>
              <p><strong>Website:</strong> https://petwash.co.il</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. What Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p><strong>Basic Personal Data:</strong></p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Full name, email address, phone number</li>
                <li>Address (for delivery and service)</li>
                <li>Pet details (name, breed, date of birth)</li>
              </ul>
              
              <p className="mt-4"><strong>Sensitive Data:</strong></p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Biometric data (Face ID, Touch ID, Passkey) - for secure authentication only</li>
                <li>Financial information (encrypted credit card via Nayax Israel)</li>
              </ul>
              
              <p className="mt-4"><strong>Online Identifiers:</strong></p>
              <ul className="list-disc ml-6 space-y-2">
                <li>IP address, geolocation (for service improvement)</li>
                <li>Cookies and device identifiers</li>
                <li>Website and app usage history</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Why We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Service Delivery:</strong> Processing orders, account management, vaccine reminders</li>
                <li><strong>Communication:</strong> Order updates, promotions, loyalty rewards</li>
                <li><strong>Service Improvement:</strong> Usage analytics, personalization</li>
                <li><strong>Security:</strong> Fraud detection, data protection</li>
                <li><strong>Legal Obligations:</strong> Tax reporting, record keeping</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Information Sharing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>We only share information with:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Service Providers:</strong> Firebase (storage), Nayax Israel (payments), SendGrid (email)</li>
                <li><strong>Authorities:</strong> As required by law</li>
                <li><strong>Business Transfers:</strong> In case of merger or acquisition</li>
              </ul>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                We never sell personal data to third parties.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Under Israel's Amendment 13, you have the right to:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Access:</strong> View the information we have about you</li>
                <li><strong>Correction:</strong> Fix inaccurate information</li>
                <li><strong>Deletion:</strong> Request data deletion (subject to legal exceptions)</li>
                <li><strong>Portability:</strong> Receive a copy of your data in accessible format</li>
                <li><strong>Withdraw Consent:</strong> Cancel previously given consent</li>
                <li><strong>Object:</strong> Object to certain data uses</li>
              </ul>
              
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="font-semibold">How to Exercise Your Rights:</p>
                <p className="mt-2">Email: <a href="mailto:Support@PetWash.co.il" className="text-blue-600 dark:text-blue-400 underline">Support@PetWash.co.il</a></p>
                <p className="mt-2">Or use our <a href="/data-rights" className="text-blue-600 dark:text-blue-400 underline">Data Rights Portal</a></p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">We respond within 30 days</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Data Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>We implement advanced security measures:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Full encryption (SSL/TLS) for data transfer</li>
                <li>Database encryption (AES-256)</li>
                <li>Two-factor authentication and Face ID/Touch ID</li>
                <li>Daily and weekly backups to Google Cloud Storage</li>
                <li>Continuous monitoring and security audits</li>
                <li>Restricted access to authorized personnel only</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>We retain data:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Active Customers:</strong> As long as account is active</li>
                <li><strong>Inactive Customers:</strong> Up to 7 years (legal requirement)</li>
                <li><strong>Payment Data:</strong> Up to 5 years (tax requirement)</li>
                <li><strong>Marketing:</strong> Until consent withdrawal</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Cookies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>We use cookies for:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Essential:</strong> Website operation and login</li>
                <li><strong>Functional:</strong> Language, preferences</li>
                <li><strong>Analytics:</strong> Google Analytics (anonymized)</li>
                <li><strong>Marketing:</strong> Facebook Pixel, Google Ads (with consent)</li>
              </ul>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Manage cookies via browser settings or <a href="/cookie-settings" className="text-blue-600 dark:text-blue-400 underline">Cookie Preferences Center</a>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Complaints & Inquiries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>You have the right to file a complaint with:</p>
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-semibold">Israel Privacy Protection Authority</p>
                <p className="mt-2">Phone: 02-6550505</p>
                <p>Fax: 02-6550506</p>
                <p>Email: privacy@justice.gov.il</p>
                <p>Address: 8 Mamilla Mall St., Jerusalem 9419207</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Policy Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>We may update this policy periodically. We'll notify you of material changes via:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Website notice</li>
                <li>Email to registered customers</li>
                <li>SMS notification (for critical changes)</li>
              </ul>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Continued use after updates constitutes acceptance of the updated policy.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2">For privacy questions or requests:</p>
              <p><strong>Email:</strong> <a href="mailto:Support@PetWash.co.il" className="text-blue-600 dark:text-blue-400 underline">Support@PetWash.co.il</a></p>
              <p><strong>Subject:</strong> [PRIVACY] Question/Request</p>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                We respond within 5 business days
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer language={language} />
    </div>
  );
}
