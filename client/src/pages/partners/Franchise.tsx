import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Globe, DollarSign, Users, TrendingUp, Award } from "lucide-react";

export default function FranchisePartners() {
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">
            Franchise & City Partners
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Join the ⁦Pet Wash™⁩ global franchise network. Proven business model, enterprise support, luxury brand.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-1">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Global Expansion</h3>
            <p className="luxury-text-body">
              Operating in multiple countries with aggressive growth plans
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Revenue Potential</h3>
            <p className="luxury-text-body">
              Multiple revenue streams across 8 business platforms
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Enterprise Support</h3>
            <p className="luxury-text-body">
              Full training, technology, marketing, and operational support
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Proven Model</h3>
            <p className="luxury-text-body">
              Tested systems, established brand, growing market demand
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <Award className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Premium Brand</h3>
            <p className="luxury-text-body">
              Luxury positioning with 7-star service standards
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 luxury-animate-fade-in luxury-delay-6">
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">Ready to Start?</h3>
            <p className="luxury-text-body mb-4">
              Request franchise information package
            </p>
            <button className="w-full luxury-btn-primary" data-testid="button-request-info">
              Request Information
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
