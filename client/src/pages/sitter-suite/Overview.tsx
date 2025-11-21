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

export default function SitterSuiteOverview() {
  useSEO(pageSEO.sitterSuite);
  
  const features = [
    {
      icon: <Search className="h-8 w-8" />,
      title: "Find a Sitter",
      description: "Browse verified pet sitters in your area",
      link: "/sitter-suite",
    },
    {
      icon: <Home className="h-8 w-8" />,
      title: "List Your Home",
      description: "Become a pet sitter and earn income",
      link: "/sitter-suite/become-sitter",
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "My Bookings",
      description: "View and manage your sitting bookings",
      link: "/sitter-suite/owner/dashboard",
    },
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: "Messages",
      description: "Chat with sitters and pet owners",
      link: "/sitter-suite/messages",
    },
    {
      icon: <Star className="h-8 w-8" />,
      title: "Reviews",
      description: "Read and write reviews",
      link: "/sitter-suite/reviews",
    },
    {
      icon: <DollarSign className="h-8 w-8" />,
      title: "Payouts & Earnings",
      description: "Track your sitter earnings (for sitters)",
      link: "/sitter-suite/sitter/dashboard",
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Safety & Insurance",
      description: "Learn about our protection policies",
      link: "/sitter-suite/safety",
    },
    {
      icon: <HelpCircle className="h-8 w-8" />,
      title: "Help & Support",
      description: "Get assistance with The Sitter Suite",
      link: "/sitter-suite/help",
    }
  ];

  const stats = [
    { icon: <CheckCircle className="h-12 w-12 text-white" />, title: "Background Checks", description: "All sitters verified" },
    { icon: <Camera className="h-12 w-12 text-white" />, title: "Daily Photos", description: "Stay connected with your pet" },
    { icon: <Shield className="h-12 w-12 text-white" />, title: "Fully Insured", description: "Protection included" },
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Hero Section */}
        <div className="luxury-services-hero">
          <div className="luxury-services-hero-content">
            <div className="luxury-services-badge luxury-animate-fade-in">
              <Sparkles className="h-4 w-4" />
              Premium Pet Sitting Marketplace
            </div>
            <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
              The Sitter Suite™
            </h1>
            <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
              Trusted pet sitting in the comfort of your home or theirs.  
              Background-checked sitters, daily photo updates, and full insurance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 luxury-animate-fade-in luxury-delay-3">
              <Link href="/sitter-suite">
                <button className="luxury-btn-primary flex items-center gap-2 px-8" data-testid="button-find-sitter">
                  <Search className="h-5 w-5" />
                  Find a Sitter
                </button>
              </Link>
              <Link href="/sitter-suite/become-sitter">
                <button className="luxury-btn-secondary flex items-center gap-2 px-8" data-testid="button-become-sitter">
                  <Home className="h-5 w-5" />
                  Become a Sitter
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
                    View
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
