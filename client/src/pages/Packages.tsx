import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function Packages() {
  const [, setLocation] = useLocation();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🎁</div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Special Offers & Packages
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Save more with our premium wash packages. The more you wash, the more you save!
          </p>
        </div>

        {/* Limited Time Offer Banner */}
        <div className="max-w-4xl mx-auto mb-12 p-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-2">🎉 Limited Time Offer!</h2>
          <p className="text-lg">Get an extra wash FREE with any package purchase this month!</p>
        </div>

        {/* Packages Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-12">
          {packages.map((pkg, index) => {
            const Icon = pkg.icon;
            return (
              <Card 
                key={index} 
                className={`relative hover:shadow-2xl transition-all duration-300 ${pkg.popular ? 'ring-2 ring-purple-500 scale-105' : ''}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    ⭐ MOST POPULAR
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${pkg.color} flex items-center justify-center`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                  <CardDescription className="text-lg font-semibold">{pkg.nameHebrew}</CardDescription>
                  
                  <div className="mt-4">
                    {pkg.originalPrice && (
                      <div className="text-gray-400 line-through text-sm">{pkg.originalPrice}</div>
                    )}
                    <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {pkg.price}
                    </div>
                    {pkg.savings && (
                      <div className="text-green-600 font-semibold text-sm mt-1">{pkg.savings}</div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={`w-full bg-gradient-to-r ${pkg.color} hover:opacity-90`}
                    size="lg"
                    onClick={() => setLocation('/sign-up')}
                  >
                    Choose Package
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Benefits Section */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Why Choose Our Packages?</CardTitle>
              <CardDescription className="text-lg">Amazing benefits for package holders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl mb-3">💰</div>
                  <h3 className="font-bold text-lg mb-2">Save Money</h3>
                  <p className="text-gray-600 text-sm">Up to 15% discount on every wash</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-3">🎁</div>
                  <h3 className="font-bold text-lg mb-2">Loyalty Rewards</h3>
                  <p className="text-gray-600 text-sm">Earn points and get free washes</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-3">👑</div>
                  <h3 className="font-bold text-lg mb-2">VIP Treatment</h3>
                  <p className="text-gray-600 text-sm">Priority access and exclusive perks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">Not sure which package to choose?</p>
          <Button 
            variant="outline"
            size="lg"
            onClick={() => window.location.href = 'mailto:Support@PetWash.co.il?subject=Package Inquiry'}
          >
            📞 Contact Us for Help
          </Button>
        </div>
      </div>
    </div>
  );
}
