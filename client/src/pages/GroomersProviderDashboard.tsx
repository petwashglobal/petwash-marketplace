import { BarChart3 } from 'lucide-react';
import PlatformPlaceholder from '@/components/PlatformPlaceholder';

interface GroomersProviderDashboardProps {
  language?: string;
}

export default function GroomersProviderDashboard({ language = 'en' }: GroomersProviderDashboardProps) {
  return (
    <PlatformPlaceholder
      platformName="Groomer Dashboard"
      platformNameHe="לוח בקרה למטפח"
      description="Manage your grooming business. View bookings, update availability, track earnings, and connect with clients."
      descriptionHe="נהל את עסק הטיפוח שלך. הצג הזמנות, עדכן זמינות, עקוב אחר הכנסות והתחבר ללקוחות."
      icon={<BarChart3 className="w-12 h-12" />}
      features={[
        'Today\'s schedule overview',
        'Upcoming bookings calendar',
        'Earnings & payout tracking',
        'Client management',
        'Service packages editor',
        'Availability settings',
        'Review & rating analytics',
        'Before/after photo uploads',
      ]}
      featuresHe={[
        'סקירת לוח הזמנים להיום',
        'לוח שנה של הזמנות עתידיות',
        'מעקב הכנסות ותשלומים',
        'ניהול לקוחות',
        'עורך חבילות שירות',
        'הגדרות זמינות',
        'ניתוח ביקורות ודירוגים',
        'העלאת תמונות לפני/אחרי',
      ]}
      language={language}
    />
  );
}
