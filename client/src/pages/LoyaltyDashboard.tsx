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
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { apiRequest } from '@/lib/queryClient';
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
    bgColor: 'bg-white dark:bg-white/20',
    icon: Medal,
    badge: 'bg-gray-400',
    emoji: '🥈'
  },
  gold: { 
    color: 'from-yellow-400 to-amber-500', 
    bgColor: 'bg-yellow-100 dark:bg-white',
    icon: Crown,
    badge: 'bg-yellow-500',
    emoji: '🥇'
  },
  platinum: { 
    color: 'from-slate-200 to-slate-300', 
    bgColor: 'bg-white dark:bg-white/20',
    icon: Award,
    badge: 'bg-slate-300',
    emoji: '💎'
  },
  diamond: { 
    color: 'from-blue-400 to-cyan-500', 
    bgColor: 'bg-blue-100 dark:bg-white',
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
    color: 'from-stone-950 via-[#b0841c] to-stone-900',
    bgColor: 'bg-[#fbf7ec] dark:bg-white',
    icon: Trophy,
    badge: 'bg-gradient-to-r from-stone-950 via-[#b0841c] to-stone-900',
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
          color={status.toLowerCase() === 'royal' ? '#333333' : status.toLowerCase() === 'emerald' ? '#10b981' : status.toLowerCase() === 'diamond' ? '#3b82f6' : status.toLowerCase() === 'platinum' ? '#d1d5db' : status.toLowerCase() === 'gold' ? '#333333' : status.toLowerCase() === 'silver' ? '#9ca3af' : '#94a3b8'}
        >
          <div className="text-center">
            <div className="text-3xl font-bold">{tierVisual.emoji}</div>
            <div className="luxury-heading-lg luxury-text-gradient mt-1">{points.toLocaleString()}</div>
            <div className="luxury-text-small">pts</div>
          </div>
        </ProgressCircle>

        {/* Points Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <TierIcon className="w-8 h-8 text-gray-700 dark:text-black" />
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-black">
                {tierVisual.emoji} {isHebrew ? currentTierConfig.nameHe : currentTierConfig.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {isHebrew ? 'נקודות נוכחיות' : 'Current Tier Status'}
              </div>
            </div>
          </div>
          <Badge className="luxury-badge-gold text-white border-0 px-4 py-1.5">
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

function LoyaltyOperatingStrip({ isHebrew }: { isHebrew: boolean }) {
  const items = [
    {
      icon: Crown,
      title: isHebrew ? 'כרטיס Prestige Wallet' : 'Prestige Wallet Pass',
      text: isHebrew ? 'QR אישי, סטטוס חבר, יתרות וקישורים לפעולה.' : 'Unique QR, member status, balances and action links.',
    },
    {
      icon: Gift,
      title: isHebrew ? 'הטבות וימי הולדת' : 'Benefits & Birthdays',
      text: isHebrew ? 'הטבות נפרדות וברורות כדי לא לערבב מתנות, החזרים ומבצעים.' : 'Separate benefits so gifts, refunds and promotions never mix.',
    },
    {
      icon: Shield,
      title: isHebrew ? 'כל מימוש מתועד' : 'Every redemption tracked',
      text: isHebrew ? 'היסטוריית מימוש, יתרה, מקור קרדיט ותוקף מוצגים למשתמש ולאדמין.' : 'Redemption history, balance, credit source and expiry visible to user and admin.',
    },
  ];

  return (
    <div className="luxury-glass-card luxury-shadow-lg mb-6 p-5 border border-[#b0841c]/20" style={{ background: 'linear-gradient(135deg,#ffffff 0%,#fbf7ec 100%)' }}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.24em] uppercase font-bold" style={{ color: '#b0841c' }}>
            Loyalty Operating System
          </p>
          <h2 className="text-2xl font-semibold text-gray-950 tracking-[-0.03em] mt-1">
            {isHebrew ? 'נאמנות שהיא מוצר אמיתי, לא רק נקודות' : 'Loyalty as a real product, not just points'}
          </h2>
        </div>
        <a href="/wallet-download" className="inline-flex items-center justify-center px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white bg-gray-950 no-underline" style={{ borderRadius: '6px' }}>
          {isHebrew ? 'הורד Pass' : 'Download Pass'}
        </a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="bg-white border border-gray-100 p-4" style={{ borderRadius: '8px' }}>
            <Icon className="w-5 h-5 mb-3" style={{ color: '#b0841c' }} />
            <h3 className="text-sm font-bold text-gray-950">{title}</h3>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ⁦Pet Wash™⁩ Loyalty Dashboard
export default function LoyaltyDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  const mockRewards = [
    { id: 1, name: isHebrew ? 'שטיפה חינם' : 'Free Wash', points: 500, available: false },
    { id: 2, name: isHebrew ? '10% הנחה' : '10% Discount', points: 200, available: true },
    { id: 3, name: isHebrew ? 'שדרוג VIP' : 'VIP Upgrade', points: 1000, available: false },
    { id: 4, name: isHebrew ? 'מוצר חינם' : 'Free Product', points: 300, available: true },
  ];

  const { data: loyaltyProfile } = useQuery<any>({
    queryKey: ['/api/loyalty/profile'],
  });

  const currentTier = loyaltyProfile?.tier ?? 'bronze';
  const currentPoints = loyaltyProfile?.points ?? 0;
  const mockPointsHistory = loyaltyProfile?.pointsHistory ?? [0, 0, 0, 0, currentPoints];

  // T012: Gemini AI personalized loyalty message
  const [aiLoyaltyMsg, setAiLoyaltyMsg]     = useState<string | null>(null);
  const [fetchingAiMsg, setFetchingAiMsg]   = useState(false);

  const fetchAiLoyaltyMessage = async () => {
    setFetchingAiMsg(true);
    try {
      const tierConfigs = TIER_CONFIGS;
      const currentTierConfig = tierConfigs.find(t => t.id === currentTier.toLowerCase());
      const currentIdx = tierConfigs.findIndex(t => t.id === currentTier.toLowerCase());
      const nextTierConfig = tierConfigs[currentIdx + 1];
      const nextTierPoints = nextTierConfig ? nextTierConfig.threshold - currentPoints : 0;
      const totalWashes = loyaltyProfile?.totalWashes || 0;

      const res = await apiRequest('POST', '/api/loyalty/ai-rewards-message', {
        tier: currentTier.toLowerCase(),
        points: currentPoints,
        totalWashes,
        nextTierPoints: Math.max(0, nextTierPoints),
      });
      const data = await res.json();
      setAiLoyaltyMsg(data.message || null);
    } catch {
      setAiLoyaltyMsg('Your loyalty means everything to us, PetWash™ member! Keep washing, keep shining. 🐾');
    } finally {
      setFetchingAiMsg(false);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
        <div className="luxury-container">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8 luxury-animate-fade-in">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="luxury-heading-xl">
                  {isHebrew ? '🏆 תוכנית הנאמנות ⁦Pet Wash™⁩' : '🏆 ⁦Pet Wash™⁩ Loyalty Program'}
                </h1>
                <span className="px-2 py-0.5 text-[8px] tracking-[0.15em] uppercase font-semibold bg-amber-100 text-amber-700 border border-amber-200/60 rounded-sm dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40">
                  {isHebrew ? 'חבר' : 'Member'}
                </span>
              </div>
              <p className="luxury-text-body">
                {isHebrew ? 'צבור נקודות וקבל פרסים מדהימים' : 'Earn points and get amazing rewards'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
              <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </div>
          </div>

          <LoyaltyOperatingStrip isHebrew={isHebrew} />

          {/* T012: Gemini AI Personalized Loyalty Message */}
          <div className="luxury-glass-card luxury-shadow-lg mb-6 luxury-animate-fade-in p-5 border border-amber-100/60 dark:border-amber-700/30" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 60%, #fef3c7 100%)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg,#b0841c,#735511)' }}>
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-black text-sm">
                  {isHebrew ? 'מסר אישי מ-AI' : 'Your AI Concierge Message'}
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {isHebrew ? 'מסר מותאם אישית מ-Gemini' : 'Personalized by Gemini'}
                </p>
              </div>
            </div>
            {aiLoyaltyMsg ? (
              <p className="text-sm text-gray-700 dark:text-black leading-relaxed bg-white/60 dark:bg-white/5 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-800/30 mb-3 italic">
                {aiLoyaltyMsg}
              </p>
            ) : (
              <p className="text-xs text-amber-500 italic mb-3">
                {isHebrew ? 'לחץ כדי לקבל מסר אישי מ-AI על הנאמנות שלך.' : 'Tap to receive a personalized AI message about your loyalty status.'}
              </p>
            )}
            <button onClick={fetchAiLoyaltyMessage} disabled={fetchingAiMsg}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-all shadow-sm"
              style={{ background: 'linear-gradient(135deg,#b0841c,#735511)' }}>
              {fetchingAiMsg
                ? <><RefreshCw className="h-3 w-3 animate-spin" /> {isHebrew ? 'יוצר מסר…' : 'Generating…'}</>
                : <><Sparkles className="h-3 w-3" /> {aiLoyaltyMsg ? (isHebrew ? 'מסר חדש' : 'New Message') : (isHebrew ? 'קבל מסר AI' : 'Get AI Message')}</>
              }
            </button>
          </div>

          {/* Main Loyalty Widget Card */}
          <Card className="luxury-glass-card luxury-shadow-lg mb-8 overflow-hidden luxury-animate-slide-up luxury-delay-1">
            <CardHeader className="luxury-bg-primary text-white">
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
          <div className="mb-8 luxury-animate-slide-up luxury-delay-2">
            <h2 className="luxury-heading-md mb-6 flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <Trophy className="w-6 h-6 luxury-text-gradient" />
              </div>
              {isHebrew ? 'מערכת דירוג 7 כוכבים' : '7-Star Tier System'}
            </h2>
            <div className="luxury-grid-4">
              {TIER_CONFIGS.map((tierConfig, index) => {
                const visualConfig = TIER_VISUAL_CONFIG[tierConfig.id];
                const Icon = visualConfig.icon;
                const isCurrent = tierConfig.id === currentTier.toLowerCase();
                
                return (
                  <Card 
                    key={tierConfig.id}
                    className={`luxury-glass-card luxury-shadow-lg relative overflow-hidden luxury-hover-lift luxury-animate-scale-in luxury-delay-${index + 3} ${
                      isCurrent 
                        ? 'ring-4 ring-blue-500 scale-105' 
                        : ''
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
                            <div className="text-base font-bold text-gray-900 dark:text-black">
                              {visualConfig.emoji} {isHebrew ? tierConfig.nameHe : tierConfig.name}
                            </div>
                          </div>
                        </div>
                        {isCurrent && (
                          <Badge className="luxury-badge-gold text-xs">
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
                          <div className="flex items-center gap-2 text-gray-700 dark:text-black">
                            <Gift className="w-3 h-3 text-green-600" />
                            <span>{tierConfig.benefits.discountPercent}% {isHebrew ? 'הנחה' : 'Discount'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700 dark:text-black">
                            <TrendingUp className="w-3 h-3 text-blue-600" />
                            <span>{tierConfig.benefits.pointsMultiplier}x {isHebrew ? 'נקודות' : 'Points'}</span>
                          </div>
                          {tierConfig.benefits.conciergeService && (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-black">
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
          <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-slide-up luxury-delay-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#b0841c]/20 to-stone-950/10">
                <Gift className="w-6 h-6" style={{ color: '#b0841c' }} />
              </div>
              <h3 className="luxury-heading-md">
                {isHebrew ? 'קטלוג הפרסים' : 'Rewards Catalog'}
              </h3>
            </div>
            
            <div className="luxury-grid-2">
              {mockRewards.map((reward, index) => (
                <div
                  key={reward.id}
                  className={`luxury-glass-card luxury-hover-glow p-5 luxury-animate-scale-in ${
                    reward.available
                      ? 'border-green-400/50'
                      : 'opacity-60'
                  }`}
                  style={{ animationDelay: `${(index + 11) * 100}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-lg text-gray-900 dark:text-black mb-1">
                        {reward.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {reward.points.toLocaleString()} {isHebrew ? 'נקודות' : 'points'}
                        </span>
                      </div>
                    </div>
                    <button
                      disabled={!reward.available}
                      className={reward.available 
                        ? 'luxury-btn-primary text-sm px-4 py-2' 
                        : 'luxury-btn-secondary text-sm px-4 py-2 opacity-50 cursor-not-allowed'}
                    >
                      {isHebrew ? 'פדה' : 'Redeem'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LUXURY Points Activity Chart (Transaction History) */}
          <div className="luxury-glass-minimal luxury-hover-lift p-8 mt-8 luxury-animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="luxury-heading-md">
                {isHebrew ? 'היסטוריית נקודות' : 'Points History'}
              </h3>
            </div>
            
            <div className="luxury-glass-minimal p-6">
              <SparklineChart data={mockPointsHistory} color="#3B82F6" height={120} />
            </div>
            
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/30 rounded-full px-6 py-3">
                <Sparkles className="w-4 h-4 text-green-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-black">
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
              ⁦Pet Wash™⁩ Loyalty Engine 2025-2026 • {isHebrew ? 'בנוי עם טכנולוגיה מתקדמת' : 'Built with Advanced Technology'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
