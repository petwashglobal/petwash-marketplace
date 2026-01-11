import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  MapPin,
  Sparkles,
  Award,
  Dog,
  Heart,
  Bell,
  Sun,
  Moon,
  Trophy,
  Activity,
  Syringe,
  Mail,
  Shield,
  Lock,
  ChevronRight,
  Loader2,
  Crown,
  Wallet,
  QrCode,
  Gift,
  Star,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { PersonalizedGreeting } from '@/components/PersonalizedGreeting';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

interface WalletSummary {
  walletId: string;
  userId: string;
  egiftBalanceCents: number;
  washPackageCredits: number;
  loyaltyPointsBalance: number;
  promoBalanceCents: number;
  referralBalanceCents: number;
  totalCreditsValueCents: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
}

const DashboardWidget = ({ 
  title, 
  children, 
  icon: Icon, 
  onAction,
  className = '',
  accentColor = 'from-[rgba(212,175,55,0.25)] to-[rgba(212,175,55,0.1)]',
  iconColor = 'text-[#d4af37]'
}: { 
  title: string; 
  children: React.ReactNode; 
  icon?: any; 
  onAction?: () => void;
  className?: string;
  accentColor?: string;
  iconColor?: string;
}) => {
  return (
    <div className={cn('luxury-dark-card overflow-hidden h-full', className)}>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[rgba(232,230,240,0.1)] to-transparent" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center', accentColor)}>
                <Icon className={cn('w-5 h-5', iconColor)} />
              </div>
            )}
            <h3 className="luxury-dark-heading-sm text-base truncate">{title}</h3>
          </div>
          {onAction && (
            <button onClick={onAction} className="luxury-dark-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

const NextAppointmentWidget = ({ booking }: { booking: any }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  if (!booking) {
    return (
      <p className="luxury-dark-text-body text-center py-6">
        {isHebrew ? 'אין הזמנות קרובות' : 'No upcoming bookings'}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/25 to-blue-500/15 flex items-center justify-center">
          <Dog className="w-7 h-7 text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="luxury-dark-heading-sm text-lg mb-1">{booking.service}</p>
          <p className="luxury-dark-text-small text-xs">{booking.date} at {booking.time}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button className="luxury-dark-btn-primary flex-1 py-3">
          {isHebrew ? 'תזמן מחדש' : 'Reschedule'}
        </button>
        <button className="luxury-dark-btn-ghost flex-1 py-3 border border-[rgba(232,230,240,0.1)] flex items-center justify-center gap-2">
          <MapPin className="w-4 h-4" />
          {isHebrew ? 'ניווט' : 'Directions'}
        </button>
      </div>
    </div>
  );
};

const tierLabels: Record<string, { en: string; he: string }> = {
  bronze: { en: 'Bronze', he: 'ברונזה' },
  silver: { en: 'Silver', he: 'כסף' },
  gold: { en: 'Gold', he: 'זהב' },
  platinum: { en: 'Platinum', he: 'פלטינום' },
  diamond: { en: 'Diamond', he: 'יהלום' },
  emerald: { en: 'Emerald', he: 'אמרלד' },
  royal: { en: 'Royal', he: 'מלכותי' },
};

const LoyaltyWidget = ({ points, status, maxPoints = 1000 }: { points: number; status: string; maxPoints?: number; }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [, setLocation] = useLocation();
  const progress = Math.min((points / maxPoints) * 100, 100);
  const tierKey = status.toLowerCase();
  const tierLabel = tierLabels[tierKey] || tierLabels.bronze;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="luxury-stat-value luxury-dark-text-gold text-3xl">{points.toLocaleString()}</p>
          <p className="luxury-dark-text-small text-xs mt-1">{isHebrew ? 'נקודות נוכחיות' : 'Current Points'}</p>
          <div className="luxury-dark-badge-gold mt-3 inline-flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>{isHebrew ? tierLabel.he : tierLabel.en} {isHebrew ? 'חבר' : 'Member'}</span>
          </div>
        </div>
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle cx="40" cy="40" r="34" stroke="rgba(232,230,240,0.08)" strokeWidth="6" fill="transparent" />
            <circle
              cx="40" cy="40" r="34"
              stroke="url(#luxuryGradient)"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="luxuryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d4af37" />
                <stop offset="100%" stopColor="#f0d860" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="luxury-dark-text-gold text-sm font-semibold">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
      <div className="h-2 bg-[rgba(232,230,240,0.08)] rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#d4af37] to-[#f0d860] rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <button 
        onClick={() => setLocation('/loyalty/dashboard')}
        className="w-full luxury-dark-btn-gold py-3 flex items-center justify-center gap-2"
      >
        <Star className="w-4 h-4" />
        {isHebrew ? 'צפה בתוכנית הנאמנות' : 'View Loyalty Program'}
      </button>
    </div>
  );
};

const WalletQuickWidget = ({ wallet }: { wallet: WalletSummary | null }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [, setLocation] = useLocation();

  const formatCurrency = (cents: number) => `₪${(cents / 100).toFixed(0)}`;

  if (!wallet) {
    return (
      <div className="text-center py-6">
        <Wallet className="w-10 h-10 mx-auto mb-3 text-[rgba(149,144,168,0.5)]" />
        <p className="luxury-dark-text-body">{isHebrew ? 'טוען ארנק...' : 'Loading wallet...'}</p>
      </div>
    );
  }

  const tierBadges: Record<string, string> = {
    bronze: '🥉',
    silver: '🥈', 
    gold: '🥇',
    platinum: '💎',
    diamond: '💠',
    emerald: '💚',
    royal: '👑'
  };

  return (
    <div className="space-y-4">
      <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-[rgba(212,175,55,0.15)] to-[rgba(212,175,55,0.05)]">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-lg">{tierBadges[wallet.loyaltyTier?.toLowerCase()] || '⭐'}</span>
          <span className="luxury-dark-text-small text-xs uppercase tracking-wider">{wallet.loyaltyTier || 'Bronze'}</span>
        </div>
        <p className="luxury-stat-value luxury-dark-text-gold text-3xl">{formatCurrency(wallet.totalCreditsValueCents)}</p>
        <p className="luxury-dark-text-small text-xs mt-1">{isHebrew ? 'סה"כ קרדיט' : 'Total Credits'}</p>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-[rgba(232,230,240,0.03)] text-center">
          <Gift className="w-4 h-4 mx-auto mb-1 text-pink-400" />
          <p className="text-white font-medium text-sm">{formatCurrency(wallet.egiftBalanceCents)}</p>
          <p className="luxury-dark-text-small text-[10px]">{isHebrew ? 'מתנות' : 'E-Gift'}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-[rgba(232,230,240,0.03)] text-center">
          <Sparkles className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
          <p className="text-white font-medium text-sm">{wallet.washPackageCredits}</p>
          <p className="luxury-dark-text-small text-[10px]">{isHebrew ? 'שטיפות' : 'Washes'}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-[rgba(232,230,240,0.03)] text-center">
          <Star className="w-4 h-4 mx-auto mb-1 text-amber-400" />
          <p className="text-white font-medium text-sm">{wallet.loyaltyPointsBalance?.toLocaleString() || 0}</p>
          <p className="luxury-dark-text-small text-[10px]">{isHebrew ? 'נקודות' : 'Points'}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setLocation('/my-wallet')}
          className="flex-1 luxury-dark-btn-ghost py-2.5 text-sm flex items-center justify-center gap-2 border border-[rgba(232,230,240,0.1)]"
        >
          <Wallet className="w-4 h-4" />
          {isHebrew ? 'הארנק שלי' : 'My Wallet'}
        </button>
        <button 
          onClick={() => setLocation('/stations')}
          className="flex-1 luxury-dark-btn-gold py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <QrCode className="w-4 h-4" />
          {isHebrew ? 'מימוש' : 'Redeem'}
        </button>
      </div>
    </div>
  );
};

const QuickBookWidget = () => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="flex items-center gap-4 luxury-dark-surface p-5 rounded-xl border-l-2 border-l-[#d4af37]">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/25 to-cyan-500/15 flex items-center justify-center">
        <Dog className="w-7 h-7 text-purple-400" />
      </div>
      <div className="flex-1">
        <p className="luxury-dark-heading-sm text-base mb-1">{isHebrew ? 'מוכן לשטיפה נוספת?' : 'Ready for another wash?'}</p>
        <p className="luxury-dark-text-small text-xs">{isHebrew ? 'הזמן עכשיו וקבל 10% הנחה' : 'Book now and get 10% off'}</p>
      </div>
      <button className="luxury-dark-btn-gold whitespace-nowrap py-3 px-5">{isHebrew ? 'הזמן!' : 'Book!'}</button>
    </div>
  );
};

