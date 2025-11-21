import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { t, type Language } from '@/lib/i18n';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  CreditCard, 
  RotateCcw, 
  ShieldCheck, 
  Gift, 
  UserCheck, 
  Lock, 
  Scale, 
  AlertTriangle, 
  Copyright, 
  MapPin, 
  FileEdit, 
  MessageSquare, 
  Building,
  Mail
} from 'lucide-react';
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

  const SectionIcon = ({ icon: Icon, delay = 0 }: { icon: any; delay?: number }) => (
    <div 
      className={`w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-4 luxury-animate-scale-in luxury-delay-${delay}`}
      style={{ animationDelay: `${delay * 100}ms` }}
    >
      <Icon className="w-6 h-6 text-white" />
    </div>
  );

  return (
    <Layout language={language} onLanguageChange={handleLanguageChange}>
      <div className={`min-h-screen luxury-bg-mesh ${language === 'he' ? 'rtl' : 'ltr'}`}>
        <div className="pt-20 pb-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Back Button */}
            <div className="mb-8 luxury-animate-fade-in">
              <Link href="/">
                <Button className="luxury-btn-ghost">
                  <ArrowLeft className="h-4 w-4" />
                  {t('terms.backToHome', language)}
                </Button>
              </Link>
            </div>

            {/* Header */}
            <div className="text-center mb-12 luxury-animate-slide-up">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-lg">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <h1 className="luxury-heading-xl mb-4">
                {t('terms.title', language)}
              </h1>
              <p className="luxury-text-body mb-4">
                {t('terms.companyNumber', language)}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="luxury-badge luxury-badge-gold">
                  {t('terms.lastUpdated', language)}: {language === 'en' ? lastUpdated : lastUpdatedHe}
                </span>
                <span className="luxury-badge luxury-badge-success">
                  {t('terms.compliantLaw', language)}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
              {language === 'en' ? (
                <>
                  {/* Section 1 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-1">
                    <SectionIcon icon={CheckCircle} delay={1} />
                    <h2 className="luxury-heading-md mb-6">1. Acceptance of Terms</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        By accessing or using Pet Wash™ services (website, mobile application, physical washing stations), 
                        you agree to be bound by these Terms and Conditions. If you do not agree to these terms, 
                        please do not use our services.
                      </p>
                      <p className="luxury-text-body">
                        These terms constitute a legally binding agreement between you and Pet Wash Ltd (Company Number: 517145033), 
                        an Israeli company registered under the laws of the State of Israel.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 2 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-2">
                    <SectionIcon icon={FileText} delay={2} />
                    <h2 className="luxury-heading-md mb-6">2. Service Description</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        Pet Wash™ provides premium organic pet washing services, including:
                      </p>
                      <ul className="space-y-3 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Self-service pet washing stations located throughout Israel</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>100% organic, biodegradable, eco-friendly washing products</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Digital loyalty program with tiered benefits</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>E-voucher system for prepaid wash packages</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Mobile PWA for station management (franchise partners)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>AI-powered customer support assistant</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        Service availability may vary by location. We reserve the right to modify, suspend, 
                        or discontinue any service with reasonable notice.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 3 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-3">
                    <SectionIcon icon={CreditCard} delay={3} />
                    <h2 className="luxury-heading-md mb-6">3. Pricing & VAT</h2>
                    <div className="space-y-4">
                      <div className="luxury-glass-panel p-6 border-l-4 border-blue-500">
                        <p className="luxury-heading-sm mb-3">Important: All Prices Include VAT</p>
                        <p className="luxury-text-body mb-3">
                          All prices displayed on our website, mobile app, and physical stations are in Israeli New Shekels (₪) 
                          and include Value Added Tax (VAT) at the current rate of 18% (effective January 1, 2025), unless explicitly stated otherwise.
                        </p>
                        <p className="luxury-text-small">
                          The final price you see at checkout is the total amount you will pay. No additional fees will be added.
                        </p>
                      </div>
                      <p className="luxury-text-body font-semibold">Current Wash Packages:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold">•</span>
                          <span>Single Wash: ₪55 (includes VAT)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold">•</span>
                          <span>3-Pack Bundle: ₪150 (includes VAT)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold">•</span>
                          <span>4-Pack Bundle: ₪220 (includes VAT, 10% savings)</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        Prices are subject to change with at least 30 days' notice. Changes will not affect prepaid vouchers 
                        or packages already purchased.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 4 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-4">
                    <SectionIcon icon={CreditCard} delay={4} />
                    <h2 className="luxury-heading-md mb-6">4. Payment Terms</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">We accept the following payment methods:</p>
                      <ul className="space-y-3 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Credit Cards:</strong> Visa, Mastercard, American Express (via Nayax Israel)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Digital Wallets:</strong> Apple Pay, Google Pay</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>E-Vouchers:</strong> Prepaid digital vouchers with QR code redemption</span>
                        </li>
                      </ul>
                      <p className="luxury-text-body">
                        All payments are processed securely through PCI DSS-compliant payment processors. 
                        We do not store your full credit card information on our servers.
                      </p>
                      <p className="luxury-text-small">
                        Payment authorization may be declined if: (1) payment method is invalid, (2) insufficient funds, 
                        (3) suspected fraudulent activity, or (4) violation of these terms.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 5 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-5">
                    <SectionIcon icon={RotateCcw} delay={5} />
                    <h2 className="luxury-heading-md mb-6">5. Cancellation & Refund Policy</h2>
                    <div className="space-y-4">
                      <div className="luxury-glass-panel p-6 border-l-4 border-green-500">
                        <p className="luxury-heading-sm mb-3">Your Unconditional 14-Day Cancellation Right</p>
                        <p className="luxury-text-body mb-3">
                          Under Israeli Consumer Protection Law (5741-1981), you have an <strong>unconditional right to cancel</strong> 
                          any purchase made through distance selling (website, phone, mobile app) within:
                        </p>
                        <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                          <li className="flex items-start gap-3">
                            <span className="text-green-600 font-bold mt-1">•</span>
                            <span><strong>Standard consumers:</strong> 14 days from transaction date OR receipt of confirmation document (whichever is later)</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="text-green-600 font-bold mt-1">•</span>
                            <span><strong>Protected groups (seniors 65+, persons with disabilities, new immigrants within 5 years):</strong> 4 months from transaction date OR receipt of confirmation document</span>
                          </li>
                        </ul>
                        <p className="luxury-text-body mt-3">
                          <strong>Important:</strong> You must provide at least 7 working days' notice before the scheduled service commencement.
                        </p>
                      </div>
                      
                      <p className="luxury-text-body font-semibold">Cancellation Fee:</p>
                      <div className="luxury-glass-panel p-6 border-l-4 border-blue-500">
                        <p className="luxury-text-body mb-2">
                          Maximum cancellation fee: <strong>5% of transaction value OR ₪100 (whichever is LOWER)</strong>
                        </p>
                        <p className="luxury-text-small">
                          <strong>No fee will be charged</strong> if: (1) service is defective or non-conforming, 
                          (2) service not delivered at scheduled time, (3) any breach of contract by Pet Wash Ltd, 
                          (4) you received misleading information.
                        </p>
                      </div>
                      
                      <p className="luxury-text-body font-semibold">How to Cancel:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Email:</strong> Send written notice to <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a> 
                          with subject line "[CANCELLATION REQUEST]"</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Phone:</strong> Call customer service (business hours: Sunday-Thursday 8:00-18:00)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Provide: Full name, ID card number, order number, transaction date</span>
                        </li>
                      </ul>
                      
                      <p className="luxury-text-body font-semibold">Refund Process:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Refund processed within <strong>14 days</strong> from receipt of cancellation notice</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Refund issued to original payment method (credit card, PayPal, etc.)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>If cancellation fee applies, it will be deducted from refund amount</span>
                        </li>
                      </ul>
                      
                      <p className="luxury-text-small">
                        <strong>Statutory Exceptions:</strong> Cancellation rights do not apply to: (1) custom/special orders made to your specification, 
                        (2) services already fully performed with your prior express consent, (3) sealed items opened by you that cannot be returned for health/hygiene reasons.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 6 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={ShieldCheck} />
                    <h2 className="luxury-heading-md mb-6">6. Warranty & Service Guarantee</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">Pet Wash Ltd guarantees that:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>All washing products are 100% organic, biodegradable, and safe for pets</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Washing stations are maintained and sanitized regularly</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Equipment is tested and functional (or clearly marked as out of service)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Services will be provided as described on our website and promotional materials</span>
                        </li>
                      </ul>
                      <p className="luxury-text-body font-semibold">Service Issues:</p>
                      <p className="luxury-text-body">If you experience equipment malfunction or service issues, please report it immediately via:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Our mobile app (instant notification to ops team)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Email: <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a></span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Phone: [Contact number]</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        We will investigate and resolve service complaints within 48 hours. 
                        Credits or refunds may be issued at our discretion.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 7 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Gift} />
                    <h2 className="luxury-heading-md mb-6">7. E-Vouchers & Digital Gift Cards</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">Our e-voucher system allows you to purchase prepaid wash packages:</p>
                      <ul className="space-y-3 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Validity:</strong> E-vouchers are valid for <strong>60 months (5 years)</strong> from purchase date, 
                          in accordance with consumer protection best practices</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Redemption:</strong> Scan QR code at any Pet Wash station to redeem value</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Transferability:</strong> Vouchers can be freely gifted or shared with others</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Security:</strong> Each voucher has a unique cryptographic signature (HMAC-SHA256) to prevent fraud</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Balance Tracking:</strong> View remaining balance anytime in your account dashboard or by scanning the QR code</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>Partial Redemption:</strong> Vouchers can be used multiple times until full value is consumed</span>
                        </li>
                      </ul>
                      <div className="luxury-glass-panel p-6 border-l-4 border-yellow-500 mt-4">
                        <p className="luxury-heading-sm mb-3">Extended Validity Period</p>
                        <p className="luxury-text-small">
                          Pet Wash voluntarily offers a 5-year validity period to ensure fair value for customers. 
                          Vouchers purchased before this policy change retain their original expiry date or 5 years from purchase, whichever is longer.
                        </p>
                      </div>
                      <p className="luxury-text-small mt-4">
                        <strong>Lost or Stolen Vouchers:</strong> If you lose access to your voucher QR code, contact support with proof of purchase. 
                        We may reissue the voucher at our discretion after verification.
                      </p>
                      <p className="luxury-text-small">
                        <strong>Expiry Notification:</strong> We will send email reminders 60 days and 30 days before voucher expiration.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 8 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={UserCheck} />
                    <h2 className="luxury-heading-md mb-6">8. User Accounts & Registration</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        To access certain features (loyalty program, voucher wallet, order history), 
                        you must create an account by providing:
                      </p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Full name</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Valid email address</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Phone number</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Pet information (optional but recommended)</span>
                        </li>
                      </ul>
                      <p className="luxury-text-body">You agree to:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Provide accurate and complete information</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Keep your password secure and confidential</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Notify us immediately of any unauthorized account access</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Accept responsibility for all activities under your account</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        We reserve the right to suspend or terminate accounts that violate these terms.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 9 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Lock} />
                    <h2 className="luxury-heading-md mb-6">9. Privacy & Data Processing</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        By using our services, you consent to the collection, use, and processing of your personal data 
                        as described in our <Link href="/privacy" className="luxury-text-gradient hover:underline">Privacy Policy</Link>.
                      </p>
                      <p className="luxury-text-body">
                        Our Privacy Policy is compliant with Israel's Protection of Privacy Law (Amendment 13, 2025) 
                        and explains:
                      </p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>What data we collect and why</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>How we use and protect your information</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Your rights under Israeli privacy law (access, correction, deletion, portability)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Cookie usage and third-party services</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Cross-border data transfers</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 10 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Scale} />
                    <h2 className="luxury-heading-md mb-6">10. Governing Law & Jurisdiction</h2>
                    <div className="space-y-4">
                      <div className="luxury-glass-panel p-6 border-l-4 border-yellow-500">
                        <p className="luxury-heading-sm mb-3">Mandatory Israeli Law Applies</p>
                        <p className="luxury-text-body mb-3">
                          These Terms are governed by and construed in accordance with the <strong>laws of the State of Israel</strong>, 
                          without regard to conflict of law provisions.
                        </p>
                        <p className="luxury-text-body mb-3">
                          Any dispute arising from your use of this website or our services shall be subject to the exclusive 
                          jurisdiction of the competent courts in Israel.
                        </p>
                        <p className="luxury-text-small">
                          Mandatory provisions of Israeli consumer protection law apply and cannot be waived by contract.
                        </p>
                      </div>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 11 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={AlertTriangle} />
                    <h2 className="luxury-heading-md mb-6">11. Limitation of Liability</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        To the maximum extent permitted by Israeli law, Pet Wash Ltd shall not be liable for:
                      </p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Indirect, incidental, or consequential damages arising from service use</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Pet injuries resulting from improper use of washing equipment</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Loss of data, vouchers, or account access due to user negligence</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Service interruptions due to force majeure events (natural disasters, war, pandemics)</span>
                        </li>
                      </ul>
                      <p className="luxury-text-body">
                        <strong>Maximum Liability:</strong> Our total liability for any claim shall not exceed the amount 
                        paid by you for the specific service in question.
                      </p>
                      <p className="luxury-text-small">
                        This limitation does not apply to liability for death, personal injury, fraud, or other matters 
                        where liability cannot be limited under Israeli law.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 12 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Copyright} />
                    <h2 className="luxury-heading-md mb-6">12. Intellectual Property</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        All content on our website, app, and materials (including Pet Wash™ logo, trademarks, text, graphics, 
                        images, software) are the property of Pet Wash Ltd and protected by Israeli and international 
                        intellectual property laws.
                      </p>
                      <p className="luxury-text-body">You may not:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Copy, reproduce, or distribute our content without written permission</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Use our trademarks or branding in any commercial manner</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Reverse engineer or attempt to extract source code from our software</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Create derivative works based on our services</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 13 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={MapPin} />
                    <h2 className="luxury-heading-md mb-6">13. Service Area & Availability</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        Pet Wash™ services are currently available throughout Israel. 
                        Station locations are listed on our website and mobile app.
                      </p>
                      <p className="luxury-text-body">
                        We reserve the right to restrict or refuse service to specific geographic areas at our discretion.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 14 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={FileEdit} />
                    <h2 className="luxury-heading-md mb-6">14. Amendments to Terms</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        We may update these Terms & Conditions from time to time to reflect changes in our services, 
                        legal requirements, or business practices.
                      </p>
                      <p className="luxury-text-body font-semibold">Notification:</p>
                      <p className="luxury-text-body">We will notify you of material changes via:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Prominent notice on our website</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>Email to registered users</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>In-app notification</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        Continued use of our services after changes take effect constitutes acceptance of the updated terms.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 15 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={MessageSquare} />
                    <h2 className="luxury-heading-md mb-6">15. Dispute Resolution</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        Before pursuing legal action, we encourage you to contact us to resolve disputes amicably:
                      </p>
                      <div className="luxury-glass-panel p-6">
                        <p className="luxury-text-body mb-2">
                          <strong>Customer Service:</strong> <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a>
                        </p>
                        <p className="luxury-text-body mb-2"><strong>Subject Line:</strong> [DISPUTE] [Your Order Number]</p>
                        <p className="luxury-text-small">We aim to respond within 5 business days.</p>
                      </div>
                      <p className="luxury-text-body">
                        If informal resolution fails, disputes will be resolved through Israeli courts as specified in Section 10.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Section 16 */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Building} />
                    <h2 className="luxury-heading-md mb-6">16. Consumer Protection Authority</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        If you believe your consumer rights have been violated, you may file a complaint with:
                      </p>
                      <div className="luxury-glass-panel p-6 border-l-4 border-blue-500">
                        <p className="luxury-heading-sm mb-3">Bureau of Consumer Protection and Fair Trade</p>
                        <p className="luxury-text-body mb-2">Ministry of Economy and Industry</p>
                        <p className="luxury-text-body mb-2">
                          Website: <a href="https://www.gov.il" className="luxury-text-gradient hover:underline">www.gov.il</a>
                        </p>
                        <p className="luxury-text-body">Phone: *5505 (Ministry hotline)</p>
                      </div>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  {/* Contact Section */}
                  <section className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Mail} />
                    <h2 className="luxury-heading-md mb-6">17. Contact Information</h2>
                    <div className="luxury-glass-panel p-8">
                      <p className="luxury-heading-sm mb-6">Pet Wash Ltd</p>
                      <div className="space-y-3">
                        <p className="luxury-text-body"><strong>Company Number:</strong> 517145033</p>
                        <p className="luxury-text-body">
                          <strong>Email:</strong> <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a>
                        </p>
                        <p className="luxury-text-body">
                          <strong>Website:</strong> <a href="https://petwash.co.il" className="luxury-text-gradient hover:underline">https://petwash.co.il</a>
                        </p>
                        <p className="luxury-text-body"><strong>Address:</strong> Israel</p>
                        <p className="luxury-text-small mt-4">Business hours: Sunday-Thursday 8:00-18:00 (Israel time)</p>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  {/* Hebrew version with all the same sections */}
                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-1">
                    <SectionIcon icon={CheckCircle} delay={1} />
                    <h2 className="luxury-heading-md mb-6">1. קבלת התנאים</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        על ידי שימוש בשירותי Pet Wash™ (אתר, אפליקציה, תחנות רחיצה), 
                        אתה מסכים להיות כפוף לתנאים וההגבלות הללו.
                        אם אינך מסכים לתנאים אלו, אנא אל תשתמש בשירותינו.
                      </p>
                      <p className="luxury-text-body">
                        תנאים אלו מהווים הסכם משפטי מחייב בינך לבין פט ווש בע"מ (מספר חברה: 517145033), 
                        חברה ישראלית הרשומה על פי חוקי מדינת ישראל.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-2">
                    <SectionIcon icon={FileText} delay={2} />
                    <h2 className="luxury-heading-md mb-6">2. תיאור השירות</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        Pet Wash™ מספקת שירותי רחצת חיות מחמד אורגנית פרמיום, כולל:
                      </p>
                      <ul className="space-y-3 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>תחנות רחיצה עצמית לחיות מחמד ברחבי ישראל</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>מוצרים אורגניים 100% מתכלים וידידותיים לסביבה</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>תוכנית נאמנות דיגיטלית עם הטבות מדורגות</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>מערכת שוברים דיגיטליים לחבילות רחיצה משולמות מראש</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>אפליקציה לניהול תחנות (לשותפים זכיינים)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>עוזר שירות לקוחות מבוסס בינה מלאכותית</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        זמינות השירות עשויה להשתנות לפי מיקום. אנו שומרים לעצמנו את הזכות לשנות, להשעות או להפסיק כל שירות בהודעה סבירה.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-3">
                    <SectionIcon icon={CreditCard} delay={3} />
                    <h2 className="luxury-heading-md mb-6">3. מחירים ומע"מ</h2>
                    <div className="space-y-4">
                      <div className="luxury-glass-panel p-6 border-r-4 border-blue-500">
                        <p className="luxury-heading-sm mb-3">חשוב: כל המחירים כוללים מע"מ</p>
                        <p className="luxury-text-body mb-3">
                          כל המחירים המוצגים באתר, באפליקציה ובתחנות הפיזיות הם בשקלים חדשים (₪) 
                          וכוללים מס ערך מוסף (מע"מ) בשיעור הנוכחי של 18% (בתוקף מ-1 בינואר 2025), אלא אם צוין אחרת במפורש.
                        </p>
                        <p className="luxury-text-small">
                          המחיר הסופי שתראה בקופה הוא הסכום הכולל שתשלם. לא יתווספו עמלות נוספות.
                        </p>
                      </div>
                      <p className="luxury-text-body font-semibold">חבילות רחיצה נוכחיות:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold">•</span>
                          <span>רחיצה בודדת: ₪55 (כולל מע"מ)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold">•</span>
                          <span>חבילת 3: ₪150 (כולל מע"מ)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold">•</span>
                          <span>חבילת 4: ₪220 (כולל מע"מ, 10% חיסכון)</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        המחירים עשויים להשתנות בהודעה של 30 יום לפחות. שינויים לא ישפיעו על שוברים או חבילות שכבר נרכשו.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-4">
                    <SectionIcon icon={CreditCard} delay={4} />
                    <h2 className="luxury-heading-md mb-6">4. תנאי תשלום</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">אנו מקבלים את אמצעי התשלום הבאים:</p>
                      <ul className="space-y-3 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>כרטיסי אשראי:</strong> Visa, Mastercard, American Express (דרך Nayax ישראל)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>ארנקים דיגיטליים:</strong> Apple Pay, Google Pay</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>שוברים דיגיטליים:</strong> שוברים משולמים מראש עם מימוש QR</span>
                        </li>
                      </ul>
                      <p className="luxury-text-body">
                        כל התשלומים מעובדים בצורה מאובטחת דרך מעבדי תשלום תואמי PCI DSS. 
                        אנחנו לא שומרים את פרטי כרטיס האשראי המלאים שלך בשרתים שלנו.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-5">
                    <SectionIcon icon={RotateCcw} delay={5} />
                    <h2 className="luxury-heading-md mb-6">5. ביטול והחזרים</h2>
                    <div className="space-y-4">
                      <div className="luxury-glass-panel p-6 border-r-4 border-green-500">
                        <p className="luxury-heading-sm mb-3">זכות ביטול בלתי מותנית ל-14 יום</p>
                        <p className="luxury-text-body mb-3">
                          על פי חוק הגנת הצרכן (התשמ"א-1981), יש לך <strong>זכות בלתי מותנית לביטול</strong> 
                          כל רכישה שבוצעה במכירה מרחוק (אתר, טלפון, אפליקציה) בתוך:
                        </p>
                        <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                          <li className="flex items-start gap-3">
                            <span className="text-green-600 font-bold mt-1">•</span>
                            <span><strong>צרכנים רגילים:</strong> 14 יום מתאריך העסקה או קבלת מסמך אישור (המאוחר מבינהם)</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="text-green-600 font-bold mt-1">•</span>
                            <span><strong>קבוצות מוגנות (גיל 65+, בעלי מוגבלות, עולים חדשים עד 5 שנים):</strong> 4 חודשים מתאריך העסקה או קבלת מסמך אישור</span>
                          </li>
                        </ul>
                        <p className="luxury-text-body mt-3">
                          <strong>חשוב:</strong> יש לתת הודעה מראש של 7 ימי עבודה לפחות לפני מועד מתן השירות.
                        </p>
                      </div>
                      
                      <p className="luxury-text-body font-semibold">דמי ביטול:</p>
                      <div className="luxury-glass-panel p-6 border-r-4 border-blue-500">
                        <p className="luxury-text-body mb-2">
                          דמי ביטול מקסימליים: <strong>5% משווי העסקה או ₪100 (הנמוך מביניהם)</strong>
                        </p>
                        <p className="luxury-text-small">
                          <strong>לא יגבה תשלום</strong> אם: (1) השירות פגום או לא תואם, 
                          (2) השירות לא נמסר במועד המתוכנן, (3) הפרת חוזה מצד פט ווש בע"מ, 
                          (4) קיבלת מידע מטעה.
                        </p>
                      </div>
                      
                      <p className="luxury-text-body font-semibold">כיצד לבטל:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>אימייל:</strong> שלח הודעה בכתב ל-<a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a> 
                          עם נושא "[בקשת ביטול]"</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>טלפון:</strong> התקשר לשירות לקוחות (שעות פעילות: ראשון-חמישי 8:00-18:00)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>יש לספק: שם מלא, מספר תעודת זהות, מספר הזמנה, תאריך עסקה</span>
                        </li>
                      </ul>
                      
                      <p className="luxury-text-body font-semibold">תהליך החזר כספי:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>החזר מעובד תוך <strong>14 יום</strong> מקבלת הודעת הביטול</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>החזר מועבר לאמצעי התשלום המקורי (כרטיס אשראי, PayPal וכו')</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>אם חלים דמי ביטול, הם ינוכו מסכום ההחזר</span>
                        </li>
                      </ul>
                      
                      <p className="luxury-text-small">
                        <strong>חריגים חוקיים:</strong> זכויות הביטול לא חלות על: (1) הזמנות מיוחדות/מותאמות אישית לפי מפרט שלך, 
                        (2) שירותים שבוצעו במלואם בהסכמתך המפורשת מראש, (3) פריטים אטומים שנפתחו על ידך ולא ניתנים להחזרה מסיבות בריאות/היגיינה.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={ShieldCheck} />
                    <h2 className="luxury-heading-md mb-6">6. אחריות והבטחת שירות</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">פט ווש בע"מ מתחייבת ש:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>כל מוצרי הרחיצה הם 100% אורגניים, מתכלים ובטוחים לחיות</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>תחנות הרחיצה מתוחזקות ומחוטאות באופן קבוע</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>הציוד נבדק ותפקודי (או מסומן בבירור כמחוץ לשירות)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>השירותים יסופקו כפי שמתואר באתר ובחומרים שיווקיים</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Gift} />
                    <h2 className="luxury-heading-md mb-6">7. שוברים דיגיטליים וכרטיסי מתנה</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        מערכת השוברים הדיגיטליים שלנו מאפשרת רכישת חבילות רחיצה משולמות מראש:
                      </p>
                      <ul className="space-y-3 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>תוקף:</strong> שוברים דיגיטליים תקפים ל-<strong>60 חודשים (5 שנים)</strong> מתאריך הרכישה, 
                          בהתאם לשיטות העבודה המומלצות להגנת הצרכן</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>מימוש:</strong> סרוק קוד QR בכל תחנת Pet Wash למימוש ערך</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>העברה:</strong> ניתן להעניק או לשתף שוברים עם אחרים בחופשיות</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>אבטחה:</strong> לכל שובר חתימה קריפטוגרפית ייחודית (HMAC-SHA256) למניעת הונאה</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>מעקב אחר יתרה:</strong> צפה ביתרה הנותרת בכל עת בדשבורד החשבון או על ידי סריקת קוד ה-QR</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span><strong>מימוש חלקי:</strong> ניתן להשתמש בשוברים מספר פעמים עד לניצול מלוא הערך</span>
                        </li>
                      </ul>
                      <div className="luxury-glass-panel p-6 border-r-4 border-yellow-500 mt-4">
                        <p className="luxury-heading-sm mb-3">תקופת תוקף מורחבת</p>
                        <p className="luxury-text-small">
                          פט ווש מציעה מרצונה תקופת תוקף של 5 שנים כדי להבטיח ערך הוגן ללקוחות. 
                          שוברים שנרכשו לפני שינוי מדיניות זה שומרים על תאריך התפוגה המקורי שלהם או 5 שנים מהרכישה, לפי המאוחר.
                        </p>
                      </div>
                      <p className="luxury-text-small mt-4">
                        <strong>שוברים אבודים או גנובים:</strong> אם איבדת גישה לקוד ה-QR של השובר, צור קשר עם התמיכה עם הוכחת רכישה. 
                        אנו עשויים להנפיק מחדש את השובר על פי שיקול דעתנו לאחר אימות.
                      </p>
                      <p className="luxury-text-small">
                        <strong>הודעת פקיעה:</strong> נשלח תזכורות באימייל 60 ו-30 יום לפני פקיעת תוקף השובר.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={UserCheck} />
                    <h2 className="luxury-heading-md mb-6">8. חשבונות משתמש והרשמה</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        כדי לגשת לתכונות מסוימות (תוכנית נאמנות, ארנק שוברים, היסטוריית הזמנות), 
                        עליך ליצור חשבון על ידי מתן:
                      </p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>שם מלא</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>כתובת אימייל תקפה</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>מספר טלפון</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>מידע על חיית המחמד (אופציונלי אך מומלץ)</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Lock} />
                    <h2 className="luxury-heading-md mb-6">9. פרטיות ועיבוד נתונים</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        על ידי שימוש בשירותינו, אתה מסכים לאיסוף, שימוש ועיבוד הנתונים האישיים שלך 
                        כמתואר ב<Link href="/privacy" className="luxury-text-gradient hover:underline">מדיניות הפרטיות</Link> שלנו.
                      </p>
                      <p className="luxury-text-body">
                        מדיניות הפרטיות שלנו תואמת לחוק הגנת הפרטיות (תיקון 13, 2025) ומסבירה:
                      </p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>איזה נתונים אנו אוספים ולמה</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>כיצד אנו משתמשים ומגנים על המידע שלך</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>הזכויות שלך על פי החוק הישראלי (גישה, תיקון, מחיקה, ניידות)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>שימוש בעוגיות ושירותי צד שלישי</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>העברות מידע חוצות גבולות</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Scale} />
                    <h2 className="luxury-heading-md mb-6">10. דין וסמכות שיפוט</h2>
                    <div className="space-y-4">
                      <div className="luxury-glass-panel p-6 border-r-4 border-yellow-500">
                        <p className="luxury-heading-sm mb-3">חוק ישראלי חל</p>
                        <p className="luxury-text-body mb-3">
                          תנאים אלו כפופים ומפורשים בהתאם ל<strong>חוקי מדינת ישראל</strong>, 
                          ללא התחשבות בהוראות ניגוד דינים.
                        </p>
                        <p className="luxury-text-body mb-3">
                          כל סכסוך הנובע משימוש באתר או בשירותינו יהיה כפוף לסמכות השיפוט הבלעדית 
                          של בתי המשפט המוסמכים בישראל.
                        </p>
                        <p className="luxury-text-small">
                          הוראות מחייבות של חוק הגנת הצרכן הישראלי חלות ולא ניתן לוותר עליהן בחוזה.
                        </p>
                      </div>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={AlertTriangle} />
                    <h2 className="luxury-heading-md mb-6">11. הגבלת אחריות</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        במידה המרבית המותרת על פי החוק הישראלי, פט ווש בע"מ לא תהיה אחראית ל:
                      </p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>נזקים עקיפים, מקריים או תוצאתיים הנובעים משימוש בשירות</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>פציעות חיות הנובעות משימוש לא נכון בציוד הרחיצה</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>אובדן נתונים, שוברים או גישה לחשבון עקב רשלנות משתמש</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>הפרעות בשירות עקב אירועי כוח עליון (אסונות טבע, מלחמה, מגיפות)</span>
                        </li>
                      </ul>
                      <p className="luxury-text-small">
                        הגבלה זו לא חלה על אחריות למוות, פגיעה גופנית, הונאה או עניינים אחרים 
                        שבהם לא ניתן להגביל אחריות על פי החוק הישראלי.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Copyright} />
                    <h2 className="luxury-heading-md mb-6">12. קניין רוחני</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        כל התוכן באתר, באפליקציה ובחומרים שלנו (כולל לוגו Pet Wash™, סימנים מסחריים, טקסט, גרפיקה, 
                        תמונות, תוכנה) הם רכושה של פט ווש בע"מ ומוגנים על ידי חוקי קניין רוחני ישראליים ובינלאומיים.
                      </p>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={FileEdit} />
                    <h2 className="luxury-heading-md mb-6">13. תיקונים לתנאים</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        אנו עשויים לעדכן תנאים והגבלות אלה מעת לעת כדי לשקף שינויים בשירותים שלנו, 
                        דרישות חוקיות או נהלים עסקיים.
                      </p>
                      <p className="luxury-text-body font-semibold">הודעה:</p>
                      <p className="luxury-text-body">נודיע לך על שינויים מהותיים באמצעות:</p>
                      <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingRight: '0' }}>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>הודעה בולטת באתר</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>אימייל למשתמשים רשומים</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-purple-600 font-bold mt-1">•</span>
                          <span>הודעה באפליקציה</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Building} />
                    <h2 className="luxury-heading-md mb-6">14. רשות הגנת הצרכן</h2>
                    <div className="space-y-4">
                      <p className="luxury-text-body">
                        אם אתה מאמין שזכויות הצרכן שלך הופרו, תוכל להגיש תלונה ל:
                      </p>
                      <div className="luxury-glass-panel p-6 border-r-4 border-blue-500">
                        <p className="luxury-heading-sm mb-3">לשכת הגנת הצרכן ומסחר הוגן</p>
                        <p className="luxury-text-body mb-2">משרד הכלכלה והתעשייה</p>
                        <p className="luxury-text-body mb-2">
                          אתר: <a href="https://www.gov.il" className="luxury-text-gradient hover:underline">www.gov.il</a>
                        </p>
                        <p className="luxury-text-body">טלפון: *5505</p>
                      </div>
                    </div>
                  </section>

                  <div className="luxury-divider"></div>

                  <section className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-slide-up">
                    <SectionIcon icon={Mail} />
                    <h2 className="luxury-heading-md mb-6">15. פרטי יצירת קשר</h2>
                    <div className="luxury-glass-panel p-8">
                      <p className="luxury-heading-sm mb-6">פט ווש בע"מ</p>
                      <div className="space-y-3">
                        <p className="luxury-text-body"><strong>מספר חברה:</strong> 517145033</p>
                        <p className="luxury-text-body">
                          <strong>אימייל:</strong> <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a>
                        </p>
                        <p className="luxury-text-body">
                          <strong>אתר:</strong> <a href="https://petwash.co.il" className="luxury-text-gradient hover:underline">https://petwash.co.il</a>
                        </p>
                        <p className="luxury-text-body"><strong>כתובת:</strong> ישראל</p>
                        <p className="luxury-text-small mt-4">שעות פעילות: ראשון-חמישי 8:00-18:00 (שעון ישראל)</p>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
