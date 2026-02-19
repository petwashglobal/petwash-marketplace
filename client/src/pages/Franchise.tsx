import { useState, useEffect } from 'react';
import { Language, t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Star, TrendingUp, Award, Shield, Zap, Crown, DollarSign, MapPin, 
  Clock, CheckCircle2, BarChart3, Building2, Percent, Calendar, 
  Globe, Briefcase, GraduationCap, Wrench, Rocket, Package, Wifi, 
  ShoppingCart, Phone, Sparkles, Play, Bot, Headset, Video, Eye,
  Target, TrendingDown, MessageCircle, Lightbulb, Trophy
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { NavigationButton } from '@/components/LuxuryWidgets';
import { FranchiseROICalculator } from '@/components/FranchiseROICalculator';
import { GoogleFormEmbed } from '@/components/GoogleFormEmbed';

interface FranchiseProps {
  language: Language;
  onLanguageChange?: (language: Language) => void;
}

export default function Franchise({ language, onLanguageChange }: FranchiseProps) {
  const [_, setLocation] = useLocation();
  const [completedSteps, setCompletedSteps] = useState(0);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  
  const handleLanguageChange = (newLanguage: Language) => {
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
    }
  };

  // Gamification: Track user progress
  const totalSteps = 6;
  const progressPercentage = (completedSteps / totalSteps) * 100;
  
  // Step 1: Mark "View Info" as completed on mount
  useEffect(() => {
    setCompletedSteps(prev => Math.max(prev, 1));
  }, []);

  // Franchise locations - will be populated when franchise program launches
  const franchiseLocations: Array<{ city: string; units: number; revenue: string; growth: number }> = [];

  // Success stories - will be added when franchise partners are live
  const successStories: Array<{
    name: string;
    location: string;
    investment: string;
    roi: string;
    period: string;
    quote: string;
    revenue: string;
  }> = [];
  
  return (
    <Layout language={language} onLanguageChange={handleLanguageChange}>
      <NavigationButton type="back" onClick={() => setLocation('/')} />
      
      {/* Luxury Mesh Background */}
      <div className="min-h-screen relative overflow-hidden luxury-bg-mesh">

        <div className="relative z-10">
          {/* Hero Section - Premium Metallic */}
          <div className="relative pt-32 pb-24 overflow-hidden">
            {/* Metallic Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-slate-100/30 to-blue-50/50 dark:from-amber-950/20 dark:via-slate-900/40 dark:to-blue-950/20"></div>
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `linear-gradient(45deg, transparent 25%, rgba(0, 0, 0, 0.05) 25%, rgba(0, 0, 0, 0.05) 50%, transparent 50%, transparent 75%, rgba(0, 0, 0, 0.05) 75%, rgba(0, 0, 0, 0.05))`,
                backgroundSize: '60px 60px'
              }}
            ></div>
            
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center space-y-8">
                {/* Premium Badge */}
                <div className="inline-block">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-500"></div>
                    <Badge className="relative px-8 py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white border-0 shadow-2xl text-base font-semibold">
                      <Crown className="w-5 h-5 inline mr-2" />
                      {t('franchise.globalOpportunity', language)}
                    </Badge>
                  </div>
                </div>
                
                {/* Hero Title - Luxury System */}
                <h1 className="luxury-heading-xl">
                  {t('franchise.heroLine1', language)}<br />{t('franchise.heroLine2', language)}
                </h1>
                
                <p className="luxury-text-body max-w-4xl mx-auto">
                  {t('franchise.heroStats', language)}
                </p>
                
                {/* Premium CTA Buttons */}
                <div className="flex flex-col sm:flex-row luxury-gap-md justify-center items-center pt-8">
                  <Button 
                    className="luxury-btn-primary luxury-shadow-xl flex items-center gap-2"
                    data-testid="button-request-investment-package"
                  >
                    <DollarSign className="w-6 h-6" />
                    {t('franchise.requestPackage', language)}
                  </Button>
                  
                  <Button 
                    className="luxury-btn-secondary flex items-center gap-2"
                    data-testid="button-schedule-tour"
                    onClick={() => setCompletedSteps(prev => Math.max(prev, 5))}
                  >
                    <Calendar className="w-6 h-6" />
                    {t('franchise.scheduleTour', language)}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats section - hidden until real data available */}
          <div className="luxury-container luxury-section-compact">
            <div className="luxury-grid-4 mb-16">
              {([] as Array<{value: string; label: string; icon: any; gradient: string}>).map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div key={idx} className={`luxury-glass-card luxury-hover-glow luxury-shadow-md luxury-animate-fade-in luxury-delay-${idx + 1}`}>
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`}></div>
                    
                    <div className="flex flex-col items-center text-center luxury-gap-sm p-6">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${stat.gradient} p-3 shadow-lg`}>
                        <Icon className="w-full h-full text-white" />
                      </div>
                      <div className="luxury-heading-lg luxury-text-gradient">
                        {stat.value}
                      </div>
                      <div className="luxury-text-small">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Success Stories - Luxury Cards */}
            <div className="mb-16">
              <h2 className="luxury-heading-lg text-center mb-12 luxury-text-gradient">
                {t('franchise.successStories', language)}
              </h2>
              <div className="luxury-grid-4">
                {successStories.map((story, idx) => (
                  <div key={idx} className={`luxury-glass-card luxury-hover-lift luxury-shadow-lg luxury-animate-slide-up luxury-delay-${(idx % 4) + 1}`}>
                      {/* Gold Metallic Top Border */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500"></div>
                      
                      <div className="p-6 space-y-4">
                        {/* Avatar with Metallic Ring */}
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 rounded-full opacity-75 blur-sm"></div>
                            <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-xl">
                              {story.name.split(' ').map(n => n[0]).join('')}
                            </div>
                          </div>
                          <div>
                            <div className="luxury-heading-sm">{story.name}</div>
                            <div className="luxury-text-small flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {story.location}
                            </div>
                          </div>
                        </div>
                        
                        {/* Stats - Glass Pills */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="luxury-glass-minimal p-3 border border-emerald-300/30">
                            <div className="luxury-heading-md luxury-text-gradient">{story.roi}</div>
                            <div className="luxury-text-small">ROI</div>
                          </div>
                          <div className="luxury-glass-minimal p-3 border border-blue-300/30">
                            <div className="luxury-heading-sm luxury-text-gradient">{story.revenue}</div>
                            <div className="luxury-text-small">{t('franchise.monthly', language)}</div>
                          </div>
                        </div>
                        
                        {/* Quote */}
                        <p className="luxury-text-body italic leading-relaxed">
                          "{story.quote}"
                        </p>
                        
                        {/* Investment Info */}
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                          <span className="font-semibold">{story.investment}</span>
                          <span>{story.period}</span>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>

            {/* Global Network - Luxury Grid */}
            <div className="mb-16">
              <h3 className="luxury-heading-lg text-center mb-12 luxury-text-gradient">
                {t('franchise.globalNetwork', language)}
              </h3>
              <div className="luxury-grid-3">
                {franchiseLocations.map((loc, idx) => (
                  <div key={idx} className={`luxury-glass-card luxury-hover-lift luxury-shadow-md luxury-animate-fade-in luxury-delay-${(idx % 3) + 1}`}>
                      <div className="flex items-center justify-between p-5">
                        <div className="flex items-center luxury-gap-sm">
                          <div className="w-12 h-12 bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {loc.units}
                          </div>
                          <div>
                            <div className="luxury-heading-sm">{loc.city}</div>
                            <div className="luxury-text-small">{loc.units} {t('franchise.units', language)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="luxury-heading-sm luxury-text-gradient">{loc.revenue}</div>
                          <div className="luxury-text-small text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            +{loc.growth}%
                          </div>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>

            {/* 🎮 GAMIFICATION: Progress Tracker - 2025/2026 Feature */}
            <div className="mb-16">
              <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-bg-soft">
                <div className="relative z-10">
                  <div className="text-center mb-6">
                    <h3 className="luxury-heading-lg mb-2 luxury-text-gradient">
                      {t('franchise.onboardingJourney', language)}
                    </h3>
                    <p className="luxury-text-body">
                      {t('franchise.trackProgress', language)}
                    </p>
                  </div>
                  <div className="max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="luxury-heading-sm">
                        {t('franchise.completed', language)}: {completedSteps}/{totalSteps}
                      </span>
                      <span className="luxury-heading-sm luxury-text-gradient">
                        {progressPercentage.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-3" />
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
                      {[
                        { icon: Eye, label: t('franchise.viewInfo', language), completed: completedSteps >= 1 },
                        { icon: Video, label: t('franchise.watchVideo', language), completed: completedSteps >= 2 },
                        { icon: Target, label: t('franchise.roiCalc', language), completed: completedSteps >= 3 },
                        { icon: MessageCircle, label: t('franchise.aiChat', language), completed: completedSteps >= 4 },
                        { icon: Calendar, label: t('franchise.bookTour', language), completed: completedSteps >= 5 },
                        { icon: Trophy, label: t('franchise.apply', language), completed: completedSteps >= 6 }
                      ].map((step, idx) => {
                        const Icon = step.icon;
                        return (
                          <div key={idx} className="text-center">
                            <div 
                              className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                                step.completed 
                                  ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg luxury-badge-success' 
                                  : 'luxury-glass-minimal'
                              }`}
                            >
                              <Icon className={`w-6 h-6 ${step.completed ? 'text-white' : 'text-gray-400'}`} />
                            </div>
                            <p className="luxury-text-small">{step.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROI Calculator - Hidden until real data available */}

            {/* 📹 VIDEO TESTIMONIALS - 2025/2026 Feature */}
            <div className="mb-16">
              <div className="luxury-glass-card luxury-shadow-xl p-8 md:p-12 luxury-bg-soft">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-300/20 to-cyan-500/20 rounded-bl-full -mr-16 -mt-16"></div>
                
                <div className="relative z-10">
                  <h3 className="luxury-heading-lg text-center mb-12 luxury-text-gradient">
                    {t('franchise.watchSuccessStories', language)}
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      { name: 'James Anderson', location: 'Toronto, Canada', revenue: '$18K CAD/mo', thumbnail: '🇨🇦' },
                      { name: 'Emily Roberts', location: 'Sydney, Australia', revenue: '$19K AUD/mo', thumbnail: '🇦🇺' },
                      { name: 'David Williams', location: 'London, England', revenue: '£14K GBP/mo', thumbnail: '🇬🇧' }
                    ].filter(() => false).map((video, idx) => (
                      <Button
                        key={idx}
                        onClick={() => {
                          setShowVideoPlayer(true);
                          setCompletedSteps(prev => Math.max(prev, 2));
                        }}
                        className="group relative overflow-hidden rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/30 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 p-6"
                      >
                        <div className="aspect-video bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center text-6xl">
                            {video.thumbnail}
                          </div>
                          <div className="relative z-10 w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <Play className="w-8 h-8 text-blue-600 ml-1" />
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="luxury-heading-sm mb-1">{video.name}</div>
                          <div className="luxury-text-small mb-2">{video.location}</div>
                          <div className="luxury-heading-sm luxury-text-gradient">{video.revenue}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 🤖 AI CHATBOT ADVISOR - 2025/2026 Feature */}
            <div className="mb-16">
              <div className="luxury-glass-card luxury-shadow-xl p-8 md:p-12 luxury-bg-soft">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-indigo-300/20 to-purple-500/20 rounded-tr-full -ml-16 -mb-16"></div>
                
                <div className="relative z-10">
                  <div className="text-center max-w-3xl mx-auto">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 rounded-full mb-6 shadow-2xl">
                      <Bot className="w-12 h-12 text-white" />
                    </div>
                    <h3 className="luxury-heading-lg mb-4 luxury-text-gradient">
                      {t('franchise.aiAdvisor', language)}
                    </h3>
                    <p className="luxury-text-body mb-8">
                      {t('franchise.aiAdvisorDesc', language)}
                    </p>
                    <Button 
                      onClick={() => setCompletedSteps(prev => Math.max(prev, 4))}
                      className="luxury-btn-primary luxury-shadow-xl flex items-center gap-2 mx-auto"
                    >
                      <Headset className="w-6 h-6" />
                      {t('franchise.startChatAI', language)}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 🥽 VR/AR FRANCHISE TOUR PREVIEW - 2025/2026 Feature */}
            <div className="mb-16">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/40 backdrop-blur-3xl border border-emerald-200/50 dark:border-emerald-800/50 shadow-2xl p-8 md:p-12">
                <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-emerald-300/20 to-teal-500/20 rounded-br-full -ml-20 -mt-20"></div>
                
                <div className="relative z-10">
                  <div className="text-center max-w-3xl mx-auto">
                    <h3 
                      className="text-4xl font-bold mb-4"
                      style={{
                        background: 'linear-gradient(135deg, #10B981 0%, #14B8A6 50%, #06B6D4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      {t('franchise.virtualTour', language)}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 text-lg mb-8">
                      {t('franchise.vrTourDesc', language)}
                    </p>
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 border border-white/30">
                        <Eye className="w-12 h-12 text-emerald-600 mb-3 mx-auto" />
                        <div className="font-bold text-gray-900 dark:text-white mb-2">
                          {t('franchise.walkthrough360', language)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('franchise.viewEveryAngle', language)}
                        </p>
                      </div>
                      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 border border-white/30">
                        <Lightbulb className="w-12 h-12 text-emerald-600 mb-3 mx-auto" />
                        <div className="font-bold text-gray-900 dark:text-white mb-2">
                          {t('franchise.interactiveDemo', language)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('franchise.operateVirtually', language)}
                        </p>
                      </div>
                    </div>
                    <Button 
                      className="group relative px-10 py-5 text-lg font-semibold transition-all duration-300 hover:scale-105"
                    >
                      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 rounded-xl opacity-75 blur group-hover:blur-md group-hover:opacity-100 transition duration-300"></div>
                      <div className="relative flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 text-white rounded-xl shadow-2xl">
                        <Eye className="w-6 h-6" />
                        {t('franchise.startVirtualTour', language)}
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* PREDICTIVE SUCCESS SCORE - 2025/2026 Feature */}
            <div className="mb-16">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:from-orange-950/40 dark:to-amber-950/40 backdrop-blur-3xl border border-orange-200/50 dark:border-orange-800/50 shadow-2xl p-8 md:p-12">
                <div className="relative z-10 text-center">
                  <h3 
                    className="text-4xl font-bold mb-8"
                    style={{
                      background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 50%, #EF4444 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    {t('franchise.successScore', language)}
                  </h3>
                  <div className="max-w-2xl mx-auto">
                    <div className="relative inline-block mb-6">
                      <div className="w-48 h-48 mx-auto">
                        <svg className="transform -rotate-90 w-48 h-48">
                          <circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            className="text-gray-200 dark:text-gray-700"
                          />
                          <circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="url(#gradient)"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={`${88 * 2 * Math.PI}`}
                            strokeDashoffset={`${88 * 2 * Math.PI * (1 - 0.92)}`}
                            className="transition-all duration-1000"
                          />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#F59E0B" />
                              <stop offset="50%" stopColor="#F97316" />
                              <stop offset="100%" stopColor="#EF4444" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-5xl font-bold text-orange-600 dark:text-orange-400">92%</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{t('franchise.success', language)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-6">
                      {t('franchise.aiPrediction', language)}
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/30">
                        <div className="text-2xl font-bold text-emerald-600">A+</div>
                        <div className="text-gray-600 dark:text-gray-400">{t('franchise.demographics', language)}</div>
                      </div>
                      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/30">
                        <div className="text-2xl font-bold text-blue-600">A</div>
                        <div className="text-gray-600 dark:text-gray-400">{t('franchise.competition', language)}</div>
                      </div>
                      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/30">
                        <div className="text-2xl font-bold text-purple-600">A+</div>
                        <div className="text-gray-600 dark:text-gray-400">{t('franchise.demand', language)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Investment Package Summary - Contact for details */}
            <div className="mb-16">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/70 to-gray-50/70 dark:from-gray-800/70 dark:to-gray-900/70 backdrop-blur-3xl border border-white/40 shadow-2xl p-12">
                {/* Metallic Corner Accents */}
                <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-amber-300/20 to-yellow-500/20 rounded-br-full -ml-20 -mt-20"></div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-300/20 to-cyan-500/20 rounded-tl-full -mr-20 -mb-20"></div>
                
                <div className="relative z-10">
                  <h3 
                    className="text-4xl font-bold text-center mb-8"
                    style={{
                      background: 'linear-gradient(135deg, #333333 0%, #555555 50%, #333333 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    {t('franchise.investmentSummary', language)}
                  </h3>
                  
                  <div className="text-center max-w-2xl mx-auto space-y-6">
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                      {language === 'he' ? 'צור קשר לקבלת פרטי השקעה מלאים והצעת מחיר מותאמת אישית.' : 'Contact us for complete investment details and a personalized quote.'}
                    </p>
                    <Button 
                      className="luxury-btn-primary luxury-shadow-xl flex items-center gap-2 mx-auto"
                      data-testid="button-contact-investment"
                    >
                      <DollarSign className="w-6 h-6" />
                      {language === 'he' ? 'בקש חבילת השקעה' : 'Request Investment Package'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 🔧 JV & ENRIQUE PLATFORM - CUSTOM R&D SOLUTIONS */}
            <div className="mb-16">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50/80 to-zinc-50/80 dark:from-slate-950/40 dark:to-zinc-950/40 backdrop-blur-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-2xl p-8 md:p-12">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-300/20 to-indigo-500/20 rounded-bl-full -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-purple-300/20 to-pink-500/20 rounded-tr-full -ml-20 -mb-20"></div>
                
                <div className="relative z-10">
                  <div className="text-center mb-12">
                    <h3 
                      className="text-4xl md:text-5xl font-bold mb-4"
                      style={{
                        background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      {t('franchise.enriquePlatform', language)}
                    </h3>
                    <p className="text-xl text-gray-700 dark:text-gray-300 max-w-4xl mx-auto">
                      {t('franchise.jvPartnership', language)}
                    </p>
                  </div>

                  {/* Key Benefits Grid */}
                  <div className="grid md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg">
                        <Wrench className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {t('franchise.customSolutions', language)}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('franchise.customFeatures', language)}
                      </p>
                    </div>

                    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg">
                        <Lightbulb className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {t('franchise.expertRD', language)}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('franchise.topExperts', language)}
                      </p>
                    </div>

                    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-lg hover:shadow-xl transition-all">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg">
                        <Rocket className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {t('franchise.fastDelivery', language)}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('franchise.tellUsWhatWhenHow', language)}
                      </p>
                    </div>
                  </div>

                  {/* K9000 Technical Specifications */}
                  <div className="bg-gradient-to-br from-gray-50/80 to-slate-100/80 dark:from-gray-900/80 dark:to-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-gray-200/30 dark:border-gray-700/30 mb-8">
                    <h4 
                      className="text-2xl font-bold mb-6 text-center"
                      style={{
                        background: 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 50%, #A8A8A8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      {t('franchise.k9000Specs', language)}
                    </h4>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Twin Model */}
                      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl p-6 border border-white/20">
                        <div className="text-center mb-4">
                          <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 text-sm px-4 py-2">
                            K9000 2.0 Twin
                          </Badge>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Dimensions:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">3700×1850×680mm</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Weight:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">350kg</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Power:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">240V / 25A</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Water Usage:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">16-20 L/min</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Noise Level:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">66 dBA @ 4m</span>
                          </div>
                        </div>
                      </div>

                      {/* Standard Model */}
                      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl p-6 border border-white/20">
                        <div className="text-center mb-4">
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-sm px-4 py-2">
                            K9000 2.0 Standard
                          </Badge>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Dimensions:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">2150×1850×600mm</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Weight:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">285kg</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Power:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">208-240V / 16A</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-200/50 dark:border-gray-700/50 pb-2">
                            <span className="text-gray-600 dark:text-gray-400">Water Usage:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">10 L/min (2.64 GPM)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">CSA Approved:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Certified</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('franchise.systemsCertified', language)}
                      </p>
                    </div>
                  </div>

                  {/* Custom Development Process */}
                  <div className="grid md:grid-cols-4 gap-4 mb-8">
                    {[
                      { num: '1', title: t('franchise.tellUs', language), desc: t('franchise.whatYouNeed', language) },
                      { num: '2', title: t('franchise.timeline', language), desc: t('franchise.whenYouNeed', language) },
                      { num: '3', title: t('franchise.how', language), desc: t('franchise.howItWorks', language) },
                      { num: '4', title: t('franchise.solution', language), desc: t('franchise.perfectSolution', language) }
                    ].map((step, idx) => (
                      <div key={idx} className="text-center">
                        <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-xl">
                          {step.num}
                        </div>
                        <h5 className="font-bold text-gray-900 dark:text-white mb-1">{step.title}</h5>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{step.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="text-center">
                    <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 font-semibold">
                      {t('franchise.ensureAccuracy', language)}
                    </p>
                    <Button className="group relative px-12 py-5 text-lg font-semibold transition-all duration-300 hover:scale-105">
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-xl opacity-75 blur group-hover:blur-md group-hover:opacity-100 transition duration-300"></div>
                      <div className="relative flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600 text-white rounded-xl shadow-2xl">
                        <Briefcase className="w-6 h-6" />
                        {t('franchise.inquireJV', language)}
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* What's Included - Luxury Grid */}
            <div className="mb-16">
              <h3 className="luxury-heading-lg text-center mb-12 luxury-text-gradient">
                {t('franchise.whatsIncluded', language)}
              </h3>
              <div className="luxury-grid-4">
                {[
                  { icon: Wrench, title: t('franchise.completeEquipment', language), gradient: 'from-blue-400 to-cyan-500' },
                  { icon: GraduationCap, title: t('franchise.comprehensiveTraining', language), gradient: 'from-purple-400 to-pink-500' },
                  { icon: ShoppingCart, title: t('franchise.initialInventory', language), gradient: 'from-emerald-400 to-green-500' },
                  { icon: Rocket, title: t('franchise.marketingCampaign', language), gradient: 'from-amber-400 to-yellow-500' },
                  { icon: Shield, title: t('franchise.completeInsurance', language), gradient: 'from-red-400 to-rose-500' },
                  { icon: Wifi, title: t('franchise.iotSystem', language), gradient: 'from-indigo-400 to-blue-500' },
                  { icon: Phone, title: t('franchise.support247', language), gradient: 'from-teal-400 to-cyan-500' },
                  { icon: MapPin, title: t('franchise.exclusiveTerritory', language), gradient: 'from-orange-400 to-amber-500' }
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={idx} className={`luxury-glass-minimal luxury-hover-lift luxury-animate-scale-in luxury-delay-${(idx % 4) + 1} p-5`}>
                      <div className={`w-12 h-12 bg-gradient-to-br ${item.gradient} rounded-lg flex items-center justify-center text-white mb-3 shadow-md`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="luxury-heading-sm">{item.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Final CTA - Luxury Premium */}
            <div className="luxury-glass-card luxury-shadow-xl p-16 text-center luxury-bg-soft">
              <div className="relative z-10 space-y-6">
                <h2 className="luxury-heading-xl mb-6">
                  {t('franchise.readyToJoin', language)}
                </h2>
                <p className="luxury-text-body max-w-2xl mx-auto">
                  {t('franchise.joinGlobalNetwork', language)}
                </p>
                <div className="flex flex-col sm:flex-row luxury-gap-md justify-center pt-4">
                  <Button 
                    className="luxury-btn-primary luxury-shadow-xl flex items-center gap-2 mx-auto"
                    onClick={() => setCompletedSteps(prev => Math.max(prev, 6))}
                    data-testid="button-apply-now"
                  >
                    <Phone className="w-6 h-6" />
                    {t('franchise.talkAdvisor', language)}
                  </Button>
                </div>
              </div>
            </div>

            {/* Google Form - Franchise Inquiry */}
            <div className="mt-12">
              <GoogleFormEmbed
                formType="franchise"
                language={language}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Shimmer Animation for Gold Text */}
      <style>{`
        @keyframes shimmer {
          to {
            background-position: 200% center;
          }
        }
      `}</style>
    </Layout>
  );
}
