import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
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

export default function WalkMyPetOverview() {
  const features = [
    {
      icon: <Dog className="h-8 w-8" />,
      title: "Book a Walk",
      description: "Find professional dog walkers in your area",
      link: "/walk-my-pet",
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "Upcoming Walks",
      description: "View and manage your scheduled walks",
      link: "/walk-my-pet/owner/dashboard?tab=upcoming",
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: "Past Walks",
      description: "Review your walk history and feedback",
      link: "/walk-my-pet/owner/dashboard?tab=past",
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "My Walkers",
      description: "See your favorite and regular walkers",
      link: "/walk-my-pet/owner/dashboard?tab=walkers",
    },
    {
      icon: <Heart className="h-8 w-8" />,
      title: "Memberships",
      description: "Subscribe for unlimited walks and discounts",
      link: "/walk-my-pet/memberships",
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Safety & Rules",
      description: "Learn about our safety protocols",
      link: "/walk-my-pet/safety",
    },
    {
      icon: <HelpCircle className="h-8 w-8" />,
      title: "Help & Support",
      description: "Get assistance with Walk My Pet services",
      link: "/walk-my-pet/help",
    }
  ];

  const stats = [
    { icon: <CheckCircle className="h-12 w-12 text-white" />, title: "Verified Walkers", description: "Background-checked professionals" },
    { icon: <MapPin className="h-12 w-12 text-white" />, title: "GPS Tracking", description: "Real-time walk monitoring" },
    { icon: <Shield className="h-12 w-12 text-white" />, title: "Fully Insured", description: "Complete peace of mind" },
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero Section */}
        <div className="luxury-services-hero">
          <div className="luxury-services-hero-content">
            <div className="luxury-services-badge luxury-animate-fade-in">
              <Sparkles className="h-4 w-4" />
              Professional Dog Walking
            </div>
            <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
              Walk My Pet™
            </h1>
            <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
              Connect with trusted, verified dog walkers.  
              GPS tracking, real-time updates, and insured service.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 luxury-animate-fade-in luxury-delay-3">
              <Link href="/walk-my-pet">
                <button className="luxury-btn-primary flex items-center gap-2 px-8" data-testid="button-book-walker">
                  <Dog className="h-5 w-5" />
                  Find a Walker
                </button>
              </Link>
              <Link href="/walk-my-pet/owner/dashboard">
                <button className="luxury-btn-secondary flex items-center gap-2 px-8" data-testid="button-my-walks">
                  <Calendar className="h-5 w-5" />
                  My Walks
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
                    Learn More
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
