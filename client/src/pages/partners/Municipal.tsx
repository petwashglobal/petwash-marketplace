import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, TreePine, Shield } from "lucide-react";

export default function MunicipalPartners() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <Building2 className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Municipal & Council Projects</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Pet-friendly city initiatives and public-private partnerships
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="p-6">
            <Users className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Community Benefits</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Enhance quality of life for pet owners with accessible washing facilities
            </p>
          </Card>

          <Card className="p-6">
            <TreePine className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Environmental Impact</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Reduce home water usage and prevent contamination with controlled drainage
            </p>
          </Card>

          <Card className="p-6">
            <Shield className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Public Health</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Promote pet hygiene and reduce disease transmission
            </p>
          </Card>

          <Card className="p-6">
            <Building2 className="w-12 h-12 text-orange-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Infrastructure</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Modern pet care facilities as part of smart city development
            </p>
          </Card>
        </div>

        <Card className="p-8 text-center bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <h2 className="text-2xl font-bold mb-4">Partner with Pet Wash™</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Explore public-private partnership opportunities for your municipality
          </p>
          <Button size="lg" data-testid="button-council-enquiry">
            Submit Council Enquiry
          </Button>
        </Card>
      </div>
    </div>
  );
}
