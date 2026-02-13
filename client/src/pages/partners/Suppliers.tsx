import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Leaf, Truck, Award } from "lucide-react";

export default function SuppliersPartners() {
  return (
    <div className="min-h-screen luxury-bg-mesh py-12">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-full mb-4 luxury-shadow-lg luxury-animate-scale-in">
            <Package className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">Suppliers & Brands</h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Partner with ⁦Pet Wash™⁩ as a premium supplier or brand partner
          </p>
        </div>

        <div className="luxury-grid-3 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
            <Leaf className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">Organic Products</h3>
            <p className="luxury-text-body">
              Premium organic shampoos, conditioners, and pet care products
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
            <Truck className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">Equipment Suppliers</h3>
            <p className="luxury-text-body">
              K9000 station components, spare parts, and maintenance supplies
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
            <Award className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">Brand Partnerships</h3>
            <p className="luxury-text-body">
              Co-branding opportunities with premium pet care brands
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 text-center bg-gradient-to-r from-green-500/10 to-blue-500/10 luxury-animate-fade-in luxury-delay-5">
          <h2 className="luxury-heading-lg mb-4">Become a Supplier Partner</h2>
          <p className="luxury-text-body mb-6">
            Join our global supply chain and distribution network
          </p>
          <button className="luxury-btn-primary luxury-shadow-xl px-8 py-4" data-testid="button-supplier-application">
            Apply as Supplier
          </button>
        </div>
      </div>
    </div>
  );
}
