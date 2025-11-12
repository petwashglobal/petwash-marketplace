import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
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
    <div className="min-h-screen bg-white">
      <Header language={currentLanguage} onLanguageChange={handleLanguageChange} />
      
      {/* Pure White Hero Section - 2025 Modern Design */}
      <div className="relative bg-white pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-black/5 bg-black/[0.02] mb-8 transition-all hover:border-black/10">
              <Sparkles className="h-5 w-5 text-black" />
              <span className="text-sm font-semibold tracking-wide text-black">
                {currentLanguage === 'en' ? '7-STAR GLOBAL EXCELLENCE' : 'מצוינות עולמית 7 כוכבים'}
              </span>
            </div>
            
            {/* Main Title - Ultra Modern Typography */}
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-8 tracking-tight">
              <span className="bg-gradient-to-br from-black via-gray-800 to-black bg-clip-text text-transparent">
                Pet Wash™
              </span>
            </h1>
            
            {/* Subtitle - Clean & Elegant */}
            <p className="text-xl sm:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed font-light">
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

      {/* K9000 Partnership - Pure White with Border */}
      <div className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-8">
              <Award className="h-6 w-6 text-black" />
              <span className="text-sm font-semibold uppercase tracking-wider text-black">
                {currentLanguage === 'en' ? 'Exclusive Partnership' : 'שותפות בלעדית'}
              </span>
            </div>
            
            <h2 className="text-5xl sm:text-6xl font-bold text-black mb-8 tracking-tight">
              {currentLanguage === 'en' ? 'K9000 Israel' : 'K9000 ישראל'}
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed font-light">
              {currentLanguage === 'en' 
                ? 'Exclusive distributor of K9000 technology in Israel — the world\'s most advanced pet washing systems, designed and manufactured in Australia with full international certification and local support'
                : 'הנציג הבלעדי של טכנולוגיית K9000 בישראל — מערכת השטיפה המתקדמת בעולם לחיות מחמד, מתוצרת אוסטרליה עם אישורים בינלאומיים ותמיכה מקומית מלאה'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Core Values - Minimal Grid */}
      <div className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            
            {/* Sustainability */}
            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full border-2 border-black/5 flex items-center justify-center group-hover:border-black/20 transition-colors">
                  <Leaf className="h-7 w-7 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-black">
                  {currentLanguage === 'en' ? 'Sustainability' : 'קיימות'}
                </h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed font-light">
                {currentLanguage === 'en' 
                  ? '100% organic biodegradable products, water-efficient systems, and eco-certified formulas featuring Australian Tea Tree Oil for natural antibacterial care'
                  : 'מוצרים אורגניים מתכלים 100%, מערכות חיסכון במים וחומרים בעלי אישור אקולוגי עם שמן עץ התה האוסטרלי לטיפול אנטי-בקטריאלי טבעי'
                }
              </p>
            </div>

            {/* Technology */}
            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full border-2 border-black/5 flex items-center justify-center group-hover:border-black/20 transition-colors">
                  <Zap className="h-7 w-7 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-black">
                  {currentLanguage === 'en' ? 'Technology' : 'טכנולוגיה'}
                </h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed font-light">
                {currentLanguage === 'en' 
                  ? 'Smart sensors, precision temperature controls, self-cleaning mechanisms, and continuous R&D investment for the most advanced pet care solutions'
                  : 'חיישנים חכמים, בקרת טמפרטורה מדויקת, מנגנוני ניקוי עצמי והשקעה מתמשכת במחקר ופיתוח לפתרונות הטיפול המתקדמים ביותר'
                }
              </p>
            </div>

            {/* Safety */}
            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full border-2 border-black/5 flex items-center justify-center group-hover:border-black/20 transition-colors">
                  <Shield className="h-7 w-7 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-black">
                  {currentLanguage === 'en' ? 'Safety' : 'בטיחות'}
                </h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed font-light">
                {currentLanguage === 'en' 
                  ? '100% global safety record, international certification, 24/7 monitoring, complete logistics infrastructure with remote support and spare parts'
                  : 'רישום בטיחות מושלם 100%, אישורים בינלאומיים, ניטור 24/7, מערך לוגיסטי מלא עם תמיכה מרחוק וחלקי חילוף'
                }
              </p>
            </div>

            {/* Experience */}
            <div className="group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full border-2 border-black/5 flex items-center justify-center group-hover:border-black/20 transition-colors">
                  <Star className="h-7 w-7 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-black">
                  {currentLanguage === 'en' ? 'Experience' : 'חוויה'}
                </h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed font-light">
                {currentLanguage === 'en' 
                  ? 'Contactless payments with Apple Pay & Google Pay, digital loyalty rewards, dual washing bays, and full accessibility for users with disabilities'
                  : 'תשלומים ללא מגע עם Apple Pay ו-Google Pay, תגמולי נאמנות דיגיטליים, שתי עמדות רחצה ונגישות מלאה לאנשים עם מוגבלויות'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Franchise Opportunities - Clean Section */}
      <div className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-8">
              <TrendingUp className="h-6 w-6 text-black" />
              <span className="text-sm font-semibold uppercase tracking-wider text-black">
                {currentLanguage === 'en' ? 'Business Opportunity' : 'הזדמנות עסקית'}
              </span>
            </div>
            
            <h2 className="text-5xl sm:text-6xl font-bold text-black mb-8 tracking-tight">
              {currentLanguage === 'en' ? 'Franchise Model' : 'מודל זכיינות'}
            </h2>
            
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
              {currentLanguage === 'en' 
                ? 'Own and operate your premium Pet Wash™ station with complete support'
                : 'הפעל תחנת Pet Wash™ פרימיום בבעלותך עם תמיכה מלאה'
              }
            </p>
          </div>
          
          {/* Benefits Grid - Ultra Clean */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { icon: CheckCircle2, titleEn: 'Installation', titleHe: 'התקנה', descEn: 'Complete setup and logistics', descHe: 'התקנה ולוגיסטיקה מלאה' },
              { icon: CheckCircle2, titleEn: 'Supply', titleHe: 'אספקה', descEn: '100% organic products', descHe: 'מוצרים אורגניים 100%' },
              { icon: CheckCircle2, titleEn: 'Smart System', titleHe: 'מערכת חכמה', descEn: 'Real-time analytics', descHe: 'ניתוח בזמן אמת' },
              { icon: CheckCircle2, titleEn: 'Marketing', titleHe: 'שיווק', descEn: 'Professional materials', descHe: 'חומרים מקצועיים' },
              { icon: CheckCircle2, titleEn: 'Training', titleHe: 'הדרכה', descEn: 'Full operational support', descHe: 'תמיכה תפעולית מלאה' },
              { icon: CheckCircle2, titleEn: 'Global Brand', titleHe: 'מותג עולמי', descEn: 'Proven business model', descHe: 'מודל עסקי מוכח' },
            ].map((item, index) => (
              <div key={index} className="group p-8 border border-gray-100 rounded-2xl hover:border-gray-200 transition-colors">
                <item.icon className="h-8 w-8 text-black mb-4" />
                <h4 className="text-lg font-semibold text-black mb-2">
                  {currentLanguage === 'en' ? item.titleEn : item.titleHe}
                </h4>
                <p className="text-gray-600 font-light">
                  {currentLanguage === 'en' ? item.descEn : item.descHe}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accessibility - Minimal */}
      <div className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-8">
            <Users2 className="h-6 w-6 text-black" />
            <span className="text-sm font-semibold uppercase tracking-wider text-black">
              {currentLanguage === 'en' ? 'For Everyone' : 'לכולם'}
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-bold text-black mb-8 tracking-tight">
            {currentLanguage === 'en' ? 'Full Accessibility' : 'נגישות מלאה'}
          </h2>
          
          <p className="text-xl text-gray-600 leading-relaxed font-light">
            {currentLanguage === 'en' 
              ? 'Dual washing bays, ergonomic design, and complete accessibility for users with disabilities — ensuring comfort and safety for everyone'
              : 'שתי עמדות רחצה, עיצוב ארגונומי ונגישות מלאה לאנשים עם מוגבלויות — מבטיחים נוחות ובטיחות לכולם'
            }
          </p>
        </div>
      </div>

      {/* Our Promise - Pure White with Subtle Border */}
      <div className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-12">
            <Heart className="h-16 w-16 mx-auto mb-8 text-black" />
            <h2 className="text-4xl sm:text-5xl font-bold text-black mb-8 tracking-tight">
              {currentLanguage === 'en' ? 'Our Promise' : 'ההבטחה שלנו'}
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed font-light">
              {currentLanguage === 'en' 
                ? 'We blend technology, sustainability, and compassion to create a new global standard in pet care — serving millions worldwide and leading the revolution in Israel'
                : 'אנו משלבים טכנולוגיה, קיימות וחמלה כדי ליצור סטנדרט עולמי חדש בטיפול בחיות מחמד — משרתים מיליונים ברחבי העולם ומובילים את המהפכה בישראל'
              }
            </p>
          </div>

          {/* Contact - Ultra Modern Card */}
          <div className="p-10 border-2 border-gray-100 rounded-3xl max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-black mb-8">
              {currentLanguage === 'en' ? 'Contact' : 'צור קשר'}
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-4">
                <Phone className="h-5 w-5 text-black" />
                <span className="text-lg text-gray-900 font-light">+972-54-983-3355</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Mail className="h-5 w-5 text-black" />
                <span className="text-lg text-gray-900 font-light">Support@PetWash.co.il</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Building2 className="h-5 w-5 text-black" />
                <span className="text-lg text-gray-900 font-light">
                  {currentLanguage === 'en' ? 'Pet Wash Ltd (517145033)' : 'פט ווש בע"מ (517145033)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer language={currentLanguage} />
    </div>
  );
}
