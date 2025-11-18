import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Globe, DollarSign, Users, TrendingUp, Award } from "lucide-react";

export default function FranchisePartners() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <Building2 className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Franchise & City Partners
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Join the Pet Wash™ global franchise network. Proven business model, enterprise support, luxury brand.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="p-6">
            <Globe className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Global Expansion</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Operating in multiple countries with aggressive growth plans
            </p>
          </Card>

          <Card className="p-6">
            <DollarSign className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Revenue Potential</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Multiple revenue streams across 8 business platforms
            </p>
          </Card>

          <Card className="p-6">
            <Users className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Enterprise Support</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Full training, technology, marketing, and operational support
            </p>
          </Card>

          <Card className="p-6">
            <TrendingUp className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Proven Model</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Tested systems, established brand, growing market demand
            </p>
          </Card>

          <Card className="p-6">
            <Award className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Premium Brand</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Luxury positioning with 7-star service standards
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <h3 className="text-lg font-semibold mb-2">Ready to Start?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Request franchise information package
            </p>
            <Button className="w-full" data-testid="button-request-info">
              Request Information
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
