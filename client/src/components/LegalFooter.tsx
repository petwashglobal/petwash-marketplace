import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileText, AlertTriangle } from 'lucide-react';
import { type Language, t } from '@/lib/i18n';

interface LegalFooterProps {
  language: Language;
}

export function LegalFooter({ language }: LegalFooterProps) {
  const [open, setOpen] = useState(false);

  const privacyContent = {
    he: {
      title: 'מדיניות פרטיות',
      content: `
**מדיניות הפרטיות של PetWash Ltd**

**עדכון אחרון: אוקטובר 2025**

### 1. איסוף מידע
אנו אוספים מידע אישי כולל: שם, אימייל, מספר טלפון, כתובת, ופרטי תשלום. המידע נאסף במטרה לספק שירותי שטיפת חיות מחמד, ניהול חשבון משתמש, ועיבוד תשלומים.

### 2. שימוש במידע
המידע משמש למטרות הבאות:
- מתן שירותי שטיפה וטיפול בחיות מחמד
- ניהול תכנית נאמנות
- תקשורת לגבי שירותים ומבצעים
- עיבוד תשלומים מאובטח

### 3. אבטחת מידע
אנו משתמשים בטכנולוגיות אבטחה מתקדמות כולל:
- הצפנת SSL/TLS
- WebAuthn & Passkeys (אימות ביומטרי)
- Firebase Security
- Blockchain Audit Trail

### 4. שיתוף מידע
לא נשתף את המידע שלך עם צדדים שלישיים ללא הסכמתך, למעט במקרים הבאים:
- נותני שירות מאושרים (Nayax Israel לתשלומים)
- דרישות חוק ורשויות

### 5. זכויותיך לפי חוק הגנת הפרטיות הישראלי 2025
- זכות גישה למידע האישי שלך
- זכות לתיקון מידע
- זכות למחיקת מידע (GDPR)
- זכות להגבלת שימוש במידע
- זכות להעברת מידע

### 6. קבצי Cookie
האתר משתמש ב-Cookies לשיפור חוויית המשתמש, אנליטיקה (Google Analytics, Clarity), ופרסום.

### 7. פרטי קשר
לשאלות בנושא פרטיות: privacy@petwash.co.il

PetWash Ltd • רח' החושן 2, כפר סבא • מס' ח.פ: 516472319
      `,
    },
    en: {
      title: 'Privacy Policy',
      content: `
**PetWash Ltd Privacy Policy**

**Last Updated: October 2025**

### 1. Information Collection
We collect personal information including: name, email, phone number, address, and payment details. Information is collected to provide pet washing services, manage user accounts, and process payments.

### 2. Information Usage
Information is used for:
- Providing pet washing and care services
- Managing loyalty programs
- Communication about services and promotions
- Secure payment processing

### 3. Data Security
We use advanced security technologies including:
- SSL/TLS encryption
- WebAuthn & Passkeys (biometric authentication)
- Firebase Security
- Blockchain Audit Trail

### 4. Information Sharing
We do not share your information with third parties without consent, except:
- Authorized service providers (Nayax Israel for payments)
- Legal requirements and authorities

### 5. Your Rights under Israeli Privacy Law 2025
- Right to access your personal information
- Right to correction
- Right to deletion (GDPR)
- Right to restriction of use
- Right to data portability

### 6. Cookies
The website uses Cookies to improve user experience, analytics (Google Analytics, Clarity), and advertising.

### 7. Contact
For privacy questions: privacy@petwash.co.il

PetWash Ltd • 2 HaChoshen St, Kfar Saba • Company ID: 516472319
      `,
    },
  };

  const termsContent = {
    he: {
      title: 'תנאי שימוש',
      content: `
**תנאי השימוש של PetWash Ltd**

**עדכון אחרון: אוקטובר 2025**

### 1. קבלת התנאים
שימוש באתר ובשירותי PetWash™ מהווה הסכמה לתנאים אלה.

### 2. השירותים
PetWash Ltd מספקת:
- עמדות שטיפה חכמות K9000 Twin
- שירותי שטיפה אורגניים פרימיום
- תכנית נאמנות 5 דרגות
- שירותי The Sitter Suite™ (שמרטפות)
- שירותי Walk My Pet™ (הליכה עם כלבים)
- שירותי PetTrek™ (הסעות חיות מחמד)

### 3. תשלומים
- כל התשלומים מעובדים באמצעות Nayax Israel בלבד
- מחירים כוללים מע"מ לפי החוק הישראלי (18%)
- החזרים כפופים למדיניות החזרים שלנו

### 4. אחריות משתמש
המשתמש אחראי:
- לספק מידע מדויק ועדכני
- לשמור על אבטחת החשבון
- לא לעשות שימוש לרעה בשירותים

### 5. הגבלת אחריות
PetWash Ltd לא תהיה אחראית לנזקים עקיפים או תוצאתיים הנובעים משימוש בשירותים.

### 6. קניין רוחני
כל התוכן באתר הוא רכושה של PetWash Ltd ומוגן בזכויות יוצרים.

### 7. שינויים בתנאים
אנו שומרים את הזכות לשנות תנאים אלה בכל עת. שינויים יכנסו לתוקף מיידית עם פרסומם באתר.

### 8. סמכות שיפוט
תנאים אלה כפופים לחוקי מדינת ישראל. סמכות השיפוט הבלעדית נתונה לבתי המשפט בכפר סבא.

PetWash Ltd • רח' החושן 2, כפר סבא • מס' ח.פ: 516472319
      `,
    },
    en: {
      title: 'Terms & Conditions',
      content: `
**PetWash Ltd Terms & Conditions**

**Last Updated: October 2025**

### 1. Acceptance of Terms
Use of the PetWash™ website and services constitutes acceptance of these terms.

### 2. Services
PetWash Ltd provides:
- K9000 Twin smart wash stations
- Premium organic washing services
- 5-tier loyalty program
- The Sitter Suite™ (pet sitting services)
- Walk My Pet™ (dog walking services)
- PetTrek™ (pet transport services)

### 3. Payments
- All payments processed via Nayax Israel ONLY
- Prices include VAT per Israeli law (18%)
- Refunds subject to our refund policy

### 4. User Responsibility
Users are responsible for:
- Providing accurate and current information
- Maintaining account security
- Not misusing services

### 5. Limitation of Liability
PetWash Ltd shall not be liable for indirect or consequential damages arising from service use.

### 6. Intellectual Property
All website content is property of PetWash Ltd and protected by copyright.

### 7. Changes to Terms
We reserve the right to modify these terms at any time. Changes take effect immediately upon posting.

### 8. Jurisdiction
These terms are governed by Israeli law. Exclusive jurisdiction lies with the courts of Kfar Saba.

PetWash Ltd • 2 HaChoshen St, Kfar Saba • Company ID: 516472319
      `,
    },
  };

  const disclaimerContent = {
    he: {
      title: 'כתב ויתור',
      content: `
**כתב ויתור - PetWash Ltd**

**עדכון אחרון: אוקטובר 2025**

### 1. כללי
השימוש בשירותי PetWash™ הוא באחריות המשתמש בלבד.

### 2. אחריות לחיית מחמד
- בעלי חיות מחמד אחראים באופן בלעדי לבריאות ובטיחות חיית המחמד שלהם
- מומלץ להתייעץ עם וטרינר לפני שימוש בשירותי שטיפה
- PetWash Ltd לא אחראית לתגובות אלרגיות או רגישויות

### 3. שירותי שטיפה
- כל המוצרים אורגניים ומאושרים לשימוש בחיות מחמד
- השירותים מבוססים על טכנולוגיית K9000 המובילה בתעשייה
- תחזוקה שוטפת מבוצעת לפי תקני הבטיחות הגבוהים ביותר

### 4. תכנית נאמנות ומבצעים
- ההטבות והמבצעים כפופים לתנאים ולתקופות תוקף
- PetWash Ltd שומרת את הזכות לשנות או לבטל מבצעים בכל עת

### 5. שירותים חיצוניים
- The Sitter Suite™, Walk My Pet™, PetTrek™ מופעלים על ידי ספקי שירות מאומתים
- PetWash Ltd פועלת כפלטפורמה ואינה אחראית ישירות למעשי נותני השירות

### 6. דיוק מידע
- אנו עושים מאמצים לספק מידע מדויק ועדכני
- PetWash Ltd לא אחראית לשגיאות או אי-דיוקים באתר

### 7. זמינות שירות
- השירותים זמינים בכפוף לזמינות עמדות ונותני שירות
- PetWash Ltd שומרת את הזכות להשעות שירותים לצורך תחזוקה

### 8. קישורים חיצוניים
- האתר עשוי להכיל קישורים לאתרים חיצוניים
- PetWash Ltd לא אחראית לתוכן או למדיניות של אתרים חיצוניים

**שימו לב:** שירותי PetWash™ מיועדים לשטיפה וטיפול בסיסי בחיות מחמד בלבד. למקרי חירום וטרינריים, פנו לוטרינר בהקדם.

PetWash Ltd • רח' החושן 2, כפר סבא • מס' ח.פ: 516472319  
טלפון תמיכה: 1-700-700-PET (738)
      `,
    },
    en: {
      title: 'Disclaimer',
      content: `
**Disclaimer - PetWash Ltd**

**Last Updated: October 2025**

### 1. General
Use of PetWash™ services is at the user's sole risk.

### 2. Pet Responsibility
- Pet owners are solely responsible for their pet's health and safety
- Consultation with a veterinarian is recommended before using washing services
- PetWash Ltd is not responsible for allergic reactions or sensitivities

### 3. Washing Services
- All products are organic and approved for pet use
- Services based on industry-leading K9000 technology
- Regular maintenance performed to highest safety standards

### 4. Loyalty Program & Promotions
- Benefits and promotions subject to terms and expiration dates
- PetWash Ltd reserves the right to modify or cancel promotions at any time

### 5. Third-Party Services
- The Sitter Suite™, Walk My Pet™, PetTrek™ operated by verified service providers
- PetWash Ltd acts as a platform and is not directly responsible for provider actions

### 6. Information Accuracy
- We make efforts to provide accurate and current information
- PetWash Ltd is not responsible for errors or inaccuracies on the website

### 7. Service Availability
- Services available subject to station and provider availability
- PetWash Ltd reserves the right to suspend services for maintenance

### 8. External Links
- The website may contain links to external sites
- PetWash Ltd is not responsible for content or policies of external sites

**Note:** PetWash™ services are intended for basic pet washing and care only. For veterinary emergencies, contact a veterinarian immediately.

PetWash Ltd • 2 HaChoshen St, Kfar Saba • Company ID: 516472319  
Support Phone: 1-700-700-PET (738)
      `,
    },
  };

  const currentLang = language === 'he' ? 'he' : 'en';

  return (
    <div className="border-t-2 border-black dark:border-white bg-gradient-to-r from-white via-gray-50 to-white dark:from-black dark:via-gray-900 dark:to-black py-8 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <h3 className="text-lg font-bold text-black dark:text-white mb-4">
          {t('legal.title', language)}
        </h3>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-black via-gray-800 to-black dark:from-white dark:via-gray-200 dark:to-white text-white dark:text-black hover:shadow-2xl hover:scale-105 transition-all duration-500 px-8 py-6 text-lg font-bold shadow-xl border-2 border-black dark:border-white"
              data-testid="button-legal-info"
            >
              <Shield className="w-5 h-5 mr-2" />
              {t('legal.buttonText', language)}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[80vh] bg-white dark:bg-black border-2 border-black dark:border-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-black dark:text-white">
                {t('legal.dialogTitle', language)}
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                {t('legal.dialogDescription', language)}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="privacy" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-900">
                <TabsTrigger 
                  value="privacy"
                  className="data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t('legal.tabPrivacy', language)}
                </TabsTrigger>
                <TabsTrigger 
                  value="terms"
                  className="data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {t('legal.tabTerms', language)}
                </TabsTrigger>
                <TabsTrigger 
                  value="disclaimer"
                  className="data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {t('legal.tabDisclaimer', language)}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="privacy" className="mt-4">
                <ScrollArea className="h-[500px] w-full pr-4">
                  <div className="prose prose-sm max-w-none text-black dark:text-white">
                    <div className="whitespace-pre-wrap text-left" dir={language === 'he' ? 'rtl' : 'ltr'}>
                      {privacyContent[currentLang].content}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="terms" className="mt-4">
                <ScrollArea className="h-[500px] w-full pr-4">
                  <div className="prose prose-sm max-w-none text-black dark:text-white">
                    <div className="whitespace-pre-wrap text-left" dir={language === 'he' ? 'rtl' : 'ltr'}>
                      {termsContent[currentLang].content}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="disclaimer" className="mt-4">
                <ScrollArea className="h-[500px] w-full pr-4">
                  <div className="prose prose-sm max-w-none text-black dark:text-white">
                    <div className="whitespace-pre-wrap text-left" dir={language === 'he' ? 'rtl' : 'ltr'}>
                      {disclaimerContent[currentLang].content}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-700 text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('legal.footerCompany', language)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {t('legal.footerAddress', language)}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        <p className="text-xs text-gray-600 dark:text-gray-400 mt-4">
          © 2025 PetWash Ltd. All rights reserved. • כל הזכויות שמורות
        </p>
      </div>
    </div>
  );
}
