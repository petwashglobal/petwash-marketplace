import { Cake, Gift, Sparkles, Heart, PartyPopper, Star } from 'lucide-react';

export default function LoyaltyBirthday() {
  const rewards = [
    {
      icon: Gift,
      title: 'Free Premium Wash',
      description: 'Complimentary premium wash on your birthday month',
      tier: 'All Members',
      color: 'from-pink-400 to-rose-500',
      delay: '1'
    },
    {
      icon: Sparkles,
      title: 'Double Points',
      description: 'Earn 2x points on all washes during your birthday month',
      tier: 'Silver+',
      color: 'from-purple-400 to-indigo-500',
      delay: '2'
    },
    {
      icon: PartyPopper,
      title: 'Exclusive Birthday Gift',
      description: 'Special surprise gift package delivered to your door',
      tier: 'Gold+',
      color: 'from-yellow-400 to-amber-500',
      delay: '3'
    },
    {
      icon: Heart,
      title: 'Pet Birthday Rewards',
      description: 'Special treats and toys for your furry friends birthday',
      tier: 'All Members',
      color: 'from-red-400 to-pink-500',
      delay: '4'
    },
    {
      icon: Star,
      title: 'VIP Birthday Experience',
      description: 'Private wash session with champagne and treats',
      tier: 'VIP Elite',
      color: 'from-indigo-400 to-purple-500',
      delay: '5'
    },
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-purple-200 flex items-center justify-center mx-auto mb-4">
            <Cake className="w-8 h-8 text-pink-600" />
          </div>
          <h1 className="luxury-heading-xl mb-4">Birthday & Special Rewards</h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Automatic surprises for pets and humans. Celebrate your special day with exclusive rewards and treats!
          </p>
        </div>

        {/* Main Birthday Card */}
        <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-8 md:p-12 mb-12 text-center luxury-animate-fade-in luxury-delay-1" style={{ opacity: 0 }}>
          <div className="max-w-2xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-100 to-purple-200 flex items-center justify-center mx-auto mb-6">
              <PartyPopper className="w-10 h-10 text-pink-600" />
            </div>
            
            <h2 className="luxury-heading-lg mb-4">Celebrate Your Special Day</h2>
            <p className="luxury-text-body mb-8">
              Every birthday is special at Pet Wash! We automatically celebrate both you and your pets' 
              birthdays with exclusive rewards, free washes, and special surprises. The more you engage 
              with our loyalty program, the better your birthday rewards become.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="p-4 luxury-glass-panel rounded-xl">
                <p className="text-3xl font-bold luxury-text-gradient mb-1">🎂</p>
                <p className="font-semibold text-gray-900">Your Birthday</p>
                <p className="luxury-text-small">Special member rewards</p>
              </div>
              <div className="p-4 luxury-glass-panel rounded-xl">
                <p className="text-3xl font-bold luxury-text-gradient mb-1">🐾</p>
                <p className="font-semibold text-gray-900">Pet's Birthday</p>
                <p className="luxury-text-small">Treats & toys included</p>
              </div>
              <div className="p-4 luxury-glass-panel rounded-xl">
                <p className="text-3xl font-bold luxury-text-gradient mb-1">✨</p>
                <p className="font-semibold text-gray-900">Automatic</p>
                <p className="luxury-text-small">No action needed</p>
              </div>
            </div>

            <button 
              className="luxury-btn-primary luxury-shadow-xl px-8 py-4 text-base"
              data-testid="button-setup-birthday"
            >
              <Gift className="w-5 h-5 inline-block mr-2" />
              Set Up Birthday Rewards
            </button>
          </div>
        </div>

        {/* Rewards Grid */}
        <div className="mb-12">
          <h2 className="luxury-heading-md text-center mb-8 luxury-animate-fade-in luxury-delay-2" style={{ opacity: 0 }}>
            Birthday Rewards by Tier
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => (
              <div
                key={reward.title}
                className={`luxury-glass-card luxury-shadow-xl luxury-hover-glow p-6 luxury-animate-fade-in luxury-delay-${reward.delay}`}
                style={{ opacity: 0 }}
              >
                {/* Icon with Gradient */}
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${reward.color} bg-opacity-10 flex items-center justify-center mb-4`}>
                  <reward.icon className={`w-7 h-7 bg-gradient-to-br ${reward.color} bg-clip-text text-transparent`} strokeWidth={2} />
                </div>

                {/* Title & Description */}
                <h3 className="luxury-heading-sm mb-2">{reward.title}</h3>
                <p className="luxury-text-small mb-4">{reward.description}</p>

                {/* Tier Badge */}
                <span className="luxury-badge-success inline-block">{reward.tier}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-fade-in luxury-delay-6" style={{ opacity: 0 }}>
          <h2 className="luxury-heading-md text-center mb-8">How Birthday Rewards Work</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Add Your Birthday</h3>
              <p className="luxury-text-small">
                Add your birthday and your pets' birthdays to your profile
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Automatic Notification</h3>
              <p className="luxury-text-small">
                We'll send you a special birthday message with your rewards
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Redeem & Celebrate</h3>
              <p className="luxury-text-small">
                Use your birthday rewards anytime during your birthday month
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
