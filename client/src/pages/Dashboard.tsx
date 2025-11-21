import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  MapPin,
  Sparkles,
  Award,
  TrendingUp,
  Dog,
  Heart,
  Bell,
  Sun,
  Moon,
  Trophy,
  Activity,
  Syringe,
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { PersonalizedGreeting } from '@/components/PersonalizedGreeting';

// Luxury Widget Card Component
const DashboardWidget = ({ 
  title, 
  children, 
  icon: Icon, 
  onAction,
  className = ''
}: { 
  title: string; 
  children: React.ReactNode; 
  icon?: any; 
  onAction?: () => void;
  className?: string;
}) => {
  return (
    <div className={`luxury-glass-card luxury-hover-glow h-full ${className}`}>
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                <Icon className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              </div>
            )}
            <h3 className="luxury-heading-sm truncate">{title}</h3>
          </div>
          {onAction && (
            <button 
              onClick={onAction} 
              className="luxury-btn-ghost text-xs sm:text-sm flex-shrink-0 px-3 py-1.5"
            >
              Manage
            </button>
          )}
        </div>
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
};

// Next Appointment Widget
const NextAppointmentWidget = ({ booking }: { booking: any }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  if (!booking) {
    return (
      <p className="luxury-text-body text-center py-4">
        {isHebrew ? 'אין הזמנות קרובות' : 'No upcoming bookings'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
          <Dog className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="luxury-heading-sm mb-1">
            {booking.service}
          </p>
          <p className="luxury-text-small">
            {booking.date} at {booking.time}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button className="luxury-btn-primary flex-1">
          {isHebrew ? 'תזמן מחדש' : 'Reschedule'}
        </button>
        <button className="luxury-btn-secondary flex-1 flex items-center justify-center gap-2">
          <MapPin className="w-4 h-4" />
          {isHebrew ? 'ניווט' : 'Directions'}
        </button>
      </div>
    </div>
  );
};

// Loyalty Points Widget
const LoyaltyWidget = ({ 
  points, 
  status, 
  maxPoints = 1000 
}: { 
  points: number; 
  status: string; 
  maxPoints?: number;
}) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const progress = (points / maxPoints) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="luxury-heading-lg luxury-text-gradient">
            {points.toLocaleString()}
          </p>
          <p className="luxury-text-small mt-1">
            {isHebrew ? 'נקודות נוכחיות' : 'Current Points'}
          </p>
          <div className="luxury-badge-gold mt-3 inline-flex">
            <Trophy className="w-4 h-4" />
            <span>{status} {isHebrew ? 'חבר' : 'Member'}</span>
          </div>
        </div>
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="url(#gradient)"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#667eea" />
                <stop offset="100%" stopColor="#764ba2" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="luxury-heading-sm luxury-text-gradient">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
      <Progress value={progress} className="h-2.5 bg-gray-200 dark:bg-gray-700">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </Progress>
    </div>
  );
};

// Quick Book Widget
const QuickBookWidget = () => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="flex items-center gap-4 luxury-glass-panel p-5 rounded-2xl border-l-4 border-purple-500">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
        <Dog className="w-10 h-10 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="flex-1">
        <p className="luxury-heading-sm mb-1">
          {isHebrew ? 'מוכן לשטיפה נוספת?' : 'Ready for another wash?'}
        </p>
        <p className="luxury-text-small">
          {isHebrew ? 'הזמן עכשיו וקבל 10% הנחה' : 'Book now and get 10% off'}
        </p>
      </div>
      <button className="luxury-btn-primary whitespace-nowrap">
        {isHebrew ? 'הזמן עכשיו!' : 'Book Now!'}
      </button>
    </div>
  );
};

// AI Tip Widget
const AITipWidget = ({ tip }: { tip: string }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="flex gap-4 luxury-glass-panel p-6 rounded-2xl border-l-4 border-purple-500 luxury-hover-lift">
      <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 h-fit">
        <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
      </div>
      <div>
        <p className="luxury-heading-sm mb-2">
          {isHebrew ? '💡 טיפ AI לטיפול בחיית מחמד' : '💡 AI Pet Care Tip'}
        </p>
        <p className="luxury-text-body">{tip}</p>
      </div>
    </div>
  );
};

