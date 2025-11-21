import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { t, type Language } from '@/lib/i18n';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  Briefcase, 
  UserCheck, 
  CreditCard, 
  Gift, 
  RotateCcw, 
  AlertTriangle, 
  FileEdit, 
  Mail
} from 'lucide-react';
import { Link } from 'wouter';

export default function TermsAndConditions() {
  const [language, setLanguage] = useState<Language>('en');

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

  const SectionIcon = ({ icon: Icon, delay = 0 }: { icon: any; delay?: number }) => (
    <div 
      className={`w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-4 luxury-animate-scale-in`}
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
                  Back to Home
                </Button>
              </Link>
            </div>

            {/* Header */}
            <div className="text-center mb-12 luxury-animate-slide-up">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-lg">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <h1 className="luxury-heading-xl mb-4">
                Terms and Conditions
              </h1>
              <p className="luxury-text-body mb-4">
                Pet Wash Ltd - Company Number: 517145033
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="luxury-badge luxury-badge-gold">
                  Last updated: {new Date().toLocaleDateString()}
                </span>
                <span className="luxury-badge luxury-badge-success">
                  Israeli Law Compliant
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
              {/* Section 1 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-1">
                <SectionIcon icon={CheckCircle} delay={1} />
                <h2 className="luxury-heading-md mb-6">1. Agreement to Terms</h2>
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
                <SectionIcon icon={Briefcase} delay={2} />
                <h2 className="luxury-heading-md mb-6">2. Use of Services</h2>
                <div className="space-y-4">
                  <p className="luxury-text-body">
                    Pet Wash™ provides access to 8 integrated platforms: Pet Wash Stations, Pet Sitter Suite,
                    Walk My Pet, PetTrek Transport, Pet Wash Academy, Pet Wash Shop, Loyalty & VIP Club, and Avatar Studio.
                  </p>
                  <p className="luxury-text-body">
                    All services are subject to availability and may be modified, suspended, or discontinued at our discretion 
                    with reasonable notice to users.
                  </p>
                </div>
              </section>

              <div className="luxury-divider"></div>

              {/* Section 3 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-3">
                <SectionIcon icon={UserCheck} delay={3} />
                <h2 className="luxury-heading-md mb-6">3. User Accounts</h2>
                <div className="space-y-4">
                  <p className="luxury-text-body">
                    Users must create a Pet Wash Hub™ account to access services. You are responsible for
                    maintaining the security of your account credentials.
                  </p>
                  <p className="luxury-text-body">
                    You must provide accurate and complete information during registration. Failure to do so may 
                    result in account suspension or termination.
                  </p>
                  <p className="luxury-text-small">
                    Account credentials are personal and confidential. You are prohibited from sharing your account 
                    with others or allowing unauthorized access.
                  </p>
                </div>
              </section>

              <div className="luxury-divider"></div>

              {/* Section 4 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-4">
                <SectionIcon icon={CreditCard} delay={4} />
                <h2 className="luxury-heading-md mb-6">4. Bookings and Payments</h2>
                <div className="space-y-4">
                  <p className="luxury-text-body">
                    All bookings are subject to availability. Payments are processed through our secure payment
                    gateway (Nayax Israel) with 72-hour escrow protection.
                  </p>
                  <div className="luxury-glass-panel p-6 border-l-4 border-blue-500">
                    <p className="luxury-heading-sm mb-3">Accepted Payment Methods</p>
                    <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                      <li className="flex items-start gap-3">
                        <span className="text-purple-600 font-bold">•</span>
                        <span>Credit Cards: Visa, Mastercard, American Express</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-purple-600 font-bold">•</span>
                        <span>Digital Wallets: Apple Pay, Google Pay</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-purple-600 font-bold">•</span>
                        <span>E-Vouchers: Prepaid digital vouchers with QR code</span>
                      </li>
                    </ul>
                  </div>
                  <p className="luxury-text-small">
                    All prices include Israeli VAT (18%) unless stated otherwise. Prices are subject to change 
                    with 30 days' notice.
                  </p>
                </div>
              </section>

              <div className="luxury-divider"></div>

              {/* Section 5 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-5">
                <SectionIcon icon={Gift} delay={5} />
                <h2 className="luxury-heading-md mb-6">5. Loyalty Program</h2>
                <div className="space-y-4">
                  <p className="luxury-text-body">
                    The Loyalty & VIP Club program is subject to additional terms. Rewards and benefits may
                    change at Pet Wash's discretion with reasonable notice to members.
                  </p>
                  <p className="luxury-text-body">
                    Loyalty points have no cash value and cannot be transferred, sold, or redeemed for cash. 
                    Points expire after 24 months of account inactivity.
                  </p>
                  <p className="luxury-text-small">
                    Pet Wash reserves the right to modify tier benefits, point values, and program structure 
                    with 60 days' notice to active members.
                  </p>
                </div>
              </section>

              <div className="luxury-divider"></div>

              {/* Section 6 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-6">
                <SectionIcon icon={RotateCcw} delay={6} />
                <h2 className="luxury-heading-md mb-6">6. Cancellation Policy</h2>
                <div className="space-y-4">
                  <div className="luxury-glass-panel p-6 border-l-4 border-green-500">
                    <p className="luxury-heading-sm mb-3">Your Cancellation Rights</p>
                    <p className="luxury-text-body mb-3">
                      Under Israeli Consumer Protection Law (5741-1981), you have the right to cancel purchases 
                      made through distance selling (website, phone, mobile app) within:
                    </p>
                    <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                      <li className="flex items-start gap-3">
                        <span className="text-green-600 font-bold">•</span>
                        <span><strong>Standard consumers:</strong> 14 days from transaction date</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-600 font-bold">•</span>
                        <span><strong>Protected groups:</strong> 4 months from transaction date (seniors 65+, persons with disabilities, new immigrants)</span>
                      </li>
                    </ul>
                  </div>
                  <p className="luxury-text-body">
                    Cancellation policies vary by service. Please review service-specific terms before booking. 
                    Maximum cancellation fee: 5% of transaction value OR ₪100 (whichever is lower).
                  </p>
                  <p className="luxury-text-small">
                    To cancel, email <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a> with 
                    subject line "[CANCELLATION REQUEST]" including your order number and transaction details.
                  </p>
                </div>
              </section>

              <div className="luxury-divider"></div>

              {/* Section 7 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-7">
                <SectionIcon icon={AlertTriangle} delay={7} />
                <h2 className="luxury-heading-md mb-6">7. Limitation of Liability</h2>
                <div className="space-y-4">
                  <p className="luxury-text-body">
                    Pet Wash™ is not liable for indirect, incidental, or consequential damages arising from
                    use of our services, except as required by Israeli law.
                  </p>
                  <div className="luxury-glass-panel p-6 border-l-4 border-yellow-500">
                    <p className="luxury-text-body mb-2">
                      <strong>Important:</strong> While we maintain high safety standards, pet owners are responsible 
                      for their pets during self-service washing. Pet Wash Ltd is not liable for:
                    </p>
                    <ul className="space-y-2 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                      <li className="flex items-start gap-3">
                        <span className="text-yellow-600 font-bold">•</span>
                        <span>Injuries to pets or persons caused by pet behavior</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-yellow-600 font-bold">•</span>
                        <span>Pre-existing pet health conditions</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-yellow-600 font-bold">•</span>
                        <span>Misuse of equipment or washing products</span>
                      </li>
                    </ul>
                  </div>
                  <p className="luxury-text-small">
                    Our maximum liability for any claim is limited to the amount paid for the specific service 
                    that gave rise to the claim.
                  </p>
                </div>
              </section>

              <div className="luxury-divider"></div>

              {/* Section 8 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-8">
                <SectionIcon icon={FileEdit} delay={8} />
                <h2 className="luxury-heading-md mb-6">8. Changes to Terms</h2>
                <div className="space-y-4">
                  <p className="luxury-text-body">
                    We reserve the right to modify these terms at any time. Material changes will be communicated 
                    to users via email or in-app notification at least 30 days before taking effect.
                  </p>
                  <p className="luxury-text-body">
                    Continued use of services after changes take effect constitutes acceptance of updated terms. 
                    If you do not agree with changes, you may terminate your account.
                  </p>
                  <p className="luxury-text-small">
                    The "Last Updated" date at the top of this page indicates the most recent revision. 
                    We recommend reviewing these terms periodically.
                  </p>
                </div>
              </section>

              <div className="luxury-divider"></div>

              {/* Section 9 */}
              <section className="luxury-glass-card luxury-shadow-md p-8 luxury-animate-slide-up luxury-delay-9">
                <SectionIcon icon={Mail} delay={9} />
                <h2 className="luxury-heading-md mb-6">9. Contact</h2>
                <div className="space-y-4">
                  <p className="luxury-text-body">
                    For questions about these terms, contact us at:
                  </p>
                  <div className="luxury-glass-panel p-6">
                    <ul className="space-y-3 luxury-text-body" style={{ listStyle: 'none', paddingLeft: '0' }}>
                      <li className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-purple-600 mt-1" />
                        <div>
                          <strong>Legal Inquiries:</strong> <a href="mailto:legal@petwash.co.il" className="luxury-text-gradient hover:underline">legal@petwash.co.il</a>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-purple-600 mt-1" />
                        <div>
                          <strong>Customer Support:</strong> <a href="mailto:Support@PetWash.co.il" className="luxury-text-gradient hover:underline">Support@PetWash.co.il</a>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <p className="luxury-text-small text-center mt-8">
                    Pet Wash Ltd • Company Number: 517145033 • Registered in Israel
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
