import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { t, type Language } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function Privacy() {
  const [language, setLanguage] = useState<Language>('en');

  // Initialize language from geolocation
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        const defaultLanguage: Language = data.country_code === 'IL' ? 'he' : 'en';
        setLanguage(defaultLanguage);
      })
      .catch(() => setLanguage('en'));
  }, []);

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
  };

  return (
    <div className={`min-h-screen bg-white ${language === 'he' ? 'rtl' : 'ltr'}`}>
      <Header language={language} onLanguageChange={handleLanguageChange} />
      <div className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" />
                {language === 'en' ? 'Back to Home' : 'חזרה לעמוד הבית'}
              </Button>
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                {language === 'en' ? 'Privacy Policy – Pet Wash Ltd' : 'מדיניות פרטיות – פט ווש בע"מ'}
              </CardTitle>
              <p className="text-gray-600 text-center">
                {language === 'en' ? 'Company Number: 517145033' : 'מספר חברה: 517145033'}
              </p>
              <p className="text-gray-600 text-center">
                {language === 'en' ? 'Effective Date: 2025' : 'תאריך תחילה: 2025'}
              </p>
            </CardHeader>
            <CardContent className="prose max-w-none">
              {language === 'en' ? (
                <>
                  <p className="mb-6">
                    Pet Wash Ltd ("we", "us", "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and protect data when you use our website or mobile application.
                  </p>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
                    <ul className="list-disc pl-6 mb-4">
                      <li>Full name</li>
                      <li>Email address</li>
                      <li>Mobile phone number</li>
                      <li>Date of birth</li>
                      <li>Country</li>
                      <li>Payment confirmation (via third-party systems only)</li>
                      <li>Technical data (device, browser, IP)</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
                    <ul className="list-disc pl-6 mb-4">
                      <li>To provide and operate our services</li>
                      <li>To process payments</li>
                      <li>To communicate with you about appointments, services, and offers</li>
                      <li>To verify identity for age- or eligibility-based discounts (e.g., seniors or disabled)</li>
                      <li>To improve our website and service experience</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">3. Data Storage</h2>
                    <p className="mb-4">
                      We store personal data securely using cloud infrastructure and restrict access to authorized personnel only.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">4. Sharing Information</h2>
                    <p className="mb-4">We do not sell or rent your data. We may share your information only with:</p>
                    <ul className="list-disc pl-6 mb-4">
                      <li>Trusted service providers (e.g. SMS, payment, or hosting platforms)</li>
                      <li>Government authorities if legally required</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
                    <p className="mb-4">Under Israeli privacy law, you have the right to:</p>
                    <ul className="list-disc pl-6 mb-4">
                      <li>Access your personal data</li>
                      <li>Request correction or deletion</li>
                      <li>Withdraw consent at any time</li>
                    </ul>
                    <p className="mb-4">To exercise these rights, contact: Support@PetWash.co.il</p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">6. Cookies</h2>
                    <p className="mb-4">
                      We may use cookies and similar technologies to improve your browsing experience.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">7. Minors</h2>
                    <p className="mb-4">
                      Our services are not intended for children under 13. If you are under 13, do not provide personal data.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">8. Changes to the Policy</h2>
                    <p className="mb-4">
                      We may update this Privacy Policy. Updates will appear on this page with the revised date.
                    </p>
                  </section>
                </>
              ) : (
                <div className="text-right">
                  <p className="mb-6">
                    פט וואש בע״מ ("אנחנו", "שלנו") מחויבת להגן על פרטיות המשתמשים. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ושומרים מידע כאשר אתם משתמשים באתר או באפליקציה שלנו.
                  </p>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">1. מידע שאנו אוספים</h2>
                    <ul className="list-disc pr-6 mb-4">
                      <li>שם מלא</li>
                      <li>כתובת דוא"ל</li>
                      <li>מספר טלפון נייד</li>
                      <li>תאריך לידה</li>
                      <li>מדינה</li>
                      <li>אישור תשלום (באמצעות ספקי שירות צד שלישי בלבד)</li>
                      <li>נתונים טכניים (מכשיר, דפדפן, כתובת IP)</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">2. כיצד אנו משתמשים במידע</h2>
                    <ul className="list-disc pr-6 mb-4">
                      <li>לספק ולהפעיל את השירותים שלנו</li>
                      <li>לעבד תשלומים</li>
                      <li>ליצור קשר בנוגע להזמנות, שירותים ומבצעים</li>
                      <li>לאמת זכאות להנחות (כגון אזרחים ותיקים או בעלי מוגבלות)</li>
                      <li>לשפר את האתר וחוויית השירות</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">3. אחסון נתונים</h2>
                    <p className="mb-4">
                      אנו שומרים מידע אישי בצורה מאובטחת באמצעות תשתיות ענן ומגבילים גישה לאנשי צוות מורשים בלבד.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">4. שיתוף מידע</h2>
                    <p className="mb-4">אנו לא מוכרים או משכירים את המידע שלכם. אנו עשויים לשתף מידע רק עם:</p>
                    <ul className="list-disc pr-6 mb-4">
                      <li>ספקי שירות מהימנים (כגון פלטפורמות SMS, תשלום או אחסון)</li>
                      <li>רשויות ממשלתיות אם נדרש על פי חוק</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">5. הזכויות שלכם</h2>
                    <p className="mb-4">על פי חוק הפרטיות הישראלי, יש לכם הזכות:</p>
                    <ul className="list-disc pr-6 mb-4">
                      <li>לגשת למידע האישי שלכם</li>
                      <li>לבקש תיקון או מחיקה</li>
                      <li>לבטל הסכמה בכל עת</li>
                    </ul>
                    <p className="mb-4">כדי לממש זכויות אלה, צרו קשר: Support@PetWash.co.il</p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">6. עוגיות</h2>
                    <p className="mb-4">
                      אנו עשויים להשתמש בעוגיות וטכנולוגיות דומות כדי לשפר את חוויית הגלישה שלכם.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">7. קטינים</h2>
                    <p className="mb-4">
                      השירותים שלנו אינם מיועדים לילדים מתחת לגיל 13. אם אתם מתחת לגיל 13, אל תספקו מידע אישי.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">8. שינויים במדיניות</h2>
                    <p className="mb-4">
                      אנו עשויים לעדכן מדיניות פרטיות זו. עדכונים יופיעו בעמוד זה עם התאריך המעודכן.
                    </p>
                  </section>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer language={language} />
    </div>
  );
}