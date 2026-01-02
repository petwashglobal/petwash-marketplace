import { useEffect, useState } from 'react';
import { Check, Crown, Gift, Shield, Star, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Layout } from '@/components/Layout';

export default function Packages() {
  const [, setLocation] = useLocation();
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const packages = [
    {
      name: 'Single Wash',
      nameHebrew: 'שטיפה בודדת',
      price: '₪49',
      originalPrice: null,
      tier: 'ESSENTIAL',
      washes: 1,
      features: [
        'One premium organic wash',
        'Professional-grade equipment',
        'Temperature-controlled water',
        'Complete drying system',
        'Organic shampoo included'
      ],
      featuresHebrew: [
        'שטיפה אורגנית פרימיום אחת',
        'ציוד ברמה מקצועית',
        'מים בטמפרטורה מבוקרת',
        'מערכת ייבוש מושלמת',
        'שמפו אורגני כלול'
      ],
      popular: false
    },
    {
      name: 'Starter Pack',
      nameHebrew: 'חבילת מתחילים',
      price: '₪139',
      originalPrice: '₪196',
      tier: 'SILVER',
      washes: 4,
      features: [
        '4 premium washes',
        '5% discount',
        'Valid for 3 months',
        'Shareable with family',
        'Priority scheduling'
      ],
      featuresHebrew: [
        '4 שטיפות פרימיום',
        '5% הנחה',
        'בתוקף ל-3 חודשים',
        'ניתן לשיתוף עם המשפחה',
        'תזמון עדיפות'
      ],
      popular: false,
      savings: '₪57'
    },
    {
      name: 'Premium Pack',
      nameHebrew: 'חבילת פרימיום',
      price: '₪269',
      originalPrice: '₪392',
      tier: 'GOLD',
      washes: 8,
      features: [
        '8 premium washes',
        '10% discount',
        'Valid for 6 months',
        'Exclusive member benefits',
        'Bonus loyalty points'
      ],
      featuresHebrew: [
        '8 שטיפות פרימיום',
        '10% הנחה',
        'בתוקף ל-6 חודשים',
        'הטבות בלעדיות',
        'נקודות נאמנות בונוס'
      ],
      popular: true,
      savings: '₪123'
    },
    {
      name: 'Elite Pack',
      nameHebrew: 'חבילת אליט',
      price: '₪499',
      originalPrice: '₪784',
      tier: 'PLATINUM',
      washes: 16,
      features: [
        '16 premium washes',
        '15% discount',
        'Valid for 12 months',
        'VIP treatment',
        '2x loyalty points',
        'Birthday bonus wash'
      ],
      featuresHebrew: [
        '16 שטיפות פרימיום',
        '15% הנחה',
        'בתוקף לשנה',
        'יחס VIP',
        'נקודות נאמנות x2',
        'שטיפת בונוס ביום הולדת'
      ],
      popular: false,
      savings: '₪285'
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        {/* Hero Section - Ultra Luxury */}
      <div className="relative bg-black text-white py-20 overflow-hidden">
                
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-white border-opacity-30 rounded-full mb-8">
              <Crown className="w-4 h-4" />
              <span className="text-sm font-medium tracking-widest uppercase">Exclusive Packages</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-6">
              Premium Wash
              <span className="block font-bold">Collections</span>
            </h1>
            
            <p className="text-lg md:text-xl text-white opacity-70 max-w-2xl mx-auto font-light">
              Luxury organic pet care packages. Save up to 15% with our curated collections.
            </p>
          </div>
        </div>
      </div>

      {/* Packages Grid - Credit Card Style */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {packages.map((pkg, index) => {
            const isSelected = selectedPackage === index;
            
            return (
              <div 
                key={index}
                onClick={() => setSelectedPackage(index)}
                className={`
                  relative group cursor-pointer
                  transition-all duration-500 ease-out
                  ${isSelected ? 'scale-105 z-10' : 'hover:scale-[1.02]'}
                `}
                data-testid={`package-card-${index}`}
              >
                {/* Credit Card Container */}
                <div className={`
                  relative overflow-hidden rounded-2xl
                  aspect-[3/4] md:aspect-[2/3]
                  ${pkg.popular 
                    ? 'bg-black text-white shadow-2xl' 
                    : 'bg-white text-black border-2 border-black border-opacity-10 hover:border-opacity-30'
                  }
                  transition-all duration-300
                `}>
                  
                  {/* Popular Badge */}
                  {pkg.popular && (
                    <div className="absolute top-4 right-4 z-20">
                      <div className="flex items-center gap-1 px-3 py-1 bg-white text-black rounded-full text-xs font-bold tracking-wider">
                        <Star className="w-3 h-3 fill-current" />
                        BEST VALUE
                      </div>
                    </div>
                  )}

                  {/* Card Pattern Overlay */}
                  <div className={`absolute inset-0 opacity-5 ${pkg.popular ? 'opacity-10' : ''}`}>
                    <div className="absolute inset-0" style={{
                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${pkg.popular ? 'white' : 'black'} 10px, ${pkg.popular ? 'white' : 'black'} 11px)`
                    }}></div>
                  </div>

                  {/* Content */}
                  <div className="relative h-full flex flex-col p-6">
                    {/* Tier Badge */}
                    <div className={`
                      inline-flex self-start px-3 py-1 rounded text-xs font-bold tracking-widest mb-4
                      ${pkg.popular 
                        ? 'bg-white bg-opacity-20 text-white' 
                        : 'bg-black bg-opacity-5 text-black opacity-60'
                      }
                    `}>
                      {pkg.tier}
                    </div>

                    {/* Package Name */}
                    <h3 className="text-xl font-bold mb-1">{pkg.name}</h3>
                    <p className={`text-sm mb-6 ${pkg.popular ? 'text-white opacity-60' : 'text-black opacity-50'}`}>
                      {pkg.nameHebrew}
                    </p>

                    {/* Washes Count - Embossed Style */}
                    <div className="flex-grow flex items-center justify-center">
                      <div className="text-center">
                        <div className={`
                          text-6xl md:text-7xl font-black
                          ${pkg.popular 
                            ? 'text-white' 
                            : 'text-black'
                          }
                        `} style={{
                          textShadow: pkg.popular 
                            ? '2px 2px 0 rgba(255,255,255,0.1)' 
                            : '2px 2px 0 rgba(0,0,0,0.05)'
                        }}>
                          {pkg.washes}
                        </div>
                        <div className={`text-sm uppercase tracking-widest ${pkg.popular ? 'text-white opacity-50' : 'text-black opacity-40'}`}>
                          {pkg.washes === 1 ? 'Wash' : 'Washes'}
                        </div>
                      </div>
                    </div>

                    {/* Price Section */}
                    <div className="mt-auto pt-6 border-t border-current/10">
                      <div className="flex items-end justify-between">
                        <div>
                          {pkg.originalPrice && (
                            <div className={`text-sm line-through ${pkg.popular ? 'text-white opacity-40' : 'text-black opacity-30'}`}>
                              {pkg.originalPrice}
                            </div>
                          )}
                          <div className="text-3xl font-bold">{pkg.price}</div>
                        </div>
                        {pkg.savings && (
                          <div className={`
                            px-2 py-1 rounded text-xs font-bold
                            ${pkg.popular 
                              ? 'bg-white bg-opacity-20 text-white' 
                              : 'bg-black text-white'
                            }
                          `}>
                            SAVE {pkg.savings}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hover Effect Overlay */}
                  <div className={`
                    absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                    ${pkg.popular ? 'bg-white bg-opacity-5' : 'bg-black bg-opacity-5'}
                  `}></div>
                </div>

                {/* Select Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPackage(index);
                    setLocation('/sign-up');
                  }}
                  className={`
                    w-full mt-4 py-4 rounded-xl font-bold text-sm tracking-wider uppercase
                    transition-all duration-300
                    ${pkg.popular
                      ? 'bg-black text-white hover:bg-opacity-80'
                      : 'bg-white text-black border-2 border-black hover:bg-black hover:text-white'
                    }
                  `}
                  data-testid={`button-choose-package-${index}`}
                >
                  Select Package
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features Section - Minimalist */}
      <div className="bg-black bg-opacity-5 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Every Package Includes
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Sparkles, title: '100% Organic', desc: 'Premium shampoo' },
              { icon: Shield, title: 'Fully Insured', desc: 'Complete coverage' },
              { icon: Gift, title: 'Loyalty Points', desc: 'Earn rewards' },
              { icon: Crown, title: 'VIP Access', desc: 'Priority booking' }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-black flex items-center justify-center">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-black opacity-60">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Package Details - Luxury Table */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Compare Collections
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-4 px-4 text-left font-bold">Feature</th>
                {packages.map((pkg, i) => (
                  <th key={i} className={`py-4 px-4 text-center ${pkg.popular ? 'bg-black text-white' : ''}`}>
                    <span className="font-bold">{pkg.tier}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black border-opacity-10">
                <td className="py-4 px-4">Number of Washes</td>
                {packages.map((pkg, i) => (
                  <td key={i} className={`py-4 px-4 text-center font-bold ${pkg.popular ? 'bg-black bg-opacity-5' : ''}`}>
                    {pkg.washes}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-black border-opacity-10">
                <td className="py-4 px-4">Discount</td>
                <td className="py-4 px-4 text-center">—</td>
                <td className="py-4 px-4 text-center">5%</td>
                <td className="py-4 px-4 text-center font-bold bg-black bg-opacity-5">10%</td>
                <td className="py-4 px-4 text-center">15%</td>
              </tr>
              <tr className="border-b border-black border-opacity-10">
                <td className="py-4 px-4">Validity</td>
                <td className="py-4 px-4 text-center">—</td>
                <td className="py-4 px-4 text-center">3 months</td>
                <td className="py-4 px-4 text-center font-bold bg-black bg-opacity-5">6 months</td>
                <td className="py-4 px-4 text-center">12 months</td>
              </tr>
              <tr className="border-b border-black border-opacity-10">
                <td className="py-4 px-4">Loyalty Points</td>
                <td className="py-4 px-4 text-center"><Check className="w-5 h-5 mx-auto" /></td>
                <td className="py-4 px-4 text-center"><Check className="w-5 h-5 mx-auto" /></td>
                <td className="py-4 px-4 text-center font-bold bg-black bg-opacity-5">Bonus</td>
                <td className="py-4 px-4 text-center font-bold">2x</td>
              </tr>
              <tr>
                <td className="py-4 px-4">Price</td>
                {packages.map((pkg, i) => (
                  <td key={i} className={`py-4 px-4 text-center font-bold text-lg ${pkg.popular ? 'bg-black bg-opacity-5' : ''}`}>
                    {pkg.price}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-black text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Experience Luxury Pet Care?
          </h2>
          <p className="text-lg text-white opacity-70 mb-8">
            Join thousands of pet owners who trust Pet Wash™ for premium organic grooming.
          </p>
          <button 
            onClick={() => setLocation('/sign-up')}
            className="px-12 py-4 bg-white text-black font-bold rounded-full hover:bg-opacity-90 transition-all duration-300"
            data-testid="button-get-started"
          >
            Get Started
          </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
