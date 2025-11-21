import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { Heart, Users, TrendingUp, DollarSign, Calendar, GraduationCap, AlertTriangle, Sparkles } from 'lucide-react';

export default function SharedServicesImpact() {
  const { language, setLanguage } = useLanguage();
  const isHebrew = language === 'he';

  const stats = [
    {
      icon: Heart,
      label: isHebrew ? 'חיות מחמד שנעזרו' : 'Pets Helped',
      value: '12,547',
      change: '+23%',
      changeLabel: isHebrew ? 'לעומת 2024' : 'vs 2024',
    },
    {
      icon: TrendingUp,
      label: isHebrew ? 'שיעור הצלחת אימוצים' : 'Adoption Success Rate',
      value: '94.2%',
      change: '+5.1%',
      changeLabel: isHebrew ? 'שיפור שנתי' : 'Year-over-year',
    },
    {
      icon: Users,
      label: isHebrew ? 'שעות התנדבות' : 'Volunteer Hours',
      value: '8,234',
      change: '+18%',
      changeLabel: isHebrew ? 'השנה' : 'This year',
    },
    {
      icon: DollarSign,
      label: isHebrew ? 'כספים למשפחות' : 'Funds to Families',
      value: '₪427K',
      change: '+31%',
      changeLabel: isHebrew ? 'גדילה' : 'Growth',
    },
    {
      icon: Calendar,
      label: isHebrew ? 'אירועים קהילתיים' : 'Community Events',
      value: '156',
      change: '+42',
      changeLabel: isHebrew ? 'אירועים חדשים' : 'New events',
    },
    {
      icon: GraduationCap,
      label: isHebrew ? 'סדנאות חינוכיות' : 'Educational Workshops',
      value: '89',
      change: '+27',
      changeLabel: isHebrew ? 'סדנאות' : 'Workshops',
    },
    {
      icon: AlertTriangle,
      label: isHebrew ? 'התערבויות חירום' : 'Emergency Interventions',
      value: '312',
      change: '-8%',
      changeLabel: isHebrew ? 'ירידה (חיובית)' : 'Reduction (positive)',
    },
    {
      icon: Sparkles,
      label: isHebrew ? 'ארגוני שותפים' : 'Partner Organizations',
      value: '47',
      change: '+12',
      changeLabel: isHebrew ? 'שותפויות חדשות' : 'New partnerships',
    },
  ];

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      <div className="min-h-screen luxury-bg-mesh">
        <div className="luxury-container py-16">
          {/* Hero Section */}
          <div className="text-center mb-12 luxury-animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-lg">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h1 className="luxury-heading-xl mb-4">
              {isHebrew ? 'לוח מצב ההשפעה שלנו' : 'Our Impact Dashboard'}
            </h1>
            <p className="luxury-text-body max-w-3xl mx-auto">
              {isHebrew 
                ? 'עקוב אחר ההשפעה החיובית שאנו יוצרים יחד. מדדים בזמן אמת על תוכניות קהילתיות, אימוצים ויוזמות רווחת חיות מחמד.'
                : 'Track the positive impact we\'re making together. Real-time metrics on community programs, adoptions, and pet welfare initiatives.'}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="luxury-grid-4">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`luxury-glass-card luxury-shadow-lg p-8 text-center luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6">
                  <stat.icon className="w-8 h-8 text-white" />
                </div>
                <h2 className="luxury-heading-lg luxury-text-gradient mb-2">{stat.value}</h2>
                <p className="luxury-text-body mb-2">{stat.label}</p>
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-sm font-semibold ${
                    stat.change.startsWith('+') ? 'text-green-600' : stat.change.startsWith('-') ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500">{stat.changeLabel}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mission Statement */}
          <div className="mt-16 luxury-glass-card luxury-shadow-lg p-12 text-center luxury-animate-scale-in luxury-delay-9">
            <h2 className="luxury-heading-md mb-6">
              {isHebrew ? 'המחויבות שלנו' : 'Our Commitment'}
            </h2>
            <p className="luxury-text-body max-w-4xl mx-auto leading-relaxed">
              {isHebrew
                ? 'Pet Wash™ מחויבת ליצירה של עתיד טוב יותר לכל חיות המחמד ובעליהן. באמצעות תוכניות הקהילה שלנו, אנו עוזרים למשפחות להעניק את הטיפול הטוב ביותר לחיות המחמד שלהן, מקדמים אימוצים אחראיים, ומספקים משאבי חירום למי שזקוק להם. כל רחיצה במערכות K9000 שלנו תומכת ביוזמות אלה.'
                : 'Pet Wash™ is committed to creating a better future for all pets and their owners. Through our community programs, we help families provide the best care for their pets, promote responsible adoptions, and provide emergency resources for those in need. Every wash at our K9000 stations supports these initiatives.'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
