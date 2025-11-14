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
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-full text-sm font-medium text-blue-700 dark:text-blue-300">
                  <Sparkles className="h-4 w-4" />
                  Premium Organic Pet Care
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                Pet Wash K9000™
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
                Self-service organic wash stations with IoT technology.  
                Premium care for your pets, anywhere, anytime.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/k9000/booking">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8" data-testid="button-book-wash">
                    <Waves className="h-5 w-5 mr-2" />
                    Book a Wash Now
                  </Button>
                </Link>
                <Link href="/k9000/stations">
                  <Button size="lg" variant="outline" className="px-8" data-testid="button-find-station">
                    <MapPin className="h-5 w-5 mr-2" />
                    Find Stations
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Link key={index} href={feature.link}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-gray-200 dark:border-gray-800">
                  <CardHeader>
                    <div className={`inline-flex p-3 rounded-lg ${feature.color} mb-4`}>
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" className="w-full justify-between text-blue-600 dark:text-blue-400" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      Learn More
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-gray-50 dark:bg-gray-900 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  100% Organic
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Premium organic shampoos
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                  IoT Enabled
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Smart wash technology
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  Self-Service
                </div>
                <div className="text-gray-600 dark:text-gray-400">
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
