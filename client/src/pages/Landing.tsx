import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { WashPackages } from '@/components/WashPackages';
import { GiftCards } from '@/components/GiftCards';
import { Layout } from '@/components/Layout';
import { LegalFooter } from '@/components/LegalFooter';
import { PetWashDivisions } from '@/components/PetWashDivisions';
import { LuxuryPageWrapper, LuxuryCardGrid, LuxuryFeatureCard } from '@/components/LuxuryThemeWrapper';
import ProviderRegistrationBanner from '@/components/ProviderRegistrationBanner';
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
        {/* Hero Section with Main Image - Luxury Design */}
        <section className="luxury-services-hero pt-[var(--header-height-mobile,148px)] md:pt-[var(--header-height-desktop,92px)]">
          <div className="max-w-6xl mx-auto">
            {/* Hero Text Content - ABOVE the image */}
            <div className="luxury-services-hero-content">
              <div className="luxury-services-badge">
                {t('hero.k9000Tech', language)}
              </div>
              <h1 className="luxury-services-title">
                {t('hero.title', language)}
              </h1>
              <p className="luxury-services-subtitle">
                {t('hero.subtitle', language)}
              </p>
              <p className="text-base sm:text-lg text-[#444] font-light max-w-2xl lg:max-w-3xl mx-auto mb-10 sm:mb-14 leading-relaxed">
                {t('hero.description', language)}
              </p>
              
              {user ? (
                <Button 
                  onClick={() => {
                    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-[#111] text-white hover:bg-black transition-all duration-500 px-8 py-4 text-sm uppercase tracking-[0.15em] font-light"
                >
                  {`${t('nav.welcome', language)} ${user.displayName?.split(' ')[0] || ''}!`}
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <button 
                    onClick={() => setLocation('/signup')}
                    className="bg-[#111] text-white px-10 py-4 text-sm uppercase tracking-[0.2em] font-light hover:bg-black transition-all duration-500 w-full sm:w-auto"
                    data-testid="button-signup-hero"
                  >
                    {t('hero.getStarted', language)}
                  </button>
                  <button 
                    onClick={() => setLocation('/signin')}
                    className="bg-transparent text-[#111] border border-[#111] px-10 py-4 text-sm uppercase tracking-[0.2em] font-light hover:bg-[#111] hover:text-white transition-all duration-500 w-full sm:w-auto"
                    data-testid="button-login-hero"
                  >
                    {t('landing.login', language)}
                  </button>
                </div>
              )}
            </div>
            
            {/* Main Hero Image - BELOW the text - Prioritized for LCP */}
            <div className="text-center">
              <img 
                src="/hero-image.jpeg"
                alt="Professional pet washing service with adorable dogs and cats"
                className="w-full max-w-sm sm:max-w-lg lg:max-w-2xl mx-auto rounded-lg shadow-lg object-cover h-60 sm:h-80 lg:h-96"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </section>


        {/* PetWash Platforms - Mobile First Position */}
        <div className="block md:hidden">
          <PetWashDivisions language={language} />
        </div>

        {/* Technology Section - Pure White with Gold Accents */}
        <section className="py-6 px-4 sm:py-20 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-5xl mx-auto text-center">
            {/* Gold accent label */}
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium mb-3 block">Pet Wash™ Ltd</span>
            <h2 className="font-serif text-xl sm:text-3xl lg:text-4xl font-light text-[#111] mb-3 sm:mb-4 tracking-tight">
              {t('technology.title', language)}
            </h2>
            <div className="w-12 sm:w-16 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto mb-4 sm:mb-6" />
            <p className="text-sm sm:text-lg text-[#444] font-light max-w-2xl lg:max-w-3xl mx-auto leading-relaxed">
              {t('technology.description', language)}
            </p>
          </div>
        </section>

        {/* Features Section - Couture Minimal Grid with Gold Accents */}
        <section className="py-6 px-4 sm:py-20 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-10">
              {features.map((feature, index) => (
                <div key={index} className="text-center group p-4 sm:p-6 border border-[#f0ebe0] hover:border-[#c6a664] transition-all duration-500">
                  <h3 className="font-serif text-lg font-medium text-[#111] mb-2 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#666] font-light leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="w-8 h-px bg-[#c6a664] mx-auto mt-3 group-hover:w-16 transition-all duration-500" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Organic Promise Section - Luxury Editorial with Gold */}
        <section className="py-8 px-4 sm:py-20 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium">Pet Wash™ Promise</span>
              <h2 className="font-serif text-xl sm:text-3xl lg:text-4xl font-light text-[#111] mt-3 mb-3 tracking-tight">
                {t('organic.title', language)}
              </h2>
              <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto mb-4" />
              <p className="text-sm sm:text-base text-[#555] font-light max-w-2xl mx-auto leading-relaxed">
                {t('organic.subtitle', language)}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-12">
              <div className="text-center group p-4">
                <div className="w-px h-8 bg-gradient-to-b from-[#c6a664] to-transparent mx-auto mb-4" />
                <h3 className="font-serif text-base sm:text-lg font-medium text-[#111] mb-2 tracking-tight">
                  {t('organic.biodegradable', language)}
                </h3>
                <p className="text-sm text-[#666] font-light leading-relaxed">
                  {t('organic.biodegradableDesc', language)}
                </p>
              </div>
              <div className="text-center group p-4">
                <div className="w-px h-8 bg-gradient-to-b from-[#c6a664] to-transparent mx-auto mb-4" />
                <h3 className="font-serif text-base sm:text-lg font-medium text-[#111] mb-2 tracking-tight">
                  {t('organic.teaTreeBenefits', language)}
                </h3>
                <p className="text-sm text-[#666] font-light leading-relaxed">
                  {t('organic.teaTreeDesc', language)}
                </p>
              </div>
              <div className="text-center group p-4">
                <div className="w-px h-8 bg-gradient-to-b from-[#c6a664] to-transparent mx-auto mb-4" />
                <h3 className="font-serif text-base sm:text-lg font-medium text-[#111] mb-2 tracking-tight">
                  {t('organic.ecoFriendly', language)}
                </h3>
                <p className="text-sm text-[#666] font-light leading-relaxed">
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

        {/* Payment Methods Accepted Section - Pure White with Gold */}
        <section className="py-6 px-4 sm:py-16 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6 sm:mb-10">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium mb-3 block">Secure Payments</span>
              <h2 className="font-serif text-xl sm:text-3xl font-light text-[#111] mb-2 tracking-tight">
                {t('payment.title', language)}
              </h2>
              <p className="text-sm sm:text-base text-[#555] font-light">
                {t('payment.subtitle', language)}
              </p>
            </div>
            
            {/* Premium Payment Icons - Luxury Minimal Style */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 items-center justify-items-center max-w-4xl mx-auto">
              {/* Visa */}
              <div className="w-24 h-14 sm:w-28 sm:h-16 bg-white border border-[#e5e5e5] rounded-lg flex items-center justify-center p-3 hover:border-[#c6a664] hover:shadow-md transition-all duration-300">
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6 sm:h-8 w-auto object-contain" />
              </div>

              {/* Mastercard */}
              <div className="w-24 h-14 sm:w-28 sm:h-16 bg-white border border-[#e5e5e5] rounded-lg flex items-center justify-center p-3 hover:border-[#c6a664] hover:shadow-md transition-all duration-300">
                <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-8 sm:h-10 w-auto object-contain" />
              </div>

              {/* American Express */}
              <div className="w-24 h-14 sm:w-28 sm:h-16 bg-white border border-[#e5e5e5] rounded-lg flex items-center justify-center p-3 hover:border-[#c6a664] hover:shadow-md transition-all duration-300">
                <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg" alt="American Express" className="h-6 sm:h-8 w-auto object-contain" />
              </div>

              {/* Apple Pay */}
              <div className="w-24 h-14 sm:w-28 sm:h-16 bg-white border border-[#e5e5e5] rounded-lg flex items-center justify-center p-3 hover:border-[#c6a664] hover:shadow-md transition-all duration-300">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Apple_Pay_logo.svg" alt="Apple Pay" className="h-6 sm:h-8 w-auto object-contain" />
              </div>

              {/* Google Pay */}
              <div className="w-24 h-14 sm:w-28 sm:h-16 bg-white border border-[#e5e5e5] rounded-lg flex items-center justify-center p-3 hover:border-[#c6a664] hover:shadow-md transition-all duration-300">
                <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" alt="Google Pay" className="h-6 sm:h-8 w-auto object-contain" />
              </div>

              {/* Diners Club */}
              <div className="w-24 h-14 sm:w-28 sm:h-16 bg-white border border-[#e5e5e5] rounded-lg flex items-center justify-center p-3 hover:border-[#c6a664] hover:shadow-md transition-all duration-300">
                <img src="https://upload.wikimedia.org/wikipedia/commons/a/a6/Diners_Club_Logo3.svg" alt="Diners Club" className="h-6 sm:h-8 w-auto object-contain" />
              </div>
            </div>
            
            {/* Trust Badge - Luxury Minimal */}
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-3 px-8 py-4">
                <div className="w-px h-4 bg-[#e6e6e6]" />
                <svg className="w-4 h-4 text-[#888]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs uppercase tracking-[0.15em] text-[#666] font-light">
                  {t('payment.secureCheckout', language)}
                </span>
                <div className="w-px h-4 bg-[#e6e6e6]" />
              </div>
            </div>
          </div>
        </section>

        {/* Digital Wallet Download Section */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-black keep-bg" data-keep-bg="true">
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
                  className="w-full bg-black hover:bg-black text-white py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all"
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
                  <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-12 h-12" viewBox="0 0 61 25" fill="black" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20.7 9.9c0-.7-.1-1.4-.2-2.1H10.6v4h5.7c-.2 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6z" fill="black"/>
                      <path d="M10.6 21.8c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H1.3v2.7c1.7 3.4 5.2 5.7 9.3 5.7z" fill="black"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Google Wallet</h3>
                  <p className="text-white/80 text-sm">
                    {t('landing.forAndroid', language)}
                  </p>
                </div>
                <Button 
                  onClick={() => setLocation('/wallet')}
                  className="w-full bg-white hover:bg-white text-black border border-black py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all"
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
            <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
              {t('loyalty.title', language)}
            </h2>
            <p className="text-base sm:text-lg text-black mb-8 sm:mb-12 max-w-2xl lg:max-w-3xl mx-auto">
              {t('loyalty.description', language)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-white rounded-xl border border-black shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-black mb-3">
                  {t('loyalty.newMember', language)}
                </h3>
                <p className="text-sm text-black">
                  {t('loyalty.newMemberDesc', language)}
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-black shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-black mb-3">
                  {t('loyalty.regular', language)}
                </h3>
                <p className="text-sm text-black">
                  {t('loyalty.regularDesc', language)}
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-amber-200 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300">
                <h3 className="text-base font-semibold text-black mb-3">
                  {t('loyalty.senior', language)}
                </h3>
                <p className="text-sm text-black">
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
                className="bg-black text-white hover:bg-black hover:shadow-2xl hover:scale-105 transition-all duration-300 px-6 py-3 text-base font-medium shadow-lg"
              >
                {user 
                  ? `${t('nav.welcome', language)} ${user.displayName?.split(' ')[0] || ''}!`
                  : t('loyalty.signUp', language)
                }
              </Button>
            </div>
          </div>
        </section>

        {/* PetWash Ltd Group - Our Unique Services (Desktop Only - Mobile shows at top) */}
        <div className="hidden md:block">
          <PetWashDivisions language={language} />
        </div>

        {/* Provider Registration - Join Our Team */}
        <ProviderRegistrationBanner variant="hero" platform="all" />

        {/* Legal Footer Section */}
        <LegalFooter language={language} />
      </div>
    </Layout>
  );
}