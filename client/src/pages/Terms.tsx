import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { t, type Language } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function Terms() {
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

  const lastUpdated = "October 19, 2025";
  const lastUpdatedHe = "19 באוקטובר 2025";

  return (
    <div className={`min-h-screen bg-white ${language === 'he' ? 'rtl' : 'ltr'}`}>
      <Header language={language} onLanguageChange={handleLanguageChange} />
      <div className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" />
                {t('terms.backToHome', language)}
              </Button>
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                {t('terms.title', language)}
              </CardTitle>
              <p className="text-gray-600 text-center">
                {t('terms.companyNumber', language)}
              </p>
              <p className="text-sm text-gray-500 text-center mt-2">
                {t('terms.lastUpdated', language)}: {language === 'en' ? lastUpdated : lastUpdatedHe}
              </p>
              <p className="text-sm text-gray-500 text-center">
                {t('terms.compliantLaw', language)}
              </p>
            </CardHeader>
            <CardContent className="prose max-w-none">
              {language === 'en' ? (
                <>
                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                    <p className="mb-4">
                      By accessing or using Pet Wash™ services (website, mobile application, physical washing stations), 
                      you agree to be bound by these Terms and Conditions. If you do not agree to these terms, 
                      please do not use our services.
                    </p>
                    <p className="mb-4">
                      These terms constitute a legally binding agreement between you and Pet Wash Ltd (Company Number: 517145033), 
                      an Israeli company registered under the laws of the State of Israel.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">2. Service Description</h2>
                    <p className="mb-4">
                      Pet Wash™ provides premium organic pet washing services, including:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li>Self-service pet washing stations located throughout Israel</li>
                      <li>100% organic, biodegradable, eco-friendly washing products</li>
                      <li>Digital loyalty program with tiered benefits</li>
                      <li>E-voucher system for prepaid wash packages</li>
                      <li>Mobile PWA for station management (franchise partners)</li>
                      <li>AI-powered customer support assistant</li>
                    </ul>
                    <p className="mb-4 text-sm text-gray-600">
                      Service availability may vary by location. We reserve the right to modify, suspend, 
                      or discontinue any service with reasonable notice.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">3. Pricing & VAT</h2>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <p className="font-semibold">Important: All Prices Include VAT</p>
                      <p className="mt-2">
                        All prices displayed on our website, mobile app, and physical stations are in Israeli New Shekels (₪) 
                        and include Value Added Tax (VAT) at the current rate of 18% (effective January 1, 2025), unless explicitly stated otherwise.
                      </p>
                      <p className="mt-2 text-sm">
                        The final price you see at checkout is the total amount you will pay. No additional fees will be added.
                      </p>
                    </div>
                    <p className="mb-4">
                      <strong>Current Wash Packages:</strong>
                    </p>
                    <ul className="list-none mb-4 space-y-2">
                      <li>• Single Wash: ₪55 (includes VAT)</li>
                      <li>• 3-Pack Bundle: ₪150 (includes VAT)</li>
                      <li>• 4-Pack Bundle: ₪220 (includes VAT, 10% savings)</li>
                    </ul>
                    <p className="text-sm text-gray-600 mb-4">
                      Prices are subject to change with at least 30 days' notice. Changes will not affect prepaid vouchers 
                      or packages already purchased.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">4. Payment Terms</h2>
                    <p className="mb-4">
                      We accept the following payment methods:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li><strong>Credit Cards:</strong> Visa, Mastercard, American Express (via Nayax Israel)</li>
                      <li><strong>Digital Wallets:</strong> Apple Pay, Google Pay</li>
                      <li><strong>E-Vouchers:</strong> Prepaid digital vouchers with QR code redemption</li>
                    </ul>
                    <p className="mb-4">
                      All payments are processed securely through PCI DSS-compliant payment processors. 
                      We do not store your full credit card information on our servers.
                    </p>
                    <p className="text-sm text-gray-600">
                      Payment authorization may be declined if: (1) payment method is invalid, (2) insufficient funds, 
                      (3) suspected fraudulent activity, or (4) violation of these terms.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">5. Cancellation & Refund Policy</h2>
                    <div className="bg-green-50 p-4 rounded-lg mb-4">
                      <p className="font-semibold">Your Unconditional 14-Day Cancellation Right</p>
                      <p className="mt-2">
                        Under Israeli Consumer Protection Law (5741-1981), you have an <strong>unconditional right to cancel</strong> 
                        any purchase made through distance selling (website, phone, mobile app) within:
                      </p>
                      <ul className="list-disc ml-6 mt-2 space-y-2">
                        <li><strong>Standard consumers:</strong> 14 days from transaction date OR receipt of confirmation document (whichever is later)</li>
                        <li><strong>Protected groups (seniors 65+, persons with disabilities, new immigrants within 5 years):</strong> 4 months from transaction date OR receipt of confirmation document</li>
                      </ul>
                      <p className="mt-3">
                        <strong>Important:</strong> You must provide at least 7 working days' notice before the scheduled service commencement.
                      </p>
                    </div>
                    
                    <p className="mb-4">
                      <strong>Cancellation Fee:</strong>
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <p>
                        Maximum cancellation fee: <strong>5% of transaction value OR ₪100 (whichever is LOWER)</strong>
                      </p>
                      <p className="mt-2 text-sm">
                        <strong>No fee will be charged</strong> if: (1) service is defective or non-conforming, 
                        (2) service not delivered at scheduled time, (3) any breach of contract by Pet Wash Ltd, 
                        (4) you received misleading information.
                      </p>
                    </div>
                    
                    <p className="mb-4">
                      <strong>How to Cancel:</strong>
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li><strong>Email:</strong> Send written notice to <a href="mailto:Support@PetWash.co.il" className="text-blue-600 underline">Support@PetWash.co.il</a> 
                      with subject line "[CANCELLATION REQUEST]"</li>
                      <li><strong>Phone:</strong> Call customer service (business hours: Sunday-Thursday 8:00-18:00)</li>
                      <li>Provide: Full name, ID card number, order number, transaction date</li>
                    </ul>
                    
                    <p className="mb-4">
                      <strong>Refund Process:</strong>
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li>Refund processed within <strong>14 days</strong> from receipt of cancellation notice</li>
                      <li>Refund issued to original payment method (credit card, PayPal, etc.)</li>
                      <li>If cancellation fee applies, it will be deducted from refund amount</li>
                    </ul>
                    
                    <p className="text-sm text-gray-600">
                      <strong>Statutory Exceptions:</strong> Cancellation rights do not apply to: (1) custom/special orders made to your specification, 
                      (2) services already fully performed with your prior express consent, (3) sealed items opened by you that cannot be returned for health/hygiene reasons.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">6. Warranty & Service Guarantee</h2>
                    <p className="mb-4">
                      Pet Wash Ltd guarantees that:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li>All washing products are 100% organic, biodegradable, and safe for pets</li>
                      <li>Washing stations are maintained and sanitized regularly</li>
                      <li>Equipment is tested and functional (or clearly marked as out of service)</li>
                      <li>Services will be provided as described on our website and promotional materials</li>
                    </ul>
                    <p className="mb-4">
                      <strong>Service Issues:</strong> If you experience equipment malfunction or service issues, 
                      please report it immediately via:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                      <li>Our mobile app (instant notification to ops team)</li>
                      <li>Email: <a href="mailto:Support@PetWash.co.il" className="text-blue-600 underline">Support@PetWash.co.il</a></li>
                      <li>Phone: [Contact number]</li>
                    </ul>
                    <p className="text-sm text-gray-600">
                      We will investigate and resolve service complaints within 48 hours. 
                      Credits or refunds may be issued at our discretion.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">7. E-Vouchers & Digital Gift Cards</h2>
                    <p className="mb-4">
                      Our e-voucher system allows you to purchase prepaid wash packages:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li><strong>Validity:</strong> E-vouchers are valid for <strong>60 months (5 years)</strong> from purchase date, 
                      in accordance with consumer protection best practices</li>
                      <li><strong>Redemption:</strong> Scan QR code at any Pet Wash station to redeem value</li>
                      <li><strong>Transferability:</strong> Vouchers can be freely gifted or shared with others</li>
                      <li><strong>Security:</strong> Each voucher has a unique cryptographic signature (HMAC-SHA256) to prevent fraud</li>
                      <li><strong>Balance Tracking:</strong> View remaining balance anytime in your account dashboard or by scanning the QR code</li>
                      <li><strong>Partial Redemption:</strong> Vouchers can be used multiple times until full value is consumed</li>
                    </ul>
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4 mt-4">
                      <p className="font-semibold">Extended Validity Period</p>
                      <p className="mt-2 text-sm">
                        Pet Wash voluntarily offers a 5-year validity period to ensure fair value for customers. 
                        Vouchers purchased before this policy change retain their original expiry date or 5 years from purchase, whichever is longer.
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                      <strong>Lost or Stolen Vouchers:</strong> If you lose access to your voucher QR code, contact support with proof of purchase. 
                      We may reissue the voucher at our discretion after verification.
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>Expiry Notification:</strong> We will send email reminders 60 days and 30 days before voucher expiration.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">8. User Accounts & Registration</h2>
                    <p className="mb-4">
                      To access certain features (loyalty program, voucher wallet, order history), 
                      you must create an account by providing:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                      <li>Full name</li>
                      <li>Valid email address</li>
                      <li>Phone number</li>
                      <li>Pet information (optional but recommended)</li>
                    </ul>
                    <p className="mb-4">
                      You agree to:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li>Provide accurate and complete information</li>
                      <li>Keep your password secure and confidential</li>
                      <li>Notify us immediately of any unauthorized account access</li>
                      <li>Accept responsibility for all activities under your account</li>
                    </ul>
                    <p className="text-sm text-gray-600">
                      We reserve the right to suspend or terminate accounts that violate these terms.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">9. Privacy & Data Processing</h2>
                    <p className="mb-4">
                      By using our services, you consent to the collection, use, and processing of your personal data 
                      as described in our <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>.
                    </p>
                    <p className="mb-4">
                      Our Privacy Policy is compliant with Israel's Protection of Privacy Law (Amendment 13, 2025) 
                      and explains:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li>What data we collect and why</li>
                      <li>How we use and protect your information</li>
                      <li>Your rights under Israeli privacy law (access, correction, deletion, portability)</li>
                      <li>Cookie usage and third-party services</li>
                      <li>Cross-border data transfers</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">10. Governing Law & Jurisdiction</h2>
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                      <p className="font-semibold">Mandatory Israeli Law Applies</p>
                      <p className="mt-2">
                        These Terms are governed by and construed in accordance with the <strong>laws of the State of Israel</strong>, 
                        without regard to conflict of law provisions.
                      </p>
                      <p className="mt-2">
                        Any dispute arising from your use of this website or our services shall be subject to the exclusive 
                        jurisdiction of the competent courts in Israel.
                      </p>
                      <p className="mt-2 text-sm">
                        Mandatory provisions of Israeli consumer protection law apply and cannot be waived by contract.
                      </p>
                    </div>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">11. Limitation of Liability</h2>
                    <p className="mb-4">
                      To the maximum extent permitted by Israeli law, Pet Wash Ltd shall not be liable for:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li>Indirect, incidental, or consequential damages arising from service use</li>
                      <li>Pet injuries resulting from improper use of washing equipment</li>
                      <li>Loss of data, vouchers, or account access due to user negligence</li>
                      <li>Service interruptions due to force majeure events (natural disasters, war, pandemics)</li>
                    </ul>
                    <p className="mb-4">
                      <strong>Maximum Liability:</strong> Our total liability for any claim shall not exceed the amount 
                      paid by you for the specific service in question.
                    </p>
                    <p className="text-sm text-gray-600">
                      This limitation does not apply to liability for death, personal injury, fraud, or other matters 
                      where liability cannot be limited under Israeli law.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">12. Intellectual Property</h2>
                    <p className="mb-4">
                      All content on our website, app, and materials (including Pet Wash™ logo, trademarks, text, graphics, 
                      images, software) are the property of Pet Wash Ltd and protected by Israeli and international 
                      intellectual property laws.
                    </p>
                    <p className="mb-4">
                      You may not:
                    </p>
                    <ul className="list-disc ml-6 mb-4 space-y-2">
                      <li>Copy, reproduce, or distribute our content without written permission</li>
                      <li>Use our trademarks or branding in any commercial manner</li>
                      <li>Reverse engineer or attempt to extract source code from our software</li>
                      <li>Create derivative works based on our services</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">13. Service Area & Availability</h2>
                    <p className="mb-4">
                      Pet Wash™ services are currently available throughout Israel. 
                      Station locations are listed on our website and mobile app.
                    </p>
                    <p className="mb-4">
                      We reserve the right to restrict or refuse service to specific geographic areas at our discretion.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">14. Amendments to Terms</h2>
                    <p className="mb-4">
                      We may update these Terms & Conditions from time to time to reflect changes in our services, 
                      legal requirements, or business practices.
                    </p>
                    <p className="mb-4">
                      <strong>Notification:</strong> We will notify you of material changes via:
                    </p>
                    <ul className="list-disc ml-6 mb-4">
                      <li>Prominent notice on our website</li>
                      <li>Email to registered users</li>
                      <li>In-app notification</li>
                    </ul>
                    <p className="text-sm text-gray-600">
                      Continued use of our services after changes take effect constitutes acceptance of the updated terms.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">15. Dispute Resolution</h2>
                    <p className="mb-4">
                      Before pursuing legal action, we encourage you to contact us to resolve disputes amicably:
                    </p>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <p><strong>Customer Service:</strong> <a href="mailto:Support@PetWash.co.il" className="text-blue-600 underline">Support@PetWash.co.il</a></p>
                      <p className="mt-2"><strong>Subject Line:</strong> [DISPUTE] [Your Order Number]</p>
                      <p className="mt-2 text-sm text-gray-600">We aim to respond within 5 business days.</p>
                    </div>
                    <p className="mb-4">
                      If informal resolution fails, disputes will be resolved through Israeli courts as specified in Section 10.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">16. Consumer Protection Authority</h2>
                    <p className="mb-4">
                      If you believe your consumer rights have been violated, you may file a complaint with:
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="font-semibold">Bureau of Consumer Protection and Fair Trade</p>
                      <p className="mt-2">Ministry of Economy and Industry</p>
                      <p>Website: <a href="https://www.gov.il" className="text-blue-600 underline">www.gov.il</a></p>
                      <p>Phone: *5505 (Ministry hotline)</p>
                    </div>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">17. Contact Information</h2>
                    <div className="bg-gray-100 p-6 rounded-lg">
                      <p className="font-semibold text-lg mb-3">Pet Wash Ltd</p>
                      <p><strong>Company Number:</strong> 517145033</p>
                      <p className="mt-2"><strong>Email:</strong> <a href="mailto:Support@PetWash.co.il" className="text-blue-600 underline">Support@PetWash.co.il</a></p>
                      <p className="mt-2"><strong>Website:</strong> <a href="https://petwash.co.il" className="text-blue-600 underline">https://petwash.co.il</a></p>
                      <p className="mt-2"><strong>Address:</strong> Israel</p>
                      <p className="mt-4 text-sm text-gray-600">Business hours: Sunday-Thursday 8:00-18:00 (Israel time)</p>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  {/* Hebrew version with all the same sections */}
                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">1. קבלת התנאים</h2>
                    <p className="mb-4">
                      על ידי שימוש בשירותי Pet Wash™ (אתר, אפליקציה, תחנות רחיצה), 
                      אתה מסכים להיות כפוף לתנאים וההגבלות הללו.
                      אם אינך מסכים לתנאים אלו, אנא אל תשתמש בשירותינו.
                    </p>
                    <p className="mb-4">
                      תנאים אלו מהווים הסכם משפטי מחייב בינך לבין פט ווש בע"מ (מספר חברה: 517145033), 
                      חברה ישראלית הרשומה על פי חוקי מדינת ישראל.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">2. תיאור השירות</h2>
                    <p className="mb-4">
                      Pet Wash™ מספקת שירותי רחצת חיות מחמד אורגנית פרמיום, כולל:
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li>תחנות רחיצה עצמית לחיות מחמד ברחבי ישראל</li>
                      <li>מוצרים אורגניים 100% מתכלים וידידותיים לסביבה</li>
                      <li>תוכנית נאמנות דיגיטלית עם הטבות מדורגות</li>
                      <li>מערכת שוברים דיגיטליים לחבילות רחיצה משולמות מראש</li>
                      <li>אפליקציה לניהול תחנות (לשותפים זכיינים)</li>
                      <li>עוזר שירות לקוחות מבוסס בינה מלאכותית</li>
                    </ul>
                    <p className="mb-4 text-sm text-gray-600">
                      זמינות השירות עשויה להשתנות לפי מיקום. אנו שומרים לעצמנו את הזכות לשנות, להשעות או להפסיק כל שירות בהודעה סבירה.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">3. מחירים ומע"מ</h2>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <p className="font-semibold">חשוב: כל המחירים כוללים מע"מ</p>
                      <p className="mt-2">
                        כל המחירים המוצגים באתר, באפליקציה ובתחנות הפיזיות הם בשקלים חדשים (₪) 
                        וכוללים מס ערך מוסף (מע"מ) בשיעור הנוכחי של 18% (בתוקף מ-1 בינואר 2025), אלא אם צוין אחרת במפורש.
                      </p>
                      <p className="mt-2 text-sm">
                        המחיר הסופי שתראה בקופה הוא הסכום הכולל שתשלם. לא יתווספו עמלות נוספות.
                      </p>
                    </div>
                    <p className="mb-4">
                      <strong>חבילות רחיצה נוכחיות:</strong>
                    </p>
                    <ul className="list-none mb-4 space-y-2">
                      <li>• רחיצה בודדת: ₪55 (כולל מע"מ)</li>
                      <li>• חבילת 3: ₪150 (כולל מע"מ)</li>
                      <li>• חבילת 4: ₪220 (כולל מע"מ, 10% חיסכון)</li>
                    </ul>
                    <p className="text-sm text-gray-600 mb-4">
                      המחירים עשויים להשתנות בהודעה של 30 יום לפחות. שינויים לא ישפיעו על שוברים או חבילות שכבר נרכשו.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">4. תנאי תשלום</h2>
                    <p className="mb-4">
                      אנו מקבלים את אמצעי התשלום הבאים:
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li><strong>כרטיסי אשראי:</strong> Visa, Mastercard, American Express (דרך Nayax ישראל)</li>
                      <li><strong>ארנקים דיגיטליים:</strong> Apple Pay, Google Pay</li>
                      <li><strong>שוברים דיגיטליים:</strong> שוברים משולמים מראש עם מימוש QR</li>
                    </ul>
                    <p className="mb-4">
                      כל התשלומים מעובדים בצורה מאובטחת דרך מעבדי תשלום תואמי PCI DSS. 
                      אנחנו לא שומרים את פרטי כרטיס האשראי המלאים שלך בשרתים שלנו.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">5. ביטול והחזרים</h2>
                    <div className="bg-green-50 p-4 rounded-lg mb-4">
                      <p className="font-semibold">זכות ביטול בלתי מותנית ל-14 יום</p>
                      <p className="mt-2">
                        על פי חוק הגנת הצרכן (התשמ"א-1981), יש לך <strong>זכות בלתי מותנית לביטול</strong> 
                        כל רכישה שבוצעה במכירה מרחוק (אתר, טלפון, אפליקציה) בתוך:
                      </p>
                      <ul className="list-disc mr-6 mt-2 space-y-2">
                        <li><strong>צרכנים רגילים:</strong> 14 יום מתאריך העסקה או קבלת מסמך אישור (המאוחר מבינהם)</li>
                        <li><strong>קבוצות מוגנות (גיל 65+, בעלי מוגבלות, עולים חדשים עד 5 שנים):</strong> 4 חודשים מתאריך העסקה או קבלת מסמך אישור</li>
                      </ul>
                      <p className="mt-3">
                        <strong>חשוב:</strong> יש לתת הודעה מראש של 7 ימי עבודה לפחות לפני מועד מתן השירות.
                      </p>
                    </div>
                    
                    <p className="mb-4">
                      <strong>דמי ביטול:</strong>
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <p>
                        דמי ביטול מקסימליים: <strong>5% משווי העסקה או ₪100 (הנמוך מביניהם)</strong>
                      </p>
                      <p className="mt-2 text-sm">
                        <strong>לא יגבה תשלום</strong> אם: (1) השירות פגום או לא תואם, 
                        (2) השירות לא נמסר במועד המתוכנן, (3) הפרת חוזה מצד פט ווש בע"מ, 
                        (4) קיבלת מידע מטעה.
                      </p>
                    </div>
                    
                    <p className="mb-4">
                      <strong>כיצד לבטל:</strong>
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li><strong>אימייל:</strong> שלח הודעה בכתב ל-<a href="mailto:Support@PetWash.co.il" className="text-blue-600 underline">Support@PetWash.co.il</a> 
                      עם נושא "[בקשת ביטול]"</li>
                      <li><strong>טלפון:</strong> התקשר לשירות לקוחות (שעות פעילות: ראשון-חמישי 8:00-18:00)</li>
                      <li>יש לספק: שם מלא, מספר תעודת זהות, מספר הזמנה, תאריך עסקה</li>
                    </ul>
                    
                    <p className="mb-4">
                      <strong>תהליך החזר כספי:</strong>
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li>החזר מעובד תוך <strong>14 יום</strong> מקבלת הודעת הביטול</li>
                      <li>החזר מועבר לאמצעי התשלום המקורי (כרטיס אשראי, PayPal וכו')</li>
                      <li>אם חלים דמי ביטול, הם ינוכו מסכום ההחזר</li>
                    </ul>
                    
                    <p className="text-sm text-gray-600">
                      <strong>חריגים חוקיים:</strong> זכויות הביטול לא חלות על: (1) הזמנות מיוחדות/מותאמות אישית לפי מפרט שלך, 
                      (2) שירותים שבוצעו במלואם בהסכמתך המפורשת מראש, (3) פריטים אטומים שנפתחו על ידך ולא ניתנים להחזרה מסיבות בריאות/היגיינה.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">6. אחריות והבטחת שירות</h2>
                    <p className="mb-4">
                      פט ווש בע"מ מתחייבת ש:
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li>כל מוצרי הרחיצה הם 100% אורגניים, מתכלים ובטוחים לחיות</li>
                      <li>תחנות הרחיצה מתוחזקות ומחוטאות באופן קבוע</li>
                      <li>הציוד נבדק ותפקודי (או מסומן בבירור כמחוץ לשירות)</li>
                      <li>השירותים יסופקו כפי שמתואר באתר ובחומרים שיווקיים</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">7. שוברים דיגיטליים וכרטיסי מתנה</h2>
                    <p className="mb-4">
                      מערכת השוברים הדיגיטליים שלנו מאפשרת רכישת חבילות רחיצה משולמות מראש:
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li><strong>תוקף:</strong> שוברים דיגיטליים תקפים ל-<strong>60 חודשים (5 שנים)</strong> מתאריך הרכישה, 
                      בהתאם לשיטות העבודה המומלצות להגנת הצרכן</li>
                      <li><strong>מימוש:</strong> סרוק קוד QR בכל תחנת Pet Wash למימוש ערך</li>
                      <li><strong>העברה:</strong> ניתן להעניק או לשתף שוברים עם אחרים בחופשיות</li>
                      <li><strong>אבטחה:</strong> לכל שובר חתימה קריפטוגרפית ייחודית (HMAC-SHA256) למניעת הונאה</li>
                      <li><strong>מעקב אחר יתרה:</strong> צפה ביתרה הנותרת בכל עת בדשבורד החשבון או על ידי סריקת קוד ה-QR</li>
                      <li><strong>מימוש חלקי:</strong> ניתן להשתמש בשוברים מספר פעמים עד לניצול מלוא הערך</li>
                    </ul>
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4 mt-4">
                      <p className="font-semibold">תקופת תוקף מורחבת</p>
                      <p className="mt-2 text-sm">
                        פט ווש מציעה מרצונה תקופת תוקף של 5 שנים כדי להבטיח ערך הוגן ללקוחות. 
                        שוברים שנרכשו לפני שינוי מדיניות זה שומרים על תאריך התפוגה המקורי שלהם או 5 שנים מהרכישה, לפי המאוחר.
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                      <strong>שוברים אבודים או גנובים:</strong> אם איבדת גישה לקוד ה-QR של השובר, צור קשר עם התמיכה עם הוכחת רכישה. 
                      אנו עשויים להנפיק מחדש את השובר על פי שיקול דעתנו לאחר אימות.
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>הודעת פקיעה:</strong> נשלח תזכורות באימייל 60 ו-30 יום לפני פקיעת תוקף השובר.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">8. חשבונות משתמש והרשמה</h2>
                    <p className="mb-4">
                      כדי לגשת לתכונות מסוימות (תוכנית נאמנות, ארנק שוברים, היסטוריית הזמנות), 
                      עליך ליצור חשבון על ידי מתן:
                    </p>
                    <ul className="list-disc mr-6 mb-4">
                      <li>שם מלא</li>
                      <li>כתובת אימייל תקפה</li>
                      <li>מספר טלפון</li>
                      <li>מידע על חיית המחמד (אופציונלי אך מומלץ)</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">9. פרטיות ועיבוד נתונים</h2>
                    <p className="mb-4">
                      על ידי שימוש בשירותינו, אתה מסכים לאיסוף, שימוש ועיבוד הנתונים האישיים שלך 
                      כמתואר ב<Link href="/privacy" className="text-blue-600 underline">מדיניות הפרטיות</Link> שלנו.
                    </p>
                    <p className="mb-4">
                      מדיניות הפרטיות שלנו תואמת לחוק הגנת הפרטיות (תיקון 13, 2025) ומסבירה:
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li>איזה נתונים אנו אוספים ולמה</li>
                      <li>כיצד אנו משתמשים ומגנים על המידע שלך</li>
                      <li>הזכויות שלך על פי החוק הישראלי (גישה, תיקון, מחיקה, ניידות)</li>
                      <li>שימוש בעוגיות ושירותי צד שלישי</li>
                      <li>העברות מידע חוצות גבולות</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">10. דין וסמכות שיפוט</h2>
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                      <p className="font-semibold">חוק ישראלי חל</p>
                      <p className="mt-2">
                        תנאים אלו כפופים ומפורשים בהתאם ל<strong>חוקי מדינת ישראל</strong>, 
                        ללא התחשבות בהוראות ניגוד דינים.
                      </p>
                      <p className="mt-2">
                        כל סכסוך הנובע משימוש באתר או בשירותינו יהיה כפוף לסמכות השיפוט הבלעדית 
                        של בתי המשפט המוסמכים בישראל.
                      </p>
                      <p className="mt-2 text-sm">
                        הוראות מחייבות של חוק הגנת הצרכן הישראלי חלות ולא ניתן לוותר עליהן בחוזה.
                      </p>
                    </div>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">11. הגבלת אחריות</h2>
                    <p className="mb-4">
                      במידה המרבית המותרת על פי החוק הישראלי, פט ווש בע"מ לא תהיה אחראית ל:
                    </p>
                    <ul className="list-disc mr-6 mb-4 space-y-2">
                      <li>נזקים עקיפים, מקריים או תוצאתיים הנובעים משימוש בשירות</li>
                      <li>פציעות חיות הנובעות משימוש לא נכון בציוד הרחיצה</li>
                      <li>אובדן נתונים, שוברים או גישה לחשבון עקב רשלנות משתמש</li>
                      <li>הפרעות בשירות עקב אירועי כוח עליון (אסונות טבע, מלחמה, מגיפות)</li>
                    </ul>
                    <p className="text-sm text-gray-600">
                      הגבלה זו לא חלה על אחריות למוות, פגיעה גופנית, הונאה או עניינים אחרים 
                      שבהם לא ניתן להגביל אחריות על פי החוק הישראלי.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">12. קניין רוחני</h2>
                    <p className="mb-4">
                      כל התוכן באתר, באפליקציה ובחומרים שלנו (כולל לוגו Pet Wash™, סימנים מסחריים, טקסט, גרפיקה, 
                      תמונות, תוכנה) הם רכושה של פט ווש בע"מ ומוגנים על ידי חוקי קניין רוחני ישראליים ובינלאומיים.
                    </p>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">13. תיקונים לתנאים</h2>
                    <p className="mb-4">
                      אנו עשויים לעדכן תנאים והגבלות אלה מעת לעת כדי לשקף שינויים בשירותים שלנו, 
                      דרישות חוקיות או נהלים עסקיים.
                    </p>
                    <p className="mb-4">
                      <strong>הודעה:</strong> נודיע לך על שינויים מהותיים באמצעות:
                    </p>
                    <ul className="list-disc mr-6 mb-4">
                      <li>הודעה בולטת באתר</li>
                      <li>אימייל למשתמשים רשומים</li>
                      <li>הודעה באפליקציה</li>
                    </ul>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">14. רשות הגנת הצרכן</h2>
                    <p className="mb-4">
                      אם אתה מאמין שזכויות הצרכן שלך הופרו, תוכל להגיש תלונה ל:
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="font-semibold">לשכת הגנת הצרכן ומסחר הוגן</p>
                      <p className="mt-2">משרד הכלכלה והתעשייה</p>
                      <p>אתר: <a href="https://www.gov.il" className="text-blue-600 underline">www.gov.il</a></p>
                      <p>טלפון: *5505</p>
                    </div>
                  </section>

                  <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">15. פרטי יצירת קשר</h2>
                    <div className="bg-gray-100 p-6 rounded-lg">
                      <p className="font-semibold text-lg mb-3">פט ווש בע"מ</p>
                      <p><strong>מספר חברה:</strong> 517145033</p>
                      <p className="mt-2"><strong>אימייל:</strong> <a href="mailto:Support@PetWash.co.il" className="text-blue-600 underline">Support@PetWash.co.il</a></p>
                      <p className="mt-2"><strong>אתר:</strong> <a href="https://petwash.co.il" className="text-blue-600 underline">https://petwash.co.il</a></p>
                      <p className="mt-2"><strong>כתובת:</strong> ישראל</p>
                      <p className="mt-4 text-sm text-gray-600">שעות פעילות: ראשון-חמישי 8:00-18:00 (שעון ישראל)</p>
                    </div>
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer language={language} />
    </div>
  );
}