const AITipWidget = ({ tip }: { tip: string }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="flex gap-4 luxury-dark-surface p-6 rounded-xl border-l-2 border-l-[#d4af37]">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-500/15 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-6 h-6 text-amber-400" />
      </div>
      <div>
        <p className="luxury-dark-heading-sm text-base mb-2">{isHebrew ? 'טיפ AI לטיפול בחיית מחמד' : 'AI Pet Care Tip'}</p>
        <p className="luxury-dark-text-body">{tip}</p>
      </div>
    </div>
  );
};

const PetHealthSummaryWidget = ({ petData }: { petData: any }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="text-center luxury-dark-surface p-5 rounded-xl">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-500/25 to-green-500/15 flex items-center justify-center">
          <Activity className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="luxury-dark-heading-lg luxury-dark-text-gradient text-2xl">{petData.lastWeight} kg</p>
        <p className="luxury-dark-text-small text-xs mt-1">{isHebrew ? 'משקל אחרון' : 'Last Weight'}</p>
      </div>
      <div className="text-center luxury-dark-surface p-5 rounded-xl">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-rose-500/25 to-pink-500/15 flex items-center justify-center">
          <Heart className="w-6 h-6 text-rose-400" />
        </div>
        <p className="luxury-dark-heading-lg luxury-dark-text-gradient text-2xl">{petData.healthScore}%</p>
        <p className="luxury-dark-text-small text-xs mt-1">{isHebrew ? 'ציון בריאות' : 'Health Score'}</p>
      </div>
    </div>
  );
};

