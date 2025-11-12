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

  const divisions = [
    {
      name: 'Pet Wash Hub™',
      nameHe: 'Pet Wash Hub™',
      icon: Building2,
      color: 'from-blue-500 to-cyan-500',
      description: 'Premium organic wash stations - Our flagship self-service pet washing division',
      descriptionHe: 'תחנות שטיפה אורגניות פרימיום - חטיבת השטיפה העצמית הדגל שלנו',
      usComparison: 'Like: Starbucks Core Coffee Business',
      usComparisonHe: 'דומה ל: עסק הקפה המרכזי של סטארבקס',
      features: ['24/7 IoT Stations', 'Organic Products', 'Loyalty Tiers', 'Mobile App'],
      featuresHe: ['תחנות IoT 24/7', 'מוצרים אורגניים', 'רמות נאמנות', 'אפליקציה סלולרית'],
      standalone: true,
      revenue: 'Station fees, loyalty memberships, product sales',
      revenueHe: 'דמי תחנה, מנויי נאמנות, מכירת מוצרים',
    },
    {
      name: 'Walk My Pet™',
      nameHe: 'Walk My Pet™',
      icon: Footprints,
      color: 'from-green-500 to-emerald-500',
      description: 'Premium dog walking marketplace with real-time GPS tracking - Complete standalone business',
      descriptionHe: 'שוק הליכת כלבים פרימיום עם מעקב GPS בזמן אמת - עסק עצמאי מלא',
      usComparison: 'Like: Uber for Drivers',
      usComparisonHe: 'דומה ל: Uber לנהגים',
      features: ['Real-time GPS', 'Vetted Walkers', 'Live Tracking', 'Emergency Support'],
      featuresHe: ['GPS בזמן אמת', 'מטיילים מאומתים', 'מעקב חי', 'תמיכת חירום'],
      standalone: true,
      revenue: 'Commission per walk, walker subscriptions, premium features',
      revenueHe: 'עמלה להליכה, מנויים למטיילים, תכונות פרימיום',
    },
    {
      name: 'The Sitter Suite™',
      nameHe: 'The Sitter Suite™',
      icon: Heart,
      color: 'from-pink-500 to-rose-500',
      description: 'Pet sitting marketplace with AI triage and split payments - Fully independent operation',
      descriptionHe: 'שוק שמרטפות עם מיון AI ותשלומים מפוצלים - מבצע עצמאי לחלוטין',
      usComparison: 'Like: Airbnb for Hosts',
      usComparisonHe: 'דומה ל: Airbnb למארחים',
      features: ['AI Matching', 'Split Payments', 'Background Checks', '24/7 Support'],
      featuresHe: ['התאמה AI', 'תשלומים מפוצלים', 'בדיקות רקע', 'תמיכה 24/7'],
      standalone: true,
      revenue: 'Booking commissions, sitter fees, insurance packages',
      revenueHe: 'עמלות הזמנה, דמי שמרטף, חבילות ביטוח',
    },
    {
      name: 'PetTrek™',
      nameHe: 'PetTrek™',
      icon: Car,
      color: 'from-purple-500 to-indigo-500',
      description: 'Advanced pet transport with Uber-style matching and live tracking - Complete rideshare platform',
      descriptionHe: 'הובלת חיות מחמד מתקדמת עם התאמה בסגנון Uber ומעקב חי - פלטפורמת rideshare מלאה',
      usComparison: 'Like: Uber Eats for Delivery',
      usComparisonHe: 'דומה ל: Uber Eats למשלוחים',
      features: ['Dynamic Pricing', 'Driver Matching', 'Live ETA', 'Safety Features'],
      featuresHe: ['תמחור דינמי', 'התאמת נהגים', 'ETA חי', 'תכונות בטיחות'],
      standalone: true,
      revenue: 'Ride fees, driver partnerships, surge pricing',
      revenueHe: 'דמי נסיעה, שותפויות נהגים, תמחור שיא',
    },
    {
      name: 'The Plush Lab™',
      nameHe: 'The Plush Lab™',
      icon: Wand2,
      color: 'from-amber-500 to-yellow-500',
      description: 'FREE public avatar creator with AI - Customer acquisition tool and standalone creative platform',
      descriptionHe: 'יוצר אווטארים ציבורי חינמי עם AI - כלי רכישת לקוחות ופלטפורמה יצירתית עצמאית',
      usComparison: 'Like: Google Photos (Free Tool → Ecosystem Entry)',
      usComparisonHe: 'דומה ל: Google Photos (כלי חינמי → כניסה למערכת)',
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
      usComparison: 'Like: Amazon AWS (Infrastructure as a Service)',
      usComparisonHe: 'דומה ל: Amazon AWS (תשתית כשירות)',
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
      description: 'Franchise management, multi-currency operations, and white-label solutions - Complete B2B division',
      descriptionHe: 'ניהול זכיינות, פעולות רב-מטבע ופתרונות white-label - חטיבת B2B מלאה',
      usComparison: 'Like: Microsoft Enterprise Solutions',
      usComparisonHe: 'דומה ל: פתרונות ארגוניים של Microsoft',
      features: ['Franchise Tools', 'Multi-Currency', 'Custom Branding', 'Analytics Dashboard'],
      featuresHe: ['כלי זכיינות', 'רב-מטבע', 'מיתוג מותאם', 'לוח מחוונים אנליטי'],
      standalone: true,
      revenue: 'Franchise fees, licensing, consulting, custom development',
      revenueHe: 'דמי זכיינות, רישוי, ייעוץ, פיתוח מותאם',
    },
  ];

  const usCompanies = [
    {
      company: 'Uber Technologies',
      divisions: ['Uber Drive (Rideshare)', 'Uber Eats (Food Delivery)', 'Uber Freight (Logistics)'],
      model: 'Each operates as standalone business with shared infrastructure',
      modelHe: 'כל אחד פועל כעסק עצמאי עם תשתית משותפת',
    },
    {
      company: 'Alphabet (Google)',
      divisions: ['Google Search', 'Gmail', 'Google Maps', 'YouTube', 'Google Cloud'],
      model: 'Independent products under unified brand umbrella',
      modelHe: 'מוצרים עצמאיים תחת מטריית מותג אחדותית',
    },
    {
      company: 'Amazon',
      divisions: ['Amazon.com (eCommerce)', 'AWS (Cloud)', 'Prime Video', 'Whole Foods'],
      model: 'Separate P&L centers with cross-selling opportunities',
      modelHe: 'מרכזי P&L נפרדים עם הזדמנויות מכירה צולבת',
    },
    {
      company: 'Apple',
      divisions: ['iPhone', 'Mac', 'Services', 'Wearables', 'Apple TV+'],
      model: 'Product divisions with shared ecosystem benefits',
      modelHe: 'חטיבות מוצרים עם יתרונות מערכת משותפת',
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-purple-900/20 py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          
          {/* Hero Section */}
          <div className="text-center mb-12">
            <Badge className="mb-4 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              {t('standaloneDivisions.businessArchitecture', language)}
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t('standaloneDivisions.multiBrandEcosystem', language)}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              {t('standaloneDivisions.heroSubtitle', language)}
            </p>
          </div>

          {/* US Companies Comparison */}
          <Card className="mb-12 border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Globe className="w-6 h-6" />
                {t('standaloneDivisions.leadingUSModel', language)}
              </CardTitle>
              <CardDescription>
                {t('standaloneDivisions.learnedFromBest', language)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                {usCompanies.map((company, idx) => (
                  <div key={idx} className="p-5 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-bold text-lg mb-3 text-blue-600 dark:text-blue-400">{company.company}</h3>
                    <div className="space-y-2 mb-4">
                      {company.divisions.map((div, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{div}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-700 pt-3">
                      {language === 'he' ? company.modelHe : company.model}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Our 7 Standalone Divisions */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">
              {t('standaloneDivisions.sevenDivisions', language)}
            </h2>
            <div className="grid lg:grid-cols-2 gap-6">
              {divisions.map((division, idx) => {
                const Icon = division.icon;
                return (
                  <Card key={idx} className="border-2 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                    <CardHeader className={`bg-gradient-to-r ${division.color} text-white`}>
                      <CardTitle className="flex items-center gap-3 text-2xl">
                        <Icon className="w-8 h-8" />
                        {language === 'he' ? division.nameHe : division.name}
                      </CardTitle>
                      {division.standalone && (
                        <Badge className="w-fit bg-white/20 text-white border-white/30">
                          {t('standaloneDivisions.fullStandaloneBusiness', language)}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="pt-6">
                      <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                        {language === 'he' ? division.descriptionHe : division.description}
                      </p>
                      
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                          {language === 'he' ? division.usComparisonHe : division.usComparison}
                        </p>
                      </div>

                      <div className="mb-4">
                        <h4 className="font-semibold text-sm mb-2 text-gray-700 dark:text-gray-300">
                          {t('standaloneDivisions.keyFeatures', language)}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {(language === 'he' ? division.featuresHe : division.features).map((feature, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold text-sm mb-1 text-green-800 dark:text-green-300">
                          {t('standaloneDivisions.revenueModel', language)}
                        </h4>
                        <p className="text-xs text-gray-700 dark:text-gray-300">
                          {language === 'he' ? division.revenueHe : division.revenue}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Why This Structure Works */}
          <Card className="border-2 border-purple-200 dark:border-purple-800">
            <CardHeader className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <TrendingUp className="w-6 h-6" />
                {t('standaloneDivisions.whyThisWorks', language)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                  <Users className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="font-bold mb-2 text-gray-800 dark:text-white">
                    {t('standaloneDivisions.specializedTeams', language)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('standaloneDivisions.specializedTeamsDesc', language)}
                  </p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 text-green-600" />
                  <h3 className="font-bold mb-2 text-gray-800 dark:text-white">
                    {t('standaloneDivisions.diversifiedRevenue', language)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('standaloneDivisions.diversifiedRevenueDesc', language)}
                  </p>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                  <h3 className="font-bold mb-2 text-gray-800 dark:text-white">
                    {t('standaloneDivisions.crossSellingOpportunities', language)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('standaloneDivisions.crossSellingDesc', language)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DISABLED: CTA for PlushLab (frozen for now, keep for future use) */}
          {/* <div className="mt-12 text-center">
            <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <CardContent className="pt-8 pb-8">
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  {t('standaloneDivisions.tryFreeDivision', language)}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
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
