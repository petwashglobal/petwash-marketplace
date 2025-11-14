import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowRight
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";

export default function SitterSuiteOverview() {
  // Apply SEO metadata
  useSEO(pageSEO.sitterSuite);
  
  const features = [
    {
      icon: <Search className="h-8 w-8 text-violet-600" />,
      title: "Find a Sitter",
      description: "Browse verified pet sitters in your area",
      link: "/sitter-suite",
      color: "bg-violet-50 dark:bg-violet-950"
    },
    {
      icon: <Home className="h-8 w-8 text-blue-600" />,
      title: "List Your Home",
      description: "Become a pet sitter and earn income",
      link: "/sitter-suite/become-sitter",
      color: "bg-blue-50 dark:bg-blue-950"
    },
    {
      icon: <Calendar className="h-8 w-8 text-green-600" />,
      title: "My Bookings",
      description: "View and manage your sitting bookings",
      link: "/sitter-suite/owner/dashboard",
      color: "bg-green-50 dark:bg-green-950"
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-purple-600" />,
      title: "Messages",
      description: "Chat with sitters and pet owners",
      link: "/sitter-suite/messages",
      color: "bg-purple-50 dark:bg-purple-950"
    },
    {
      icon: <Star className="h-8 w-8 text-amber-600" />,
      title: "Reviews",
      description: "Read and write reviews",
      link: "/sitter-suite/reviews",
      color: "bg-amber-50 dark:bg-amber-950"
    },
    {
      icon: <DollarSign className="h-8 w-8 text-emerald-600" />,
      title: "Payouts & Earnings",
      description: "Track your sitter earnings (for sitters)",
      link: "/sitter-suite/sitter/dashboard",
      color: "bg-emerald-50 dark:bg-emerald-950"
    },
    {
      icon: <Shield className="h-8 w-8 text-indigo-600" />,
      title: "Safety & Insurance",
      description: "Learn about our protection policies",
      link: "/sitter-suite/safety",
      color: "bg-indigo-50 dark:bg-indigo-950"
    },
    {
      icon: <HelpCircle className="h-8 w-8 text-orange-600" />,
      title: "Help & Support",
      description: "Get assistance with The Sitter Suite",
      link: "/sitter-suite/help",
      color: "bg-orange-50 dark:bg-orange-950"
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900 rounded-full text-sm font-medium text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-4 w-4" />
                  Premium Pet Sitting Marketplace
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                The Sitter Suite™
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
                Trusted pet sitting in the comfort of your home or theirs.  
                Background-checked sitters, daily photo updates, and full insurance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/sitter-suite">
                  <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white px-8" data-testid="button-find-sitter">
                    <Search className="h-5 w-5 mr-2" />
                    Find a Sitter
                  </Button>
                </Link>
                <Link href="/sitter-suite/become-sitter">
                  <Button size="lg" variant="outline" className="px-8" data-testid="button-become-sitter">
                    <Home className="h-5 w-5 mr-2" />
                    Become a Sitter
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Link key={index} href={feature.link}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-gray-200 dark:border-gray-800">
                  <CardHeader>
                    <div className={`inline-flex p-3 rounded-lg ${feature.color} mb-4`}>
                      {feature.icon}
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" className="w-full justify-between text-violet-600 dark:text-violet-400 text-sm" data-testid={`link-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      View
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
                <div className="text-4xl font-bold text-violet-600 dark:text-violet-400 mb-2">
                  Background Checks
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  All sitters verified
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  Daily Photos
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Stay connected with your pet
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                  Fully Insured
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Protection included
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