const VaccineCalendarWidget = ({ vaccines }: { vaccines: any[] }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const getVaccineStatus = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return { label: isHebrew ? 'באיחור' : 'Overdue', bgClass: 'bg-red-500/15', textClass: 'text-red-400' };
    if (daysUntil <= 7) return { label: isHebrew ? 'דחוף' : 'Urgent', bgClass: 'bg-amber-500/15', textClass: 'text-amber-400' };
    if (daysUntil <= 30) return { label: isHebrew ? 'קרוב' : 'Soon', bgClass: 'bg-yellow-500/15', textClass: 'text-yellow-400' };
    return { label: isHebrew ? 'מתוזמן' : 'Scheduled', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400' };
  };

  if (!vaccines || vaccines.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center">
          <Syringe className="w-7 h-7 text-[rgba(149,144,168,0.5)]" />
        </div>
        <p className="luxury-dark-text-body mb-4">{isHebrew ? 'אין חיסונים מתוזמנים' : 'No scheduled vaccines'}</p>
        <button className="luxury-dark-btn-primary">{isHebrew ? 'הוסף חיסון' : 'Add Vaccine'}</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vaccines.map((vaccine, idx) => {
        const status = getVaccineStatus(vaccine.dueDate);
        return (
          <div key={idx} className="luxury-credit-item flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', status.bgClass)}>
                <Syringe className={cn('w-4 h-4', status.textClass)} />
              </div>
              <div className="flex-1">
                <p className="luxury-dark-heading-sm text-sm">{vaccine.name}</p>
                <p className="luxury-dark-text-small text-xs">{isHebrew ? 'תאריך יעד:' : 'Due:'} {new Date(vaccine.dueDate).toLocaleDateString()}</p>
              </div>
            </div>
            <span className={cn('luxury-dark-badge text-[10px]', status.bgClass, status.textClass)}>{status.label}</span>
          </div>
        );
      })}
      <button className="luxury-dark-btn-ghost w-full mt-4 flex items-center justify-center gap-2 border border-[rgba(232,230,240,0.1)] py-2.5">
        <Bell className="w-4 h-4" />
        {isHebrew ? 'הגדר תזכורות' : 'Set Reminders'}
      </button>
    </div>
  );
};

