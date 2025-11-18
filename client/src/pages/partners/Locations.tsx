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
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <MapPin className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Business Locations & Landlords</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Partner with Pet Wash™ to add premium pet care amenities to your property
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {locationTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Card key={type.name} className="p-6 hover:shadow-lg transition-shadow">
                <Icon className="w-12 h-12 text-purple-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{type.name}</h3>
                <p className="text-gray-600 dark:text-gray-400">{type.desc}</p>
              </Card>
            );
          })}
        </div>

        <Card className="p-8 text-center bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <h2 className="text-2xl font-bold mb-4">Interested in Hosting a K9000™ Station?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Add value to your property with premium pet care amenities
          </p>
          <Button size="lg" data-testid="button-submit-enquiry">
            Submit Partnership Enquiry
          </Button>
        </Card>
      </div>
    </div>
  );
}
