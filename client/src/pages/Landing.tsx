import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { WashPackages } from '@/components/WashPackages';
import { GiftCards } from '@/components/GiftCards';
import { Layout } from '@/components/Layout';
import { LuxuryPlatformShowcase } from '@/components/LuxuryPlatformShowcase';
import { LegalFooter } from '@/components/LegalFooter';
import { PetWashDivisions } from '@/components/PetWashDivisions';
import { t, type Language } from '@/lib/i18n';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface LandingProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function Landing({ language, onLanguageChange }: LandingProps) {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  const features = [
    {
      title: t('features.dualStations', language),
      description: t('features.dualStationsDesc', language)
    },
    {
      title: t('features.twoSpeedSettings', language),
      description: t('features.twoSpeedSettingsDesc', language)
    },
    {
      title: t('features.organicProducts', language),
      description: t('features.organicProductsDesc', language)
    },
    {
      title: t('features.ecoProcess', language),
      description: t('features.ecoProcessDesc', language)
    },
    {
      title: t('features.fullBodyRinse', language),
      description: t('features.fullBodyRinseDesc', language)
    }
  ];

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-white">
        {/* Hero Section with Main Image */}
        <section className="pt-[var(--header-height-mobile,148px)] md:pt-[var(--header-height-desktop,92px)] pb-12 px-4 sm:pb-16 sm:px-6 lg:pb-20 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Hero Text Content - ABOVE the image */}
            <div className="text-center px-2 sm:px-4 mb-8 sm:mb-10 lg:mb-12">
              <h1 className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                {t('hero.title', language)}
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-gray-700 mb-6 sm:mb-8">
                {t('hero.subtitle', language)}
              </p>
              <div className="mb-6 sm:mb-8">
                <span className="bg-gray-900 text-white px-4 py-2 sm:px-6 sm:py-3 text-base sm:text-lg font-medium rounded-lg shadow-lg">
                  {t('hero.k9000Tech', language)}
                </span>
              </div>
              <p className="text-base sm:text-lg text-gray-700 max-w-2xl lg:max-w-3xl mx-auto mb-8 sm:mb-12">
                {t('hero.description', language)}
              </p>
              
              {user ? (
                <Button 
                  onClick={() => {
                    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-gray-900 text-white hover:shadow-2xl hover:scale-105 transition-all duration-300 px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-medium shadow-lg"
                >
                  {`${t('nav.welcome', language)} ${user.displayName?.split(' ')[0] || ''}!`}
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button 
                    onClick={() => setLocation('/signup')}
                    className="bg-blue-600 text-white hover:shadow-2xl hover:scale-105 transition-all duration-300 px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-medium w-full sm:w-auto shadow-lg"
                    data-testid="button-signup-hero"
                  >
                    {t('hero.getStarted', language)}
                  </Button>
                  <Button 
                    onClick={() => setLocation('/signin')}
                    variant="outline"
                    className="border-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:border-blue-300 hover:shadow-2xl hover:scale-105 transition-all duration-300 px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-medium w-full sm:w-auto"
                    data-testid="button-login-hero"
                  >
                    {t('landing.login', language)}
                  </Button>
                </div>
              )}
            </div>
            
            {/* Main Hero Image - BELOW the text - Prioritized for LCP */}
            <div className="text-center">
              <img 
                src="/attached_assets/IMG_7114_1751624638881.jpeg"
                alt="Professional pet washing service with adorable dogs and cats"
                className="w-full max-w-sm sm:max-w-lg lg:max-w-2xl mx-auto rounded-lg shadow-lg object-cover h-60 sm:h-80 lg:h-96"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </section>


        {/* Technology Section */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto text-center">
            <div className="p-8 bg-white rounded-2xl border border-blue-100 shadow-xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                {t('technology.title', language)}
              </h2>
              <p className="text-base sm:text-lg text-gray-700 mb-0 max-w-2xl lg:max-w-3xl mx-auto">
                {t('technology.description', language)}
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-center">
              {features.map((feature, index) => (
                <div key={index} className="p-6 bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Organic Promise Section */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
              {t('organic.title', language)}
            </h2>
            <p className="text-base sm:text-lg text-gray-700 mb-8 sm:mb-12 max-w-2xl lg:max-w-3xl mx-auto">
              {t('organic.subtitle', language)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-white rounded-xl border border-blue-100 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  {t('organic.biodegradable', language)}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('organic.biodegradableDesc', language)}
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-cyan-100 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  {t('organic.teaTreeBenefits', language)}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('organic.teaTreeDesc', language)}
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-blue-100 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  {t('organic.ecoFriendly', language)}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('organic.ecoDesc', language)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Wash Packages Section */}
        <div id="packages">
          <WashPackages language={language} />
        </div>

        {/* Gift Cards Section */}
        <GiftCards language={language} />

        {/* Payment Methods Accepted Section - Premium High-Quality Logos */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-8">
              {t('landing.paymentMethods', language)}
            </h2>
            <div className="flex flex-col items-center justify-center gap-8 max-w-5xl mx-auto">
              {/* All Credit Cards & Payment Methods - Ultra HD */}
              <div className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1 border-2 border-gray-100">
                <img 
                  src="/payments/payment-methods.jpg"
                  alt="Accepted Payment Methods: Visa, Mastercard, American Express, Diners Club"
                  className="w-full max-w-4xl h-auto object-contain"
                  loading="lazy"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
              
              {/* Apple Pay & Google Pay - Premium Quality */}
              <div className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1 border-2 border-gray-100">
                <img 
                  src="/payments/apple-google-pay.jpg"
                  alt="Apple Pay and Google Pay Accepted"
                  className="w-full max-w-2xl h-auto object-contain"
                  loading="lazy"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Digital Wallet Download Section */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                {t('landing.downloadVipCard', language)}
              </h2>
              <p className="text-xl text-white/90 max-w-3xl mx-auto">
                {t('landing.vipSubtitle', language)}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Apple Wallet Card */}
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-2 border-white/20 hover:border-white/40 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09l-.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Apple Wallet</h3>
                  <p className="text-white/80 text-sm">
                    {t('landing.foriPhoneiPad', language)}
                  </p>
                </div>
                <Button 
                  onClick={() => setLocation('/wallet')}
                  className="w-full bg-black hover:bg-gray-900 text-white py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all"
                  data-testid="button-homepage-apple-wallet"
                >
                  {t('landing.addAppleWallet', language)}
                </Button>
                <div className="mt-4 flex items-center justify-center gap-2 text-white/70 text-xs">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{t('landing.secured256bit', language)}</span>
                </div>
              </div>

              {/* Google Wallet Card */}
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border-2 border-white/20 hover:border-white/40 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-12 h-12" viewBox="0 0 61 25" fill="white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20.7 9.9c0-.7-.1-1.4-.2-2.1H10.6v4h5.7c-.2 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6z" fill="white"/>
                      <path d="M10.6 21.8c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H1.3v2.7c1.7 3.4 5.2 5.7 9.3 5.7z" fill="white"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Google Wallet</h3>
                  <p className="text-white/80 text-sm">
                    {t('landing.forAndroid', language)}
                  </p>
                </div>
                <Button 
                  onClick={() => setLocation('/wallet')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all"
                  data-testid="button-homepage-google-wallet"
                >
                  {t('landing.addGoogleWallet', language)}
                </Button>
                <div className="mt-4 flex items-center justify-center gap-2 text-white/70 text-xs">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{t('landing.accessibleLockScreen', language)}</span>
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              <Link 
                href="/wallet" 
                className="inline-flex items-center gap-2 text-white hover:text-white/80 transition-colors font-medium"
              >
                {t('landing.learnMoreDigitalCards', language)}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Loyalty Program Section */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
              {t('loyalty.title', language)}
            </h2>
            <p className="text-base sm:text-lg text-gray-700 mb-8 sm:mb-12 max-w-2xl lg:max-w-3xl mx-auto">
              {t('loyalty.description', language)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  {t('loyalty.newMember', language)}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('loyalty.newMemberDesc', language)}
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-blue-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  {t('loyalty.regular', language)}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('loyalty.regularDesc', language)}
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-purple-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  {t('loyalty.senior', language)}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('loyalty.seniorDesc', language)}
                </p>
              </div>
            </div>
            <div className="mt-8">
              <Button 
                onClick={() => {
                  if (user) {
                    // If already logged in, show they're a member
                    alert(`${t('nav.welcome', language)} ${user.displayName?.split(' ')[0] || ''}! You're already a loyalty member.`);
                  } else {
                    setLocation('/signin');
                  }
                }}
                className="bg-blue-600 text-white hover:shadow-2xl hover:scale-105 transition-all duration-300 px-6 py-3 text-base font-medium shadow-lg"
              >
                {user 
                  ? `${t('nav.welcome', language)} ${user.displayName?.split(' ')[0] || ''}!`
                  : t('loyalty.signUp', language)
                }
              </Button>
            </div>
          </div>
        </section>

        {/* PetWash Ltd Group - Our Unique Services */}
        <PetWashDivisions language={language} />

        {/* Legal Footer Section */}
        <LegalFooter language={language} />
      </div>
      
      {/* Luxury Platform Showcase - Shows on first visit */}
      <LuxuryPlatformShowcase language={language} />
    </Layout>
  );
}