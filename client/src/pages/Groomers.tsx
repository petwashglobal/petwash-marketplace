import { Scissors } from 'lucide-react';
import PlatformPlaceholder from '@/components/PlatformPlaceholder';

interface GroomersProps {
  language?: string;
}

export default function Groomers({ language = 'en' }: GroomersProps) {
  return (
    <PlatformPlaceholder
      platformName="Grooming Marketplace"
      platformNameHe="שוק מטפחים"
      description="Professional pet grooming services at your fingertips. Connect with certified groomers for mobile or salon grooming."
      descriptionHe="שירותי טיפוח מקצועי לחיות מחמד בהישג יד. התחבר למטפחים מוסמכים לטיפוח נייד או בסלון."
      icon={<Scissors className="w-12 h-12" />}
      features={[
        'Search & book certified groomers',
        'Mobile grooming services',
        'Salon grooming packages',
        'Real-time booking calendar',
        'Groomer profiles & reviews',
        'Custom grooming packages',
        'Before/after photo galleries',
        'Recurring grooming schedules',
      ]}
      featuresHe={[
        'חפש והזמן מטפחים מוסמכים',
        'שירותי טיפוח נייד',
        'חבילות טיפוח בסלון',
        'לוח שנה להזמנות בזמן אמת',
        'פרופילי מטפחים וביקורות',
        'חבילות טיפוח מותאמות אישית',
        'גלריות תמונות לפני/אחרי',
        'לוחות זמנים חוזרים לטיפוח',
      ]}
      language={language}
    />
  );
}
