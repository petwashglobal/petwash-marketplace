import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Search, 
  Calendar, 
  MessageSquare, 
  Star, 
  DollarSign,
  Shield,
  HelpCircle,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Camera,
  Heart,
  Award,
  Users,
  MapPin,
  Plane
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";

export default function SitterSuiteOverview() {
  useSEO(pageSEO.sitterSuite);
  const { t, language } = useLanguage();
  
  const features = [
    {
      icon: <Search className="h-8 w-8" />,
      title: t('sitterSuite.findSitter'),
      description: t('sitterSuite.browseVerified'),
      link: "/sitter-suite/browse",
    },
    {
      icon: <Home className="h-8 w-8" />,
      title: t('sitterSuite.listHome'),
      description: t('sitterSuite.listHomeDesc'),
      link: "/sitter-suite/hub",
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: t('sitterSuite.myBookings'),
      description: t('sitterSuite.myBookingsDesc'),
      link: "/sitter-suite/owner/dashboard",
    },
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: t('sitterSuite.messages'),
      description: t('sitterSuite.messagesDesc'),
      link: "/sitter-suite/owner/dashboard",
    },
    {
      icon: <Star className="h-8 w-8" />,
      title: t('sitterSuite.reviews'),
      description: t('sitterSuite.reviewsDesc'),
      link: "/sitter-suite/browse",
    },
    {
      icon: <DollarSign className="h-8 w-8" />,
      title: t('sitterSuite.payouts'),
      description: t('sitterSuite.payoutsDesc'),
      link: "/sitter-suite/sitter/dashboard",
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: t('sitterSuite.safety'),
      description: t('sitterSuite.safetyDesc'),
      link: "/sitter-suite/explore",
    },
    {
      icon: <HelpCircle className="h-8 w-8" />,
      title: t('sitterSuite.help'),
      description: t('sitterSuite.helpDesc'),
      link: "/sitter-suite/hub",
    }
  ];

  const stats = [
    { icon: <CheckCircle className="h-12 w-12 text-white" />, title: t('sitterSuite.backgroundChecks'), description: t('sitterSuite.backgroundChecksDesc') },
    { icon: <Camera className="h-12 w-12 text-white" />, title: t('sitterSuite.dailyPhotos'), description: t('sitterSuite.dailyPhotosDesc') },
    { icon: <Shield className="h-12 w-12 text-white" />, title: t('sitterSuite.fullyInsured'), description: t('sitterSuite.fullyInsuredDesc') },
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero Section */}
        <div className="luxury-services-hero">
          <div className="luxury-services-hero-content">
            <div className="luxury-services-badge luxury-animate-fade-in">
              <Sparkles className="h-4 w-4" />
              {t('sitterSuite.badge')}
            </div>
            <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
              {t('sitterSuite.title')}
            </h1>
            <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
              {t('sitterSuite.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 luxury-animate-fade-in luxury-delay-3">
              <Link href="/sitter-suite/browse">
                <button className="luxury-btn-primary flex items-center gap-2 px-8" data-testid="button-find-sitter">
                  <Search className="h-5 w-5" />
                  {t('sitterSuite.findSitter')}
                </button>
              </Link>
              <Link href="/sitter-suite/hub">
                <button className="luxury-btn-secondary flex items-center gap-2 px-8" data-testid="button-become-sitter">
                  <Home className="h-5 w-5" />
                  {t('sitterSuite.becomeSitter')}
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="luxury-grid-4">
            {features.map((feature, index) => (
              <Link key={index} href={feature.link}>
                <div className={`luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 cursor-pointer h-full luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}>
                  <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="luxury-heading-sm mb-2">
                    {feature.title}
                  </h3>
                  <p className="luxury-text-small mb-4">
                    {feature.description}
                  </p>
                  <button className="luxury-btn-ghost w-full flex items-center justify-between text-sm" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {t('sitterSuite.view')}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-16 bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="luxury-grid-3">
              {stats.map((stat, index) => (
                <div key={index} className={`text-center luxury-animate-fade-in luxury-delay-${index + 1}`}>
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    {stat.icon}
                  </div>
                  <div className="luxury-heading-md text-white mb-2">
                    {stat.title}
                  </div>
                  <div className="luxury-text-body text-purple-100">
                    {stat.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VALUE PROPOSITION SECTION */}
        <div className="py-16 bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-400/30 mb-4" data-testid="badge-first-in-israel">
                <Plane className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-300">
                  {t('marketplace.firstInIsrael') || (language === 'he' ? 'פעם ראשונה בישראל' : 'First in Israel')}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4" data-testid="heading-value-proposition">
                {t('marketplace.valueProposition') || (language === 'he' ? 'למה לבחור במרקטפלייס של Pet Wash™?' : 'Why Choose Pet Wash™ Marketplace?')}
              </h2>
              <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                {t('marketplace.valuePropositionSubtitle') || (language === 'he' 
                  ? 'מרקטפלייס השירותים לחיות מחמד הראשון והיוקרתי בישראל עם מקצוענים מאומתים'
                  : "Israel's first premium pet services marketplace with verified professionals")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { 
                  icon: Shield, 
                  title: language === 'he' ? 'כולם מאומתים ועברו בדיקת רקע' : 'All Verified & Background Checked',
                  desc: language === 'he' 
                    ? 'כל שמרטף, מטייל כלבים, נהג ומאלף עובר בדיקות רקע יסודיות ואימות זהות לפני שמצטרף לפלטפורמה שלנו.'
                    : 'Every sitter, dog walker, driver, and trainer passes thorough background checks and identity verification.',
                  color: 'from-blue-500 to-blue-600'
                },
                { 
                  icon: Heart, 
                  title: language === 'he' ? 'רק אוהבי חיות' : 'Animal Lovers Only',
                  desc: language === 'he' 
                    ? 'אנחנו מעסיקים רק אוהבי חיות אמיתיים שמתייחסים לכל חיית מחמד כמו לבן משפחה שלהם.'
                    : 'We hire only genuine animal lovers who treat every pet like their own family member.',
                  color: 'from-pink-500 to-pink-600'
                },
                { 
                  icon: Award, 
                  title: language === 'he' ? 'הסכמים מחייבים חוקית' : 'Legally Binding Agreements',
                  desc: language === 'he' 
                    ? 'כל קבלני המשנה שלנו חתומים על מסמכים מחייבים חוקית שמבטיחים אחריות וסטנדרטים מקצועיים.'
                    : 'All subcontractors sign legally binding documents ensuring accountability and professional standards.',
                  color: 'from-amber-500 to-orange-500'
                },
                { 
                  icon: Users, 
                  title: language === 'he' ? 'שמירה על הבית כלולה' : 'House Sitting Included',
                  desc: language === 'he' 
                    ? 'השמרטף שלכם ישמור על הבית, ישקה את העציצים, יאסוף דואר וישמור על הכל מאובטח בזמן שאתם בחופשה.'
                    : 'Your sitter will watch your home, water plants, collect mail, and keep everything secure.',
                  color: 'from-green-500 to-emerald-500'
                },
                { 
                  icon: MapPin, 
                  title: language === 'he' ? 'נותני שירות מהשכונה' : 'Local Neighborhood Providers',
                  desc: language === 'he' 
                    ? 'התחברו עם שכנים מהימנים שמחפשים הכנסה נוספת. הם מכירים את האזור ואכפת להם.'
                    : 'Connect with trusted neighbors looking for extra income. They know the area and they care.',
                  color: 'from-purple-500 to-purple-600'
                },
                { 
                  icon: Home, 
                  title: language === 'he' ? 'אתם בוחרים את המיקום' : "You Choose the Location",
                  desc: language === 'he' 
                    ? 'בבית שלכם או בבית השמרטף/ית - הבחירה שלכם! כל האפשרויות כוללות 2 טיולים ביום, מים טריים ואוכל.'
                    : 'At your home or the sitter\'s - your choice! All options include 2 daily walks, fresh water, and food.',
                  color: 'from-cyan-500 to-teal-500'
                },
                { 
                  icon: Shield, 
                  title: language === 'he' ? 'ביטוח מלא ומרגיע' : "Full Peace-of-Mind Insurance",
                  desc: language === 'he' 
                    ? 'כשהשמרטף/ית נשאר/ת אצלכם בבית, אתם מקבלים כיסוי ביטוחי מלא של ₪10 מיליון+ לשקט נפשי מושלם.'
                    : 'When a sitter stays at your home, you get full ₪10M+ insurance coverage for complete peace of mind.',
                  color: 'from-indigo-500 to-blue-600'
                },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-300"
                  data-testid={`value-prop-card-${i}`}
                >
                  <div className={`w-14 h-14 mb-4 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-lg`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-gray-300">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Vacation CTA */}
            <div className="mt-12 bg-gradient-to-r from-pink-600/30 via-purple-600/30 to-pink-600/30 rounded-2xl border-2 border-pink-400/30 p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="text-center lg:text-right">
                  <h3 className="text-2xl font-black text-white mb-2" data-testid="heading-vacation-cta">
                    {language === 'he' ? '🏖️ צאו לחופשה בשקט!' : '🏖️ Go on Vacation Stress-Free!'}
                  </h3>
                  <p className="text-lg text-pink-100">
                    {language === 'he' 
                      ? 'השאירו את חיית המחמד שלכם בבית עם שמרטף מקצועי. הם ידאגו לטיולים, אוכל, מים וחוויה מושלמת.'
                      : "Leave your pet at home with a professional sitter. They'll handle walks, food, water, and a perfect experience."}
                  </p>
                </div>
                <Link href="/sitter-suite/browse">
                  <button 
                    className="px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg whitespace-nowrap"
                    data-testid="button-vacation-cta"
                  >
                    {language === 'he' ? 'מצא שמרטף עכשיו' : 'Find a Sitter Now'}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
