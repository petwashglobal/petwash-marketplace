import { Share2, Users, Gift, Copy, Facebook, Twitter, Mail, MessageCircle, TrendingUp, Award } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function LoyaltyRefer() {
  const [referralCode] = useState('PETWASH2025');
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    toast({
      title: 'Copied!',
      description: 'Referral code copied to clipboard',
    });
  };

  const shareButtons = [
    { icon: Facebook, label: 'Facebook', color: 'from-blue-500 to-blue-600' },
    { icon: Twitter, label: 'Twitter', color: 'from-sky-400 to-blue-500' },
    { icon: MessageCircle, label: 'WhatsApp', color: 'from-green-500 to-emerald-600' },
    { icon: Mail, label: 'Email', color: 'from-gray-500 to-gray-600' },
  ];

  const stats = [
    { icon: Users, label: 'Friends Referred', value: '0', color: 'from-blue-400 to-indigo-500' },
    { icon: Gift, label: 'Rewards Earned', value: '0', color: 'from-purple-400 to-pink-500' },
    { icon: Award, label: 'Bonus Points', value: '0', color: 'from-yellow-400 to-amber-500' },
  ];

  const rewards = [
    {
      friends: '1 Friend',
      reward: '200 Points',
      bonus: 'Free Basic Wash',
      delay: '1'
    },
    {
      friends: '3 Friends',
      reward: '750 Points',
      bonus: 'Free Premium Wash',
      delay: '2'
    },
    {
      friends: '5 Friends',
      reward: '1,500 Points',
      bonus: 'Silver Tier Upgrade',
      delay: '3'
    },
    {
      friends: '10 Friends',
      reward: '3,500 Points',
      bonus: 'Gold Tier Upgrade',
      delay: '4'
    },
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center mx-auto mb-4">
            <Share2 className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="luxury-heading-xl mb-4">Refer a Friend</h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Invite friends and earn wash credits. Share the love and get rewarded together!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`luxury-glass-card luxury-shadow-xl p-6 text-center luxury-animate-fade-in luxury-delay-${index + 1}`}
              style={{ opacity: 0 }}
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stat.color} bg-opacity-10 flex items-center justify-center mx-auto mb-3`}>
                <stat.icon className={`w-6 h-6 bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`} strokeWidth={2} />
              </div>
              <p className="luxury-text-small mb-1">{stat.label}</p>
              <p className="text-3xl font-bold luxury-text-gradient">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Referral Code Card */}
        <div className="luxury-glass-card luxury-shadow-xl p-8 mb-12 luxury-animate-fade-in luxury-delay-4" style={{ opacity: 0 }}>
          <h2 className="luxury-heading-md text-center mb-6">Your Referral Code</h2>
          <div className="max-w-md mx-auto">
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 mb-6">
              <code className="flex-1 text-2xl font-bold text-center luxury-text-gradient tracking-wider">
                {referralCode}
              </code>
              <button
                onClick={handleCopy}
                className="p-3 rounded-lg bg-white hover:bg-purple-50 transition-colors border border-purple-200"
                data-testid="button-copy-code"
              >
                <Copy className="w-5 h-5 text-purple-600" />
              </button>
            </div>

            {/* Share Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {shareButtons.map((button) => (
                <button
                  key={button.label}
                  className="luxury-btn-primary flex flex-col items-center gap-2 py-4"
                  data-testid={`button-share-${button.label.toLowerCase()}`}
                >
                  <button.icon className="w-5 h-5" />
                  <span className="text-xs">{button.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rewards Table */}
        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in luxury-delay-5" style={{ opacity: 0 }}>
          <h2 className="luxury-heading-md text-center mb-8">Referral Rewards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {rewards.map((reward) => (
              <div
                key={reward.friends}
                className={`luxury-glass-panel p-6 text-center luxury-animate-fade-in luxury-delay-${reward.delay}`}
                style={{ opacity: 0 }}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <p className="font-semibold text-gray-900 mb-2">{reward.friends}</p>
                <p className="text-2xl font-bold luxury-text-gradient mb-2">{reward.reward}</p>
                <p className="luxury-text-small">{reward.bonus}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="luxury-glass-card luxury-shadow-lg p-8 mt-12 luxury-animate-fade-in luxury-delay-6" style={{ opacity: 0 }}>
          <h2 className="luxury-heading-md text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Share Your Code</h3>
              <p className="luxury-text-small">Send your unique referral code to friends and family</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">They Sign Up</h3>
              <p className="luxury-text-small">Your friend creates an account using your code</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Earn Rewards</h3>
              <p className="luxury-text-small">Both of you receive bonus points and rewards</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
