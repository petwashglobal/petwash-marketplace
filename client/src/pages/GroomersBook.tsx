import { Calendar } from 'lucide-react';
import PlatformPlaceholder from '@/components/PlatformPlaceholder';

interface GroomersBookProps {
  language?: string;
}

export default function GroomersBook({ language = 'en' }: GroomersBookProps) {
  return (
    <PlatformPlaceholder
      platformName="Book Grooming Session"
      platformNameHe="הזמן מפגש טיפוח"
      description="Schedule a grooming appointment for your pet. Choose your preferred groomer, service type, and time slot."
      descriptionHe="תזמן פגישת טיפוח לחיית המחמד שלך. בחר את המטפח המועדף עליך, סוג השירות ומשבצת הזמן."
      icon={<Calendar className="w-12 h-12" />}
      features={[
        'Select groomer by location',
        'Choose grooming package',
        'Pick date & time slot',
        'Add special instructions',
        'Secure online payment',
        'Instant booking confirmation',
      ]}
      featuresHe={[
        'בחר מטפח לפי מיקום',
        'בחר חבילת טיפוח',
        'בחר תאריך ומשבצת זמן',
        'הוסף הוראות מיוחדות',
        'תשלום מקוון מאובטח',
        'אישור הזמנה מיידי',
      ]}
      language={language}
    />
  );
}
