import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSEO, pageSEO } from "@/lib/seo";
import { 
  Scissors, 
  Search, 
  Calendar, 
  Clock, 
  Heart, 
  DollarSign,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Sparkle
} from "lucide-react";

export default function GroomersOverview() {
  // Apply SEO metadata
  useSEO(pageSEO.groomingMarketplace);
  
  const features = [
    {
      icon: <Search className="h-8 w-8 text-[#B8932F]" />,
      title: "Find a Groomer",
      description: "Browse professional groomers in your area",
      link: "/groomers",
      color: "bg-[#D4AF37] dark:bg-[#B8932F]"
    },
    {
      icon: <Calendar className="h-8 w-8 text-[#B8932F]" />,
      title: "Book Appointment",
      description: "Schedule grooming services",
      link: "/groomers/book",
      color: "bg-[#D4AF37] dark:bg-[#B8932F]"
    },
    {
      icon: <Clock className="h-8 w-8 text-[#B8932F]" />,
      title: "My Appointments",
      description: "View upcoming and past grooming sessions",
      link: "/groomers/customer/dashboard",
      color: "bg-[#D4AF37] dark:bg-[#B8932F]"
    },
    {
      icon: <Heart className="h-8 w-8 text-rose-600" />,
      title: "Favourite Groomers",
      description: "Save your trusted groomers",
      link: "/groomers/favorites",
      color: "bg-rose-50 dark:bg-rose-950"
    },
    {
      icon: <DollarSign className="h-8 w-8 text-emerald-600" />,
      title: "Pricing & Add-ons",
      description: "View services and pricing",
      link: "/groomers/pricing",
      color: "bg-emerald-50 dark:bg-emerald-950"
    },
    {
      icon: <HelpCircle className="h-8 w-8 text-[#B8932F]" />,
      title: "Help & Support",
      description: "Get assistance with grooming services",
      link: "/groomers/help",
      color: "bg-white dark:bg-[#B8932F]"
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Luxury Hero Section */}
        <div className="relative overflow-hidden py-16 sm:py-24 luxury-animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center luxury-animate-slide-up">
              <div className="flex justify-center mb-6">
                <div className="luxury-badge">
                  <Sparkles className="h-4 w-4" />
                  Professional Pet Grooming
                </div>
              </div>
              <h1 className="luxury-heading-xl mb-4">
                Groomers Marketplace
              </h1>
              <p className="luxury-text-body max-w-2xl mx-auto mb-8">
                Expert grooming services for your pet.  
                Haircuts, baths, nail trims, and spa treatments.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/groomers">
                  <Button size="lg" className="luxury-btn-primary px-8" data-testid="button-find-groomer">
                    <Scissors className="h-5 w-5 mr-2" />
                    Find a Groomer
                  </Button>
                </Link>
                <Link href="/groomers/book">
                  <Button size="lg" className="luxury-btn-secondary px-8" data-testid="button-book-grooming">
                    <Calendar className="h-5 w-5 mr-2" />
                    Book Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Luxury Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="luxury-grid-3">
            {features.map((feature, index) => (
              <Link key={index} href={feature.link}>
                <div className={`luxury-glass-card luxury-hover-glow cursor-pointer h-full luxury-animate-scale-in luxury-delay-${Math.min(index + 1, 10)}`}>
                  <CardHeader>
                    <div className="inline-flex p-4 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] dark:from-[#B8932F]/50 dark:to-[#B8932F]/50 luxury-shadow-md mb-4">
                      {feature.icon}
                    </div>
                    <CardTitle className="luxury-heading-sm luxury-text-gradient">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="luxury-text-body">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" className="w-full justify-between text-[#B8932F] dark:text-[#D4AF37] hover:text-[#B8932F] dark:hover:text-[#D4AF37]" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      Learn More
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Luxury Stats Section */}
        <div className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="luxury-glass-card luxury-shadow-xl p-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center luxury-animate-slide-up luxury-delay-7">
                  <div className="luxury-heading-lg luxury-text-gradient mb-2">
                    Certified Groomers
                  </div>
                  <div className="luxury-text-body">
                    Licensed professionals
                  </div>
                </div>
                <div className="text-center luxury-animate-slide-up luxury-delay-8">
                  <div className="luxury-heading-lg luxury-text-gradient mb-2">
                    Premium Products
                  </div>
                  <div className="luxury-text-body">
                    High-quality care
                  </div>
                </div>
                <div className="text-center luxury-animate-slide-up luxury-delay-9">
                  <div className="luxury-heading-lg luxury-text-gradient mb-2">
                    Spa Treatments
                  </div>
                  <div className="luxury-text-body">
                    Luxury services available
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
