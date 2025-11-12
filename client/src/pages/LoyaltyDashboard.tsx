import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Trophy,
  Award,
  Gift,
  TrendingUp,
  Crown,
  Medal,
  Star,
  Sparkles,
  Sun,
  Moon,
  Heart,
  Gem,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { ProgressCircle, SparklineChart, GlassCard, DashboardWidget } from '@/components/LuxuryWidgets';
import { TIER_CONFIGS } from '@shared/schema-loyalty';

// 7-STAR LUXURY TIER SYSTEM - Visual Configuration
const TIER_VISUAL_CONFIG: Record<string, { color: string; bgColor: string; icon: any; badge: string; emoji: string }> = {
  bronze: { 
    color: 'from-amber-600 to-orange-700', 
    bgColor: 'bg-amber-100 dark:bg-amber-900/20',
    icon: Star,
    badge: 'bg-amber-600',
    emoji: '🥉'
  },
  silver: { 
    color: 'from-gray-300 to-gray-400', 
    bgColor: 'bg-gray-100 dark:bg-gray-900/20',
    icon: Medal,
    badge: 'bg-gray-400',
    emoji: '🥈'
  },
  gold: { 
    color: 'from-yellow-400 to-amber-500', 
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    icon: Crown,
    badge: 'bg-yellow-500',
    emoji: '🥇'
  },
  platinum: { 
    color: 'from-slate-200 to-slate-300', 
    bgColor: 'bg-slate-100 dark:bg-slate-800/20',
    icon: Award,
    badge: 'bg-slate-300',
    emoji: '💎'
  },
  diamond: { 
    color: 'from-blue-400 to-cyan-500', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    icon: Gem,
    badge: 'bg-blue-500',
    emoji: '💠'
  },
  emerald: { 
    color: 'from-emerald-400 to-green-500', 
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/20',
    icon: Heart,
    badge: 'bg-emerald-500',
    emoji: '💚'
  },
  royal: { 
    color: 'from-purple-500 to-violet-600', 
    bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    icon: Trophy,
    badge: 'bg-gradient-to-r from-purple-600 to-violet-600',
    emoji: '👑'
  }
};

// Main Loyalty Widget (LUXURY VERSION with Glassmorphism)
const MainLoyaltyWidget = ({ 
  points, 
  status, 
  pointsHistory 
}: { 
  points: number; 
  status: string; 
  pointsHistory: number[];
}) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  // Find current tier and next tier
  const currentTierConfig = TIER_CONFIGS.find(t => t.id === status.toLowerCase()) || TIER_CONFIGS[0];
  const currentTierIndex = TIER_CONFIGS.findIndex(t => t.id === status.toLowerCase());
  const nextTierConfig = currentTierIndex < TIER_CONFIGS.length - 1 ? TIER_CONFIGS[currentTierIndex + 1] : null;
  
  const maxPoints = nextTierConfig?.threshold || currentTierConfig.threshold;
  const progress = nextTierConfig ? ((points - currentTierConfig.threshold) / (maxPoints - currentTierConfig.threshold)) * 100 : 100;
  
  const tierVisual = TIER_VISUAL_CONFIG[status.toLowerCase()] || TIER_VISUAL_CONFIG.bronze;
  const TierIcon = tierVisual.icon;

  return (
    <div className="relative rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 shadow-2xl overflow-hidden">
      {/* Gradient Background Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${tierVisual.color} opacity-5`}></div>
      
      <div className="relative flex items-center gap-8">
        {/* Progress Circle */}
        <ProgressCircle 
          progress={Math.min(Math.max(progress, 0), 100)} 
          size={140}
          strokeWidth={14}
          color={status.toLowerCase() === 'royal' ? '#8b5cf6' : status.toLowerCase() === 'emerald' ? '#10b981' : status.toLowerCase() === 'diamond' ? '#3b82f6' : status.toLowerCase() === 'platinum' ? '#d1d5db' : status.toLowerCase() === 'gold' ? '#eab308' : status.toLowerCase() === 'silver' ? '#9ca3af' : '#94a3b8'}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{tierVisual.emoji}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{points.toLocaleString()}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">pts</div>
          </div>
        </ProgressCircle>

        {/* Points Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <TierIcon className="w-8 h-8 text-gray-700 dark:text-white" />
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {tierVisual.emoji} {isHebrew ? currentTierConfig.nameHe : currentTierConfig.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {isHebrew ? 'נקודות נוכחיות' : 'Current Tier Status'}
              </div>
            </div>
          </div>
          <Badge className={`${tierVisual.badge} text-white border-0 px-4 py-1.5`}>
            {nextTierConfig 
              ? `${points.toLocaleString()} / ${maxPoints.toLocaleString()} ${isHebrew ? 'נקודות' : 'Points'}` 
              : `${tierVisual.emoji} ${isHebrew ? 'דרגה מקסימלית!' : 'Max Tier Achieved!'}`
            }
          </Badge>
          {nextTierConfig && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {isHebrew 
                ? `עוד ${(maxPoints - points).toLocaleString()} נקודות ל-${nextTierConfig.nameHe}`
                : `${(maxPoints - points).toLocaleString()} points to ${nextTierConfig.name}`
              }
            </p>
          )}
        </div>

        {/* Sparkline Chart */}
        <div className="w-32 h-24">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {isHebrew ? 'מגמה' : 'Trend'}
          </div>
          <SparklineChart data={pointsHistory} color="#3B82F6" height={60} />
        </div>
      </div>
    </div>
  );
};

