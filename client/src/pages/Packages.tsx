import { useEffect, useState } from 'react';
import { Crown, Check, Gift, ShoppingBag, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';

const WASH_PRICE = 55;

const cardColors = {
  essential: {
    name: 'Rose',
    bg: 'linear-gradient(145deg, #b85a8c 0%, #d4789e 25%, #b85a8c 50%, #8a3d68 100%)',
    text: 'text-white',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  },
  silver: {
    name: 'Emerald',
    bg: 'linear-gradient(145deg, #1a5f3c 0%, #2a7a4e 25%, #1a5f3c 50%, #0d4a2c 100%)',
    text: 'text-white',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  },
  gold: {
    name: 'Gold',
    bg: 'linear-gradient(145deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)',
    text: 'text-white',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  },
  platinum: {
    name: 'Platinum',
    bg: 'linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 25%, #1a1a1a 50%, #0a0a0a 100%)',
    text: 'text-white',
    chipBg: 'linear-gradient(135deg, #d4af37 0%, #f4e4a1 25%, #d4af37 50%, #aa8a2e 100%)'
  }
};

type CardColorKey = keyof typeof cardColors;

interface Package {
  name: string;
  nameHebrew: string;
  price: number;
  washes: number;
  discount: number;
  tier: CardColorKey;
  features: string[];
  popular: boolean;
  validity: string;
}

const packages: Package[] = [
  {
    name: 'Single Wash',
    nameHebrew: 'שטיפה בודדת',
    price: 55,
    washes: 1,
    discount: 0,
    tier: 'essential',
    features: [
      'One premium organic wash',
      'Professional-grade equipment',
      'Temperature-controlled water',
      'Complete drying system',
      'Organic shampoo included'
    ],
    popular: false,
    validity: 'Valid for 30 days'
  },
  {
    name: 'Starter Pack',
    nameHebrew: 'חבילת מתחילים',
    price: 139,
    washes: 3,
    discount: 5,
    tier: 'silver',
    features: [
      '3 premium washes',
      '5% discount',
      'Shareable with family',
      'Priority scheduling',
      'Loyalty points included'
    ],
    popular: false,
    validity: 'Valid for 3 months'
  },
  {
    name: 'Premium Pack',
    nameHebrew: 'חבילת פרימיום',
    price: 269,
    washes: 5,
    discount: 10,
    tier: 'gold',
    features: [
      '5 premium washes',
      '10% discount',
      'Exclusive member benefits',
      'Bonus loyalty points',
      'Free birthday wash'
    ],
    popular: true,
    validity: 'Valid for 6 months'
  },
  {
    name: 'Elite Pack',
    nameHebrew: 'חבילת אליט',
    price: 499,
    washes: 10,
    discount: 15,
    tier: 'platinum',
    features: [
      '10 premium washes',
      '15% discount',
      'VIP treatment',
      '2x loyalty points',
      'Birthday bonus wash',
      'Priority support'
    ],
    popular: false,
    validity: 'Valid for 12 months'
  }
];

function generateSerialNumber(washes: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'PWL';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${result}/${washes}`;
}

function LuxuryPackageCard({ 
  pkg,
  isFlipped,
  onClick,
  serialNumber
}: { 
  pkg: Package;
  isFlipped: boolean;
  onClick: () => void;
  serialNumber: string;
}) {
  const colors = cardColors[pkg.tier];
  const originalPrice = pkg.washes * WASH_PRICE;
  const savings = originalPrice - pkg.price;
  
  return (
    <div 
      className="relative w-full cursor-pointer group"
      onClick={onClick}
      data-testid={`package-card-${pkg.tier}`}
    >
      <div 
        className="relative aspect-[1.586/1] rounded-2xl overflow-hidden transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-2xl"
        style={{ 
          background: colors.bg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset'
        }}
      >
        {!isFlipped ? (
          <>
            {/* Front of Card */}
            <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-between">
              {/* Top Row - Logo and Mascot */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                      <path d="M12 2C10.5 2 9.3 3.2 9.3 4.7c0 .7.3 1.4.7 1.9-.4.2-.7.4-1 .7-1.4-1-3.3-1.1-4.8-.2C2.7 8 2.2 10 3 11.5c.5.9 1.3 1.5 2.2 1.8-.1.4-.2.9-.2 1.4 0 3.9 3.1 7 7 7s7-3.1 7-7c0-.5-.1-.9-.2-1.4.9-.3 1.7-.9 2.2-1.8.8-1.5.3-3.5-1.2-4.4-1.5-.9-3.4-.8-4.8.2-.3-.3-.6-.5-1-.7.4-.5.7-1.2.7-1.9C14.7 3.2 13.5 2 12 2z"/>
                    </svg>
                  </div>
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    PetWash<sup className="text-[8px]">™</sup>
                  </span>
                </div>
                
                {/* Pet Mascot */}
                <div className="opacity-50">
                  <svg viewBox="0 0 80 60" className="w-12 h-8" fill="white">
                    <path d="M65 10 L65 5 L60 5 L60 10 L55 10 L55 15 L60 15 L65 15 L70 15 L70 10 Z" fillOpacity="0.6"/>
                    <ellipse cx="55" cy="35" rx="10" ry="12" fillOpacity="0.8"/>
                    <circle cx="51" cy="31" r="2" fill="black" fillOpacity="0.5"/>
                    <ellipse cx="32" cy="38" rx="8" ry="10" fillOpacity="0.8"/>
                    <circle cx="29" cy="34" r="1.5" fill="black" fillOpacity="0.5"/>
                  </svg>
                </div>
              </div>
              
              {/* Chip and Title */}
              <div className="flex items-center gap-3 mt-2">
                <div 
                  className="w-10 h-8 rounded-md"
                  style={{ 
                    background: colors.chipBg,
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-px p-0.5">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="bg-black bg-opacity-10 rounded-sm"></div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={`text-base sm:text-lg font-bold ${colors.text}`}>
                    {pkg.name}
                  </div>
                  <div className={`text-xs opacity-70 ${colors.text}`}>PetWash Ltd</div>
                </div>
              </div>
              
              {/* Price and Details */}
              <div className="mt-auto">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-2xl sm:text-3xl font-bold ${colors.text}`}>
                    ₪{pkg.price}
                  </span>
                  {savings > 0 && (
                    <span className={`text-sm line-through opacity-50 ${colors.text}`}>
                      ₪{originalPrice}
                    </span>
                  )}
                </div>
                <div className={`text-xs opacity-60 ${colors.text}`}>
                  {pkg.washes} {pkg.washes === 1 ? 'Wash' : 'Washes'} • {pkg.validity}
                </div>
                <div className="flex justify-between items-end mt-2">
                  <div className={`text-[10px] font-mono ${colors.text} opacity-60`}>
                    SN: {serialNumber}
                  </div>
                  {pkg.discount > 0 && (
                    <div className={`text-xs font-bold ${colors.text} bg-white bg-opacity-20 px-2 py-0.5 rounded`}>
                      SAVE {pkg.discount}%
                    </div>
                  )}
                </div>
              </div>
              
              {/* Popular Badge */}
              {pkg.popular && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-white text-black rounded-full text-[10px] font-bold">
                  <Crown className="w-2.5 h-2.5" />
                  BEST VALUE
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Back of Card */}
            <div className="absolute inset-0 p-4 sm:p-5 flex flex-col">
              {/* QR Code Area */}
              <div className="flex items-start gap-2">
                <div className="bg-white p-1.5 rounded-lg">
                  <div className="w-12 h-12 grid grid-cols-5 grid-rows-5 gap-px">
                    {[...Array(25)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}
                      ></div>
                    ))}
                  </div>
                </div>
                <div className={`text-[8px] font-mono ${colors.text} opacity-60 transform -rotate-90 origin-left mt-6`}>
                  {serialNumber}
                </div>
              </div>
              
              {/* Features */}
              <div className={`mt-3 space-y-1 ${colors.text}`}>
                {pkg.features.slice(0, 4).map((feature, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] opacity-80">
                    <Check className="w-3 h-3" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* Bottom */}
              <div className="mt-auto flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="white">
                      <path d="M12 2C10.5 2 9.3 3.2 9.3 4.7c0 .7.3 1.4.7 1.9-.4.2-.7.4-1 .7-1.4-1-3.3-1.1-4.8-.2C2.7 8 2.2 10 3 11.5c.5.9 1.3 1.5 2.2 1.8-.1.4-.2.9-.2 1.4 0 3.9 3.1 7 7 7s7-3.1 7-7c0-.5-.1-.9-.2-1.4.9-.3 1.7-.9 2.2-1.8.8-1.5.3-3.5-1.2-4.4-1.5-.9-3.4-.8-4.8.2-.3-.3-.6-.5-1-.7.4-.5.7-1.2.7-1.9C14.7 3.2 13.5 2 12 2z"/>
                    </svg>
                  </div>
                  <span className={`text-xs font-semibold ${colors.text}`}>
                    PetWash<sup className="text-[6px]">™</sup>
                  </span>
                </div>
                <div className={`text-sm font-bold ${colors.text} uppercase`}>
                  {pkg.tier}
                </div>
              </div>
            </div>
          </>
        )}
        
      </div>
    </div>
  );
}

