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
  ArrowRight
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";

export default function K9000Overview() {
  // Apply SEO metadata
  useSEO(pageSEO.k9000);
  
  const features = [
    {
      icon: <MapPin className="h-8 w-8 text-blue-600" />,
      title: "Find a Station",
      description: "Locate the nearest K9000 organic wash station",
      link: "/k9000/stations",
      color: "bg-blue-50 dark:bg-blue-950"
    },
    {
      icon: <Calendar className="h-8 w-8 text-green-600" />,
      title: "Book a Wash",
      description: "Reserve your spot at a K9000 station",
      link: "/k9000/booking",
      color: "bg-green-50 dark:bg-green-950"
    },
    {
      icon: <History className="h-8 w-8 text-purple-600" />,
      title: "My Wash History",
      description: "View all your past K9000 wash sessions",
      link: "/k9000/history",
      color: "bg-purple-50 dark:bg-purple-950"
    },
    {
      icon: <Gift className="h-8 w-8 text-pink-600" />,
      title: "Loyalty & E-Gifts",
      description: "Earn rewards and send gift cards",
      link: "/loyalty",
      color: "bg-pink-50 dark:bg-pink-950"
    },
    {
      icon: <Shield className="h-8 w-8 text-indigo-600" />,
      title: "Safety Guidelines",
      description: "Learn how to use K9000 stations safely",
      link: "/k9000/safety",
      color: "bg-indigo-50 dark:bg-indigo-950"
    },
    {
      icon: <HelpCircle className="h-8 w-8 text-orange-600" />,
      title: "Help & Support",
      description: "Get assistance with K9000 services",
      link: "/k9000/help",
      color: "bg-orange-50 dark:bg-orange-950"
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero Section */}
        <div className="relative overflow-hidden py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center luxury-fade-in">
              <div className="flex justify-center mb-8">
                <div className="luxury-badge-primary">
                  <Sparkles className="h-5 w-5" />
                  Premium Organic Pet Care
                </div>
              </div>
              <h1 className="luxury-heading-xl mb-6">
                Pet Wash K9000™
              </h1>
              <p className="luxury-subtitle-lg max-w-2xl mx-auto mb-10">
                Self-service organic wash stations with IoT technology.  
                Premium care for your pets, anywhere, anytime.
              </p>
              <div className="flex flex-col sm:flex-row gap-5 justify-center">
                <Link href="/k9000/booking">
                  <button className="luxury-btn-primary luxury-shadow-xl px-10" data-testid="button-book-wash">
                    <Waves className="h-5 w-5 mr-2" />
                    Book a Wash Now
                  </button>
                </Link>
                <Link href="/k9000/stations">
                  <button className="luxury-btn-outline px-10" data-testid="button-find-station">
                    <MapPin className="h-5 w-5 mr-2" />
                    Find Stations
                  </button>
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
                    <button className="luxury-btn-outline w-full" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      Learn More
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-20 luxury-glass-minimal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 luxury-stagger-fade-in">
              <div className="text-center" style={{ animationDelay: '0.1s' }}>
                <div className="text-5xl font-black luxury-gradient-text mb-3">
                  100% Organic
                </div>
                <div className="luxury-text-body text-lg">
                  Premium organic shampoos
                </div>
              </div>
              <div className="text-center" style={{ animationDelay: '0.2s' }}>
                <div className="text-5xl font-black luxury-gradient-text mb-3">
                  IoT Enabled
                </div>
                <div className="luxury-text-body text-lg">
                  Smart wash technology
                </div>
              </div>
              <div className="text-center" style={{ animationDelay: '0.3s' }}>
                <div className="text-5xl font-black luxury-gradient-text mb-3">
                  Self-Service
                </div>
                <div className="luxury-text-body text-lg">
                  Wash on your schedule
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
