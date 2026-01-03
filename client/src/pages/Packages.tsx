import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Check, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import roseFrontImg from '@assets/IMG_2004_1767430326403.png';
import roseBackImg from '@assets/IMG_2005_1767430326403.png';
import emeraldBackImg from '@assets/IMG_2003_1767430326404.png';
import goldFrontImg from '@assets/IMG_1996_1767430326404.png';
import goldBackImg from '@assets/IMG_1997_1767430326404.png';
import platinumFrontImg from '@assets/IMG_1998_1767430326404.png';
import platinumBackImg from '@assets/IMG_1999_1767430326404.png';

const WASH_PRICE = 55;

const cardImages = {
  rose: { front: roseFrontImg, back: roseBackImg },
  emerald: { front: emeraldBackImg, back: emeraldBackImg },
  gold: { front: goldFrontImg, back: goldBackImg },
  platinum: { front: platinumFrontImg, back: platinumBackImg }
};

interface PackageOption {
  washes: number;
  name: string;
  discount: number;
  color: keyof typeof cardImages;
  tier: string;
  features: string[];
  popular?: boolean;
}

const packageOptions: PackageOption[] = [
  { 
    washes: 1, 
    name: 'Essential', 
    discount: 0, 
    color: 'rose',
    tier: 'essential',
    features: ['Single premium wash', '100% organic shampoo', 'Valid 6 months']
  },
  { 
    washes: 3, 
    name: 'Silver', 
    discount: 5, 
    color: 'emerald',
    tier: 'silver',
    features: ['3 premium washes', '5% discount', 'Valid 9 months', 'Transferable']
  },
  { 
    washes: 5, 
    name: 'Premium', 
    discount: 8, 
    color: 'platinum',
    tier: 'premium',
    features: ['5 premium washes', '8% discount', 'Priority booking', 'Valid 12 months'],
    popular: true
  },
  { 
    washes: 10, 
    name: 'Elite', 
    discount: 12, 
    color: 'gold',
    tier: 'elite',
    features: ['10 premium washes', '12% discount', 'VIP treatment', '2x loyalty points', 'Valid 12 months']
  }
];

function LuxuryPackageCard({ 
  pkg,
  onClick,
  selected
}: { 
  pkg: PackageOption;
  onClick: () => void;
  selected?: boolean;
}) {
  const images = cardImages[pkg.color];
  const price = Math.round(pkg.washes * WASH_PRICE * (1 - pkg.discount / 100));
  const originalPrice = pkg.washes * WASH_PRICE;
  
  return (
    <button 
      type="button"
      className={`relative w-full text-left transition-all duration-300 rounded-2xl ${
        selected ? 'ring-4 ring-black ring-offset-2 scale-[1.02]' : 'hover:scale-[1.02]'
      }`}
      onClick={onClick}
      data-testid={`package-card-${pkg.tier}`}
    >
      {pkg.popular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-lg whitespace-nowrap">
          MOST POPULAR
        </div>
      )}
      <div className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl">
        <img 
          src={images.front}
          alt={`${pkg.name} - ${pkg.washes} Wash${pkg.washes > 1 ? 'es' : ''}`}
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />
      </div>
      <div className="mt-3 text-center">
        <p className="font-bold text-base sm:text-lg text-gray-900">{pkg.name}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">₪{price}</p>
        {pkg.discount > 0 && (
          <p className="text-xs sm:text-sm text-gray-500 line-through">₪{originalPrice}</p>
        )}
        <p className="text-xs sm:text-sm text-gray-600">{pkg.washes} Wash{pkg.washes > 1 ? 'es' : ''}</p>
        {pkg.discount > 0 && (
          <span className="inline-block mt-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium">
            Save {pkg.discount}%
          </span>
        )}
      </div>
    </button>
  );
}

export default function Packages() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handlePackageClick = (pkg: PackageOption) => {
    setSelectedPackage(pkg);
  };

  const proceedToDetails = () => {
    if (!selectedPackage) {
      toast({ title: "Please select a package", variant: "destructive" });
      return;
    }
    setShowDetails(true);
  };

  const handlePurchase = () => {
    if (!selectedPackage) return;
    toast({ title: "Processing your purchase...", description: "Redirecting to payment" });
  };

  if (showDetails && selectedPackage) {
    const price = Math.round(selectedPackage.washes * WASH_PRICE * (1 - selectedPackage.discount / 100));
    const originalPrice = selectedPackage.washes * WASH_PRICE;
    const images = cardImages[selectedPackage.color];

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
          <Button 
            variant="ghost" 
            onClick={() => setShowDetails(false)}
            className="mb-4 sm:mb-6"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="order-2 lg:order-1">
              <Card className="border-0 shadow-xl">
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedPackage.name} Package</h2>
                    <p className="text-gray-600">{selectedPackage.washes} Premium Wash{selectedPackage.washes > 1 ? 'es' : ''}</p>
                  </div>

                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-baseline gap-2 sm:gap-3">
                      <span className="text-3xl sm:text-4xl font-bold text-gray-900">₪{price}</span>
                      {selectedPackage.discount > 0 && (
                        <span className="text-lg sm:text-xl text-gray-400 line-through">₪{originalPrice}</span>
                      )}
                    </div>
                    {selectedPackage.discount > 0 && (
                      <p className="text-emerald-600 font-medium mt-1 text-sm sm:text-base">
                        You save ₪{originalPrice - price} ({selectedPackage.discount}% off)
                      </p>
                    )}
                  </div>

                  <div className="mb-4 sm:mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">What's Included:</h3>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {selectedPackage.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button 
                    className="w-full bg-black hover:bg-gray-800 text-white py-5 sm:py-6 text-base sm:text-lg"
                    onClick={handlePurchase}
                    data-testid="button-purchase"
                  >
                    Buy Now - ₪{price}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-3 sm:mt-4">
                    Secure checkout • 100% organic pet care
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="order-1 lg:order-2">
              <div className="w-full max-w-xs sm:max-w-sm mx-auto lg:sticky lg:top-8">
                <div className="relative aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl">
                  <img 
                    src={images.front}
                    alt={`${selectedPackage.name} Package`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Premium Wash Packages
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm sm:text-base">
            Save more with multi-wash packages. 100% organic shampoo with Australian tea tree oil.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {packageOptions.map((pkg) => (
              <LuxuryPackageCard
                key={pkg.washes}
                pkg={pkg}
                onClick={() => handlePackageClick(pkg)}
                selected={selectedPackage?.washes === pkg.washes}
              />
            ))}
          </div>

          {selectedPackage && (
            <div className="mt-6 sm:mt-8 text-center">
              <Button 
                className="bg-black hover:bg-gray-800 text-white px-8 sm:px-12 py-5 sm:py-6 text-base sm:text-lg"
                onClick={proceedToDetails}
                data-testid="button-proceed-details"
              >
                View Package Details
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              100% Organic
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              24/7 Self-Service
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              All Locations
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-500" />
              Transferable
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}