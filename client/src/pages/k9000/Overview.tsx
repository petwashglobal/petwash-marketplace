import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Waves, 
  MapPin, 
  Calendar, 
  History, 
  Gift, 
  HelpCircle, 
  Shield,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Leaf,
  Clock,
  Droplet
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";

export default function K9000Overview() {
  useSEO(pageSEO.k9000);
  const { t, language } = useLanguage();
  const isRtl = language === 'he' || language === 'ar';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  
  const features = [
    {
      icon: <MapPin className="h-8 w-8 text-blue-600" />,
      title: t('k9000.findStation'),
      description: t('k9000.findStationDesc'),
      link: "/k9000/explore",
      color: "bg-blue-50 dark:bg-blue-950"
    },
    {
      icon: <Calendar className="h-8 w-8 text-green-600" />,
      title: t('k9000.bookWash'),
      description: t('k9000.findStationDesc'),
      link: "/k9000/booking",
      color: "bg-green-50 dark:bg-green-950"
    },
    {
      icon: <History className="h-8 w-8 text-purple-600" />,
      title: t('k9000.myWashes'),
      description: t('k9000.myWashesDesc'),
      link: "/k9000/booking",
      color: "bg-purple-50 dark:bg-purple-950"
    },
    {
      icon: <Gift className="h-8 w-8 text-pink-600" />,
      title: t('k9000.packages'),
      description: t('k9000.packagesDesc'),
      link: "/loyalty",
      color: "bg-pink-50 dark:bg-pink-950"
    },
    {
      icon: <Shield className="h-8 w-8 text-indigo-600" />,
      title: t('k9000.safety'),
      description: t('k9000.safetyDesc'),
      link: "/k9000/explore",
      color: "bg-indigo-50 dark:bg-indigo-950"
    },
    {
      icon: <HelpCircle className="h-8 w-8 text-orange-600" />,
      title: t('k9000.help'),
      description: t('k9000.helpDesc'),
      link: "/k9000/hub",
      color: "bg-white dark:bg-orange-950"
    }
  ];

  const stats = [
    { icon: <Leaf className="h-12 w-12 text-white" />, title: t('k9000.organic'), description: t('k9000.organicDesc') },
    { icon: <Clock className="h-12 w-12 text-white" />, title: t('k9000.available247'), description: t('k9000.available247Desc') },
    { icon: <Droplet className="h-12 w-12 text-white" />, title: t('k9000.ecoFriendly'), description: t('k9000.ecoFriendlyDesc') },
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Button
            onClick={() => { try { window.history.back(); } catch { window.location.href = '/dashboard'; } }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <BackArrow className="w-5 h-5" />
            <span className="text-sm font-medium">{isRtl ? 'חזרה' : 'Back'}</span>
          </Button>
        </div>
        {/* Hero Section */}
        <div className="relative overflow-hidden py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center luxury-fade-in">
              <div className="flex justify-center mb-8">
                <div className="luxury-badge-primary">
                  <Sparkles className="h-5 w-5" />
                  {t('k9000.badge')}
                </div>
              </div>
              <h1 className="luxury-heading-xl mb-6">
                {t('k9000.title')}
              </h1>
              <p className="luxury-subtitle-lg max-w-2xl mx-auto mb-10">
                {t('k9000.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-5 justify-center">
                <Link href="/k9000/booking">
                  <Button className="luxury-btn-primary luxury-shadow-xl px-10" data-testid="button-book-wash">
                    <Waves className="h-5 w-5 mr-2" />
                    {t('k9000.bookWash')}
                  </Button>
                </Link>
                <Link href="/k9000/explore">
                  <Button className="luxury-btn-outline px-10" data-testid="button-find-station">
                    <MapPin className="h-5 w-5 mr-2" />
                    {t('k9000.findStation')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="luxury-grid-3 luxury-stagger-fade-in">
            {features.map((feature, index) => (
              <Link key={index} href={feature.link}>
                <div className="luxury-glass-card luxury-hover-glow h-full cursor-pointer" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="p-8">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-6 luxury-pulse-glow">
                      {feature.icon}
                    </div>
                    <h3 className="text-2xl font-bold luxury-gradient-text mb-3">
                      {feature.title}
                    </h3>
                    <p className="luxury-text-body mb-6">
                      {feature.description}
                    </p>
                    <Button className="luxury-btn-outline w-full" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      {t('common.learnMore')}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-16 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800">
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
                  <div className="luxury-text-body text-blue-100">
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
