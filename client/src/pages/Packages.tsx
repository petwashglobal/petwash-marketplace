import { useEffect, useState } from 'react';
import { Check, Sparkles, Crown, Zap, Gift, Shield, TrendingUp, Package, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

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
      icon: Sparkles,
      color: 'from-blue-500 to-cyan-500',
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
      name: 'Starter Package',
      nameHebrew: 'חבילת מתחילים',
      price: '₪139',
      originalPrice: '₪196',
      icon: Zap,
      color: 'from-slate-500 to-gray-600',
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
      savings: '₪57 saved'
    },
    {
      name: 'Silver Package',
      nameHebrew: 'חבילת כסף',
      price: '₪269',
      originalPrice: '₪392',
      icon: Crown,
      color: 'from-purple-500 to-pink-500',
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
      savings: '₪123 saved'
    },
    {
      name: 'Gold Package',
      nameHebrew: 'חבילת זהב',
      price: '₪499',
      originalPrice: '₪784',
      icon: Crown,
      color: 'from-yellow-500 to-orange-500',
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
      savings: '₪285 saved'
    }
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'Choose Your Package',
      description: 'Select the perfect package for your pet washing needs'
    },
    {
      step: 2,
      title: 'Complete Purchase',
      description: 'Secure checkout with multiple payment options'
    },
    {
      step: 3,
      title: 'Receive Confirmation',
      description: 'Get instant access to your package credits'
    },
    {
      step: 4,
      title: 'Start Washing',
      description: 'Use your credits at any Pet Wash station'
    }
  ];

  const benefits = [
    {
      icon: TrendingUp,
      title: 'Save Money',
      description: 'Up to 15% discount on every wash'
    },
    {
      icon: Gift,
      title: 'Loyalty Rewards',
      description: 'Earn points and get free washes'
    },
    {
      icon: Crown,
      title: 'VIP Treatment',
      description: 'Priority access and exclusive perks'
    },
    {
      icon: Shield,
      title: 'No Expiry Stress',
      description: 'Generous validity periods'
    }
  ];

  return (
    <div className="min-h-screen luxury-bg-purple-fade">
      <div className="luxury-container">
        {/* Hero Section */}
        <div className="text-center py-16 luxury-animate-fade-in">
          <div className="text-6xl mb-6">🎁</div>
          <h1 className="luxury-heading-xl mb-4">
            Premium Wash Packages
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto mb-6">
            Save more with packages. The more you wash, the more you save!
          </p>
          <div className="inline-flex">
            <span className="luxury-badge luxury-badge-gold">
              💎 Up to 15% Savings
            </span>
          </div>
        </div>

        {/* Limited Time Offer Banner */}
        <div className="max-w-4xl mx-auto mb-12 luxury-glass-card luxury-shadow-xl p-8 text-center luxury-animate-slide-up luxury-delay-1"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <h2 className="text-2xl font-bold mb-2">🎉 Limited Time Offer!</h2>
          <p className="text-lg opacity-95">Get an extra wash FREE with any package purchase this month!</p>
        </div>

        {/* Packages Grid */}
        <div className="luxury-grid-3 max-w-7xl mx-auto mb-16">
          {packages.map((pkg, index) => {
            const Icon = pkg.icon;
            const isSelected = selectedPackage === index;
            return (
              <div 
                key={index} 
                className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl luxury-animate-scale-in transition-all duration-300 ${
                  isSelected ? 'ring-4 ring-purple-500 shadow-purple-500/50' : ''
                } ${pkg.popular ? 'scale-105' : ''}`}
                style={{ 
                  animationDelay: `${index * 0.1}s`,
                  opacity: 0,
                  animation: `luxury-scale-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1}s forwards`
                }}
                data-testid={`package-card-${index}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 luxury-badge luxury-badge-gold">
                    ⭐ BEST VALUE
                  </div>
                )}
                
                <div className="text-center p-6">
                  <div 
                    className={`w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r ${pkg.color} flex items-center justify-center luxury-shadow-lg`}
                  >
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="luxury-heading-md mb-2">{pkg.name}</h3>
                  <p className="luxury-text-body text-sm mb-4">{pkg.nameHebrew}</p>
                  
                  <div className="mt-4 mb-6">
                    {pkg.originalPrice && (
                      <div className="luxury-text-small line-through opacity-60">{pkg.originalPrice}</div>
                    )}
                    <div className="luxury-heading-lg luxury-text-gradient my-2">
                      {pkg.price}
                    </div>
                    {pkg.savings && (
                      <span className="luxury-badge luxury-badge-gold text-xs">
                        {pkg.savings}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 text-left">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <span className="luxury-text-body text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button 
                    className="luxury-btn-primary luxury-shadow-xl w-full"
                    onClick={() => {
                      setSelectedPackage(index);
                      setLocation('/sign-up');
                    }}
                    data-testid={`button-choose-package-${index}`}
                  >
                    Choose Package
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Package Comparison Table */}
        <div className="max-w-6xl mx-auto mb-16 luxury-animate-fade-in luxury-delay-3">
          <h2 className="luxury-heading-lg text-center mb-8">Compare Packages</h2>
          <div className="luxury-glass-card luxury-shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-100">
                    <th className="p-4 text-left luxury-heading-sm">Feature</th>
                    {packages.map((pkg, i) => (
                      <th key={i} className="p-4 text-center">
                        <span className="luxury-heading-sm luxury-text-gradient">{pkg.name}</span>
                        {pkg.popular && (
                          <div className="luxury-badge luxury-badge-gold text-xs mt-2">Best Value</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                    <td className="p-4 luxury-text-body">Number of Washes</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">1</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">4</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">8</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">16</td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                    <td className="p-4 luxury-text-body">Discount</td>
                    <td className="p-4 text-center luxury-text-body">-</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">5%</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">10%</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">15%</td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
                    <td className="p-4 luxury-text-body">Validity</td>
                    <td className="p-4 text-center luxury-text-body">-</td>
                    <td className="p-4 text-center luxury-text-body">3 months</td>
                    <td className="p-4 text-center luxury-text-body">6 months</td>
                    <td className="p-4 text-center luxury-text-body">12 months</td>
                  </tr>
                  <tr className="hover:bg-purple-50/30 transition-colors">
                    <td className="p-4 luxury-text-body">Loyalty Points</td>
                    <td className="p-4 text-center">
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    </td>
                    <td className="p-4 text-center">
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    </td>
                    <td className="p-4 text-center luxury-text-body font-semibold">Bonus</td>
                    <td className="p-4 text-center luxury-text-body font-semibold">2x</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="luxury-section luxury-bg-soft">
          <div className="max-w-5xl mx-auto">
            <h2 className="luxury-heading-lg text-center mb-12">How It Works</h2>
            <div className="luxury-grid-4">
              {howItWorks.map((step, index) => (
                <div 
                  key={index}
                  className="luxury-glass-minimal luxury-hover-lift p-6 text-center luxury-animate-slide-up"
                  style={{ animationDelay: `${index * 0.15}s` }}
                  data-testid={`how-it-works-step-${index}`}
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center luxury-shadow-md">
                    <span className="text-2xl font-bold text-white">{step.step}</span>
                  </div>
                  <h3 className="luxury-heading-sm mb-2">{step.title}</h3>
                  <p className="luxury-text-body text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="luxury-section">
          <div className="max-w-6xl mx-auto">
            <h2 className="luxury-heading-lg text-center mb-12">Package Benefits</h2>
            <div className="luxury-grid-4">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div 
                    key={index}
                    className="luxury-glass-minimal luxury-hover-lift p-6 text-center luxury-animate-scale-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    data-testid={`benefit-card-${index}`}
                  >
                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center luxury-shadow-md">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="luxury-heading-sm mb-2">{benefit.title}</h3>
                    <p className="luxury-text-small">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center pb-16 luxury-animate-fade-in luxury-delay-5">
          <div className="luxury-glass-card luxury-shadow-lg max-w-2xl mx-auto p-8">
            <Package className="w-12 h-12 mx-auto mb-4 text-purple-600" />
            <h3 className="luxury-heading-md mb-3">Need Help Choosing?</h3>
            <p className="luxury-text-body mb-6">
              Our team is here to help you find the perfect package for your needs
            </p>
            <button 
              className="luxury-btn-primary luxury-shadow-xl"
              onClick={() => window.location.href = 'mailto:Support@PetWash.co.il?subject=Package Inquiry'}
              data-testid="button-contact-support"
            >
              📞 Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
