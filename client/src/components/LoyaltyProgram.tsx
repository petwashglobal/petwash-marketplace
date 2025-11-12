import { Trophy, Star, Crown, Zap, Gift, Heart, Award, TrendingUp, Users, Calendar, Sparkles, Gem, Medal, Rocket } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { t, type Language } from '@/lib/i18n';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { motion } from 'framer-motion';

interface LoyaltyProgramProps {
  language: Language;
}

export function LoyaltyProgram({ language }: LoyaltyProgramProps) {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  const handleSignUp = () => {
    if (user) {
      setLocation('/dashboard');
    } else {
      setLocation('/signin');
    }
  };

  const tiers = [
    {
      name: t('loyalty.tier1.name', language),
      icon: Sparkles,
      range: '0-500',
      points: '0-500',
      discount: '5%',
      color: 'from-gray-400 to-gray-600',
      borderColor: 'border-gray-400',
      textColor: 'text-gray-700',
      bgColor: 'bg-gradient-to-br from-gray-50 to-gray-100',
      benefits: [
        t('loyalty.tier1.benefit1', language),
        t('loyalty.tier1.benefit2', language),
        t('loyalty.tier1.benefit3', language)
      ]
    },
    {
      name: t('loyalty.tier2.name', language),
      icon: Star,
      range: '501-1,500',
      points: '501-1,500',
      discount: '10%',
      color: 'from-blue-400 to-blue-600',
      borderColor: 'border-blue-400',
      textColor: 'text-blue-700',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
      benefits: [
        t('loyalty.tier2.benefit1', language),
        t('loyalty.tier2.benefit2', language),
        t('loyalty.tier2.benefit3', language),
        t('loyalty.tier2.benefit4', language)
      ]
    },
    {
      name: t('loyalty.tier3.name', language),
      icon: Trophy,
      range: '1,501-3,000',
      points: '1,501-3,000',
      discount: '15%',
      color: 'from-amber-400 to-amber-600',
      borderColor: 'border-amber-400',
      textColor: 'text-amber-700',
      bgColor: 'bg-gradient-to-br from-amber-50 to-amber-100',
      benefits: [
        t('loyalty.tier3.benefit1', language),
        t('loyalty.tier3.benefit2', language),
        t('loyalty.tier3.benefit3', language),
        t('loyalty.tier3.benefit4', language),
        t('loyalty.tier3.benefit5', language)
      ]
    },
    {
      name: t('loyalty.tier4.name', language),
      icon: Crown,
      range: '3,001-5,000',
      points: '3,001-5,000',
      discount: '20%',
      color: 'from-purple-400 to-purple-600',
      borderColor: 'border-purple-400',
      textColor: 'text-purple-700',
      bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
      benefits: [
        t('loyalty.tier4.benefit1', language),
        t('loyalty.tier4.benefit2', language),
        t('loyalty.tier4.benefit3', language),
        t('loyalty.tier4.benefit4', language),
        t('loyalty.tier4.benefit5', language),
        t('loyalty.tier4.benefit6', language)
      ]
    },
    {
      name: t('loyalty.tier5.name', language),
      icon: Zap,
      range: '5,000+',
      points: '5,000+',
      discount: '25%',
      color: 'from-pink-400 via-rose-400 to-red-500',
      borderColor: 'border-pink-500',
      textColor: 'text-pink-700',
      bgColor: 'bg-gradient-to-br from-pink-50 via-rose-50 to-red-50',
      benefits: [
        t('loyalty.tier5.benefit1', language),
        t('loyalty.tier5.benefit2', language),
        t('loyalty.tier5.benefit3', language),
        t('loyalty.tier5.benefit4', language),
        t('loyalty.tier5.benefit5', language),
        t('loyalty.tier5.benefit6', language),
        t('loyalty.tier5.benefit7', language)
      ]
    }
  ];

  const features = [
    {
      icon: Gift,
      title: t('loyalty.feature1.title', language),
      description: t('loyalty.feature1.desc', language),
      color: 'text-rose-600'
    },
    {
      icon: TrendingUp,
      title: t('loyalty.feature2.title', language),
      description: t('loyalty.feature2.desc', language),
      color: 'text-blue-600'
    },
    {
      icon: Users,
      title: t('loyalty.feature3.title', language),
      description: t('loyalty.feature3.desc', language),
      color: 'text-purple-600'
    },
    {
      icon: Calendar,
      title: t('loyalty.feature4.title', language),
      description: t('loyalty.feature4.desc', language),
      color: 'text-amber-600'
    }
  ];

  return (
    <section id="loyalty" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <Award className="w-8 h-8 text-rose-600" />
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {t('loyalty.title', language)}
            </h2>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            {t('loyalty.subtitle', language)}
          </p>
          
          {/* Points System Explainer */}
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 border border-blue-200 rounded-full px-6 py-3 shadow-lg">
            <Zap className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">{t('loyalty.pawPoints', language)}</span>
            <span className="text-gray-600">{t('loyalty.earnPoints', language)}</span>
          </div>
        </div>

        {/* Key Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5, ease: 'easeOut' }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <Card className="border-2 shadow-lg hover:shadow-2xl transition-all duration-300 h-full">
                  <CardContent className="p-6 text-center">
                    <motion.div 
                      className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-gray-50 to-gray-100 mb-4 shadow-md"
                      animate={{ 
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.05, 1]
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        ease: 'easeInOut' 
                      }}
                    >
                      <IconComponent className={`w-7 h-7 ${feature.color}`} />
                    </motion.div>
                    <h3 className="font-bold text-gray-900 mb-2 text-lg">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Membership Tiers */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
            {t('loyalty.tierTitle', language)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {tiers.map((tier, index) => {
              const IconComponent = tier.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ 
                    delay: index * 0.15, 
                    duration: 0.6, 
                    ease: [0.16, 1, 0.3, 1] 
                  }}
                  whileHover={{ 
                    scale: 1.08, 
                    y: -8,
                    transition: { duration: 0.3, ease: 'easeOut' }
                  }}
                  className="group"
                >
                  <Card 
                    className={`relative overflow-hidden border-2 ${tier.borderColor} shadow-xl hover:shadow-2xl transition-all duration-500 ${tier.bgColor} h-full`}
                  >
                    {/* Animated glow effect */}
                    <motion.div
                      className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${tier.color} rounded-full opacity-20 blur-3xl`}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.3, 0.2],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                    
                    <CardContent className="p-6 relative z-10">
                      {/* Tier Header */}
                      <div className="text-center mb-4">
                        <motion.div 
                          className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${tier.color} mb-3 shadow-2xl`}
                          whileHover={{ 
                            rotate: [0, -10, 10, -10, 0],
                            scale: 1.15
                          }}
                          transition={{ duration: 0.5 }}
                          animate={{
                            y: [0, -5, 0],
                          }}
                          style={{
                            transition: 'transform 2s ease-in-out infinite',
                          }}
                        >
                          <IconComponent className="w-10 h-10 text-white drop-shadow-lg" />
                        </motion.div>
                        <h4 className={`font-bold text-xl ${tier.textColor} mb-1`}>{tier.name}</h4>
                        <p className="text-xs text-gray-600 mb-2 font-medium">{tier.points} {t('loyalty.points', language)}</p>
                        <Badge className={`bg-gradient-to-r ${tier.color} text-white border-0 font-bold text-sm px-4 py-1 shadow-lg`}>
                          {tier.discount} {t('loyalty.discount', language)}
                        </Badge>
                      </div>

                      {/* Benefits List */}
                      <div className="space-y-2 mt-4">
                        {tier.benefits.map((benefit, bidx) => (
                          <motion.div 
                            key={bidx} 
                            className="flex items-start gap-2 text-xs"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: (index * 0.15) + (bidx * 0.05) + 0.3 }}
                          >
                            <motion.div
                              animate={{
                                scale: [1, 1.2, 1],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: bidx * 0.2,
                              }}
                            >
                              <Heart className="w-3 h-3 text-rose-500 flex-shrink-0 mt-0.5" />
                            </motion.div>
                            <span className="text-gray-700">{benefit}</span>
                          </motion.div>
                        ))}
                      </div>

                      {/* Progress hint for non-max tier */}
                      {index < tiers.length - 1 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>{t('loyalty.nextTier', language)}</span>
                            <span className="font-semibold">{tier.range.split('-')[1]}</span>
                          </div>
                          <Progress value={0} className="h-1.5" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <Card className="mb-12 border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
              {t('loyalty.howItWorks', language)}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white font-bold text-2xl mb-4 shadow-lg">
                  1
                </div>
                <h4 className="font-bold text-gray-900 mb-2">{t('loyalty.step1.title', language)}</h4>
                <p className="text-sm text-gray-600">{t('loyalty.step1.desc', language)}</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white font-bold text-2xl mb-4 shadow-lg">
                  2
                </div>
                <h4 className="font-bold text-gray-900 mb-2">{t('loyalty.step2.title', language)}</h4>
                <p className="text-sm text-gray-600">{t('loyalty.step2.desc', language)}</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-2xl mb-4 shadow-lg">
                  3
                </div>
                <h4 className="font-bold text-gray-900 mb-2">{t('loyalty.step3.title', language)}</h4>
                <p className="text-sm text-gray-600">{t('loyalty.step3.desc', language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bonus Opportunities */}
        <div className="text-center mb-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            {t('loyalty.bonusTitle', language)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { icon: Users, text: t('loyalty.bonus1', language), points: '+200', color: 'from-blue-500 to-purple-600' },
              { icon: Calendar, text: t('loyalty.bonus2', language), points: '2x', color: 'from-pink-500 to-rose-600' },
              { icon: Trophy, text: t('loyalty.bonus3', language), points: '+500', color: 'from-amber-500 to-orange-600' },
              { icon: Gift, text: t('loyalty.bonus4', language), points: '2x', color: 'from-green-500 to-teal-600' }
            ].map((bonus, index) => {
              const IconComponent = bonus.icon;
              return (
                <div key={index} className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-r ${bonus.color} rounded-lg blur opacity-25 group-hover:opacity-40 transition-opacity`}></div>
                  <div className="relative bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <IconComponent className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                    <p className="text-sm text-gray-700 mb-1">{bonus.text}</p>
                    <Badge className={`bg-gradient-to-r ${bonus.color} text-white border-0 font-bold`}>
                      {bonus.points}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="inline-block border-2 border-rose-200 bg-gradient-to-br from-white to-rose-50">
            <CardContent className="p-8">
              <Trophy className="w-12 h-12 text-rose-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {t('loyalty.ctaTitle', language)}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md">
                {t('loyalty.ctaDesc', language)}
              </p>
              <Button 
                onClick={handleSignUp} 
                className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                data-testid="button-loyalty-join"
              >
                {user ? t('nav.dashboard', language) : t('loyalty.signUp', language)}
              </Button>
              {!user && (
                <p className="text-xs text-gray-500 mt-4">
                  {t('loyalty.freeToJoin', language)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
