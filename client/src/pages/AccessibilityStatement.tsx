/**
 * Accessibility Statement Page - IS 5568 Compliant
 * Complies with Israel Standard 5568 (WCAG 2.0 Level AA)
 */

import { useLanguage } from "@/lib/languageStore";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BrandHeader } from "@/components/BrandHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";

export default function AccessibilityStatement() {
  const { language, setLanguage } = useLanguage();
  
  if (language === 'he') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Header language={language} onLanguageChange={setLanguage} />
        <BrandHeader />
        
        <div className="max-w-4xl mx-auto px-4 py-12" dir="rtl">
          <h1 className="text-4xl font-bold mb-8 text-center">הצהרת נגישות</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-8">
            עודכן לאחרונה: 17 באוקטובר 2025 | תואם לתקן ישראלי 5568
          </p>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>מחויבות לנגישות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>
                  Pet Wash™ מחויבת להנגשת אתר האינטרנט והאפליקציה שלה לאנשים עם מוגבלות,
                  בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות ולתקן ישראלי 5568 (המבוסס על WCAG 2.0 Level AA).
                </p>
                <p>
                  אנו שואפים להבטיח שהשירותים הדיגיטליים שלנו יהיו נגישים לכולם, כולל אנשים עם:
                </p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>מוגבלות ראייה (כולל עיוורון וליקויי ראייה)</li>
                  <li>מוגבלות שמיעה</li>
                  <li>מוגבלות מוטורית</li>
                  <li>מוגבלות קוגניטיבית</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>התאמות נגישות באתר</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>האתר והאפליקציה שלנו כוללים את ההתאמות הבאות:</p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">🎯 ניווט מקלדת</h3>
                    <p>ניתן לנווט באתר באמצעות מקלדת בלבד (Tab, Enter, חצים)</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2">🔍 קוראי מסך</h3>
                    <p>התאמה מלאה לקוראי מסך (NVDA, JAWS, VoiceOver)</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      טקסטים חלופיים לתמונות, תוויות לשדות טפסים, מבנה HTML סמנטי
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2">📏 ניגודיות צבעים</h3>
                    <p>יחס ניגודיות של לפחות 4.5:1 לטקסט רגיל ו-3:1 לטקסט גדול</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2">🔠 גופנים וגדלים</h3>
                    <p>ניתן להגדיל/להקטין טקסט עד 200% ללא אובדן תוכן</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2">⏰ זמן מותאם</h3>
                    <p>ללא הגבלות זמן קבועות בתהליכי מילוי טפסים</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2">🎬 מדיה נגישה</h3>
                    <p>כתוביות וטקסט חלופי לתוכן וידאו ואודיו</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>רכיבי נגישות ייעודיים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc mr-6 space-y-2">
                  <li>תפריט דילוג לתוכן ראשי (Skip to main content)</li>
                  <li>התראות נגישות (ARIA live regions)</li>
                  <li>תוויות ברורות לכל אלמנט אינטראקטיבי</li>
                  <li>סימוני landmark לסעיפי הדף</li>
                  <li>Focus visible - סימון ברור של אלמנט פעיל</li>
                  <li>תמיכה בזום עד 200%</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>טכנולוגיות מסייעות נתמכות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>האתר תואם ל:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li><strong>Windows:</strong> NVDA, JAWS + Chrome/Firefox/Edge</li>
                  <li><strong>macOS:</strong> VoiceOver + Safari</li>
                  <li><strong>iOS:</strong> VoiceOver + Safari</li>
                  <li><strong>Android:</strong> TalkBack + Chrome</li>
                  <li><strong>ניווט קולי:</strong> Dragon NaturallySpeaking</li>
                  <li><strong>זום:</strong> ZoomText, MAGic</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>תקנים ושיטות עבודה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>האתר עומד בתקנים הבאים:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li><strong>תקן ישראלי 5568:</strong> נגישות תכנים באינטרנט</li>
                  <li><strong>WCAG 2.0 Level AA:</strong> Web Content Accessibility Guidelines</li>
                  <li><strong>ARIA 1.2:</strong> Accessible Rich Internet Applications</li>
                  <li><strong>Section 508:</strong> US Federal accessibility standard</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>מגבלות נגישות ידועות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>למרות מאמצינו, ייתכנו חלקים באתר שעדיין לא נגישים במלואם:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>תוכן PDF ישן שהועלה לפני 2024 (בתהליך המרה לגרסאות נגישות)</li>
                  <li>סרטוני וידאו חיצוניים מיוטיוב (תלוי בנגישות המקור)</li>
                </ul>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  אנו פועלים באופן מתמיד לשיפור נגישות החלקים הללו.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20">
              <CardHeader>
                <CardTitle>רכז נגישות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">צוות הנגישות של Pet Wash™ לשירותכם</p>
                
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-semibold">אימייל:</p>
                      <a href="mailto:accessibility@petwash.co.il" className="text-blue-600 dark:text-blue-400 underline">
                        accessibility@petwash.co.il
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-semibold">טלפון:</p>
                      <a href="tel:+972501234567" className="text-blue-600 dark:text-blue-400 underline">
                        050-123-4567
                      </a>
                      <p className="text-sm text-gray-600 dark:text-gray-400">(א׳-ה׳, 9:00-17:00)</p>
                    </div>
                  </div>
                </div>
                
                <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                  נענה לפניות בתוך 48 שעות. במקרים דחופים, צרו קשר טלפוני.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>דיווח על בעיות נגישות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>אם נתקלתם בבעיית נגישות באתר, אנא דווחו לנו:</p>
                
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                  <p className="font-semibold">פרטים לכלול בדיווח:</p>
                  <ul className="list-disc mr-6 space-y-1 text-sm">
                    <li>תיאור הבעיה והאתגר שנתקלתם בו</li>
                    <li>העמוד/הקישור בו התגלתה הבעיה</li>
                    <li>הדפדפן והטכנולוגיה המסייעת שבהם השתמשתם</li>
                    <li>צילום מסך (אופציונלי)</li>
                  </ul>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  המשוב שלכם חשוב לנו ועוזר לנו לשפר את הנגישות לכולם.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>אכיפה ופיקוח</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>אם לא קיבלתם מענה מספק מרכז הנגישות, ניתן לפנות ל:</p>
                
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="font-semibold">נציבות שוויון זכויות לאנשים עם מוגבלות</p>
                  <p className="mt-2">טלפון: 1-800-254-401</p>
                  <p>פקס: 02-6496118</p>
                  <p>אימייל: sar@justice.gov.il</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>מחויבות מתמשכת</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Pet Wash™ רואה בנגישות ערך מרכזי ופועלת באופן מתמיד:</p>
                <ul className="list-disc mr-6 space-y-2">
                  <li>ביקורת נגישות שנתית על ידי מומחים חיצוניים</li>
                  <li>הדרכות צוות פיתוח בנושא נגישות</li>
                  <li>בדיקות אוטומטיות יומיות עם כלי aXe ו-WAVE</li>
                  <li>בדיקות משתמש עם אנשים עם מוגבלות</li>
                  <li>עדכון שוטף בהתאם לתקנים מתפתחים</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-6">
                <p className="text-center font-semibold text-lg">
                  נגישות היא זכות, לא פריבילגיה
                </p>
                <p className="text-center mt-2 text-gray-600 dark:text-gray-400">
                  אנו מחויבים לספק חוויה שווה ונגישה לכל המשתמשים
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
        <h1 className="text-4xl font-bold mb-8 text-center">Accessibility Statement</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-8">
          Last Updated: October 17, 2025 | Compliant with IS 5568
        </p>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commitment to Accessibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Pet Wash™ is committed to making our website and app accessible to people with disabilities,
                in accordance with the Equal Rights for Persons with Disabilities Law and Israeli Standard 5568 (based on WCAG 2.0 Level AA).
              </p>
              <p>
                We strive to ensure our digital services are accessible to everyone, including people with:
              </p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Visual impairments (including blindness and low vision)</li>
                <li>Hearing impairments</li>
                <li>Motor disabilities</li>
                <li>Cognitive disabilities</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accessibility Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Our website and app include the following accessibility features:</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">🎯 Keyboard Navigation</h3>
                  <p>Full keyboard navigation support (Tab, Enter, Arrow keys)</p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">🔍 Screen Readers</h3>
                  <p>Full compatibility with screen readers (NVDA, JAWS, VoiceOver)</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Alt text for images, form labels, semantic HTML structure
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">📏 Color Contrast</h3>
                  <p>Minimum 4.5:1 contrast ratio for text, 3:1 for large text</p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">🔠 Fonts & Sizes</h3>
                  <p>Text can be enlarged up to 200% without loss of content</p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">⏰ Adjustable Time</h3>
                  <p>No fixed time limits on form completion</p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">🎬 Accessible Media</h3>
                  <p>Captions and alt text for video and audio content</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dedicated Accessibility Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc ml-6 space-y-2">
                <li>Skip to main content link</li>
                <li>Accessible notifications (ARIA live regions)</li>
                <li>Clear labels for all interactive elements</li>
                <li>Landmark regions for page sections</li>
                <li>Focus visible - clear indication of active element</li>
                <li>Zoom support up to 200%</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported Assistive Technologies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Our website is compatible with:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Windows:</strong> NVDA, JAWS + Chrome/Firefox/Edge</li>
                <li><strong>macOS:</strong> VoiceOver + Safari</li>
                <li><strong>iOS:</strong> VoiceOver + Safari</li>
                <li><strong>Android:</strong> TalkBack + Chrome</li>
                <li><strong>Voice Navigation:</strong> Dragon NaturallySpeaking</li>
                <li><strong>Screen Magnification:</strong> ZoomText, MAGic</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardHeader>
              <CardTitle>Accessibility Coordinator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="font-semibold">Pet Wash™ Accessibility Team at your service</p>
              
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-semibold">Email:</p>
                    <a href="mailto:accessibility@petwash.co.il" className="text-blue-600 dark:text-blue-400 underline">
                      accessibility@petwash.co.il
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-semibold">Phone:</p>
                    <a href="tel:+972501234567" className="text-blue-600 dark:text-blue-400 underline">
                      +972-50-123-4567
                    </a>
                    <p className="text-sm text-gray-600 dark:text-gray-400">(Sun-Thu, 9:00-17:00 IST)</p>
                  </div>
                </div>
              </div>
              
              <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                We respond to inquiries within 48 hours. For urgent issues, please call.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reporting Accessibility Issues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>If you encounter an accessibility issue, please report it to us:</p>
              
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                <p className="font-semibold">Details to include:</p>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>Description of the issue and challenge you encountered</li>
                  <li>Page/link where the problem occurred</li>
                  <li>Browser and assistive technology used</li>
                  <li>Screenshot (optional)</li>
                </ul>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your feedback is important and helps us improve accessibility for everyone.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-900/20">
            <CardContent className="pt-6">
              <p className="text-center font-semibold text-lg">
                Accessibility is a right, not a privilege
              </p>
              <p className="text-center mt-2 text-gray-600 dark:text-gray-400">
                We're committed to providing an equal and accessible experience for all users
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer language={language} />
    </div>
  );
}
