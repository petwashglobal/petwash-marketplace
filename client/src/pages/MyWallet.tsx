import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Gift, Send, History, Plus, RefreshCw, Wallet, Award, Crown, Apple, Zap, ArrowUpRight, ArrowDownRight, Calendar, Check, Mail, ChevronRight, Smartphone, Star, Sparkles, Gem } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { WalletConsentDialog } from "@/components/WalletConsentDialog";
import { useWalletTelemetry } from "@/hooks/useWalletTelemetry";
import { calculateTier, getTierConfig, getTierProgress } from "@/lib/loyalty";
import { cn } from "@/lib/utils";

const tierIcons: Record<string, typeof Crown> = {
  bronze: Star,
  silver: Star,
  gold: Crown,
  platinum: Crown,
  diamond: Gem,
  black: Crown,
  royal: Crown,
};

const tierGradients: Record<string, string> = {
  bronze: 'luxury-tier-bronze',
  silver: 'luxury-tier-silver',
  gold: 'luxury-tier-gold',
  platinum: 'luxury-tier-platinum',
  diamond: 'luxury-tier-diamond',
  black: 'luxury-tier-black',
  royal: 'luxury-tier-royal',
};

export default function MyWallet() {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingVIP, setIsDownloadingVIP] = useState(false);
  const [isDownloadingBusiness, setIsDownloadingBusiness] = useState(false);
  const [isEmailingCards, setIsEmailingCards] = useState(false);
  const [showVIPConsent, setShowVIPConsent] = useState(false);
  const [showBusinessConsent, setShowBusinessConsent] = useState(false);
  const [telemetryToken, setTelemetryToken] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  
  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ['/api/wallet/balance'],
    retry: 1
  });

  const { data: vouchersData } = useQuery({
    queryKey: ['/api/vouchers/my-vouchers'],
    retry: 1
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['/api/wallet/transactions'],
    retry: 1
  });

  const { data: giftCardsData } = useQuery({
    queryKey: ['/api/gift-cards/my-cards'],
    retry: 1
  });

  const { trackClick } = useWalletTelemetry({
    token: telemetryToken || undefined,
    platform: 'apple',
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Pass added to your wallet",
      });
    }
  });

  const balance = walletData?.balance || 450;
  const loyaltyPoints = walletData?.loyaltyPoints || 1250;
  const vouchers = vouchersData?.vouchers || [];
  const transactions = transactionsData?.transactions || [];
  const giftCards = giftCardsData?.giftCards || [];

  const totalWashes = walletData?.totalWashes || 15;
  const tierProgress = getTierProgress(totalWashes);
  const tierConfig = getTierConfig(tierProgress.currentTier);
  const TierIcon = tierIcons[tierProgress.currentTier] || Star;
  const tierGradient = tierGradients[tierProgress.currentTier] || 'luxury-tier-bronze';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchWallet();
    setTimeout(() => setIsRefreshing(false), 1000);
    toast({
      title: "Refreshed",
      description: "Balance updated",
    });
  };

  const handleDownloadVIPCard = async () => {
    setShowVIPConsent(true);
  };

  const handleVIPConsentAccepted = async () => {
    setIsDownloadingVIP(true);
    
    try {
      const prepareResponse = await fetch('/api/wallet/vip-card/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!prepareResponse.ok) {
        if (prepareResponse.status === 401) {
          setLocation('/signin');
          return;
        }
        throw new Error('Failed to prepare VIP card');
      }

      const { telemetryToken: token, downloadUrl } = await prepareResponse.json();
      setTelemetryToken(token);
      trackClick();

      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate VIP card');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PetWash_VIP_Card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Downloaded!",
        description: "Open the file to add to your Wallet",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingVIP(false);
    }
  };

  const handleDownloadBusinessCard = async () => {
    setShowBusinessConsent(true);
  };

  const handleBusinessConsentAccepted = async () => {
    setIsDownloadingBusiness(true);
    
    try {
      const response = await fetch('/api/wallet/my-business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: 'VIP Member',
          phone: ''
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation('/signin');
          return;
        }
        throw new Error('Failed to generate business card');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PetWash_Business_Card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Downloaded!",
        description: "Open the file to add to your Wallet",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingBusiness(false);
    }
  };

  const handleEmailCards = async () => {
    setIsEmailingCards(true);
    
    try {
      const response = await fetch('/api/wallet/email-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user?.email
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation('/signin');
          return;
        }
        const error = await response.json();
        throw new Error(error.message || 'Failed to email cards');
      }

      const data = await response.json();

      toast({
        title: "Sent!",
        description: `Direct wallet links sent to ${data.email}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsEmailingCards(false);
    }
  };

  return (
    <div className="luxury-dark-mesh min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
        
        <div className="text-center space-y-3 luxury-animate-fade-in">
          <h1 className="luxury-dark-heading-xl">My Wallet</h1>
          <p className="luxury-dark-text-body">Manage your balance, cards, and rewards</p>
        </div>

        <div className="luxury-wallet-hero luxury-animate-slide-up">
          <div className={cn('h-1.5 rounded-t-[28px]', tierGradient)} />
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(212,175,55,0.25)] to-[rgba(212,175,55,0.1)] flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-[#d4af37]" />
                </div>
                <div>
                  <h2 className="luxury-dark-heading-sm text-lg">Pet Wash™ Wallet</h2>
                  <p className="luxury-dark-text-small text-xs mt-0.5">Premium Balance</p>
                </div>
              </div>
              <div className="luxury-dark-badge-gold flex items-center gap-2 py-2 px-4">
                <TierIcon className="w-4 h-4" />
                <span className="font-semibold tracking-wider">{tierConfig.badge} {tierProgress.currentTier.toUpperCase()}</span>
              </div>
            </div>

            <div className="text-center py-6 sm:py-8">
              <p className="luxury-dark-text-small text-xs mb-3">Available Balance</p>
              <p className="luxury-stat-value luxury-dark-text-gold text-4xl sm:text-5xl lg:text-6xl">
                ₪{balance.toFixed(2)}
              </p>
            </div>

            <div className="luxury-dark-divider" />

            <div className="luxury-dark-grid-3">
              <div className="luxury-credit-item text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-amber-400" />
                </div>
                <p className="luxury-dark-heading-sm text-xl">{loyaltyPoints.toLocaleString()}</p>
                <p className="luxury-dark-text-small text-xs">Points</p>
              </div>
              <div className="luxury-credit-item text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/10 flex items-center justify-center">
                  <Gift className="w-6 h-6 text-pink-400" />
                </div>
                <p className="luxury-dark-heading-sm text-xl">{giftCards.length}</p>
                <p className="luxury-dark-text-small text-xs">Gift Cards</p>
              </div>
              <div className="luxury-credit-item text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="luxury-dark-heading-sm text-xl">{vouchers.length}</p>
                <p className="luxury-dark-text-small text-xs">Vouchers</p>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap pt-2">
              <Button onClick={handleRefresh} disabled={isRefreshing} className="luxury-dark-btn-ghost" data-testid="button-refresh-balance">
                <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setLocation('/packages')} className="luxury-dark-btn-gold" data-testid="button-top-up">
                <Plus className="w-5 h-5 mr-2" />
                Top Up
              </Button>
            </div>
          </div>
        </div>

        <div className="luxury-animate-slide-up luxury-delay-1">
          <h2 className="luxury-dark-heading-md mb-6">Quick Actions</h2>
          <div className="luxury-dark-grid-4">
            <button onClick={() => setLocation('/buy-gift-card')} className="luxury-dark-card p-6 rounded-2xl text-center transition-all duration-300 hover:scale-[1.02]" data-testid="action-buy-gift-card">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-rose-700/30 to-rose-600/20 flex items-center justify-center">
                <Gift className="w-7 h-7 text-rose-400" />
              </div>
              <div className="luxury-dark-heading-sm text-base">Buy Gift Card</div>
            </button>
            <button onClick={() => setLocation('/transfer')} className="luxury-dark-card p-6 rounded-2xl text-center transition-all duration-300 hover:scale-[1.02]" data-testid="action-transfer">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center">
                <Send className="w-7 h-7 text-blue-400" />
              </div>
              <div className="luxury-dark-heading-sm text-base">Transfer</div>
            </button>
            <button onClick={() => setLocation('/claim')} className="luxury-dark-card p-6 rounded-2xl text-center transition-all duration-300 hover:scale-[1.02]" data-testid="action-redeem-voucher">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-amber-400" />
              </div>
              <div className="luxury-dark-heading-sm text-base">Redeem Voucher</div>
            </button>
            <button onClick={() => setLocation('/transactions')} className="luxury-dark-card p-6 rounded-2xl text-center transition-all duration-300 hover:scale-[1.02]" data-testid="action-view-history">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-green-500/20 flex items-center justify-center">
                <History className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="luxury-dark-heading-sm text-base">View History</div>
            </button>
          </div>
        </div>

        {giftCards.length > 0 && (
          <div className="luxury-animate-slide-up luxury-delay-2">
            <h2 className="luxury-dark-heading-md mb-6">My Gift Cards</h2>
            <div className="luxury-dark-grid-3">
              {giftCards.slice(0, 3).map((card: any, index: number) => (
                <div key={card.id} className="luxury-dark-card overflow-hidden" data-testid={`gift-card-${index}`}>
                  <div className="h-1 bg-gradient-to-r from-[#0a2540] via-[#1a365d] to-[#0a2540]" />
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0a2540]/40 to-[#1a365d]/25 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-[#4a9eff]" />
                      </div>
                      <span className={cn('luxury-dark-badge', card.status === 'active' && 'luxury-dark-badge-success')}>{card.status}</span>
                    </div>
                    <div>
                      <div className="luxury-dark-heading-lg luxury-dark-text-gradient text-2xl">₪{card.value}</div>
                      <div className="luxury-dark-text-small mt-1">{card.name}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="luxury-dark-btn-primary flex-1 py-2.5" data-testid={`use-card-${index}`}>
                        <Check className="w-4 h-4 mr-2" />
                        Use
                      </Button>
                      <Button className="luxury-dark-btn-ghost flex-1 py-2.5 border border-[rgba(232,230,240,0.1)]" data-testid={`send-card-${index}`}>
                        <Send className="w-4 h-4 mr-2" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="luxury-animate-slide-up luxury-delay-3">
          <div className="luxury-dark-card">
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between mb-6">
                <h2 className="luxury-dark-heading-md">Recent Transactions</h2>
                <Button variant="ghost" onClick={() => setLocation('/transactions')} className="luxury-dark-text-small hover:text-[#e8e6f0]" data-testid="view-all-transactions">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { type: 'purchase', amount: -55, date: '2025-11-20', description: 'Premium Wash' },
                  { type: 'topup', amount: 200, date: '2025-11-18', description: 'Balance Top-up' },
                  { type: 'reward', amount: 50, date: '2025-11-15', description: 'Loyalty Bonus' }
                ].map((transaction, index) => (
                  <div key={index} className="luxury-credit-item flex items-center justify-between transition-all duration-300" data-testid={`transaction-${index}`}>
                    <div className="flex items-center gap-4">
                      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center',
                        transaction.type === 'purchase' ? 'bg-red-500/15' : 
                        transaction.type === 'topup' ? 'bg-emerald-500/15' : 'bg-amber-500/15'
                      )}>
                        {transaction.type === 'purchase' ? <ArrowDownRight className="w-5 h-5 text-red-400" /> :
                         transaction.type === 'topup' ? <ArrowUpRight className="w-5 h-5 text-emerald-400" /> :
                         <Award className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div>
                        <div className="luxury-dark-heading-sm text-base">{transaction.description}</div>
                        <div className="luxury-dark-text-small flex items-center gap-2 text-xs">
                          <Calendar className="w-3 h-3" />
                          {transaction.date}
                        </div>
                      </div>
                    </div>
                    <div className={cn('luxury-dark-heading-sm text-lg',
                      transaction.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {transaction.amount > 0 ? '+' : ''}₪{Math.abs(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="luxury-animate-slide-up luxury-delay-4">
          <div className="luxury-wallet-hero">
            <div className={cn('h-1.5 rounded-t-[28px]', tierGradient)} />
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-500/10 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                    <h2 className="luxury-dark-heading-md">Loyalty Rewards</h2>
                  </div>
                  <div className="luxury-stat-value luxury-dark-text-gold text-3xl sm:text-4xl">{loyaltyPoints.toLocaleString()} Points</div>
                  <p className="luxury-dark-text-small text-xs">Worth ₪{(loyaltyPoints * 0.1).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <div className="luxury-dark-badge-gold text-base px-5 py-2.5 flex items-center gap-2">
                    <TierIcon className="w-4 h-4" />
                    {tierConfig.badge} {tierProgress.currentTier.toUpperCase()}
                  </div>
                  <p className="luxury-dark-text-small mt-2 text-xs">
                    {tierProgress.nextTier ? `${tierProgress.washesUntilNext} washes to ${tierProgress.nextTier}` : 'Max Tier!'}
                  </p>
                </div>
              </div>
              {tierProgress.nextTier && (
                <div className="space-y-2">
                  <div className="h-2.5 bg-[rgba(232,230,240,0.08)] rounded-full overflow-hidden">
                    <div 
                      className={cn('h-full rounded-full transition-all duration-500', tierGradient)} 
                      style={{ width: `${tierProgress.progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between luxury-dark-text-small text-xs">
                    <span>{tierProgress.currentWashes} washes</span>
                    <span>{tierProgress.nextTierAt} washes</span>
                  </div>
                </div>
              )}
              <Button onClick={() => setLocation('/loyalty')} className="luxury-dark-btn-gold w-full h-13" data-testid="redeem-points">
                <Award className="w-5 h-5 mr-2" />
                Redeem Points
              </Button>
            </div>
          </div>
        </div>

        <div className="luxury-animate-slide-up luxury-delay-5">
          <div className="luxury-dark-panel p-6 sm:p-7">
            <h2 className="luxury-dark-heading-md mb-6">Payment Methods</h2>
            <div className="space-y-3 mb-6">
              {[
                { type: 'visa', last4: '4242', expiry: '12/25' },
                { type: 'mastercard', last4: '8888', expiry: '06/26' }
              ].map((method, index) => (
                <div key={index} className="luxury-credit-item flex items-center justify-between" data-testid={`payment-method-${index}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0a2540]/40 to-[#1a365d]/25 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-[#4a9eff]" />
                    </div>
                    <div>
                      <div className="luxury-dark-heading-sm text-base">{method.type.toUpperCase()} •••• {method.last4}</div>
                      <div className="luxury-dark-text-small text-xs">Expires {method.expiry}</div>
                    </div>
                  </div>
                  <span className="luxury-dark-badge luxury-dark-badge-success">Active</span>
                </div>
              ))}
            </div>
            <Button className="luxury-dark-btn-primary w-full" data-testid="add-payment-method">
              <Plus className="w-5 h-5 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </div>

        <div className="luxury-animate-slide-up luxury-delay-6">
          <div className="luxury-dark-card p-6 sm:p-7">
            <h2 className="luxury-dark-heading-md mb-6">Redeem Voucher</h2>
            <div className="flex gap-3 mb-6">
              <Input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="Enter voucher code"
                className="flex-1 font-mono uppercase text-lg bg-[rgba(26,24,37,0.6)] border-[rgba(232,230,240,0.1)] text-[#e8e6f0] placeholder:text-[rgba(149,144,168,0.5)] focus:border-[rgba(212,175,55,0.4)] h-13"
                maxLength={20}
                data-testid="input-voucher-code"
              />
              <Button onClick={() => { if (voucherCode.trim()) setLocation(`/claim?code=${voucherCode}`); }} disabled={!voucherCode.trim()} className="luxury-dark-btn-gold h-13 px-6" data-testid="apply-voucher">
                Apply
              </Button>
            </div>
            {vouchers.length > 0 && (
              <div>
                <h3 className="luxury-dark-heading-sm mb-4">Active Vouchers</h3>
                <div className="luxury-dark-grid-2">
                  {vouchers.slice(0, 2).map((voucher: any, index: number) => (
                    <div key={voucher.id} className="luxury-dark-surface p-5 space-y-3" data-testid={`voucher-${index}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono luxury-dark-text-gradient text-lg">****{voucher.codeLast4}</span>
                        <span className="luxury-dark-badge luxury-dark-badge-success">Active</span>
                      </div>
                      <div className="luxury-dark-heading-lg luxury-dark-text-gold text-2xl">₪{voucher.remainingAmount}</div>
                      {voucher.expiresAt && (
                        <div className="luxury-dark-text-small flex items-center gap-2 text-xs">
                          <Calendar className="w-4 h-4" />
                          Expires: {new Date(voucher.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                      <Button className="luxury-dark-btn-primary w-full py-2.5" size="sm">Use Voucher</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Apple/Google Wallet integration hidden - coming soon */}
      </div>

      <WalletConsentDialog
        isOpen={showVIPConsent}
        onClose={() => setShowVIPConsent(false)}
        onAccept={handleVIPConsentAccepted}
        cardType="vip"
      />

      <WalletConsentDialog
        isOpen={showBusinessConsent}
        onClose={() => setShowBusinessConsent(false)}
        onAccept={handleBusinessConsentAccepted}
        cardType="business"
      />
    </div>
  );
}
