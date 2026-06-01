import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, Sparkles, Footprints, Heart, Car, Wand2, Cog,
  Briefcase, TrendingUp, Globe, Users, CheckCircle2, ArrowRight
} from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';

export default function StandaloneDivisions() {
  const [language] = useState<Language>((localStorage.getItem('petwash_lang') as Language) || 'he');

  // Helper to get localized field from data objects
  const getLocalizedField = (obj: any, fieldName: string): any => {
    const hebrewField = `${fieldName}He`;
    return language === 'he' && obj[hebrewField] ? obj[hebrewField] : obj[fieldName];
  };

  const divisions = [
    {
      name: 'Pet ⁦Wash Hub™⁩',
      nameHe: 'Pet ⁦Wash Hub™⁩',
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
      description: 'Premium organic wash stations - Our flagship self-service pet washing division',
      descriptionHe: 'תחנות שטיפה אורגניות פרימיום - חטיבת השטיפה העצמית הדגל שלנו',
      usComparison: 'Category-defining premium retail flagship',
      usComparisonHe: 'מותג דגל קמעונאי פרימיום מגדיר קטגוריה',
      features: ['24/7 IoT Stations', 'Organic Products', 'Loyalty Tiers', 'Mobile App'],
      featuresHe: ['תחנות IoT 24/7', 'מוצרים אורגניים', 'רמות נאמנות', 'אפליקציה סלולרית'],
      standalone: true,
      revenue: 'Station fees, loyalty memberships, product sales',
      revenueHe: 'דמי תחנה, מנויי נאמנות, מכירת מוצרים',
    },
    {
      name: '⁦Walk My Pet™⁩',
      nameHe: '⁦Walk My Pet™⁩',
      icon: Footprints,
      color: 'from-green-500 to-emerald-500',
      description: 'Premium dog walking marketplace with real-time GPS tracking - Complete standalone business',
      descriptionHe: 'שוק הליכת כלבים פרימיום עם מעקב GPS בזמן אמת - עסק עצמאי מלא',
      usComparison: 'On-demand walker dispatch marketplace',
      usComparisonHe: 'מרקטפלייס שיגור מטיילים לפי דרישה',
      features: ['Real-time GPS', 'Vetted Walkers', 'Live Tracking', 'Emergency Support'],
      featuresHe: ['GPS בזמן אמת', 'מטיילים מאומתים', 'מעקב חי', 'תמיכת חירום'],
      standalone: true,
      revenue: 'Commission per walk, walker subscriptions, premium features',
      revenueHe: 'עמלה להליכה, מנויים למטיילים, תכונות פרימיום',
    },
    {
      name: '⁦The Sitter Suite™⁩',
      nameHe: '⁦The Sitter Suite™⁩',
      icon: Heart,
      color: 'from-pink-500 to-rose-500',
      description: 'Pet sitting marketplace with AI triage and split payments - Fully independent operation',
      descriptionHe: 'שוק שמרטפות עם מיון AI ותשלומים מפוצלים - מבצע עצמאי לחלוטין',
      usComparison: 'Vetted host marketplace with verified profiles',
      usComparisonHe: 'מרקטפלייס מארחים מאומתים עם פרופילים מאושרים',
      features: ['AI Matching', 'Split Payments', 'Background Checks', '24/7 Support'],
      featuresHe: ['התאמה AI', 'תשלומים מפוצלים', 'בדיקות רקע', 'תמיכה 24/7'],
      standalone: true,
      revenue: 'Booking commissions, sitter fees, insurance packages',
      revenueHe: 'עמלות הזמנה, דמי שמרטף, חבילות ביטוח',
    },
    {
      name: '⁦PetTrek™⁩',
      nameHe: '⁦PetTrek™⁩',
      icon: Car,
      color: 'from-purple-500 to-indigo-500',
      description: 'Advanced pet transport with on-demand matching and live tracking — complete rideshare platform',
      descriptionHe: 'הובלת חיות מחמד מתקדמת עם התאמה לפי דרישה ומעקב חי — פלטפורמת rideshare מלאה',
      usComparison: 'On-demand pet transport with dynamic dispatch',
      usComparisonHe: 'הובלת חיות מחמד לפי דרישה עם שיגור דינמי',
      features: ['Dynamic Pricing', 'Driver Matching', 'Live ETA', 'Safety Features'],
      featuresHe: ['תמחור דינמי', 'התאמת נהגים', 'ETA חי', 'תכונות בטיחות'],
      standalone: true,
      revenue: 'Ride fees, driver partnerships, surge pricing',
      revenueHe: 'דמי נסיעה, שותפויות נהגים, תמחור שיא',
    },
    {
      name: '⁦The Plush Lab™⁩',
      nameHe: '⁦The Plush Lab™⁩',
      icon: Wand2,
      color: 'from-amber-500 to-yellow-500',
      description: 'FREE public avatar creator with AI - Customer acquisition tool and standalone creative platform',
      descriptionHe: 'יוצר אווטארים ציבורי חינמי עם AI - כלי רכישת לקוחות ופלטפורמה יצירתית עצמאית',
      usComparison: 'Free creative tool driving ecosystem acquisition',
      usComparisonHe: 'כלי יצירתי חינמי המניע רכישת לקוחות למערכת',
      features: ['Free Public Access', 'AI Processing', 'No Sign-Up Required', 'Premium Customization'],
      featuresHe: ['גישה ציבורית חינמית', 'עיבוד AI', 'ללא צורך בהרשמה', 'התאמה אישית פרימיום'],
      standalone: false, // Freemium model
      revenue: 'Free tier (customer acquisition), premium features, B2B licensing',
      revenueHe: 'רמה חינמית (רכישת לקוחות), תכונות פרימיום, רישוי B2B',
    },
    {
      name: 'K9000',
      nameHe: 'K9000',
      icon: Cog,
      color: 'from-slate-500 to-gray-600',
      description: 'IoT wash station hardware and cloud platform - Complete B2B SaaS infrastructure',
      descriptionHe: 'חומרת תחנות שטיפה IoT ופלטפורמת ענן - תשתית B2B SaaS מלאה',
      usComparison: 'IoT infrastructure as a service for pet wash bays',
      usComparisonHe: 'תשתית IoT כשירות לעמדות שטיפת חיות מחמד',
      features: ['Cloud Management', 'Real-time Monitoring', 'Predictive Maintenance', 'API Access'],
      featuresHe: ['ניהול ענן', 'ניטור בזמן אמת', 'תחזוקה חזויה', 'גישת API'],
      standalone: true,
      revenue: 'Hardware sales, SaaS subscriptions, API licensing, maintenance contracts',
      revenueHe: 'מכירת חומרה, מנויי SaaS, רישוי API, חוזי תחזוקה',
    },
    {
      name: 'Enterprise',
      nameHe: 'Enterprise',
      icon: Briefcase,
      color: 'from-red-500 to-orange-500',
      description: 'Location partner controls, approved revenue-share review, and enterprise operations evidence',
      descriptionHe: 'בקרת שותפי מיקום, בדיקת חלוקת הכנסות מאושרת וראיות תפעול ארגוניות',
      usComparison: 'Enterprise partner-control and evidence platform',
      usComparisonHe: 'פלטפורמת בקרת שותפים וראיות ארגונית',
      features: ['Partner Controls', 'Approval Evidence', 'Brand Rules', 'Analytics Dashboard'],
      featuresHe: ['בקרת שותפים', 'ראיות אישור', 'כללי מותג', 'לוח מחוונים אנליטי'],
      standalone: true,
      revenue: 'Approved revenue-share, licensing, support, and custom development after contracts',
      revenueHe: 'חלוקת הכנסות מאושרת, רישוי, תמיכה ופיתוח מותאם לאחר חוזים',
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-12">
        <div className="luxury-container">
          
          {/* Hero Section */}
          <div className="text-center mb-16 luxury-animate-fade-in">
            <span className="luxury-badge luxury-badge-gold mb-6 inline-flex">
              <Building2 className="w-4 h-4" />
              {t('standaloneDivisions.businessArchitecture', language)}
            </span>
            <h1 className="luxury-heading-xl mb-6">
              {t('standaloneDivisions.multiBrandEcosystem', language)}
            </h1>
            <p className="luxury-text-body max-w-3xl mx-auto">
              {t('standaloneDivisions.heroSubtitle', language)}
            </p>
          </div>

          {/* Our 7 Standalone Divisions */}
          <div className="mb-16">
            <h2 className="luxury-heading-lg text-center mb-12 luxury-animate-fade-in luxury-delay-2">
              {t('standaloneDivisions.sevenDivisions', language)}
            </h2>
            <div className="luxury-grid-2">
              {divisions.map((division, idx) => {
                const Icon = division.icon;
                return (
                  <div key={idx} className="luxury-glass-card luxury-hover-lift luxury-shadow-xl overflow-hidden luxury-animate-fade-in" style={{ animationDelay: `${0.1 * (idx + 1)}s` }}>
                    <div className={`bg-gradient-to-r ${division.color} text-white p-8`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Icon className="w-8 h-8" />
                        </div>
                        <h3 className="luxury-heading-lg text-white">{getLocalizedField(division, 'name')}</h3>
                      </div>
                      {division.standalone && (
                        <span className="luxury-badge bg-white/20 text-white border-white/30">
                          {t('standaloneDivisions.fullStandaloneBusiness', language)}
                        </span>
                      )}
                    </div>
                    <div className="p-8">
                      <p className="luxury-text-body mb-6 leading-relaxed">
                        {getLocalizedField(division, 'description')}
                      </p>
                      
                      <div className="luxury-glass-minimal p-4 rounded-xl mb-6">
                        <p className="luxury-text-small font-semibold text-purple-600">
                          {getLocalizedField(division, 'usComparison')}
                        </p>
                      </div>

                      <div className="mb-6">
                        <h4 className="luxury-heading-sm mb-3">
                          {t('standaloneDivisions.keyFeatures', language)}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {getLocalizedField(division, 'features').map((feature: string, i: number) => (
                            <span key={i} className="luxury-badge">
                              <Sparkles className="w-3 h-3" />
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="luxury-glass-minimal p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                        <h4 className="luxury-heading-sm mb-2 text-green-800 dark:text-green-300">
                          {t('standaloneDivisions.revenueModel', language)}
                        </h4>
                        <p className="luxury-text-small">
                          {getLocalizedField(division, 'revenue')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Why This Structure Works */}
          <div className="luxury-glass-card luxury-shadow-xl overflow-hidden luxury-animate-scale-in luxury-delay-3">
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <h2 className="luxury-heading-lg">{t('standaloneDivisions.whyThisWorks', language)}</h2>
              </div>
            </div>
            <div className="p-8">
              <div className="luxury-grid-3">
                <div className="luxury-glass-minimal p-8 rounded-xl text-center luxury-hover-lift">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="luxury-heading-sm mb-3">
                    {t('standaloneDivisions.specializedTeams', language)}
                  </h3>
                  <p className="luxury-text-small">
                    {t('standaloneDivisions.specializedTeamsDesc', language)}
                  </p>
                </div>

                <div className="luxury-glass-minimal p-8 rounded-xl text-center luxury-hover-lift">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="luxury-heading-sm mb-3">
                    {t('standaloneDivisions.diversifiedRevenue', language)}
                  </h3>
                  <p className="luxury-text-small">
                    {t('standaloneDivisions.diversifiedRevenueDesc', language)}
                  </p>
                </div>

                <div className="luxury-glass-minimal p-8 rounded-xl text-center luxury-hover-lift">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="luxury-heading-sm mb-3">
                    {t('standaloneDivisions.crossSellingOpportunities', language)}
                  </h3>
                  <p className="luxury-text-small">
                    {t('standaloneDivisions.crossSellingDesc', language)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* DISABLED: CTA for PlushLab (frozen for now, keep for future use) */}
          {/* <div className="mt-12 text-center">
            <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <CardContent className="pt-8 pb-8">
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-black">
                  {t('standaloneDivisions.tryFreeDivision', language)}
                </h3>
                <p className="text-gray-600 dark:text-black mb-6">
                  {t('standaloneDivisions.freeDivisionDesc', language)}
                </p>
                <Link href="/plush-lab">
                  <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                    {t('standaloneDivisions.tryNowFree', language)}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div> */}

        </div>
      </div>
    </Layout>
  );
}