// Pet Wash™ Loyalty Dashboard
export default function LoyaltyDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  // Mock data (replace with API)
  const mockPoints = 400;
  const mockStatus = 'Silver';
  const mockPointsHistory = [0, 50, 200, 350, 400];
  const mockRewards = [
    { id: 1, name: isHebrew ? 'שטיפה חינם' : 'Free Wash', points: 500, available: false },
    { id: 2, name: isHebrew ? '10% הנחה' : '10% Discount', points: 200, available: true },
    { id: 3, name: isHebrew ? 'שדרוג VIP' : 'VIP Upgrade', points: 1000, available: false },
    { id: 4, name: isHebrew ? 'מוצר חינם' : 'Free Product', points: 300, available: true },
  ];

  const { data: loyaltyProfile } = useQuery<any>({
    queryKey: ['/api/loyalty/profile'],
  });

  const currentTier = loyaltyProfile?.tier || mockStatus;
  const currentPoints = loyaltyProfile?.points || mockPoints;

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {isHebrew ? '🏆 תוכנית הנאמנות Pet Wash™' : '🏆 Pet Wash™ Loyalty Program'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {isHebrew ? 'צבור נקודות וקבל פרסים מדהימים' : 'Earn points and get amazing rewards'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
              <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </div>
          </div>

          {/* Main Loyalty Widget Card */}
          <Card className="shadow-2xl mb-8 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="w-6 h-6" />
                {isHebrew ? 'סטטוס הנאמנות שלך' : 'Your Loyalty Status'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MainLoyaltyWidget 
                points={currentPoints}
                status={currentTier}
                pointsHistory={mockPointsHistory}
              />
            </CardContent>
          </Card>

          {/* Tier System Grid - 7 STAR LUXURY */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              {isHebrew ? 'מערכת דירוג 7 כוכבים' : '7-Star Tier System'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {TIER_CONFIGS.map((tierConfig) => {
                const visualConfig = TIER_VISUAL_CONFIG[tierConfig.id];
                const Icon = visualConfig.icon;
                const isCurrent = tierConfig.id === currentTier.toLowerCase();
                
                return (
                  <Card 
                    key={tierConfig.id}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      isCurrent 
                        ? 'ring-4 ring-blue-500 shadow-2xl scale-105' 
                        : 'shadow-lg hover:shadow-xl hover:scale-102'
                    }`}
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${visualConfig.color} opacity-10 rounded-full -mr-16 -mt-16`}></div>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${visualConfig.color} shadow-md`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="text-base font-bold text-gray-900 dark:text-white">
                              {visualConfig.emoji} {isHebrew ? tierConfig.nameHe : tierConfig.name}
                            </div>
                          </div>
                        </div>
                        {isCurrent && (
                          <Badge className="bg-blue-600 text-white text-xs">
                            {isHebrew ? 'נוכחי' : 'Current'}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <Star className="w-3 h-3" />
                          <span>
                            {isHebrew ? `${tierConfig.threshold.toLocaleString()}+ נקודות` : `${tierConfig.threshold.toLocaleString()}+ points`}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Gift className="w-3 h-3 text-green-600" />
                            <span>{tierConfig.benefits.discountPercent}% {isHebrew ? 'הנחה' : 'Discount'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <TrendingUp className="w-3 h-3 text-blue-600" />
                            <span>{tierConfig.benefits.pointsMultiplier}x {isHebrew ? 'נקודות' : 'Points'}</span>
                          </div>
                          {tierConfig.benefits.conciergeService && (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Crown className="w-3 h-3 text-purple-600" />
                              <span>{isHebrew ? 'שירות קונסיירז׳' : 'Concierge'}</span>
                            </div>
                          )}
                        </div>
                        {isCurrent && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              {isHebrew ? 'התקדמות לדרגה הבאה' : 'Progress to next tier'}
                            </div>
                            <Progress value={45} className="h-2" />
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

          {/* LUXURY Rewards Catalog with Glassmorphism */}
          <div className="rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <Gift className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isHebrew ? 'קטלוג הפרסים' : 'Rewards Catalog'}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockRewards.map((reward, index) => (
                <GlassCard
                  key={reward.id}
                  className={`p-5 transition-all duration-300 ${
                    reward.available
                      ? 'border-green-400/50 hover:border-green-400 hover:shadow-green-500/20'
                      : 'opacity-60'
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                        {reward.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {reward.points.toLocaleString()} {isHebrew ? 'נקודות' : 'points'}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!reward.available}
                      className={reward.available 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg' 
                        : ''}
                    >
                      {isHebrew ? 'פדה' : 'Redeem'}
                    </Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* LUXURY Points Activity Chart */}
          <div className="rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 shadow-2xl mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isHebrew ? 'היסטוריית נקודות' : 'Points History'}
              </h3>
            </div>
            
            <div className="bg-white/5 dark:bg-black/20 rounded-xl p-6 border border-white/10">
              <SparklineChart data={mockPointsHistory} color="#3B82F6" height={120} />
            </div>
            
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/30 rounded-full px-6 py-3">
                <Sparkles className="w-4 h-4 text-green-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {isHebrew 
                    ? 'המגמה שלך: עולה! המשך כך 🚀' 
                    : 'Your trend: Rising! Keep it up 🚀'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>
              Pet Wash™ Loyalty Engine 2025-2026 • {isHebrew ? 'בנוי עם טכנולוגיה מתקדמת' : 'Built with Advanced Technology'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
