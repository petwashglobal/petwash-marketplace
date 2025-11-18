import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Sparkles, Leaf, Package } from "lucide-react";

export default function Shop() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="relative inline-block">
            <ShoppingBag className="w-16 h-16 text-purple-600 mx-auto mb-4" />
            <div className="absolute -top-2 -right-2 bg-yellow-500 text-xs font-bold px-2 py-1 rounded-full text-black">
              SOON
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Pet Wash Shop™
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Organic care products and premium accessories - Coming Soon
          </p>
        </div>

        {/* Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center">
            <Leaf className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Organic Shampoos</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Premium organic shampoos and conditioners for all breeds
            </p>
          </Card>

          <Card className="p-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pet Accessories</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Luxury collars, leashes, beds, and toys
            </p>
          </Card>

          <Card className="p-6 text-center">
            <Package className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Care Bundles</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Curated packages for complete pet care
            </p>
          </Card>
        </div>

        {/* Coming Soon Banner */}
        <Card className="p-12 text-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <div className="max-w-2xl mx-auto">
            <div className="inline-block px-4 py-2 bg-yellow-500 text-black font-bold rounded-full mb-6">
              🚧 FROZEN - In Development
            </div>
            <h2 className="text-3xl font-bold mb-4">
              Pet Wash Shop™ is Coming Soon
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              We're curating a premium selection of organic products and accessories.
              Sign up to be notified when we launch.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" data-testid="button-notify-launch">
                Notify Me at Launch
              </Button>
              <Button size="lg" variant="outline" data-testid="button-view-stations" onClick={() => setLocation("/stations")}>
                Visit K9000 Stations
              </Button>
            </div>
          </div>
        </Card>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            This platform is currently frozen. Active platforms: Stations, Sitter, Walker, Transport, Academy
          </p>
        </div>
      </div>
    </div>
  );
}
