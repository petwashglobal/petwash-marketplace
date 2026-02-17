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
import k9000StationImg from '@assets/D49C7A93-BA54-43A7-A3F6-5FEC96439FE3_1770820255509.png';

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
              <div className="relative mx-auto max-w-sm sm:max-w-lg lg:max-w-2xl">
                <img 
                  src="/hero-image.jpeg"
                  alt="Professional pet washing service with adorable dogs and cats"
                  className="w-full rounded-lg shadow-2xl object-contain h-60 sm:h-80 lg:h-96 mx-auto"
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
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium mb-2 block gold-shimmer-text">⁦Pet Wash™⁩ Ltd</span>
            <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-light text-[#111] mb-2 tracking-tight">
              {t('technology.title', language)}
            </h2>
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent mx-auto mb-3" />
            <p className="text-sm sm:text-base text-[#444] font-light max-w-2xl mx-auto leading-relaxed">
              {t('technology.description', language)}
            </p>
            
            <div className="mt-6 sm:mt-8 max-w-3xl mx-auto">
              <img 
                src={k9000StationImg}
                alt="⁦PetWash™⁩ K9000 Dual Wash Station"
                className="w-full rounded-sm"
                style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.12))' }}
                loading="lazy"
              />
            </div>
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
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#c6a664] font-medium gold-shimmer-text">⁦Pet Wash™⁩ Promise</span>
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


{/* Digital Wallet Section - Removed: Feature not yet active */}

        {/* Loyalty Program Section */}
        <section className="py-12 px-4 sm:py-16 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
              {t('loyalty.title', language)}
            </h2>
            <p className="text-base sm:text-lg text-black mb-8 sm:mb-12 max-w-2xl lg:max-w-3xl mx-auto">
              {t('loyalty.description', language)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
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