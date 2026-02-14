import { useLanguage } from '@/lib/languageStore';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Clock, ArrowLeft, Bell } from 'lucide-react';

interface PlatformComingSoonProps {
  platformName: string;
  platformNameHe?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

export function PlatformComingSoon({ 
  platformName, 
  platformNameHe,
  icon,
  accentColor = 'from-emerald-500 to-teal-600'
}: PlatformComingSoonProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center px-4" dir={dir}>
      <div className="max-w-lg w-full text-center space-y-8">
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${accentColor} text-white shadow-2xl mx-auto`}>
          {icon || <Clock className="h-12 w-12" />}
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            {isHebrew ? (platformNameHe || platformName) : platformName}
          </h1>
          <div className={`inline-block px-4 py-1.5 rounded-full bg-gradient-to-r ${accentColor} text-white text-sm font-semibold tracking-wide uppercase`}>
            {isHebrew ? 'בקרוב' : 'Coming Soon'}
          </div>
        </div>

        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-md mx-auto">
          {isHebrew
            ? `אנחנו עובדים קשה כדי להביא לכם את ${platformNameHe || platformName}. חווית שירות מובחרת מחכה לכם!`
            : `We're working hard to bring you ${platformName}. A premium service experience awaits!`
          }
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link href="/">
            <Button variant="outline" className="gap-2 px-6">
              <ArrowLeft className="h-4 w-4" />
              {isHebrew ? 'חזרה לדף הבית' : 'Back to Home'}
            </Button>
          </Link>
          <Link href="/loyalty/join">
            <Button className={`gap-2 px-6 bg-gradient-to-r ${accentColor} hover:opacity-90 text-white border-0`}>
              <Bell className="h-4 w-4" />
              {isHebrew ? 'הצטרפו למועדון' : 'Join Loyalty'}
            </Button>
          </Link>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          {isHebrew 
            ? 'הצטרפו לתוכנית הנאמנות שלנו כדי להיות הראשונים לדעת כשנפתח!'
            : 'Join our loyalty program to be the first to know when we launch!'
          }
        </p>
      </div>
    </div>
  );
}
