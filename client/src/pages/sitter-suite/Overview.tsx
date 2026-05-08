import { Link } from "wouter";
import { becomeProviderHref, setProviderSignupIntent } from "@/lib/becomeProvider";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import ProviderRegistrationBanner from "@/components/ProviderRegistrationBanner";
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
  ArrowLeft,
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
  const isRtl = language === 'he' || language === 'ar';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Button
            variant="ghost"
            onClick={() => { try { window.history.back(); } catch { window.location.href = '/dashboard'; } }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <BackArrow className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'חזרה' : 'Back'}</span>
          </Button>
        </div>
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
                <Button className="luxury-btn-primary flex items-center gap-2 px-8" data-testid="button-find-sitter">
                  <Search className="h-5 w-5" />
                  {t('sitterSuite.findSitter')}
                </Button>
              </Link>
              <Link href={becomeProviderHref('sitter')} onClick={setProviderSignupIntent}>
                <Button className="luxury-btn-secondary flex items-center gap-2 px-8" data-testid="button-become-sitter">
                  <Home className="h-5 w-5" />
                  {t('sitterSuite.becomeSitter')}
                </Button>
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
                  <Button className="luxury-btn-ghost w-full flex items-center justify-between text-sm" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {t('sitterSuite.view')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-16 bg-white border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="luxury-grid-3">
              {stats.map((stat, index) => (
                <div key={index} className={`text-center luxury-animate-fade-in luxury-delay-${index + 1}`}>
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                    {stat.icon}
                  </div>
                  <div className="luxury-heading-md text-gray-900 mb-2">
                    {stat.title}
                  </div>
                  <div className="luxury-text-body text-gray-600">
                    {stat.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VALUE PROPOSITION SECTION - All translations verified by Gemini AI */}
        <div className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border border-amber-200 mb-4" data-testid="badge-first-in-israel">
                <Plane className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-700">
                  {t('marketplace.firstInIsrael')}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4" data-testid="heading-value-proposition">
                {t('marketplace.valueProposition')}
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                {t('marketplace.valuePropositionSubtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { 
                  icon: Shield, 
                  titleKey: 'marketplace.verifiedBackgroundChecked',
                  descKey: 'marketplace.verifiedBackgroundCheckedDesc',
                  color: 'from-blue-500 to-blue-600'
                },
                { 
                  icon: Heart, 
                  titleKey: 'marketplace.animalLoversOnly',
                  descKey: 'marketplace.animalLoversOnlyDesc',
                  color: 'from-pink-500 to-pink-600'
                },
                { 
                  icon: Award, 
                  titleKey: 'marketplace.legallyBindingAgreements',
                  descKey: 'marketplace.legallyBindingAgreementsDesc',
                  color: 'from-amber-500 to-orange-500'
                },
                { 
                  icon: Users, 
                  titleKey: 'marketplace.houseSittingIncluded',
                  descKey: 'marketplace.houseSittingIncludedDesc',
                  color: 'from-green-500 to-emerald-500'
                },
                { 
                  icon: MapPin, 
                  titleKey: 'marketplace.localNeighborhoodProviders',
                  descKey: 'marketplace.localNeighborhoodProvidersDesc',
                  color: 'from-purple-500 to-purple-600'
                },
                { 
                  icon: Home, 
                  titleKey: 'marketplace.youChooseLocation',
                  descKey: 'marketplace.youChooseLocationDesc',
                  color: 'from-cyan-500 to-teal-500'
                },
                { 
                  icon: Shield, 
                  titleKey: 'marketplace.fullInsurance',
                  descKey: 'marketplace.fullInsuranceDesc',
                  color: 'from-indigo-500 to-blue-600'
                },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:bg-white transition-all duration-300"
                  data-testid={`value-prop-card-${i}`}
                >
                  <div className={`w-14 h-14 mb-4 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-lg`}>
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{t(item.titleKey)}</h3>
                  <p className="text-sm text-gray-600">{t(item.descKey)}</p>
                </div>
              ))}
            </div>

            {/* Vacation CTA */}
            <div className="mt-12 bg-white rounded-2xl border-2 border-gray-200 p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="text-center lg:text-end">
                  <h3 className="text-2xl font-black text-gray-900 mb-2" data-testid="heading-vacation-cta">
                    🏖️ {t('marketplace.vacationCta')}
                  </h3>
                  <p className="text-lg text-gray-600">
                    {t('marketplace.vacationCtaDesc')}
                  </p>
                </div>
                <Link href="/sitter-suite/browse">
                  <Button 
                    className="px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg whitespace-nowrap"
                    data-testid="button-vacation-cta"
                  >
                    {t('marketplace.findSitterNow')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Become a Sitter - Provider Registration */}
            <ProviderRegistrationBanner variant="section" platform="sitter" className="mt-16" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
