import { Layout } from '@/components/Layout';
import { useState, useEffect } from 'react';
import { type Language } from '@/lib/i18n';
import { 
  Sparkles, 
  Award, 
  Shield, 
  TrendingUp, 
  Leaf, 
  Heart,
  Globe2,
  Star,
  CheckCircle2,
  Zap,
  Users2,
  Phone,
  Mail,
  Building2
} from 'lucide-react';

interface AboutProps {
  language: Language;
}

export default function About({ language }: AboutProps) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);

  const handleLanguageChange = (newLanguage: Language) => {
    setCurrentLanguage(newLanguage);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout language={currentLanguage} onLanguageChange={handleLanguageChange}>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Luxury Hero Section */}
      <div className="luxury-services-hero luxury-animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="luxury-services-hero-content">
            {/* Premium Badge */}
            <div className="luxury-badge luxury-badge-gold">
              <Sparkles className="h-5 w-5" />
              <span>
                {currentLanguage === 'en' ? '7-STAR GLOBAL EXCELLENCE' : 'מצוינות עולמית 7 כוכבים'}
              </span>
            </div>
            
            {/* Main Title */}
            <h1 className="luxury-heading-xl mt-8">
              Pet Wash™
            </h1>
            
            {/* Subtitle */}
            <p className="luxury-services-subtitle">
              {currentLanguage === 'en' 
                ? 'Leading the global revolution in premium pet care with world-class technology, sustainability, and a flawless safety record'
                : 'מובילים את המהפכה העולמית בטיפול מתקדם בחיות מחמד עם טכנולוגיה מהשורה הראשונה, קיימות ורישום בטיחות מושלם'
              }
            </p>

            {/* Stats - Minimal & Premium */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-black mb-2">100%</div>
                <div className="text-sm text-gray-500 uppercase tracking-wider">
                  {currentLanguage === 'en' ? 'Safety Record' : 'בטיחות מושלמת'}
                </div>
              </div>
              <div className="text-center border-x border-gray-100">
                <div className="text-4xl font-bold text-black mb-2">7★</div>
                <div className="text-sm text-gray-500 uppercase tracking-wider">
                  {currentLanguage === 'en' ? 'Premium Standard' : 'סטנדרט פרימיום'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-black mb-2">24/7</div>
                <div className="text-sm text-gray-500 uppercase tracking-wider">
                  {currentLanguage === 'en' ? 'Global Support' : 'תמיכה עולמית'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* K9000 Partnership - Luxury Glass Panel */}
      <div className="luxury-section">
        <div className="luxury-container">
          <div className="luxury-glass-card luxury-shadow-lg p-16 luxury-animate-slide-up luxury-delay-1">
            <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-8">
              <Award className="h-6 w-6 text-black" />
              <span className="text-sm font-semibold uppercase tracking-wider text-black">
                {currentLanguage === 'en' ? 'Exclusive Partnership' : 'שותפות בלעדית'}
              </span>
            </div>
            
            <h2 className="luxury-heading-lg mb-8">
              {currentLanguage === 'en' ? 'K9000 Israel' : 'K9000 ישראל'}
            </h2>
            
            <p className="luxury-text-body">
              {currentLanguage === 'en' 
                ? 'Exclusive distributor of K9000 technology in Israel — the world\'s most advanced pet washing systems, designed and manufactured in Australia with full international certification and local support'
                : 'הנציג הבלעדי של טכנולוגיית K9000 בישראל — מערכת השטיפה המתקדמת בעולם לחיות מחמד, מתוצרת אוסטרליה עם אישורים בינלאומיים ותמיכה מקומית מלאה'
              }
            </p>
          </div>
        </div>
      </div>
      </div>

      {/* Core Values - Luxury Glass Grid */}
      <div className="luxury-section">
        <div className="luxury-container">
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Sustainability */}
            <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                  <Leaf className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="luxury-heading-md">
                  {currentLanguage === 'en' ? 'Sustainability' : 'קיימות'}
                </h3>
              </div>
              <p className="luxury-text-body">
                {currentLanguage === 'en' 
                  ? '100% organic biodegradable products, water-efficient systems, and eco-certified formulas featuring Australian Tea Tree Oil for natural antibacterial care'
                  : 'מוצרים אורגניים מתכלים 100%, מערכות חיסכון במים וחומרים בעלי אישור אקולוגי עם שמן עץ התה האוסטרלי לטיפול אנטי-בקטריאלי טבעי'
                }
              </p>
            </div>

            {/* Technology */}
            <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-3">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                  <Zap className="h-7 w-7 text-purple-600" />
                </div>
                <h3 className="luxury-heading-md">
                  {currentLanguage === 'en' ? 'Technology' : 'טכנולוגיה'}
                </h3>
              </div>
              <p className="luxury-text-body">
                {currentLanguage === 'en' 
                  ? 'Smart sensors, precision temperature controls, self-cleaning mechanisms, and continuous R&D investment for the most advanced pet care solutions'
                  : 'חיישנים חכמים, בקרת טמפרטורה מדויקת, מנגנוני ניקוי עצמי והשקעה מתמשכת במחקר ופיתוח לפתרונות הטיפול המתקדמים ביותר'
                }
              </p>
            </div>

            {/* Safety */}
            <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                  <Shield className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="luxury-heading-md">
                  {currentLanguage === 'en' ? 'Safety' : 'בטיחות'}
                </h3>
              </div>
              <p className="luxury-text-body">
                {currentLanguage === 'en' 
                  ? '100% global safety record, international certification, 24/7 monitoring, complete logistics infrastructure with remote support and spare parts'
                  : 'רישום בטיחות מושלם 100%, אישורים בינלאומיים, ניטור 24/7, מערך לוגיסטי מלא עם תמיכה מרחוק וחלקי חילוף'
                }
              </p>
            </div>

            {/* Experience */}
            <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-5">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-50 to-yellow-100 flex items-center justify-center">
                  <Star className="h-7 w-7 text-yellow-600" />
                </div>
                <h3 className="luxury-heading-md">
                  {currentLanguage === 'en' ? 'Experience' : 'חוויה'}
                </h3>
              </div>
              <p className="luxury-text-body">
                {currentLanguage === 'en' 
                  ? 'Contactless payments with Apple Pay & Google Pay, digital loyalty rewards, dual washing bays, and full accessibility for users with disabilities'
                  : 'תשלומים ללא מגע עם Apple Pay ו-Google Pay, תגמולי נאמנות דיגיטליים, שתי עמדות רחצה ונגישות מלאה לאנשים עם מוגבלויות'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Franchise Opportunities - Luxury Section */}
      <div className="luxury-section luxury-bg-soft">
        <div className="luxury-container">
          <div className="text-center mb-16">
            <div className="luxury-badge luxury-badge-gold mb-8">
              <TrendingUp className="h-5 w-5" />
              <span>
                {currentLanguage === 'en' ? 'Business Opportunity' : 'הזדמנות עסקית'}
              </span>
            </div>
            
            <h2 className="luxury-heading-lg mb-6">
              {currentLanguage === 'en' ? 'Franchise Model' : 'מודל זכיינות'}
            </h2>
            
            <p className="luxury-text-body max-w-3xl mx-auto">
              {currentLanguage === 'en' 
                ? 'Own and operate your premium Pet Wash™ station with complete support'
                : 'הפעל תחנת Pet Wash™ פרימיום בבעלותך עם תמיכה מלאה'
              }
            </p>
          </div>
          
          {/* Benefits Grid - Luxury Glass Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { icon: CheckCircle2, titleEn: 'Installation', titleHe: 'התקנה', descEn: 'Complete setup and logistics', descHe: 'התקנה ולוגיסטיקה מלאה' },
              { icon: CheckCircle2, titleEn: 'Supply', titleHe: 'אספקה', descEn: '100% organic products', descHe: 'מוצרים אורגניים 100%' },
              { icon: CheckCircle2, titleEn: 'Smart System', titleHe: 'מערכת חכמה', descEn: 'Real-time analytics', descHe: 'ניתוח בזמן אמת' },
              { icon: CheckCircle2, titleEn: 'Marketing', titleHe: 'שיווק', descEn: 'Professional materials', descHe: 'חומרים מקצועיים' },
              { icon: CheckCircle2, titleEn: 'Training', titleHe: 'הדרכה', descEn: 'Full operational support', descHe: 'תמיכה תפעולית מלאה' },
              { icon: CheckCircle2, titleEn: 'Global Brand', titleHe: 'מותג עולמי', descEn: 'Proven business model', descHe: 'מודל עסקי מוכח' },
            ].map((item, index) => (
              <div key={index} className="luxury-glass-card p-8 luxury-hover-lift">
                <item.icon className="h-8 w-8 text-purple-600 mb-4" />
                <h4 className="luxury-heading-sm mb-3">
                  {currentLanguage === 'en' ? item.titleEn : item.titleHe}
                </h4>
                <p className="luxury-text-body">
                  {currentLanguage === 'en' ? item.descEn : item.descHe}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accessibility - Luxury Section */}
      <div className="luxury-section">
        <div className="luxury-container">
          <div className="luxury-glass-card luxury-shadow-lg p-16 text-center max-w-4xl mx-auto luxury-animate-scale-in luxury-delay-6">
            <div className="luxury-badge luxury-badge-success mb-8 inline-flex">
              <Users2 className="h-5 w-5" />
              <span>
                {currentLanguage === 'en' ? 'For Everyone' : 'לכולם'}
              </span>
            </div>
            
            <h2 className="luxury-heading-lg mb-8">
              {currentLanguage === 'en' ? 'Full Accessibility' : 'נגישות מלאה'}
            </h2>
            
            <p className="luxury-text-body">
              {currentLanguage === 'en' 
                ? 'Dual washing bays, ergonomic design, and complete accessibility for users with disabilities — ensuring comfort and safety for everyone'
                : 'שתי עמדות רחצה, עיצוב ארגונומי ונגישות מלאה לאנשים עם מוגבלויות — מבטיחים נוחות ובטיחות לכולם'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Our Promise - Luxury Glass Section */}
      <div className="luxury-section luxury-bg-soft">
        <div className="luxury-container">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-12">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-br from-pink-100 to-red-100 flex items-center justify-center">
                <Heart className="h-10 w-10 text-red-500" />
              </div>
              <h2 className="luxury-heading-lg mb-8">
                {currentLanguage === 'en' ? 'Our Promise' : 'ההבטחה שלנו'}
              </h2>
              <p className="luxury-text-body">
                {currentLanguage === 'en' 
                  ? 'We blend technology, sustainability, and compassion to create a new global standard in pet care — serving millions worldwide and leading the revolution in Israel'
                  : 'אנו משלבים טכנולוגיה, קיימות וחמלה כדי ליצור סטנדרט עולמי חדש בטיפול בחיות מחמד — משרתים מיליונים ברחבי העולם ומובילים את המהפכה בישראל'
                }
              </p>
            </div>

            {/* Contact - Luxury Glass Card */}
            <div className="luxury-glass-card p-12 max-w-2xl mx-auto luxury-shadow-lg">
              <h3 className="luxury-heading-md mb-8">
                {currentLanguage === 'en' ? 'Contact' : 'צור קשר'}
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="luxury-text-body font-medium">+972-54-983-3355</span>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="luxury-text-body font-medium">Support@PetWash.co.il</span>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="luxury-text-body font-medium">
                    {currentLanguage === 'en' ? 'Pet Wash Ltd (517145033)' : 'פט ווש בע"מ (517145033)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
}