const PrivateInboxWidget = () => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { user: firebaseUser } = useFirebaseAuth();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread/count'],
    enabled: !!firebaseUser,
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 luxury-dark-surface px-4 py-2.5 rounded-xl">
        <Shield className="w-4 h-4 text-emerald-400" />
        <span className="luxury-dark-text-small text-xs text-emerald-300">
          {isHebrew ? 'מוגן לפי חוק הפרטיות הישראלי 2025' : 'Israeli Privacy Law 2025 Protected'}
        </span>
      </div>

      <div className="flex items-center justify-between luxury-credit-item">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/25 to-blue-500/15 flex items-center justify-center">
            <Mail className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="luxury-dark-heading-sm text-sm">{isHebrew ? 'הודעות שלא נקראו' : 'Unread Messages'}</p>
            <p className="luxury-dark-text-small text-xs">{isHebrew ? 'עם חתימה קריפטוגרפית' : 'With cryptographic signature'}</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-[#d4af37] text-[#0a0a0f] text-sm px-3 py-1">{unreadCount}</Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 luxury-dark-text-small text-xs">
          <Lock className="w-3.5 h-3.5 text-purple-400" />
          <span>{isHebrew ? 'הצפנה מקצה לקצה' : 'End-to-end encryption'}</span>
        </div>
        <div className="flex items-center gap-2 luxury-dark-text-small text-xs">
          <Shield className="w-3.5 h-3.5 text-purple-400" />
          <span>{isHebrew ? 'יומן ביקורת SHA-256' : 'SHA-256 audit trail'}</span>
        </div>
      </div>

      <Link href="/personal-inbox">
        <button className="luxury-dark-btn-gold w-full flex items-center justify-center gap-2 py-3" data-testid="button-open-inbox">
          <Mail className="w-4 h-4" />
          {isHebrew ? 'פתח תיבת דואר' : 'Open Inbox'}
        </button>
      </Link>
    </div>
  );
};

