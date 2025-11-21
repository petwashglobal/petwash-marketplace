import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Gift, Send, History, Plus, RefreshCw, Wallet, Award, Crown, Apple, Zap, ArrowUpRight, ArrowDownRight, Calendar, Check, Mail, ChevronRight, Smartphone } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { WalletConsentDialog } from "@/components/WalletConsentDialog";
import { useWalletTelemetry } from "@/hooks/useWalletTelemetry";
import { calculateTier, getTierConfig, getTierProgress } from "@/lib/loyalty";

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
  
  // Fetch user wallet data
  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ['/api/wallet/balance'],
    retry: 1
  });

  // Fetch vouchers
  const { data: vouchersData } = useQuery({
    queryKey: ['/api/vouchers/my-vouchers'],
    retry: 1
  });

  // Fetch transactions
  const { data: transactionsData } = useQuery({
    queryKey: ['/api/wallet/transactions'],
    retry: 1
  });

  // Fetch gift cards
  const { data: giftCardsData } = useQuery({
    queryKey: ['/api/gift-cards/my-cards'],
    retry: 1
  });

  // Initialize telemetry tracking
  const { trackClick } = useWalletTelemetry({
    token: telemetryToken || undefined,
    platform: 'apple',
    onSuccess: () => {
      toast({
        title: "✅ Success!",
        description: "Pass added to your wallet",
      });
    }
  });

  // Mock data for demo (replace with real data from queries)
  const balance = walletData?.balance || 450;
  const loyaltyPoints = walletData?.loyaltyPoints || 1250;
  const vouchers = vouchersData?.vouchers || [];
  const transactions = transactionsData?.transactions || [];
  const giftCards = giftCardsData?.giftCards || [];

  // Calculate loyalty tier
  const totalWashes = walletData?.totalWashes || 15;
  const tierProgress = getTierProgress(totalWashes);
  const tierConfig = getTierConfig(tierProgress.currentTier);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchWallet();
    setTimeout(() => setIsRefreshing(false), 1000);
    toast({
      title: "✅ Refreshed",
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
        title: "✅ Downloaded!",
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
        title: "✅ Downloaded!",
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
        title: "📧 Sent!",
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
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Ultra-Premium Background with Glassmorphism */}
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl">My Wallet</h1>
          <p className="luxury-text-body">Manage your balance, cards, and rewards</p>
        </div>

        {/* 1. Hero/Balance Card */}
        <Card className="luxury-glass-card luxury-shadow-xl luxury-hover-glow luxury-animate-slide-up">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Wallet className="w-6 h-6 text-purple-600" />
                <span className="luxury-text-small uppercase tracking-wider">Available Balance</span>
              </div>
              <div className="luxury-heading-xl luxury-text-gradient">
                ₪{balance.toFixed(2)}
              </div>
              <p className="luxury-text-small">ILS</p>
            </div>

            <div className="luxury-grid-3">
              <div className="luxury-glass-minimal p-4 rounded-2xl text-center">
                <Award className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <div className="luxury-heading-sm luxury-text-gradient">{loyaltyPoints}</div>
                <div className="luxury-text-small">Points</div>
              </div>
              <div className="luxury-glass-minimal p-4 rounded-2xl text-center">
                <Gift className="w-8 h-8 mx-auto mb-2 text-pink-500" />
                <div className="luxury-heading-sm luxury-text-gradient">{giftCards.length}</div>
                <div className="luxury-text-small">Gift Cards</div>
              </div>
              <div className="luxury-glass-minimal p-4 rounded-2xl text-center">
                <CreditCard className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <div className="luxury-heading-sm luxury-text-gradient">{vouchers.length}</div>
                <div className="luxury-text-small">Vouchers</div>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <Button onClick={handleRefresh} disabled={isRefreshing} className="luxury-btn-ghost" data-testid="button-refresh-balance">
                <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setLocation('/packages')} className="luxury-btn-primary" data-testid="button-top-up">
                <Plus className="w-5 h-5 mr-2" />
                Top Up
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 2. Quick Actions */}
        <div className="luxury-animate-slide-up luxury-delay-1">
          <h2 className="luxury-heading-md mb-6">Quick Actions</h2>
          <div className="luxury-grid-4">
            <button onClick={() => setLocation('/buy-gift-card')} className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl text-center transition-all duration-300" data-testid="action-buy-gift-card">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <div className="luxury-heading-sm">Buy Gift Card</div>
            </button>
            <button onClick={() => setLocation('/transfer')} className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl text-center transition-all duration-300" data-testid="action-transfer">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Send className="w-8 h-8 text-white" />
              </div>
              <div className="luxury-heading-sm">Transfer</div>
            </button>
            <button onClick={() => setLocation('/claim')} className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl text-center transition-all duration-300" data-testid="action-redeem-voucher">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <div className="luxury-heading-sm">Redeem Voucher</div>
            </button>
            <button onClick={() => setLocation('/transactions')} className="luxury-glass-minimal luxury-hover-lift p-6 rounded-2xl text-center transition-all duration-300" data-testid="action-view-history">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <History className="w-8 h-8 text-white" />
              </div>
              <div className="luxury-heading-sm">View History</div>
            </button>
          </div>
        </div>

        {/* 3. Gift Cards Display */}
        {giftCards.length > 0 && (
          <div className="luxury-animate-slide-up luxury-delay-2">
            <h2 className="luxury-heading-md mb-6">My Gift Cards</h2>
            <div className="luxury-grid-3">
              {giftCards.slice(0, 3).map((card: any, index: number) => (
                <Card key={card.id} className="luxury-glass-card luxury-hover-lift luxury-shadow-lg relative overflow-hidden" data-testid={`gift-card-${index}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 blur-xl"></div>
                  <CardContent className="relative p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Gift className="w-6 h-6 text-white" />
                      </div>
                      <span className={`luxury-badge ${card.status === 'active' ? 'luxury-badge-success' : ''}`}>{card.status}</span>
                    </div>
                    <div>
                      <div className="luxury-heading-lg luxury-text-gradient">₪{card.value}</div>
                      <div className="luxury-text-small mt-1">{card.name}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="luxury-btn-primary flex-1" data-testid={`use-card-${index}`}>
                        <Check className="w-4 h-4 mr-2" />
                        Use
                      </Button>
                      <Button className="luxury-btn-secondary flex-1" data-testid={`send-card-${index}`}>
                        <Send className="w-4 h-4 mr-2" />
                        Send
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 4. Transaction History */}
        <div className="luxury-animate-slide-up luxury-delay-3">
          <Card className="luxury-glass-card luxury-shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="luxury-heading-md">Recent Transactions</h2>
                <Button variant="ghost" onClick={() => setLocation('/transactions')} className="luxury-text-small" data-testid="view-all-transactions">
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
                  <div key={index} className="luxury-glass-minimal luxury-hover-lift p-4 rounded-xl flex items-center justify-between transition-all duration-300" data-testid={`transaction-${index}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.type === 'purchase' ? 'bg-red-100' : transaction.type === 'topup' ? 'bg-green-100' : 'bg-amber-100'
                      }`}>
                        {transaction.type === 'purchase' ? <ArrowDownRight className="w-5 h-5 text-red-600" /> :
                         transaction.type === 'topup' ? <ArrowUpRight className="w-5 h-5 text-green-600" /> :
                         <Award className="w-5 h-5 text-amber-600" />}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{transaction.description}</div>
                        <div className="luxury-text-small flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {transaction.date}
                        </div>
                      </div>
                    </div>
                    <div className={`luxury-heading-sm luxury-text-gradient ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount > 0 ? '+' : ''}₪{Math.abs(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 5. Loyalty Points Integration */}
        <div className="luxury-animate-slide-up luxury-delay-4">
          <Card className="luxury-glass-card luxury-hover-glow relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10"></div>
            <CardContent className="relative p-8 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Crown className="w-8 h-8 text-amber-500" />
                    <h2 className="luxury-heading-md">Loyalty Rewards</h2>
                  </div>
                  <div className="luxury-heading-lg luxury-text-gradient">{loyaltyPoints} Points</div>
                  <p className="luxury-text-small">Worth ₪{(loyaltyPoints * 0.1).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <span className="luxury-badge-gold text-lg px-6 py-3">
                    {tierConfig.badge} {tierProgress.currentTier.toUpperCase()}
                  </span>
                  <p className="luxury-text-small mt-2">
                    {tierProgress.nextTier ? `${tierProgress.washesUntilNext} washes to ${tierProgress.nextTier}` : 'Max Tier!'}
                  </p>
                </div>
              </div>
              {tierProgress.nextTier && (
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${tierProgress.progressPercentage}%` }}></div>
                  </div>
                  <div className="flex justify-between luxury-text-small">
                    <span>{tierProgress.currentWashes} washes</span>
                    <span>{tierProgress.nextTierAt} washes</span>
                  </div>
                </div>
              )}
              <Button onClick={() => setLocation('/loyalty')} className="luxury-btn-primary w-full" data-testid="redeem-points">
                <Award className="w-5 h-5 mr-2" />
                Redeem Points
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 6. Payment Methods */}
        <div className="luxury-animate-slide-up luxury-delay-5">
          <Card className="luxury-glass-panel">
            <CardContent className="p-6">
              <h2 className="luxury-heading-md mb-6">Payment Methods</h2>
              <div className="space-y-3 mb-6">
                {[
                  { type: 'visa', last4: '4242', expiry: '12/25' },
                  { type: 'mastercard', last4: '8888', expiry: '06/26' }
                ].map((method, index) => (
                  <div key={index} className="luxury-glass-minimal p-4 rounded-xl flex items-center justify-between" data-testid={`payment-method-${index}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{method.type.toUpperCase()} •••• {method.last4}</div>
                        <div className="luxury-text-small">Expires {method.expiry}</div>
                      </div>
                    </div>
                    <span className="luxury-badge luxury-badge-success">Active</span>
                  </div>
                ))}
              </div>
              <Button className="luxury-btn-secondary w-full" data-testid="add-payment-method">
                <Plus className="w-5 h-5 mr-2" />
                Add Payment Method
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 7. Vouchers/Codes */}
        <div className="luxury-animate-slide-up luxury-delay-6">
          <Card className="luxury-glass-card luxury-shadow-md">
            <CardContent className="p-6">
              <h2 className="luxury-heading-md mb-6">Redeem Voucher</h2>
              <div className="flex gap-3 mb-6">
                <Input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="Enter voucher code"
                  className="flex-1 font-mono uppercase text-lg"
                  maxLength={20}
                  data-testid="input-voucher-code"
                />
                <Button onClick={() => { if (voucherCode.trim()) setLocation(`/claim?code=${voucherCode}`); }} disabled={!voucherCode.trim()} className="luxury-btn-primary" data-testid="apply-voucher">
                  Apply
                </Button>
              </div>
              {vouchers.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">Active Vouchers</h3>
                  <div className="luxury-grid-2">
                    {vouchers.slice(0, 2).map((voucher: any, index: number) => (
                      <div key={voucher.id} className="luxury-glass-card luxury-shadow-md p-4 space-y-3" data-testid={`voucher-${index}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono luxury-text-gradient text-lg">****{voucher.codeLast4}</span>
                          <span className="luxury-badge luxury-badge-success">Active</span>
                        </div>
                        <div className="luxury-heading-lg luxury-text-gradient">₪{voucher.remainingAmount}</div>
                        {voucher.expiresAt && (
                          <div className="luxury-text-small flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Expires: {new Date(voucher.expiresAt).toLocaleDateString()}
                          </div>
                        )}
                        <Button className="luxury-btn-primary w-full" size="sm">Use Voucher</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 8. Apple Wallet Integration */}
        {isIOS && (
          <div className="luxury-animate-slide-up luxury-delay-7">
            <Card className="luxury-glass-card luxury-hover-glow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900/5 to-gray-600/5"></div>
              <CardContent className="relative p-8 space-y-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
                    <Apple className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="luxury-heading-md">Add to Apple Wallet</h2>
                  <p className="luxury-text-body">Get instant access to your loyalty and business cards</p>
                </div>
                <div className="luxury-grid-2">
                  <Button onClick={handleDownloadVIPCard} disabled={isDownloadingVIP} className="luxury-btn-primary h-14" data-testid="download-vip-wallet">
                    {isDownloadingVIP ? (
                      <>
                        <Zap className="w-5 h-5 mr-2 animate-pulse" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        VIP Card
                      </>
                    )}
                  </Button>
                  <Button onClick={handleDownloadBusinessCard} disabled={isDownloadingBusiness} className="luxury-btn-secondary h-14" data-testid="download-business-wallet">
                    {isDownloadingBusiness ? (
                      <>
                        <Zap className="w-5 h-5 mr-2 animate-pulse" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-5 h-5 mr-2" />
                        Business Card
                      </>
                    )}
                  </Button>
                </div>
                <Button onClick={handleEmailCards} disabled={isEmailingCards} variant="outline" className="w-full h-12" data-testid="email-wallet-links">
                  {isEmailingCards ? (
                    <>
                      <Mail className="w-5 h-5 mr-2 animate-pulse" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Email Direct Links
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Consent Dialogs */}
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
