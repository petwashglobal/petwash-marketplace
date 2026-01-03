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
  Camera
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";

export default function SitterSuiteOverview() {
  useSEO(pageSEO.sitterSuite);
  const { t } = useLanguage();
  
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
      </div>
    </Layout>
  );
}
