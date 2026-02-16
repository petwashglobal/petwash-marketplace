import { useLocation } from "wouter";
import { ShoppingBag, Sparkles, Leaf, Package, Search, ShoppingCart, Filter } from "lucide-react";

export default function Shop() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-12">
        {/* Cart Icon - Gradient Circle with Badge */}
        <div className="fixed top-24 right-6 z-50 luxury-animate-scale-in">
          <div className="relative cursor-pointer luxury-hover-lift">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center luxury-shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
              <span className="text-xs font-bold text-black">0</span>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center luxury-shadow-xl luxury-hover-glow">
              <ShoppingBag className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 luxury-badge luxury-badge-gold">
              SOON
            </div>
          </div>
          <h1 className="luxury-heading-xl mb-6">
            Pet Wash Shop™
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Organic care products and premium accessories - Coming Soon
          </p>
        </div>

        {/* Search & Filter Section */}
        <div className="luxury-glass-panel luxury-shadow-md p-6 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                data-testid="input-search-products"
              />
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <button className="luxury-badge cursor-pointer luxury-hover-lift" data-testid="filter-all">
                <Filter className="w-4 h-4" />
                All Products
              </button>
              <button className="luxury-badge cursor-pointer luxury-hover-lift" data-testid="filter-shampoos">
                Shampoos
              </button>
              <button className="luxury-badge cursor-pointer luxury-hover-lift" data-testid="filter-accessories">
                Accessories
              </button>
              <button className="luxury-badge cursor-pointer luxury-hover-lift" data-testid="filter-bundles">
                Bundles
              </button>
            </div>
          </div>
        </div>

        {/* Product Grid - Preview Cards (Disabled - Coming Soon) */}
        <div className="luxury-grid-3 mb-12 opacity-50 pointer-events-none select-none">
          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center luxury-animate-slide-up luxury-delay-2 relative">
            <div className="absolute top-3 right-3 px-2 py-0.5 text-[9px] tracking-wider uppercase font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Coming Soon</div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 luxury-shadow-lg">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Organic Shampoos</h3>
            <p className="luxury-text-small mb-6">
              Premium organic shampoos and conditioners for all breeds
            </p>
            <div className="luxury-heading-lg luxury-text-gradient mb-4">
              $24.99
            </div>
            <button className="luxury-btn-primary w-full opacity-50 cursor-not-allowed" disabled data-testid="button-add-shampoo">
              Coming Soon
            </button>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center luxury-animate-slide-up luxury-delay-3 relative">
            <div className="absolute top-3 right-3 px-2 py-0.5 text-[9px] tracking-wider uppercase font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Coming Soon</div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-6 luxury-shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Pet Accessories</h3>
            <p className="luxury-text-small mb-6">
              Luxury collars, leashes, beds, and toys
            </p>
            <div className="luxury-heading-lg luxury-text-gradient mb-4">
              $34.99
            </div>
            <button className="luxury-btn-primary w-full opacity-50 cursor-not-allowed" disabled data-testid="button-add-accessories">
              Coming Soon
            </button>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center luxury-animate-slide-up luxury-delay-4 relative">
            <div className="absolute top-3 right-3 px-2 py-0.5 text-[9px] tracking-wider uppercase font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Coming Soon</div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 luxury-shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Care Bundles</h3>
            <p className="luxury-text-small mb-6">
              Curated packages for complete pet care
            </p>
            <div className="luxury-heading-lg luxury-text-gradient mb-4">
              $89.99
            </div>
            <button className="luxury-btn-primary w-full opacity-50 cursor-not-allowed" disabled data-testid="button-add-bundle">
              Coming Soon
            </button>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className="luxury-glass-card luxury-shadow-xl p-12 text-center luxury-animate-scale-in luxury-delay-5">
          <div className="max-w-2xl mx-auto">
            <div className="luxury-badge luxury-badge-gold mb-6">
              Coming Soon
            </div>
            <h2 className="luxury-heading-lg mb-6">
              Pet Wash Shop™ is Coming Soon
            </h2>
            <p className="luxury-text-body mb-8">
              We're curating a premium selection of organic products and accessories.
              Sign up to be notified when we launch.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="luxury-btn-primary" data-testid="button-notify-launch">
                Notify Me at Launch
              </button>
              <button 
                className="luxury-btn-secondary" 
                data-testid="button-view-stations" 
                onClick={() => setLocation("/stations")}
              >
                Visit K9000 Stations
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 text-center luxury-animate-fade-in luxury-delay-6">
          <p className="luxury-text-small">
            Coming soon. Active platforms: Stations, Sitter Suite, Walk My Pet, PetTrek, Academy
          </p>
        </div>
      </div>
    </div>
  );
}
