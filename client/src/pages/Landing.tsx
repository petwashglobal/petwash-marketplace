import { useLocation, Link } from 'wouter';
import { useEffect, useRef, useState } from 'react';
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
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface LandingProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function Landing({ language, onLanguageChange }: LandingProps) {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const [heroAnimated, setHeroAnimated] = useState(false);
  
  const { ref: techRef, isRevealed: techRevealed } = useScrollReveal<HTMLElement>();
  const { ref: featuresRef, isRevealed: featuresRevealed } = useScrollReveal<HTMLElement>();
  const { ref: organicRef, isRevealed: organicRevealed } = useScrollReveal<HTMLElement>();

  useEffect(() => {
    const timer = setTimeout(() => setHeroAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      title: t('features.dualStations', language),
      description: t('features.dualStationsDesc', language),
      icon: '🏢'
    },
    {
      title: t('features.twoSpeedSettings', language),
      description: t('features.twoSpeedSettingsDesc', language),
      icon: '⚡'
    },
    {
      title: t('features.organicProducts', language),
      description: t('features.organicProductsDesc', language),
      icon: '🌿'
    },
    {
      title: t('features.ecoProcess', language),
      description: t('features.ecoProcessDesc', language),
      icon: '♻️'
    },
    {
      title: t('features.fullBodyRinse', language),
      description: t('features.fullBodyRinseDesc', language),
      icon: '🚿'
    },
    {
      title: t('features.premiumCare', language),
      description: t('features.premiumCareDesc', language),
      icon: '✨'
    }
  ];

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-white">
        {/* Hero Section with Main Image - Luxury Design with Animations */}
        <section className="luxury-services-hero pt-[var(--header-height-mobile,148px)] md:pt-[var(--header-height-desktop,92px)] overflow-hidden">
          <div className="max-w-6xl mx-auto">
            {/* Hero Text Content - ABOVE the image with cascading animations */}
            <div className="luxury-services-hero-content">
              {/* Animated Badge */}
              <div 
                className={`luxury-services-badge transition-all duration-700 ${
                  heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: '0ms' }}
              >
                <span className="gold-shimmer-text">{t('hero.k9000Tech', language)}</span>
              </div>
              
              {/* Animated Title */}
              <h1 
                className={`luxury-services-title transition-all duration-700 ${
                  heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: '150ms' }}
              >
                {t('hero.title', language)}
              </h1>
              
              {/* Animated Subtitle */}
              <p 
                className={`luxury-services-subtitle transition-all duration-700 ${
                  heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: '300ms' }}
              >
                {t('hero.subtitle', language)}
              </p>
              
              {/* Animated Description */}
              <p 
                className={`text-base sm:text-lg text-[#444] font-light max-w-2xl lg:max-w-3xl mx-auto mb-10 sm:mb-14 leading-relaxed transition-all duration-700 ${
                  heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: '450ms' }}
              >
                {t('hero.description', language)}
              </p>
              
              {/* Animated CTA Buttons */}
              <div 
                className={`transition-all duration-700 ${
                  heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: '600ms' }}
              >
                {user ? (
                  <Button 
                    onClick={() => {
                      document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="gold-shimmer-btn text-white px-8 py-4 text-sm uppercase tracking-[0.15em] font-light rounded-none"
                  >
                    {`${t('nav.welcome', language)} ${user.displayName?.split(' ')[0] || ''}!`}
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                    <button 
                      onClick={() => setLocation('/signup')}
                      className="gold-shimmer-btn text-white px-10 py-4 text-sm uppercase tracking-[0.2em] font-light w-full sm:w-auto rounded-none"
                      data-testid="button-signup-hero"
                    >
                      {t('hero.getStarted', language)}
                    </button>
                    <button 
                      onClick={() => setLocation('/signin')}
                      className="bg-transparent text-[#111] border-2 border-[#c6a664] px-10 py-4 text-sm uppercase tracking-[0.2em] font-light hover:bg-[#c6a664] hover:text-white transition-all duration-500 w-full sm:w-auto animate-gold-border"
                      data-testid="button-login-hero"
                    >
                      {t('landing.login', language)}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Main Hero Image - BELOW the text with animation */}
            <div 
              className={`text-center transition-all duration-1000 ${
                heroAnimated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
              }`}
              style={{ transitionDelay: '750ms' }}
            >
              <div className="relative inline-block">
                <img 
                  src="/hero-image.jpeg"
                  alt="Professional pet washing service with adorable dogs and cats"
                  className="w-full max-w-sm sm:max-w-lg lg:max-w-2xl mx-auto rounded-lg shadow-2xl object-cover h-60 sm:h-80 lg:h-96"
                  loading="eager"
                  decoding="async"
                />
                {/* Gold glow effect behind image */}
                <div className="absolute -inset-4 bg-gradient-to-br from-[#c6a664]/20 via-transparent to-[#c6a664]/10 rounded-2xl -z-10 blur-xl animate-gold-pulse" />
              </div>
            </div>
          </div>
        </section>


        {/* PetWash Platforms - Mobile First Position */}
        <div className="block md:hidden">
          <PetWashDivisions language={language} />
        </div>

        {/* Luxury Gold Divider */}
        <div className="relative h-16 bg-gradient-to-b from-white via-[#fdfbf7] to-white overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent" />
            <div className="absolute w-2 h-2 rounded-full bg-[#c6a664]" />
          </div>
        </div>

        {/* Technology Section - Compact with Luxury Background */}
        <section 
          ref={techRef}
          className={`py-8 px-4 sm:py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-[#fdfbf7] via-white to-[#faf8f5] relative overflow-hidden transition-all duration-1000 ${
            techRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          {/* Subtle luxury pattern overlay */}
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 0L60 30L30 60L0 30L30 0z\' fill=\'%23c6a664\' fill-opacity=\'1\'/%3E%3C/svg%3E")', backgroundSize: '30px 30px' }} />
          
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium mb-2 block gold-shimmer-text">Pet Wash™ Ltd</span>
            <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-light text-[#111] mb-2 tracking-tight">
              {t('technology.title', language)}
            </h2>
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto mb-3" />
            <p className="text-sm sm:text-base text-[#444] font-light max-w-2xl mx-auto leading-relaxed">
              {t('technology.description', language)}
            </p>
          </div>
        </section>

        {/* Features Section - Luxury Grid with Icons and Gold Effects */}
        <section 
          ref={featuresRef}
          className="py-6 px-4 sm:py-12 sm:px-6 lg:px-8 bg-white relative"
        >
          {/* Floating gold accents */}
          <div className="absolute top-8 left-8 w-20 h-20 border border-[#c6a664]/10 rotate-45 hidden lg:block" />
          <div className="absolute bottom-8 right-8 w-16 h-16 border border-[#c6a664]/10 rotate-12 hidden lg:block" />
          
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className={`luxury-card text-center group p-4 sm:p-6 rounded-lg transition-all duration-700 relative bg-gradient-to-br from-white to-[#fdfbf7] border border-[#e8e5e0] hover:border-[#c6a664]/50 hover:shadow-lg ${
                    featuresRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  {/* Icon with gold ring */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#fdfbf7] to-white border border-[#c6a664]/30 flex items-center justify-center group-hover:border-[#c6a664] group-hover:scale-110 transition-all duration-500">
                    <span className="text-lg sm:text-xl">{feature.icon}</span>
                  </div>
                  
                  <h3 className="font-serif text-sm sm:text-base font-medium text-[#111] mb-2 tracking-tight group-hover:text-[#c6a664] transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#666] font-light leading-relaxed">
                    {feature.description}
                  </p>
                  
                  {/* Expanding gold line */}
                  <div className="w-6 h-0.5 bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto mt-3 group-hover:w-16 transition-all duration-500" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Luxury Divider with Diamond */}
        <div className="relative h-12 bg-white overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-px bg-gradient-to-r from-transparent via-[#c6a664]/60 to-transparent" />
            <div className="absolute w-3 h-3 rotate-45 border border-[#c6a664] bg-white" />
          </div>
        </div>

        {/* Organic Promise Section - Compact Luxury with Rich Background */}
        <section 
          ref={organicRef}
          className="py-6 px-4 sm:py-10 sm:px-6 lg:px-8 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #fdfbf7 0%, #faf8f5 50%, #f8f6f1 100%)' }}
        >
          {/* Luxury corner ornaments */}
          <div className="absolute top-4 left-4 w-16 h-16 border-t border-l border-[#c6a664]/20" />
          <div className="absolute bottom-4 right-4 w-16 h-16 border-b border-r border-[#c6a664]/20" />
          
          <div className="max-w-6xl mx-auto relative z-10">
            <div 
              className={`text-center mb-6 transition-all duration-1000 ${
                organicRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium gold-shimmer-text">Pet Wash™ Promise</span>
              <h2 className="font-serif text-lg sm:text-2xl lg:text-3xl font-light text-[#111] mt-2 mb-2 tracking-tight">
                {t('organic.title', language)}
              </h2>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto" />
            </div>
            
            {/* Horizontal Timeline Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              {[
                { title: t('organic.biodegradable', language), desc: t('organic.biodegradableDesc', language), num: '01', icon: '🌱' },
                { title: t('organic.teaTreeBenefits', language), desc: t('organic.teaTreeDesc', language), num: '02', icon: '🌿' },
                { title: t('organic.ecoFriendly', language), desc: t('organic.ecoDesc', language), num: '03', icon: '🌍' }
              ].map((item, index) => (
                <div 
                  key={index}
                  className={`text-center group p-3 sm:p-5 relative bg-white/80 backdrop-blur-sm rounded-lg border border-[#e8e5e0] hover:border-[#c6a664]/50 hover:shadow-md transition-all duration-700 ${
                    organicRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ transitionDelay: `${100 + index * 100}ms` }}
                >
                  {/* Icon + Number combined */}
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-lg sm:text-2xl">{item.icon}</span>
                    <span className="text-[10px] sm:text-xs text-[#c6a664] font-light">{item.num}</span>
                  </div>
                  
                  <h3 className="font-serif text-xs sm:text-sm font-medium text-[#111] mb-1 tracking-tight group-hover:text-[#c6a664] transition-colors duration-300 line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-[#666] font-light leading-relaxed line-clamp-3 hidden sm:block">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wash Packages Section */}
        <div id="packages">
          <WashPackages language={language} />
        </div>

        {/* Gift Cards Section */}
        <GiftCards language={language} />


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