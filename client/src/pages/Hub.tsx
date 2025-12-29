import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import {
  Home,
  Droplets,
  Dog,
  Route as RouteIcon,
  GraduationCap,
  ShoppingBag,
  Award,
  Gift,
  TrendingUp,
  Users,
  Star,
  Activity,
  Clock,
  Sparkles,
  Zap,
  Heart,
} from "lucide-react";

export default function Hub() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const platforms = [
    {
      icon: Droplets,
      name: "Wash Stations",
      desc: "Self-service K9000 organic wash",
      href: "/stations",
      active: true,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Home,
      name: "Sitter Suite",
      desc: "Trusted pet and home sitting",
      href: "/sitter-suite/overview",
      active: true,
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: Dog,
      name: "Walk My Pet",
      desc: "Walks, play time and outdoor",
      href: "/walk-my-pet/overview",
      active: true,
      gradient: "from-orange-500 to-amber-500",
    },
    {
      icon: RouteIcon,
      name: "PetTrek",
      desc: "Pet taxi between locations",
      href: "/pettrek/overview",
      active: true,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: ShoppingBag,
      name: "Plush Lab",
      desc: "Premium pet boutique",
      href: "/plush-lab",
      active: true,
      gradient: "from-rose-500 to-red-500",
    },
    {
      icon: GraduationCap,
      name: "Academy",
      desc: "Training and certification",
      href: "/academy",
      active: true,
      gradient: "from-indigo-500 to-violet-500",
    },
    {
      icon: Award,
      name: "Loyalty & VIP",
      desc: "Rewards and benefits",
      href: "/loyalty",
      active: true,
      gradient: "from-yellow-500 to-orange-500",
    },
    {
      icon: Gift,
      name: "eGift Cards",
      desc: "Digital gifts for loved ones",
      href: "/egift",
      active: true,
      gradient: "from-pink-500 to-fuchsia-500",
    },
  ];

  const quickStats = [
    { label: "Active Bookings", value: "3", icon: Activity },
    { label: "Loyalty Points", value: "1,250", icon: Star },
    { label: "Services Used", value: "12", icon: Sparkles },
  ];

  const recentActivity = [
    {
      title: "Wash Station Booking",
      desc: "Tel Aviv Marina - Station #5",
      time: "2 hours ago",
      badge: "Completed",
      badgeType: "success",
    },
    {
      title: "Walk Scheduled",
      desc: "Tomorrow at 10:00 AM",
      time: "5 hours ago",
      badge: "Upcoming",
      badgeType: "default",
    },
    {
      title: "Loyalty Reward Earned",
      desc: "+50 points added",
      time: "1 day ago",
      badge: "New",
      badgeType: "gold",
    },
  ];

  const featuredServices = [
    {
      title: "First Wash Free",
      desc: "Try our K9000 stations with your first wash on us",
      cta: "Claim Offer",
      icon: Droplets,
    },
    {
      title: "Refer & Earn",
      desc: "Get 100 points for each friend who joins",
      cta: "Share Now",
      icon: Users,
    },
    {
      title: "VIP Upgrade",
      desc: "Unlock exclusive benefits and priority booking",
      cta: "Learn More",
      icon: Zap,
    },
  ];

  return (
    <Layout>
    <div className="min-h-screen luxury-bg-purple-fade">
      <div className="luxury-container py-12">
        
        {/* Hero Section */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-4">
            Pet Wash Hub™
          </h1>
          {user && (
            <p className="luxury-heading-lg mb-3">
              Welcome back, {user.displayName || user.email?.split('@')[0] || 'Friend'}!
            </p>
          )}
          <p className="luxury-text-body max-w-2xl mx-auto">
            One 7-star account for all your pets and services. Seamless access to our complete ecosystem.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {quickStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="luxury-heading-lg luxury-text-gradient mb-1">
                    {stat.value}
                  </div>
                  <div className="luxury-text-small">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Navigation Grid */}
        <div className="mb-12">
          <h2 className="luxury-heading-md text-center mb-8 luxury-animate-fade-in luxury-delay-2">
            Explore Our Platforms
          </h2>
          <div className="luxury-grid-4">
            {platforms.map((platform, index) => {
              const Icon = platform.icon;
              return (
                <div
                  key={platform.name}
                  className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl p-6 luxury-animate-scale-in luxury-delay-${Math.min(index + 1, 5)} ${
                    platform.active
                      ? "cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (platform.active && platform.href !== "#") {
                      setLocation(platform.href);
                    }
                  }}
                  data-testid={`platform-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <h3 className="luxury-heading-sm mb-2">{platform.name}</h3>
                      <p className="luxury-text-small">
                        {platform.desc}
                      </p>
                    </div>
                    {platform.active && platform.href !== "#" && (
                      <button 
                        className="luxury-btn-primary w-full mt-2"
                        data-testid={`button-launch-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        Launch
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two Column Layout: Recent Activity + Loyalty Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          {/* Recent Activity */}
          <div className="luxury-animate-slide-up luxury-delay-3">
            <h3 className="luxury-heading-md mb-6">Recent Activity</h3>
            <div className="luxury-glass-panel p-6 space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="luxury-glass-minimal p-4 luxury-hover-lift flex items-start gap-4"
                  data-testid={`activity-${index}`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {activity.title}
                      </h4>
                      <span className={`luxury-badge ${
                        activity.badgeType === 'success' ? 'luxury-badge-success' :
                        activity.badgeType === 'gold' ? 'luxury-badge-gold' : 'luxury-badge'
                      } flex-shrink-0`}>
                        {activity.badge}
                      </span>
                    </div>
                    <p className="luxury-text-small mb-1">{activity.desc}</p>
                    <p className="luxury-text-small opacity-60">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loyalty Status */}
          <div className="luxury-animate-slide-up luxury-delay-4">
            <h3 className="luxury-heading-md mb-6">Loyalty Status</h3>
            <div className="luxury-glass-card luxury-hover-glow p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 mb-4">
                  <Award className="w-10 h-10 text-white" />
                </div>
                <div className="luxury-badge-gold mb-3">
                  Gold Member
                </div>
                <div className="luxury-heading-lg luxury-text-gradient mb-1">
                  1,250 Points
                </div>
                <p className="luxury-text-small">
                  750 points to Platinum
                </p>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: '62.5%' }}
                ></div>
              </div>
              
              <button 
                className="luxury-btn-primary w-full"
                onClick={() => setLocation('/loyalty')}
                data-testid="button-view-rewards"
              >
                View Rewards
              </button>
            </div>
          </div>
        </div>

        {/* Featured Services/Promotions */}
        <div className="luxury-animate-slide-up luxury-delay-5">
          <h3 className="luxury-heading-md text-center mb-8">Featured For You</h3>
          <div className="luxury-grid-3">
            {featuredServices.map((service, index) => {
              const Icon = service.icon;
              return (
                <div
                  key={index}
                  className="luxury-glass-card luxury-hover-lift p-6"
                  data-testid={`featured-${index}`}
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="luxury-heading-sm mb-2">{service.title}</h4>
                  <p className="luxury-text-small mb-4">{service.desc}</p>
                  <button 
                    className="luxury-btn-secondary w-full"
                    data-testid={`button-${service.cta.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {service.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center luxury-animate-fade-in luxury-delay-5">
          <div className="luxury-glass-card luxury-shadow-xl p-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-6">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h2 className="luxury-heading-lg mb-4">
              Experience the Pet Wash™ Ecosystem
            </h2>
            <p className="luxury-text-body mb-6 max-w-2xl mx-auto">
              One account. Eight premium platforms. Unlimited care for your pets.
            </p>
            <button 
              className="luxury-btn-primary"
              onClick={() => setLocation('/signup')}
              data-testid="button-join-hub"
            >
              Join Pet Wash Hub
            </button>
          </div>
        </div>

      </div>
    </div>
    </Layout>
  );
}
