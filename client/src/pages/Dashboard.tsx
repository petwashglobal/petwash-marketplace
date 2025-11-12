import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// Widget Card Component
const DashboardWidget = ({ 
  title, 
  children, 
  icon: Icon, 
  onAction 
}: { 
  title: string; 
  children: React.ReactNode; 
  icon?: any; 
  onAction?: () => void;
}) => {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-200 h-full">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
            <span className="truncate">{title}</span>
          </div>
          {onAction && (
            <Button variant="ghost" size="sm" onClick={onAction} className="text-xs sm:text-sm flex-shrink-0">
              Manage
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
};

// Next Appointment Widget
const NextAppointmentWidget = ({ booking }: { booking: any }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  if (!booking) {
    return (
      <p className="text-gray-500 dark:text-gray-400">
        {isHebrew ? 'אין הזמנות קרובות' : 'No upcoming bookings'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Dog className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        <div className="flex-1">
          <p className="font-bold text-lg text-gray-900 dark:text-white">
            {booking.service}
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            {booking.date} at {booking.time}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1">
          {isHebrew ? 'תזמן מחדש' : 'Reschedule'}
        </Button>
        <Button size="sm" variant="outline" className="flex-1">
          <MapPin className="w-4 h-4 mr-1" />
          {isHebrew ? 'ניווט' : 'Directions'}
        </Button>
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
          <p className="text-4xl font-bold text-gray-900 dark:text-white">
            {points.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isHebrew ? 'נקודות נוכחיות' : 'Current Points'}
          </p>
          <Badge className="mt-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
            <Trophy className="w-3 h-3 mr-1" />
            {status} {isHebrew ? 'חבר' : 'Member'}
          </Badge>
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
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
              className="text-blue-600 dark:text-blue-400"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
};

// Quick Book Widget
const QuickBookWidget = () => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="flex items-center gap-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 p-4 rounded-lg">
      <Dog className="w-12 h-12 text-orange-600 dark:text-orange-400" />
      <div className="flex-1">
        <p className="font-semibold text-gray-900 dark:text-white">
          {isHebrew ? 'מוכן לשטיפה נוספת?' : 'Ready for another wash?'}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isHebrew ? 'הזמן עכשיו וקבל 10% הנחה' : 'Book now and get 10% off'}
        </p>
      </div>
      <Button className="bg-orange-600 hover:bg-orange-700">
        {isHebrew ? 'הזמן עכשיו!' : 'Book Now!'}
      </Button>
    </div>
  );
};

// AI Tip Widget
const AITipWidget = ({ tip }: { tip: string }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="flex gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border-l-4 border-purple-600 dark:border-purple-400">
      <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0" />
      <div>
        <p className="font-semibold text-gray-900 dark:text-white mb-1">
          {isHebrew ? '💡 טיפ AI לטיפול בחיית מחמד' : '💡 AI Pet Care Tip'}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{tip}</p>
      </div>
    </div>
  );
};

// Pet Health Summary Widget
const PetHealthSummaryWidget = ({ petData }: { petData: any }) => {
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
        <Activity className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {petData.lastWeight} kg
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {isHebrew ? 'משקל אחרון' : 'Last Weight'}
        </p>
      </div>
      <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
        <Heart className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {petData.healthScore}%
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
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
    
    if (daysUntil < 0) return { status: 'overdue', color: 'red', label: isHebrew ? 'באיחור' : 'Overdue' };
    if (daysUntil <= 7) return { status: 'urgent', color: 'orange', label: isHebrew ? 'דחוף' : 'Urgent' };
    if (daysUntil <= 30) return { status: 'upcoming', color: 'yellow', label: isHebrew ? 'קרוב' : 'Soon' };
    return { status: 'scheduled', color: 'green', label: isHebrew ? 'מתוזמן' : 'Scheduled' };
  };

  if (!vaccines || vaccines.length === 0) {
    return (
      <div className="text-center py-6">
        <Syringe className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {isHebrew ? 'אין חיסונים מתוזמנים' : 'No scheduled vaccines'}
        </p>
        <Button size="sm" className="mt-3">
          {isHebrew ? 'הוסף חיסון' : 'Add Vaccine'}
        </Button>
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
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className={`p-2 rounded-full bg-${status.color}-100 dark:bg-${status.color}-900/30`}>
                <Syringe className={`w-4 h-4 text-${status.color}-600 dark:text-${status.color}-400`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {vaccine.name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'תאריך יעד:' : 'Due:'} {new Date(vaccine.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge className={`bg-${status.color}-100 text-${status.color}-700 dark:bg-${status.color}-900/30 dark:text-${status.color}-300 border-0`}>
              {status.label}
            </Badge>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-full mt-2">
        <Bell className="w-4 h-4 mr-2" />
        {isHebrew ? 'הגדר תזכורות' : 'Set Reminders'}
      </Button>
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              {isHebrew ? 'טוען...' : 'Loading...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {isHebrew ? `שלום, ${userName}! 👋` : `Welcome Back, ${userName}! 👋`}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                {isHebrew ? 'לוח הבקרה שלך' : 'Your Dashboard'}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Sun className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
                <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                <Moon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>

          {/* Personalized AI Greeting */}
          <PersonalizedGreeting />

          {/* Widgets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6">
            {/* Next Appointment */}
            <DashboardWidget
              title={isHebrew ? '📅 התור הבא' : '📅 Next Appointment'}
              icon={Calendar}
              onAction={() => console.log('Manage appointments')}
            >
              <NextAppointmentWidget booking={mockBooking} />
            </DashboardWidget>

            {/* Quick Action */}
            <DashboardWidget title={isHebrew ? '⚡ פעולה מהירה' : '⚡ Quick Action'}>
              <QuickBookWidget />
            </DashboardWidget>

            {/* Loyalty Status */}
            <DashboardWidget
              title={isHebrew ? '🏆 סטטוס נאמנות' : '🏆 Pet Loyalty Status'}
              icon={Award}
              onAction={() => console.log('View benefits')}
            >
              <LoyaltyWidget points={400} status="Silver" maxPoints={1000} />
            </DashboardWidget>

            {/* Pet Health */}
            <DashboardWidget
              title={isHebrew ? '🐕 תמונת מצב בריאותית' : '🐕 Pet Health Snapshot'}
              icon={Activity}
              onAction={() => console.log('Full profile')}
            >
              <PetHealthSummaryWidget petData={mockPetData} />
            </DashboardWidget>

            {/* Vaccine Calendar & Reminders */}
            <DashboardWidget
              title={isHebrew ? '💉 לוח חיסונים ותזכורות' : '💉 Vaccine Calendar & Reminders'}
              icon={Syringe}
              onAction={() => console.log('Manage vaccines')}
            >
              <VaccineCalendarWidget vaccines={mockVaccines} />
            </DashboardWidget>

            {/* AI Tip - Full Width */}
            <div className="lg:col-span-2 2xl:col-span-3">
              <DashboardWidget
                title={isHebrew ? '🤖 טיפול מותאם אישית' : '🤖 Personalized Pet Care'}
                icon={Sparkles}
              >
                <AITipWidget tip={mockAITip} />
              </DashboardWidget>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Pet Wash™ 2025-2026 • {isHebrew ? 'טכנולוגיה מתקדמת' : 'Advanced Technology'}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