export default function Dashboard() {
  const { user: firebaseUser, loading } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  const mockBooking = {
    service: isHebrew ? 'טיפוח מלא' : 'Full Grooming',
    date: 'Fri, 15 Nov',
    time: '10:00 AM',
  };

  const mockPetData = { lastWeight: 25.4, healthScore: 92, lastVisit: '2024-10-20' };

  const mockAITip = isHebrew
    ? "עברו 4 שבועות מאז חיתוך הציפורניים האחרון של רובר. תזמן אותו עכשיו לבריאות כפות מיטבית!"
    : "It's been 4 weeks since Rover's last nail trim. Schedule it now for optimal paw health!";

  const mockVaccines = [
    { name: isHebrew ? 'חיסון כלבת' : 'Rabies Vaccine', dueDate: '2025-11-05' },
    { name: isHebrew ? 'DHPP' : 'DHPP', dueDate: '2025-11-20' },
    { name: 'Leptospirosis', dueDate: '2025-12-15' },
  ];

  const { data: profileData } = useQuery({
    queryKey: ['/api/simple-auth/me'],
    enabled: !!firebaseUser,
  });

  const { data: walletData } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
    enabled: !!firebaseUser,
  });

  const wallet = walletData?.wallet || null;
  const userProfile = profileData?.user;
  const userName = userProfile?.firstName || firebaseUser?.displayName?.split(' ')[0] || 'User';

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  if (loading) {
    return (
      <Layout>
        <div className="luxury-dark-mesh min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#d4af37] mx-auto mb-4" />
            <p className="luxury-dark-text-body">{isHebrew ? 'טוען...' : 'Loading...'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="luxury-dark-mesh min-h-screen py-6 sm:py-10 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-10 gap-6 luxury-animate-fade-in">
            <div>
              <h1 className="luxury-dark-heading-xl mb-2">
                {isHebrew ? `שלום, ${userName}!` : `Welcome Back, ${userName}!`}
              </h1>
              <p className="luxury-dark-text-body">{isHebrew ? 'לוח הבקרה שלך' : 'Your Dashboard'}</p>
            </div>
            <div className="flex items-center gap-4 luxury-dark-surface px-4 py-2.5 rounded-2xl">
              <button className="p-2.5 hover:bg-[rgba(232,230,240,0.05)] rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-[#d4af37]" />
              </button>
              <div className="w-px h-7 bg-[rgba(232,230,240,0.1)]" />
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-[rgba(149,144,168,0.6)]" />
                <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                <Moon className="w-4 h-4 text-[rgba(149,144,168,0.6)]" />
              </div>
            </div>
          </div>

          <div className="luxury-animate-fade-in luxury-delay-1 mb-8">
            <PersonalizedGreeting />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="luxury-animate-slide-up luxury-delay-2">
              <DashboardWidget
                title={isHebrew ? 'התור הבא' : 'Next Appointment'}
                icon={Calendar}
                onAction={() => console.log('Manage appointments')}
                accentColor="from-purple-500/25 to-blue-500/15"
                iconColor="text-purple-400"
              >
                <NextAppointmentWidget booking={mockBooking} />
              </DashboardWidget>
            </div>

            <div className="luxury-animate-slide-up luxury-delay-3">
              <DashboardWidget 
                title={isHebrew ? 'פעולה מהירה' : 'Quick Action'}
                icon={Sparkles}
                accentColor="from-cyan-500/25 to-blue-500/15"
                iconColor="text-cyan-400"
              >
                <QuickBookWidget />
              </DashboardWidget>
            </div>

            <div className="luxury-animate-slide-up luxury-delay-4">
              <DashboardWidget
                title={isHebrew ? 'סטטוס נאמנות' : 'Loyalty Status'}
                icon={Crown}
                accentColor="from-amber-500/25 to-yellow-500/15"
                iconColor="text-amber-400"
              >
                <LoyaltyWidget 
                  points={wallet?.loyaltyPointsBalance || 0} 
                  status={wallet?.loyaltyTier || 'bronze'} 
                  maxPoints={wallet?.tierPointsThisYear ? wallet.tierPointsThisYear + 500 : 1000} 
                />
              </DashboardWidget>
            </div>

            <div className="luxury-animate-slide-up luxury-delay-5">
              <DashboardWidget
                title={isHebrew ? 'הארנק שלי' : 'My Wallet'}
                icon={Wallet}
                accentColor="from-pink-500/25 to-rose-500/15"
                iconColor="text-pink-400"
              >
                <WalletQuickWidget wallet={wallet} />
              </DashboardWidget>
            </div>

            <div className="luxury-animate-slide-up luxury-delay-6">
              <DashboardWidget
                title={isHebrew ? 'תמונת מצב בריאותית' : 'Pet Health Snapshot'}
                icon={Activity}
                onAction={() => console.log('Full profile')}
                accentColor="from-emerald-500/25 to-green-500/15"
                iconColor="text-emerald-400"
              >
                <PetHealthSummaryWidget petData={mockPetData} />
              </DashboardWidget>
            </div>

            <div className="luxury-animate-slide-up luxury-delay-7">
              <DashboardWidget
                title={isHebrew ? 'לוח חיסונים' : 'Vaccine Calendar'}
                icon={Syringe}
                onAction={() => console.log('Manage vaccines')}
                accentColor="from-blue-500/25 to-cyan-500/15"
                iconColor="text-blue-400"
              >
                <VaccineCalendarWidget vaccines={mockVaccines} />
              </DashboardWidget>
            </div>

            <div className="luxury-animate-slide-up luxury-delay-7">
              <DashboardWidget
                title={isHebrew ? 'תיבת דואר פרטית' : 'Private Inbox'}
                icon={Mail}
                accentColor="from-purple-500/25 to-pink-500/15"
                iconColor="text-purple-400"
              >
                <PrivateInboxWidget />
              </DashboardWidget>
            </div>

            <div className="md:col-span-2 lg:col-span-3 luxury-animate-slide-up luxury-delay-8">
              <DashboardWidget
                title={isHebrew ? 'טיפול מותאם אישית' : 'Personalized Pet Care'}
                icon={Sparkles}
                accentColor="from-amber-500/25 to-orange-500/15"
                iconColor="text-amber-400"
              >
                <AITipWidget tip={mockAITip} />
              </DashboardWidget>
            </div>
          </div>

          <div className="luxury-dark-divider mt-12" />
          <div className="mt-8 text-center luxury-animate-fade-in luxury-delay-8">
            <p className="luxury-dark-text-small text-xs">
              Pet Wash™ 2025-2026 • {isHebrew ? 'טכנולוגיה מתקדמת' : 'Advanced Technology'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
