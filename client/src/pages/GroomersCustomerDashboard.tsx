import { User } from 'lucide-react';
import PlatformPlaceholder from '@/components/PlatformPlaceholder';

interface GroomersCustomerDashboardProps {
  language?: string;
}

export default function GroomersCustomerDashboard({ language = 'en' }: GroomersCustomerDashboardProps) {
  return (
    <PlatformPlaceholder
      platformName="My Grooming History"
      platformNameHe="היסטוריית הטיפוח שלי"
      description="View your past and upcoming grooming appointments. Track your pet's grooming history and rebook favorite groomers."
      descriptionHe="הצג את פגישות הטיפוח הקודמות והעתידיות שלך. עקוב אחר היסטוריית הטיפוח של חיית המחמד שלך והזמן מחדש מטפחים מועדפים."
      icon={<User className="w-12 h-12" />}
      features={[
        'View all bookings',
        'Grooming history timeline',
        'Favorite groomers list',
        'Before/after photo gallery',
        'Rebook with one click',
        'Payment history',
        'Review & rate groomers',
      ]}
      featuresHe={[
        'הצג את כל ההזמנות',
        'ציר זמן של היסטוריית הטיפוח',
        'רשימת מטפחים מועדפים',
        'גלריית תמונות לפני/אחרי',
        'הזמן מחדש בלחיצה אחת',
        'היסטוריית תשלומים',
        'סקור ודרג מטפחים',
      ]}
      language={language}
    />
  );
}
