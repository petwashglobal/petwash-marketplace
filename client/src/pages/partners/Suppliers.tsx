import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Leaf, Truck, Award } from "lucide-react";

export default function SuppliersPartners() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <Package className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Suppliers & Brands</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Partner with Pet Wash™ as a premium supplier or brand partner
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6">
            <Leaf className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Organic Products</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Premium organic shampoos, conditioners, and pet care products
            </p>
          </Card>

          <Card className="p-6">
            <Truck className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Equipment Suppliers</h3>
            <p className="text-gray-600 dark:text-gray-400">
              K9000 station components, spare parts, and maintenance supplies
            </p>
          </Card>

          <Card className="p-6">
            <Award className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Brand Partnerships</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Co-branding opportunities with premium pet care brands
            </p>
          </Card>
        </div>

        <Card className="p-8 text-center bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
          <h2 className="text-2xl font-bold mb-4">Become a Supplier Partner</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Join our global supply chain and distribution network
          </p>
          <Button size="lg" data-testid="button-supplier-application">
            Apply as Supplier
          </Button>
        </Card>
      </div>
    </div>
  );
}
