import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  MapPin
} from "lucide-react";

export default function WalkMyPetOverview() {
  const features = [
    {
      icon: <Dog className="h-8 w-8 text-emerald-600" />,
      title: "Book a Walk",
      description: "Find professional dog walkers in your area",
      link: "/walk-my-pet",
      color: "bg-emerald-50 dark:bg-emerald-950"
    },
    {
      icon: <Calendar className="h-8 w-8 text-blue-600" />,
      title: "Upcoming Walks",
      description: "View and manage your scheduled walks",
      link: "/walk-my-pet/owner/dashboard?tab=upcoming",
      color: "bg-blue-50 dark:bg-blue-950"
    },
    {
      icon: <Clock className="h-8 w-8 text-purple-600" />,
      title: "Past Walks",
      description: "Review your walk history and feedback",
      link: "/walk-my-pet/owner/dashboard?tab=past",
      color: "bg-purple-50 dark:bg-purple-950"
    },
    {
      icon: <Users className="h-8 w-8 text-pink-600" />,
      title: "My Walkers",
      description: "See your favorite and regular walkers",
      link: "/walk-my-pet/owner/dashboard?tab=walkers",
      color: "bg-pink-50 dark:bg-pink-950"
    },
    {
      icon: <Heart className="h-8 w-8 text-rose-600" />,
      title: "Memberships",
      description: "Subscribe for unlimited walks and discounts",
      link: "/walk-my-pet/memberships",
      color: "bg-rose-50 dark:bg-rose-950"
    },
    {
      icon: <Shield className="h-8 w-8 text-indigo-600" />,
      title: "Safety & Rules",
      description: "Learn about our safety protocols",
      link: "/walk-my-pet/safety",
      color: "bg-indigo-50 dark:bg-indigo-950"
    },
    {
      icon: <HelpCircle className="h-8 w-8 text-orange-600" />,
      title: "Help & Support",
      description: "Get assistance with Walk My Pet services",
      link: "/walk-my-pet/help",
      color: "bg-orange-50 dark:bg-orange-950"
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900 rounded-full text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  Professional Dog Walking
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                Walk My Pet™
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
                Connect with trusted, verified dog walkers.  
                GPS tracking, real-time updates, and insured service.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/walk-my-pet">
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8" data-testid="button-book-walker">
                    <Dog className="h-5 w-5 mr-2" />
                    Find a Walker
                  </Button>
                </Link>
                <Link href="/walk-my-pet/owner/dashboard">
                  <Button size="lg" variant="outline" className="px-8" data-testid="button-my-walks">
                    <Calendar className="h-5 w-5 mr-2" />
                    My Walks
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
                    <Button variant="ghost" className="w-full justify-between text-emerald-600 dark:text-emerald-400" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
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
                <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  Verified Walkers
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Background-checked professionals
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  GPS Tracking
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Real-time walk monitoring
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  Fully Insured
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Complete peace of mind
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
