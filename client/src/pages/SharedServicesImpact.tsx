import { BarChart3 } from 'lucide-react';
import PlatformPlaceholder from '@/components/PlatformPlaceholder';

interface SharedServicesImpactProps {
  language?: string;
}

export default function SharedServicesImpact({ language = 'en' }: SharedServicesImpactProps) {
  return (
    <PlatformPlaceholder
      platformName="Impact Dashboard"
      platformNameHe="לוח מצב השפעה"
      description="Track the positive impact we're making together. Real-time metrics on community programs, adoptions, and pet welfare initiatives."
      descriptionHe="עקוב אחר ההשפעה החיובית שאנו יוצרים יחד. מדדים בזמן אמת על תוכניות קהילתיות, אימוצים ויוזמות רווחת חיות מחמד."
      icon={<BarChart3 className="w-12 h-12" />}
      features={[
        'Pets helped this year',
        'Adoption success rate',
        'Volunteer hours contributed',
        'Funds distributed to families',
        'Community events hosted',
        'Educational workshops delivered',
        'Emergency interventions',
        'Partner organizations network',
      ]}
      featuresHe={[
        'חיות מחמד שנעזרו השנה',
        'שיעור הצלחת אימוצים',
        'שעות התנדבות שתרמו',
        'כספים שחולקו למשפחות',
        'אירועים קהילתיים שארחנו',
        'סדנאות חינוכיות שנערכו',
        'התערבויות חירום',
        'רשת ארגוני שותפים',
      ]}
      language={language}
    />
  );
}
