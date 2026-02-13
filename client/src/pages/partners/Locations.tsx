import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building, ShoppingCart, Fuel, Coffee } from "lucide-react";

export default function LocationPartners() {
  const locationTypes = [
    { icon: ShoppingCart, name: "Shopping Centers", desc: "High foot traffic retail locations" },
    { icon: Fuel, name: "Fuel Stations", desc: "Convenience stop pet wash services" },
    { icon: Coffee, name: "Service Plazas", desc: "Highway rest stops and service areas" },
    { icon: Building, name: "Business Parks", desc: "Corporate campus amenities" },
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh py-12">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-4 luxury-shadow-lg luxury-animate-scale-in">
            <MapPin className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">Business Locations & Landlords</h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Partner with ⁦Pet Wash™⁩ to add premium pet care amenities to your property
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 luxury-animate-slide-up luxury-delay-1">
          {locationTypes.map((type, idx) => {
            const Icon = type.icon;
            return (
              <div key={type.name} className={`luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-${idx + 2}`}>
                <Icon className="w-12 h-12 text-purple-600 mb-4" />
                <h3 className="luxury-heading-sm mb-2">{type.name}</h3>
                <p className="luxury-text-body">{type.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 text-center bg-gradient-to-r from-purple-500/10 to-pink-500/10 luxury-animate-fade-in luxury-delay-6">
          <h2 className="luxury-heading-lg mb-4">Interested in Hosting a ⁦K9000™⁩ Station?</h2>
          <p className="luxury-text-body mb-6">
            Add value to your property with premium pet care amenities
          </p>
          <button className="luxury-btn-primary luxury-shadow-xl px-8 py-4" data-testid="button-submit-enquiry">
            Submit Partnership Enquiry
          </button>
        </div>
      </div>
    </div>
  );
}
