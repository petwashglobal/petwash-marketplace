import { Sparkles, Calendar, Gift, Percent, Crown, Zap, Star, Heart } from 'lucide-react';

export default function LoyaltyBenefits() {
  const benefits = [
    {
      icon: Percent,
      title: 'Exclusive Discounts',
      description: 'Save up to 20% on all washes depending on your tier',
      tier: 'All Tiers',
      tierBadge: 'luxury-badge-success',
      color: 'from-green-400 to-emerald-500',
      delay: '1'
    },
    {
      icon: Calendar,
      title: 'Priority Booking',
      description: 'Skip the wait with priority access to all time slots',
      tier: 'Silver+',
      tierBadge: 'luxury-badge',
      color: 'from-blue-400 to-indigo-500',
      delay: '2'
    },
    {
      icon: Gift,
      title: 'Free Washes',
      description: 'Enjoy complimentary washes throughout the year',
      tier: 'Gold+',
      tierBadge: 'luxury-badge-gold',
      color: 'from-yellow-400 to-amber-500',
      delay: '3'
    },
    {
      icon: Crown,
      title: 'VIP Events',
      description: 'Exclusive invitations to member-only events',
      tier: 'Gold+',
      tierBadge: 'luxury-badge-gold',
      color: 'from-purple-400 to-pink-500',
      delay: '4'
    },
    {
      icon: Zap,
      title: 'Free Upgrades',
      description: 'Automatic upgrades to premium wash packages',
      tier: 'Silver+',
      tierBadge: 'luxury-badge',
      color: 'from-orange-400 to-red-500',
      delay: '5'
    },
    {
      icon: Sparkles,
      title: 'Concierge Service',
      description: 'Personal account manager for all your needs',
      tier: 'VIP Elite',
      tierBadge: 'luxury-badge-gold',
      color: 'from-indigo-400 to-purple-500',
      delay: '6'
    },
    {
      icon: Star,
      title: 'Early Access',
      description: 'Be first to try new services and features',
      tier: 'Silver+',
      tierBadge: 'luxury-badge',
      color: 'from-cyan-400 to-blue-500',
      delay: '7'
    },
    {
      icon: Heart,
      title: 'Birthday Rewards',
      description: 'Special treats for you and your pets birthdays',
      tier: 'All Tiers',
      tierBadge: 'luxury-badge-success',
      color: 'from-pink-400 to-rose-500',
      delay: '8'
    }
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-4">Benefits & Perks</h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Discounted washes, early access, VIP events and more. 
            Experience premium perks designed for loyal pet parents.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className={`luxury-glass-card luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-${benefit.delay}`}
              style={{ opacity: 0 }}
            >
              {/* Icon with Gradient Circle */}
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${benefit.color} bg-opacity-10 flex items-center justify-center mb-4`}>
                <benefit.icon className={`w-7 h-7 bg-gradient-to-br ${benefit.color} bg-clip-text text-transparent`} strokeWidth={2} />
              </div>

              {/* Benefit Title */}
              <h3 className="luxury-heading-sm mb-2">{benefit.title}</h3>

              {/* Description */}
              <p className="luxury-text-small mb-4">{benefit.description}</p>

              {/* Tier Badge */}
              <div className="flex justify-start">
                <span className={benefit.tierBadge}>{benefit.tier}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-9" style={{ opacity: 0 }}>
          <div className="text-center">
            <h2 className="luxury-heading-md mb-4">Unlock More Benefits</h2>
            <p className="luxury-text-body max-w-3xl mx-auto mb-6">
              The more you wash, the more you save. Upgrade your tier to unlock premium benefits, 
              exclusive perks, and VIP treatment that make every visit special.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="px-6 py-3 luxury-glass-panel">
                <p className="text-sm font-semibold luxury-text-gradient">Member</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">3 Benefits</p>
              </div>
              <div className="px-6 py-3 luxury-glass-panel">
                <p className="text-sm font-semibold luxury-text-gradient">Silver</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">6 Benefits</p>
              </div>
              <div className="px-6 py-3 luxury-glass-panel">
                <p className="text-sm font-semibold luxury-text-gradient">Gold</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">8 Benefits</p>
              </div>
              <div className="px-6 py-3 luxury-glass-panel">
                <p className="text-sm font-semibold luxury-text-gradient">VIP Elite</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">All Benefits</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