export default function Packages() {
  const [, setLocation] = useLocation();
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [serialNumbers] = useState(() => 
    packages.map(pkg => generateSerialNumber(pkg.washes))
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const toggleFlip = (index: number) => {
    setFlippedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleSelectPackage = (pkg: Package) => {
    setLocation('/sign-up');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-neutral-50">
        {/* Hero Section */}
        <div className="relative bg-black text-white py-16 md:py-24 overflow-hidden">
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              background: 'radial-gradient(circle at 20% 50%, rgba(212,175,55,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 50%, rgba(26,95,60,0.3) 0%, transparent 40%)'
            }}
          ></div>
          
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-white border-opacity-20 rounded-full mb-6 bg-white bg-opacity-5">
                <Crown className="w-4 h-4" />
                <span className="text-sm font-medium tracking-widest uppercase">Exclusive Packages</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-4">
                Premium Wash
                <span className="block font-bold mt-2">Collections</span>
              </h1>
              
              <p className="text-lg text-white text-opacity-60 max-w-xl mx-auto">
                Luxury organic pet care packages. Save up to 15% with our curated collections.
              </p>
            </div>
          </div>
        </div>

        {/* Packages Grid */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <p className="text-center text-sm text-neutral-400 mb-8">
            Click any card to see features
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-6">
            {packages.map((pkg, index) => (
              <div key={index} className="flex flex-col gap-4 mx-auto w-full max-w-[280px] sm:max-w-none">
                <LuxuryPackageCard
                  pkg={pkg}
                  isFlipped={flippedCards[index] || false}
                  onClick={() => toggleFlip(index)}
                  serialNumber={serialNumbers[index]}
                />
                
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPackage(pkg);
                  }}
                  className={`
                    w-full h-12 rounded-xl font-bold tracking-wide transition-all duration-200
                    ${pkg.popular 
                      ? 'bg-black hover:bg-neutral-800 text-white' 
                      : 'bg-white hover:bg-neutral-100 text-black border-2 border-neutral-200 hover:border-black'
                    }
                  `}
                  data-testid={`button-select-${pkg.tier}`}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Select Package
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Gift Card CTA */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="bg-black rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden">
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.3) 0%, transparent 60%)'
              }}
            ></div>
            
            <div className="relative z-10">
              <Gift className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Give the Gift of Pet Care
              </h2>
              <p className="text-white text-opacity-60 mb-6 max-w-md mx-auto">
                Send a luxury digital gift card to any pet lover. Express checkout for guests.
              </p>
              <Button
                onClick={() => setLocation('/egift')}
                className="bg-white hover:bg-neutral-100 text-black h-14 px-8 rounded-xl font-bold"
                data-testid="button-gift-card"
              >
                <Gift className="w-5 h-5 mr-2" />
                Send Gift Card
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: '🧴', title: '100% Organic', desc: 'Premium shampoo' },
              { icon: '🌡️', title: 'Temperature', desc: 'Controlled water' },
              { icon: '💨', title: 'Pro Drying', desc: 'Complete system' },
              { icon: '🏆', title: 'Quality', desc: 'Guaranteed' }
            ].map((item, i) => (
              <div 
                key={i}
                className="bg-white rounded-2xl p-6 text-center border border-neutral-100"
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="font-bold text-sm">{item.title}</div>
                <div className="text-xs text-neutral-400">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
