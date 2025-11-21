import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { GlassmorphismCard, LuxuryButton } from '@/components/luxury/GlassmorphismCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Heart,
  Users,
  Gift,
  Calendar,
  Crown,
  TrendingUp,
  HandHeart,
  Building,
  Sparkles,
  Award,
  Home,
  Star,
  ArrowRight,
  Check
} from 'lucide-react';

interface CounterProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

function AnimatedCounter({ end, duration = 2000, suffix = '', prefix = '' }: CounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return (
    <span className="font-bold">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

export default function GlobalCommunityHub() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';

  const programs = [
    {
      icon: HandHeart,
      titleKey: 'communityHub.disabilityTitle',
      discountKey: 'communityHub.disabilityDiscount',
      descriptionKey: 'communityHub.disabilityDescription',
      gradient: 'blue',
      discount: '50%',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Users,
      titleKey: 'communityHub.seniorTitle',
      discountKey: 'communityHub.seniorDiscount',
      descriptionKey: 'communityHub.seniorDescription',
      gradient: 'purple',
      discount: '40%',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Award,
      titleKey: 'communityHub.veteranTitle',
      discountKey: 'communityHub.veteranDiscount',
      descriptionKey: 'communityHub.veteranDescription',
      gradient: 'gold',
      discount: '35%',
      color: 'from-amber-500 to-orange-500'
    },
    {
      icon: Home,
      titleKey: 'communityHub.shelterTitle',
      discountKey: 'communityHub.shelterDiscount',
      descriptionKey: 'communityHub.shelterDescription',
      gradient: 'green',
      discount: 'FREE',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  const impactStats = [
    {
      value: 12847,
      labelKey: 'communityHub.petsHelped',
      icon: Heart,
      color: 'text-pink-500',
      prefix: ''
    },
    {
      value: 425000,
      labelKey: 'communityHub.donatedValue',
      icon: Gift,
      color: 'text-blue-500',
      prefix: '₪'
    },
    {
      value: 34,
      labelKey: 'communityHub.sheltersPartnered',
      icon: Building,
      color: 'text-purple-500',
      prefix: ''
    },
    {
      value: 156,
      labelKey: 'communityHub.volunteersActive',
      icon: Users,
      color: 'text-green-500',
      prefix: ''
    }
  ];

  return (
    <Layout>
      <div className={`min-h-screen luxury-bg-mesh ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        
        {/* Hero Section - Lime/Green Social Good Theme */}
        <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-lime-50 via-green-50 to-emerald-100 dark:from-gray-900 dark:via-green-900/20 dark:to-gray-900 py-20 px-4">
          {/* Animated Background Gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,200,120,0.1),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(100,180,100,0.15),rgba(255,255,255,0))]" />
          
          <div className="relative z-10 max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge 
                className="mb-6 text-lg px-6 py-2 bg-gradient-to-r from-green-600 to-lime-600 text-white border-0"
                data-testid="badge-heroes-2025"
              >
                <Sparkles className="w-5 h-5 mr-2 inline" />
                {t('communityHub.heroTitle')}
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-green-600 via-lime-600 to-emerald-600 bg-clip-text text-transparent">
                {t('communityHub.title')}
              </h1>
              
              <p className="text-2xl md:text-3xl text-gray-700 dark:text-gray-200 font-medium mb-4">
                {t('communityHub.subtitle')}
              </p>
              
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-10">
                {t('communityHub.heroDescription')}
              </p>

              {/* Hero CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <LuxuryButton
                  variant="primary"
                  size="lg"
                  className="bg-gradient-to-r from-green-600 via-lime-600 to-emerald-600 hover:from-green-700 hover:via-lime-700 hover:to-emerald-700"
                  testId="button-apply-support"
                >
                  <HandHeart className="w-5 h-5 mr-2" />
                  {t('communityHub.applyButton')}
                </LuxuryButton>
                
                <LuxuryButton
                  variant="secondary"
                  size="lg"
                  testId="button-partner"
                >
                  <Building className="w-5 h-5 mr-2" />
                  {t('communityHub.partnerButton')}
                </LuxuryButton>
                
                <LuxuryButton
                  variant="secondary"
                  size="lg"
                  testId="button-donate"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  {t('communityHub.donateButton')}
                </LuxuryButton>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Community Programs Grid */}
        <section className="py-20 px-4 luxury-bg-mesh">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                {t('communityHub.heroSubtitle')}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {programs.map((program, index) => {
                const Icon = program.icon;
                return (
                  <motion.div
                    key={program.titleKey}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className={`luxury-animate-fade-in luxury-delay-${index + 1}`}
                  >
                    <GlassmorphismCard
                      gradient={program.gradient as any}
                      className="h-full p-8 group luxury-glass-card"
                      hover
                    >
                      <div className="flex items-start gap-6">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${program.color} p-4 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                              {t(program.titleKey)}
                            </h3>
                            <Badge className={`text-lg px-4 py-1 bg-gradient-to-r ${program.color} text-white border-0`}>
                              {t(program.discountKey)}
                            </Badge>
                          </div>
                          
                          <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                            {t(program.descriptionKey)}
                          </p>
                          
                          <button
                            className="mt-6 text-green-600 dark:text-green-400 font-semibold flex items-center gap-2 group-hover:gap-3 transition-all"
                            data-testid={`button-learn-more-${index}`}
                          >
                            {t('communityHub.learnMoreButton')}
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </GlassmorphismCard>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Special Events & VIP Section */}
        <section className="py-20 px-4 luxury-bg-mesh">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Special Events */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <GlassmorphismCard gradient="pink" className="h-full p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 p-3 flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {t('communityHub.eventsTitle')}
                    </h3>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-6">
                    {t('communityHub.eventsDescription')}
                  </p>

                  <div className="space-y-3">
                    {['Adoption Events', 'Fundraising Campaigns', 'Community Workshops'].map((event, i) => (
                      <div key={i} className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                        <Check className="w-5 h-5 text-green-600" />
                        <span className="text-lg">{event}</span>
                      </div>
                    ))}
                  </div>
                </GlassmorphismCard>
              </motion.div>

              {/* VIP Perks */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <GlassmorphismCard gradient="gold" className="h-full p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 p-3 flex items-center justify-center">
                      <Crown className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {t('communityHub.vipTitle')}
                    </h3>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-6">
                    {t('communityHub.vipDescription')}
                  </p>

                  <div className="space-y-3">
                    {[
                      { tier: 'Gold', benefit: 'Priority Support + Extra Discounts' },
                      { tier: 'Platinum', benefit: 'Exclusive Events Access' },
                      { tier: 'Royal', benefit: 'Complimentary Services' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <span className="text-lg text-gray-700 dark:text-gray-200">
                          <strong className="font-semibold">{item.tier}:</strong> {item.benefit}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassmorphismCard>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Impact Dashboard - Animated Stats */}
        <section className="py-24 px-4 bg-gradient-to-br from-green-600 via-lime-600 to-emerald-600 text-white relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.2),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.2),transparent)]" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-4">
                {t('communityHub.impactTitle')}
              </h2>
              <p className="text-xl md:text-2xl text-green-100">
                {t('communityHub.impactSubtitle')}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {impactStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.labelKey}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <Card className="bg-white/10 backdrop-blur-xl border-white/20 text-center p-8 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                      <CardContent className="p-0">
                        <Icon className={`w-12 h-12 ${stat.color} mx-auto mb-4`} />
                        <div className="text-5xl md:text-6xl font-bold mb-2" data-testid={`stat-${index}`}>
                          <AnimatedCounter 
                            end={stat.value} 
                            prefix={stat.prefix}
                          />
                        </div>
                        <p className="text-lg text-green-100 font-medium">
                          {t(stat.labelKey)}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Get Involved CTA */}
        <section className="py-20 px-4 luxury-bg-mesh">
          <div className="max-w-4xl mx-auto">
            <GlassmorphismCard gradient="purple" className="p-12 text-center luxury-glass-card luxury-shadow-xl">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                {t('communityHub.contactTitle')}
              </h2>
              
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                {t('communityHub.contactDescription')}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <LuxuryButton
                  variant="primary"
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700"
                  testId="button-contact-support"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  {t('communityHub.applyButton')}
                </LuxuryButton>
                
                <LuxuryButton
                  variant="secondary"
                  size="lg"
                  testId="button-contact-partner"
                >
                  <TrendingUp className="w-5 h-5 mr-2" />
                  {t('communityHub.partnerButton')}
                </LuxuryButton>
              </div>

              <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('communityHub.eligibilityTitle')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {t('communityHub.eligibilityDescription')}
                </p>
              </div>
            </GlassmorphismCard>
          </div>
        </section>

      </div>
    </Layout>
  );
}
