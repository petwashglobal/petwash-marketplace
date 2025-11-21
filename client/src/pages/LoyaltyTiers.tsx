import { Crown, Star, Award, Gem, Check } from 'lucide-react';

export default function LoyaltyTiers() {
  const tiers = [
    {
      name: 'Member',
      badge: 'luxury-badge',
      icon: Star,
      color: 'from-gray-400 to-gray-600',
      iconBg: 'bg-gradient-to-br from-gray-100 to-gray-200',
      requirements: 'Join for free',
      benefits: ['Earn points on every wash', 'Birthday rewards', 'Exclusive promotions'],
      delay: '1'
    },
    {
      name: 'Silver',
      badge: 'luxury-badge',
      icon: Award,
      color: 'from-slate-400 to-slate-600',
      iconBg: 'bg-gradient-to-br from-slate-100 to-slate-300',
      requirements: '500 points or 10 washes',
      benefits: ['10% discount on all washes', 'Priority booking', 'Free upgrade once/month', 'Early access to new services'],
      delay: '2'
    },
    {
      name: 'Gold',
      badge: 'luxury-badge-gold',
      icon: Crown,
      color: 'from-yellow-400 to-amber-600',
      iconBg: 'bg-gradient-to-br from-yellow-100 to-amber-200',
      requirements: '1,500 points or 30 washes',
      benefits: ['15% discount on all washes', 'VIP priority support', 'Free upgrades', '2 free washes/year', 'Exclusive VIP events'],
      delay: '3'
    },
    {
      name: 'VIP Elite',
      badge: 'luxury-badge-gold',
      icon: Gem,
      color: 'from-purple-500 to-indigo-600',
      iconBg: 'bg-gradient-to-br from-purple-100 to-indigo-200',
      requirements: '5,000 points or 100 washes',
      benefits: ['20% discount on all washes', 'Concierge service', 'Unlimited free upgrades', '4 free washes/year', 'VIP lounge access', 'Personal account manager'],
      delay: '4'
    }
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-4">Loyalty Tiers</h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Luxury 4-tier structure: Member, Silver, Gold, VIP Elite. 
            Unlock exclusive benefits and premium perks as you level up.
          </p>
        </div>

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl p-6 luxury-animate-fade-in luxury-delay-${tier.delay}`}
              style={{ opacity: 0 }}
            >
              {/* Tier Icon */}
              <div className={`w-16 h-16 ${tier.iconBg} rounded-2xl flex items-center justify-center mb-4 mx-auto`}>
                <tier.icon className={`w-8 h-8 bg-gradient-to-br ${tier.color} bg-clip-text text-transparent`} strokeWidth={2.5} />
              </div>

              {/* Tier Name */}
              <h3 className="luxury-heading-sm text-center mb-2">{tier.name}</h3>

              {/* Tier Badge */}
              <div className="flex justify-center mb-4">
                <span className={tier.badge}>{tier.name} Tier</span>
              </div>

              {/* Requirements */}
              <div className="mb-6">
                <p className="text-sm font-semibold luxury-text-gradient mb-1">Requirements:</p>
                <p className="luxury-text-small">{tier.requirements}</p>
              </div>

              {/* Benefits */}
              <div>
                <p className="text-sm font-semibold luxury-text-gradient mb-3">Benefits:</p>
                <ul className="space-y-2">
                  {tier.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                      <span className="luxury-text-small text-left">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-5" style={{ opacity: 0 }}>
          <h2 className="luxury-heading-md text-center mb-6">How to Earn Points</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Every Wash</h3>
              <p className="luxury-text-small">Earn 50 points per wash</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center mx-auto mb-3">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Referrals</h3>
              <p className="luxury-text-small">Earn 200 bonus points</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center mx-auto mb-3">
                <Gem className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Special Events</h3>
              <p className="luxury-text-small">Double points days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