// Pet Health Summary Widget
const PetHealthSummaryWidget = ({ petData }: { petData: any }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="luxury-grid-2 gap-4">
      <div className="text-center luxury-glass-minimal p-5 rounded-2xl luxury-hover-lift">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 w-fit mx-auto mb-3">
          <Activity className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <p className="luxury-heading-lg luxury-text-gradient">
          {petData.lastWeight} kg
        </p>
        <p className="luxury-text-small mt-1">
          {isHebrew ? 'משקל אחרון' : 'Last Weight'}
        </p>
      </div>
      <div className="text-center luxury-glass-minimal p-5 rounded-2xl luxury-hover-lift">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 w-fit mx-auto mb-3">
          <Heart className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <p className="luxury-heading-lg luxury-text-gradient">
          {petData.healthScore}%
        </p>
        <p className="luxury-text-small mt-1">
          {isHebrew ? 'ציון בריאות' : 'Health Score'}
        </p>
      </div>
    </div>
  );
};

// Vaccine Calendar Widget
const VaccineCalendarWidget = ({ vaccines }: { vaccines: any[] }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const getVaccineStatus = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return { status: 'overdue', color: 'red', label: isHebrew ? 'באיחור' : 'Overdue', bgClass: 'bg-red-100 dark:bg-red-900/30', textClass: 'text-red-700 dark:text-red-300' };
    if (daysUntil <= 7) return { status: 'urgent', color: 'orange', label: isHebrew ? 'דחוף' : 'Urgent', bgClass: 'bg-orange-100 dark:bg-orange-900/30', textClass: 'text-orange-700 dark:text-orange-300' };
    if (daysUntil <= 30) return { status: 'upcoming', color: 'yellow', label: isHebrew ? 'קרוב' : 'Soon', bgClass: 'bg-yellow-100 dark:bg-yellow-900/30', textClass: 'text-yellow-700 dark:text-yellow-300' };
    return { status: 'scheduled', color: 'green', label: isHebrew ? 'מתוזמן' : 'Scheduled', bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300' };
  };

  if (!vaccines || vaccines.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 w-fit mx-auto mb-4">
          <Syringe className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="luxury-text-body mb-4">
          {isHebrew ? 'אין חיסונים מתוזמנים' : 'No scheduled vaccines'}
        </p>
        <button className="luxury-btn-primary">
          {isHebrew ? 'הוסף חיסון' : 'Add Vaccine'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vaccines.map((vaccine, idx) => {
        const status = getVaccineStatus(vaccine.dueDate);
        return (
          <div
            key={idx}
            className="luxury-glass-minimal luxury-hover-lift p-4 rounded-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className={`p-2.5 rounded-xl ${status.bgClass}`}>
                <Syringe className={`w-4 h-4 ${status.textClass}`} />
              </div>
              <div className="flex-1">
                <p className="luxury-heading-sm">
                  {vaccine.name}
                </p>
                <p className="luxury-text-small">
                  {isHebrew ? 'תאריך יעד:' : 'Due:'} {new Date(vaccine.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className={`luxury-badge ${status.bgClass} ${status.textClass} border-0`}>
              {status.label}
            </div>
          </div>
        );
      })}
      <button className="luxury-btn-secondary w-full mt-4 flex items-center justify-center gap-2">
        <Bell className="w-4 h-4" />
        {isHebrew ? 'הגדר תזכורות' : 'Set Reminders'}
      </button>
    </div>
  );
};

// Main Dashboard Component
export default function Dashboard() {
  const { user: firebaseUser, loading } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  // Mock data (replace with real API calls)
  const mockBooking = {
    service: isHebrew ? 'טיפוח מלא' : 'Full Grooming',
    date: 'Fri, 15 Nov',
    time: '10:00 AM',
  };

  const mockPetData = {
    lastWeight: 25.4,
    healthScore: 92,
    lastVisit: '2024-10-20',
  };

  const mockAITip = isHebrew
    ? "עברו 4 שבועות מאז חיתוך הציפורניים האחרון של רובר. תזמן אותו עכשיו לבריאות כפות מיטבית!"
    : "It's been 4 weeks since Rover's last nail trim. Schedule it now for optimal paw health!";

  const mockVaccines = [
    { name: isHebrew ? 'חיסון כלבת' : 'Rabies Vaccine', dueDate: '2025-11-05' },
    { name: isHebrew ? 'DHPP' : 'DHPP', dueDate: '2025-11-20' },
    { name: 'Leptospirosis', dueDate: '2025-12-15' },
  ];

  // Query user profile
  const { data: profileData } = useQuery({
    queryKey: ['/api/simple-auth/me'],
    enabled: !!firebaseUser,
  });

  const userProfile = profileData?.user;
  const userName = userProfile?.firstName || firebaseUser?.displayName?.split(' ')[0] || 'User';

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
          <div className="text-center">
            <div className="luxury-spinner mx-auto mb-6"></div>
            <p className="luxury-text-body">
              {isHebrew ? 'טוען...' : 'Loading...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="luxury-container">
          {/* Luxury Header with Stagger Animation */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-12 gap-6 luxury-animate-fade-in">
            <div>
              <h1 className="luxury-heading-xl mb-2">
                {isHebrew ? `שלום, ${userName}! 👋` : `Welcome Back, ${userName}! 👋`}
              </h1>
              <p className="luxury-text-body">
                {isHebrew ? 'לוח הבקרה שלך' : 'Your Dashboard'}
              </p>
            </div>
            <div className="flex items-center gap-4 luxury-glass-minimal px-4 py-2.5 rounded-2xl">
              <button className="p-2.5 hover:bg-purple-500/10 rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </button>
              <div className="luxury-divider-vertical h-8"></div>
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>

          {/* Personalized AI Greeting */}
          <div className="luxury-animate-fade-in luxury-delay-1 mb-8">
            <PersonalizedGreeting />
          </div>

          {/* Luxury Widgets Grid with Stagger Animations */}
          <div className="luxury-grid-3 gap-6">
            {/* Next Appointment */}
            <div className="luxury-animate-slide-up luxury-delay-2">
              <DashboardWidget
                title={isHebrew ? '📅 התור הבא' : '📅 Next Appointment'}
                icon={Calendar}
                onAction={() => console.log('Manage appointments')}
                className="luxury-shadow-xl"
              >
                <NextAppointmentWidget booking={mockBooking} />
              </DashboardWidget>
            </div>

            {/* Quick Action */}
            <div className="luxury-animate-slide-up luxury-delay-3">
              <DashboardWidget 
                title={isHebrew ? '⚡ פעולה מהירה' : '⚡ Quick Action'}
                icon={Sparkles}
              >
                <QuickBookWidget />
              </DashboardWidget>
            </div>

            {/* Loyalty Status */}
            <div className="luxury-animate-slide-up luxury-delay-4">
              <DashboardWidget
                title={isHebrew ? '🏆 סטטוס נאמנות' : '🏆 Pet Loyalty Status'}
                icon={Award}
                onAction={() => console.log('View benefits')}
                className="luxury-shadow-xl"
              >
                <LoyaltyWidget points={400} status="Silver" maxPoints={1000} />
              </DashboardWidget>
            </div>

            {/* Pet Health */}
            <div className="luxury-animate-slide-up luxury-delay-5">
              <DashboardWidget
                title={isHebrew ? '🐕 תמונת מצב בריאותית' : '🐕 Pet Health Snapshot'}
                icon={Activity}
                onAction={() => console.log('Full profile')}
              >
                <PetHealthSummaryWidget petData={mockPetData} />
              </DashboardWidget>
            </div>

            {/* Vaccine Calendar & Reminders */}
            <div className="luxury-animate-slide-up luxury-delay-6">
              <DashboardWidget
                title={isHebrew ? '💉 לוח חיסונים ותזכורות' : '💉 Vaccine Calendar & Reminders'}
                icon={Syringe}
                onAction={() => console.log('Manage vaccines')}
              >
                <VaccineCalendarWidget vaccines={mockVaccines} />
              </DashboardWidget>
            </div>

            {/* AI Tip - Full Width */}
            <div className="lg:col-span-2 2xl:col-span-3 luxury-animate-slide-up luxury-delay-7">
              <DashboardWidget
                title={isHebrew ? '🤖 טיפול מותאם אישית' : '🤖 Personalized Pet Care'}
                icon={Sparkles}
                className="luxury-shadow-lg"
              >
                <AITipWidget tip={mockAITip} />
              </DashboardWidget>
            </div>
          </div>

          {/* Luxury Footer */}
          <div className="luxury-divider mt-12"></div>
          <div className="mt-8 text-center luxury-animate-fade-in luxury-delay-8">
            <p className="luxury-text-small">
              Pet Wash™ 2025-2026 • {isHebrew ? 'טכנולוגיה מתקדמת' : 'Advanced Technology'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
