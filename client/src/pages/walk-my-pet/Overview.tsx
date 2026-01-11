import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import ProviderRegistrationBanner from "@/components/ProviderRegistrationBanner";
import { 
  Dog, 
  Calendar, 
  Clock, 
  Users, 
  Heart, 
  Shield,
  HelpCircle,
  Sparkles,
  ArrowRight,
  MapPin,
  CheckCircle
} from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

export default function WalkMyPetOverview() {
  const { t } = useLanguage();

  const features = [
    {
      icon: <Dog className="h-8 w-8" />,
      title: t('walkMyPet.bookWalk'),
      description: t('walkMyPet.bookWalkDesc'),
      link: "/walk-my-pet/browse",
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: t('walkMyPet.upcomingWalks'),
      description: t('walkMyPet.upcomingWalksDesc'),
      link: "/walk-my-pet/owner/dashboard?tab=upcoming",
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: t('walkMyPet.pastWalks'),
      description: t('walkMyPet.pastWalksDesc'),
      link: "/walk-my-pet/owner/dashboard?tab=past",
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: t('walkMyPet.myWalkers'),
      description: t('walkMyPet.myWalkersDesc'),
      link: "/walk-my-pet/owner/dashboard?tab=walkers",
    },
    {
      icon: <Heart className="h-8 w-8" />,
      title: t('walkMyPet.memberships'),
      description: t('walkMyPet.membershipsDesc'),
      link: "/loyalty",
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: t('walkMyPet.safetyRules'),
      description: t('walkMyPet.safetyRulesDesc'),
      link: "/walk-my-pet/explore",
    },
    {
      icon: <HelpCircle className="h-8 w-8" />,
      title: t('walkMyPet.help'),
      description: t('walkMyPet.helpDesc'),
      link: "/walk-my-pet/hub",
    }
  ];

  const stats = [
    { icon: <CheckCircle className="h-12 w-12 text-white" />, title: t('walkMyPet.verifiedWalkers'), description: t('walkMyPet.verifiedWalkersDesc') },
    { icon: <MapPin className="h-12 w-12 text-white" />, title: t('walkMyPet.gpsTracking'), description: t('walkMyPet.gpsTrackingDesc') },
    { icon: <Shield className="h-12 w-12 text-white" />, title: t('walkMyPet.fullyInsured'), description: t('walkMyPet.fullyInsuredDesc') },
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero Section */}
        <div className="luxury-services-hero">
          <div className="luxury-services-hero-content">
            <div className="luxury-services-badge luxury-animate-fade-in">
              <Sparkles className="h-4 w-4" />
              {t('walkMyPet.badge')}
            </div>
            <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
              {t('walkMyPet.title')}
            </h1>
            <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
              {t('walkMyPet.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 luxury-animate-fade-in luxury-delay-3">
              <Link href="/walk-my-pet/browse">
                <button className="luxury-btn-primary flex items-center gap-2 px-8" data-testid="button-book-walker">
                  <Dog className="h-5 w-5" />
                  {t('walkMyPet.findWalker')}
                </button>
              </Link>
              <Link href="/walk-my-pet/owner/dashboard">
                <button className="luxury-btn-secondary flex items-center gap-2 px-8" data-testid="button-my-walks">
                  <Calendar className="h-5 w-5" />
                  {t('walkMyPet.myWalks')}
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="luxury-grid-3">
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
                  <button className="luxury-btn-ghost w-full flex items-center justify-between" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {t('walkMyPet.learnMore')}
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

        {/* Become a Walker - Provider Registration */}
        <ProviderRegistrationBanner variant="section" platform="walker" />
      </div>
    </Layout>
  );
}
