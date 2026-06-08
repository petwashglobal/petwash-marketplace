import { Award, Star, Gift, Users, Calendar, TrendingUp, Shield, Mail, Check, Sparkles } from "lucide-react";

export default function LoyaltyTerms() {
  const tiers = [
    { name: "Bronze", points: "0", color: "text-orange-700", badge: "luxury-badge" },
    { name: "Silver", points: "1,000", color: "text-gray-600", badge: "luxury-badge" },
    { name: "Gold", points: "3,000", color: "text-yellow-600", badge: "luxury-badge-gold" },
    { name: "Platinum", points: "6,000", color: "text-purple-600", badge: "luxury-badge-gold" },
    { name: "Diamond", points: "10,000", color: "text-blue-600", badge: "luxury-badge-gold" },
    { name: "Emerald", points: "20,000", color: "text-green-600", badge: "luxury-badge-gold" },
    { name: "Royal", points: "35,000", color: "text-purple-700", badge: "luxury-badge-gold" },
  ];

  const earningMethods = [
    { icon: Gift, title: "Service Bookings", desc: "1 point per ₪1 spent on any service" },
    { icon: Sparkles, title: "Natural Products", desc: "Bonus points for eco-friendly choices" },
    { icon: Users, title: "Referrals", desc: "500 points per successful referral" },
    { icon: Calendar, title: "Birthday Rewards", desc: "Automatic tier-based bonus points" },
    { icon: TrendingUp, title: "Promotions", desc: "Special challenges and campaigns" },
  ];

  const benefits = [
    "Discounted wash rates (5% to 25% off)",
    "Priority booking access",
    "Exclusive VIP events",
    "Free birthday washes",
    "Early access to new services",
    "Premium customer support",
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-12">
        {/* Header Section */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-lg">
            <Award className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-6">
            7-Star Loyalty Program Terms
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto mb-6">
            Welcome to ⁦Pet Wash™⁩ Loyalty & VIP Club — your gateway to exclusive rewards, 
            premium benefits, and unforgettable experiences across all our platforms.
          </p>
          <div className="luxury-badge luxury-badge-gold">
            <Calendar className="w-4 h-4" />
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Tier Overview Section */}
        <div className="mb-16">
          <h2 className="luxury-heading-lg text-center mb-8 luxury-animate-slide-up">
            Membership Tiers
          </h2>
          <div className="luxury-grid-4">
            {tiers.map((tier, index) => (
              <div
                key={tier.name}
                className={`luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 text-center luxury-animate-slide-up luxury-delay-${index + 1}`}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 mb-4">
                  <Star className={`w-6 h-6 ${tier.color}`} />
                </div>
                <h3 className={`luxury-heading-sm mb-2 ${tier.color}`}>{tier.name}</h3>
                <div className={`${tier.badge} mb-4`}>
                  {tier.points} points
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="luxury-text-small">Active Tier</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* Program Overview */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-1">
          <div className="flex items-start gap-4 mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="luxury-heading-md mb-2">1. Program Overview</h2>
              <p className="luxury-text-body">
                The ⁦Pet Wash™⁩ Loyalty & VIP Club is a free rewards program offering exclusive
                benefits across all platforms including ⁦K9000™⁩ self-service stations, ⁦PetTrek™⁩ 
                transportation, ⁦Walk My Pet™⁩, Groomers marketplace, and ⁦Sitter Suite™⁩.
              </p>
            </div>
          </div>
        </div>

        {/* Earning Points */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-2">
          <div className="flex items-start gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="luxury-heading-md mb-2">2. Earning Points</h2>
              <p className="luxury-text-body mb-6">
                Accumulate points through multiple activities across our ecosystem:
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {earningMethods.map((method, index) => (
              <div key={method.title} className="flex items-start gap-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50">
                  <method.icon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-black mb-1">
                    {method.title}
                  </h4>
                  <p className="luxury-text-small">{method.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Points Calculation Example */}
          <div className="luxury-glass-minimal p-6 border-l-4 border-purple-500">
            <h4 className="font-semibold text-gray-900 dark:text-black mb-4">
              Example Calculation:
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="luxury-text-body">K9000 Natural Wash</span>
                <span className="luxury-heading-lg luxury-text-gradient">+150</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="luxury-text-body">Referral Bonus</span>
                <span className="luxury-heading-lg luxury-text-gradient">+500</span>
              </div>
              <div className="luxury-divider my-2"></div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-black">Total Points</span>
                <span className="luxury-heading-lg luxury-text-gradient">650</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Benefits */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-3">
          <div className="flex items-start gap-4 mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h2 className="luxury-heading-md mb-2">3. Tier Benefits</h2>
              <p className="luxury-text-body mb-6">
                Benefits increase progressively with each tier level:
              </p>

              <ul className="space-y-3">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="luxury-text-body">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="luxury-glass-panel p-4 border-l-4 border-green-500 mt-6">
            <p className="luxury-text-small text-green-700 dark:text-green-400 font-medium">
              💎 <strong>Premium Tiers (Diamond+)</strong> unlock concierge support, 
              exclusive partner discounts, and invitation-only experiences.
            </p>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* Point Expiration */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-4">
          <div className="flex items-start gap-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="luxury-heading-md mb-2">4. Point Expiration</h2>
              <p className="luxury-text-body mb-4">
                Points expire after <strong>24 months of account inactivity</strong>. 
                Active members who use any ⁦Pet Wash™⁩ service retain all points indefinitely.
              </p>
              <div className="luxury-glass-panel p-4 border-l-4 border-yellow-500">
                <p className="luxury-text-small text-yellow-700 dark:text-yellow-400 font-medium">
                  ⚠️ <strong>Important:</strong> One transaction every 24 months keeps your points active.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Retention */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-5">
          <div className="flex items-start gap-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="luxury-heading-md mb-2">5. Tier Retention</h2>
              <p className="luxury-text-body">
                Membership tiers are recalculated on your anniversary date based on total 
                accumulated points. Maintain the minimum point threshold to retain your tier status. 
                Points never decrease, so once earned, you keep them forever (if active).
              </p>
            </div>
          </div>
        </div>

        {/* Program Changes */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-6">
          <div className="flex items-start gap-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="luxury-heading-md mb-2">6. Program Changes</h2>
              <p className="luxury-text-body">
                ⁦Pet Wash™⁩ reserves the right to modify program benefits, point values, 
                tier requirements, and redemption options with <strong>30 days advance notice</strong> 
                to all members via email and in-app notifications.
              </p>
            </div>
          </div>
        </div>

        <div className="luxury-divider"></div>

        {/* Terms & Conditions */}
        <div className="luxury-glass-card luxury-shadow-md p-8 mb-8 luxury-animate-slide-up luxury-delay-7">
          <h2 className="luxury-heading-md mb-6">7. Terms & Conditions</h2>
          
          <div className="space-y-4">
            <div className="luxury-glass-panel p-4">
              <p className="luxury-text-body">
                <strong>7.1 Eligibility:</strong> Open to all ⁦Pet Wash™⁩ customers aged 18+. 
                One account per person.
              </p>
            </div>

            <div className="luxury-glass-panel p-4">
              <p className="luxury-text-body">
                <strong>7.2 Points Transfer:</strong> Points are non-transferable and cannot 
                be sold, bartered, or exchanged for cash.
              </p>
            </div>

            <div className="luxury-glass-panel p-4">
              <p className="luxury-text-body">
                <strong>7.3 Fraud Prevention:</strong> Any fraudulent activity, point manipulation, 
                or abuse will result in immediate account termination and point forfeiture.
              </p>
            </div>

            <div className="luxury-glass-panel p-4">
              <p className="luxury-text-body">
                <strong>7.4 Service Integration:</strong> Points earned on one platform 
                (e.g., ⁦K9000™⁩) can be redeemed across all ⁦Pet Wash™⁩ services.
              </p>
            </div>

            <div className="luxury-glass-panel p-4 border-l-4 border-red-500">
              <p className="luxury-text-body text-red-700 dark:text-red-400">
                <strong>7.5 Termination:</strong> ⁦Pet Wash™⁩ reserves the right to terminate 
                memberships for terms violations. All points forfeit upon account closure.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 text-center luxury-animate-slide-up luxury-delay-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 mb-6 luxury-shadow-md">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="luxury-heading-md mb-4">Questions About Our Loyalty Program?</h2>
          <p className="luxury-text-body mb-6 max-w-2xl mx-auto">
            Our loyalty team is here to help you maximize your benefits and resolve any concerns.
          </p>
          <a
            href="mailto:loyalty@petwash.co.il"
            className="luxury-text-gradient text-xl font-semibold hover:underline inline-flex items-center gap-2"
          >
            <Mail className="w-5 h-5" />
            loyalty@petwash.co.il
          </a>
          <div className="mt-6 luxury-divider"></div>
          <p className="luxury-text-small mt-6">
            Available in: English | עברית | العربية | Русский | Français | Español
          </p>
        </div>
      </div>
    </div>
  );
}
