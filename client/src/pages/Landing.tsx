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
  const { user, claims } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  const getDashboardPath = (): string => {
    if (!user) return '/signin';
    const role = claims?.role;
    const ADMIN_ROLES = ['staff', 'admin', 'management', 'super_admin'];
    if (role === 'provider') return '/provider/dashboard';
    if (ADMIN_ROLES.includes(role ?? '')) return '/dashboard';
    // Email-based fallback: if Firebase claim hasn't been written yet (first login
    // or token not yet refreshed), use the email list that mirrors the server check.
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || 'nirhadad1@gmail.com,nir.h@petwash.co.il,ceo@petwash.co.il')
      .split(',').map((e: string) => e.trim().toLowerCase());
    if (user.email && adminEmails.includes(user.email.toLowerCase())) return '/dashboard';
    return '/my-account';
  };
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
        <section className="luxury-services-hero overflow-hidden">
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
                className={`text-base sm:text-lg text-[#444] font-light max-w-2xl lg:max-w-3xl mx-auto mb-6 sm:mb-8 leading-relaxed transition-all duration-700 ${
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
                    onClick={() => setLocation(getDashboardPath())}
                    className="gold-shimmer-btn text-white px-8 py-4 text-sm uppercase tracking-[0.15em] font-light rounded-none"
                  >
                    {`${t('nav.welcome', language)} ${user.displayName?.split(' ')[0] || ''}!`}
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                    <Button 
                      onClick={() => setLocation('/signup')}
                      className="gold-shimmer-btn text-white px-10 py-4 text-sm uppercase tracking-[0.2em] font-light w-full sm:w-auto rounded-none"
                      data-testid="button-signup-hero"
                    >
                      {t('hero.getStarted', language)}
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => setLocation('/signin')}
                      className="bg-transparent text-[#111] border-2 border-[#c6a664] px-10 py-4 text-sm uppercase tracking-[0.2em] font-light hover:bg-[#c6a664] hover:text-white transition-all duration-500 w-full sm:w-auto animate-gold-border rounded-none"
                      data-testid="button-login-hero"
                    >
                      {t('landing.login', language)}
                    </Button>
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
                  className="w-full object-contain h-60 sm:h-80 lg:h-96 mx-auto"
                  style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.14))' }}
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
        <div className="relative h-3 bg-white overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-px bg-gradient-to-r from-transparent via-[#c6a664] to-transparent" />
          </div>
        </div>

        {/* Technology Section - Compact with Luxury Background */}
        <section 
          ref={techRef}
          className={`py-4 px-4 sm:py-8 sm:px-6 lg:px-8 bg-white relative overflow-hidden transition-all duration-1000 ${
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
          className="py-4 px-4 sm:py-8 sm:px-6 lg:px-8 bg-white relative"
        >
          {/* Floating gold accents */}
          <div className="absolute top-8 left-8 w-20 h-20 border border-[#c6a664]/10 rotate-45 hidden lg:block" />
          <div className="absolute bottom-8 right-8 w-16 h-16 border border-[#c6a664]/10 rotate-12 hidden lg:block" />
          
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className={`text-center group p-4 sm:p-6 transition-all duration-700 relative bg-white ${
                    featuresRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#fdfbf7] to-white flex items-center justify-center group-hover:scale-110 transition-all duration-500" style={{ boxShadow: '0 4px 16px rgba(198,166,100,0.12)' }}>
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

        {/* Luxury Divider */}
        <div className="relative h-3 bg-white overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-px bg-gradient-to-r from-transparent via-[#c6a664]/60 to-transparent" />
          </div>
        </div>

        {/* Organic Promise Section - Compact Luxury with Rich Background */}
        <section 
          ref={organicRef}
          className="py-4 px-4 sm:py-6 sm:px-6 lg:px-8 relative overflow-hidden"
          style={{ background: '#FFFFFF' }}
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
                  className={`text-center group p-3 sm:p-5 relative bg-white transition-all duration-700 ${
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
        <section className="py-16 px-4 sm:py-24 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-14">
              <p className="text-[10px] font-light tracking-[5px] uppercase mb-4 text-[#C6A664]"
                style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", letterSpacing: '0.35em' }}>
                PET WASH PRESTIGE™
              </p>
              <h2 className="text-3xl sm:text-4xl font-light text-[#0A0A0A] mb-4"
                style={{ fontFamily: "'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif" }}>
                {t('loyalty.title', language)}
              </h2>
              {/* Metallic rule */}
              <div className="flex justify-center my-5">
                <div className="w-16 h-[1px]"
                  style={{ background: 'linear-gradient(90deg,transparent,#C6A664 30%,#E8D5A0 50%,#C6A664 70%,transparent)' }} />
              </div>
              <p className="text-sm font-light text-[#6B7280] max-w-2xl mx-auto leading-relaxed"
                style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                {t('loyalty.description', language)}
              </p>
            </div>

            {/* Tier cards — no borders, pure white with shadow lift */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#F5F5F5]">
              {/* Silver */}
              <div className="group bg-white p-8 sm:p-10 text-center transition-all duration-500 hover:-translate-y-1"
                style={{ boxShadow: '0 0 0 0 transparent', transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.09)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 0 transparent')}
              >
                {/* Tier indicator — thin metallic top strip */}
                <div className="w-12 h-[2px] mx-auto mb-7"
                  style={{ background: 'linear-gradient(90deg,#9CA3AF,#E5E7EB,#9CA3AF)' }} />
                <span className="text-[9px] font-light tracking-[4px] uppercase text-[#9CA3AF] block mb-3"
                  style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                  Silver
                </span>
                <h3 className="text-lg font-light text-[#0A0A0A] mb-4"
                  style={{ fontFamily: "'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif" }}>
                  {t('loyalty.newMember', language)}
                </h3>
                <p className="text-sm font-light text-[#6B7280] leading-relaxed"
                  style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                  {t('loyalty.newMemberDesc', language)}
                </p>
              </div>

              {/* Gold */}
              <div className="group bg-white p-8 sm:p-10 text-center transition-all duration-500 hover:-translate-y-1"
                style={{ boxShadow: '0 0 0 0 transparent', transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.09)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 0 transparent')}
              >
                <div className="w-12 h-[2px] mx-auto mb-7"
                  style={{ background: 'linear-gradient(90deg,#C6A664,#E8D5A0,#C6A664)' }} />
                <span className="text-[9px] font-light tracking-[4px] uppercase block mb-3"
                  style={{
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    background: 'linear-gradient(90deg,#C6A664,#D4AF37,#C6A664)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                  Gold
                </span>
                <h3 className="text-lg font-light text-[#0A0A0A] mb-4"
                  style={{ fontFamily: "'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif" }}>
                  {t('loyalty.regular', language)}
                </h3>
                <p className="text-sm font-light text-[#6B7280] leading-relaxed"
                  style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                  {t('loyalty.regularDesc', language)}
                </p>
              </div>

              {/* Platinum */}
              <div className="group bg-white p-8 sm:p-10 text-center transition-all duration-500 hover:-translate-y-1"
                style={{ boxShadow: '0 0 0 0 transparent', transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.09)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 0 transparent')}
              >
                <div className="w-12 h-[2px] mx-auto mb-7"
                  style={{ background: 'linear-gradient(90deg,#00C569,#00E87A,#00C569)' }} />
                <span className="text-[9px] font-light tracking-[4px] uppercase block mb-3"
                  style={{
                    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    background: 'linear-gradient(90deg,#00C569,#00E87A,#00C569)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                  Platinum
                </span>
                <h3 className="text-lg font-light text-[#0A0A0A] mb-4"
                  style={{ fontFamily: "'Didot', 'Bodoni MT', 'Hoefler Text', Georgia, serif" }}>
                  {t('loyalty.senior', language)}
                </h3>
                <p className="text-sm font-light text-[#6B7280] leading-relaxed"
                  style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                  {t('loyalty.seniorDesc', language)}
                </p>
              </div>
            </div>

            <div className="mt-12 text-center">
              <Button
                onClick={() => setLocation(user ? getDashboardPath() : '/signin')}
                className="h-14 px-12 rounded-none text-white text-[11px] font-light tracking-[3px] uppercase"
                style={{
                  background: 'linear-gradient(135deg,#C6A664 0%,#D4AF37 50%,#C6A664 100%)',
                  backgroundSize: '200% 200%',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  letterSpacing: '0.2em',
                  boxShadow: '0 8px 32px rgba(198,166,100,0.3)',
                }}
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