import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, TreePine, Shield } from "lucide-react";

export default function MunicipalPartners() {
  return (
    <div className="min-h-screen luxury-bg-mesh py-12">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mb-4 luxury-shadow-lg luxury-animate-scale-in">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">Municipal & Council Projects</h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Pet-friendly city initiatives and public-private partnerships
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
            <Users className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">Community Benefits</h3>
            <p className="luxury-text-body">
              Enhance quality of life for pet owners with accessible washing facilities
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
            <TreePine className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">Environmental Impact</h3>
            <p className="luxury-text-body">
              Reduce home water usage and prevent contamination with controlled drainage
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
            <Shield className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">Public Health</h3>
            <p className="luxury-text-body">
              Promote pet hygiene and reduce disease transmission
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-5">
            <Building2 className="w-12 h-12 text-orange-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">Infrastructure</h3>
            <p className="luxury-text-body">
              Modern pet care facilities as part of smart city development
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 text-center bg-gradient-to-r from-purple-500/10 to-blue-500/10 luxury-animate-fade-in luxury-delay-6">
          <h2 className="luxury-heading-lg mb-4">Partner with ⁦Pet Wash™⁩</h2>
          <p className="luxury-text-body mb-6">
            Explore public-private partnership opportunities for your municipality
          </p>
          <button className="luxury-btn-primary luxury-shadow-xl px-8 py-4" data-testid="button-council-enquiry">
            Submit Council Enquiry
          </button>
        </div>
      </div>
    </div>
  );
}
