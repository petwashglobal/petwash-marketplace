import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  Gift, 
  Star, 
  Sparkles, 
  Users, 
  QrCode,
  ChevronRight,
  Loader2,
  Crown,
  Gem
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import QRCode from 'qrcode.react';

interface WalletSummary {
  walletId: string;
  userId: string;
  egiftBalanceCents: number;
  washPackageCredits: number;
  loyaltyPointsBalance: number;
  promoBalanceCents: number;
  referralBalanceCents: number;
  totalCreditsValueCents: number;
  loyaltyTier: string;
  tierPointsThisYear: number;
}

interface CreditPreview {
  requestedAmountCents: number;
  platform: string;
  egiftApplicableCents: number;
  washPackagesApplicable: number;
  loyaltyPointsApplicable: number;
  promoApplicableCents: number;
  totalCreditsApplicableCents: number;
  cashDueCents: number;
}

interface RedemptionResult {
  sessionId: string;
  redemptionCode: string;
  qrData: string;
  expiresAt: string;
  creditsApplied: {
    egiftCents: number;
    washPackages: number;
    loyaltyPoints: number;
    promoCents: number;
  };
  cashDueCents: number;
}

const tierConfig: Record<string, { 
  gradient: string; 
  label: string; 
  icon: typeof Crown;
  glow: string;
}> = {
  bronze: { 
    gradient: 'luxury-tier-bronze', 
    label: 'Bronze',
    icon: Star,
    glow: 'rgba(205, 133, 63, 0.3)'
  },
  silver: { 
    gradient: 'luxury-tier-silver', 
    label: 'Silver',
    icon: Star,
    glow: 'rgba(192, 192, 192, 0.3)'
  },
  gold: { 
    gradient: 'luxury-tier-gold', 
    label: 'Gold',
    icon: Crown,
    glow: 'rgba(255, 215, 0, 0.3)'
  },
  platinum: { 
    gradient: 'luxury-tier-platinum', 
    label: 'Platinum',
    icon: Crown,
    glow: 'rgba(229, 228, 226, 0.3)'
  },
  diamond: { 
    gradient: 'luxury-tier-diamond', 
    label: 'Diamond',
    icon: Gem,
    glow: 'rgba(185, 242, 255, 0.3)'
  },
  black: { 
    gradient: 'luxury-tier-black', 
    label: 'Black Card',
    icon: Crown,
    glow: 'rgba(60, 60, 60, 0.5)'
  },
  royal: { 
    gradient: 'luxury-tier-royal', 
    label: 'Royal Elite',
    icon: Crown,
    glow: 'rgba(153, 50, 204, 0.3)'
  },
};

function formatCurrency(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

interface CreditWalletCardProps {
  userId: string;
  onRedeemCredits?: (preview: CreditPreview, redemption: RedemptionResult) => void;
  platform?: 'walker' | 'sitter' | 'pettrek' | 'k9000' | 'plush_lab';
  transactionAmountCents?: number;
  compact?: boolean;
}

export function CreditWalletCard({
  userId,
  onRedeemCredits,
  platform,
  transactionAmountCents,
  compact = false,
}: CreditWalletCardProps) {
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [activeRedemption, setActiveRedemption] = useState<RedemptionResult | null>(null);

  const { data: walletData, isLoading } = useQuery<{ success: boolean; wallet: WalletSummary }>({
    queryKey: ['/api/credit-wallet/summary'],
    enabled: !!userId,
    staleTime: 30000,
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<{ success: boolean; preview: CreditPreview }>({
    queryKey: ['/api/credit-wallet/preview', platform, transactionAmountCents],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/credit-wallet/preview', {
        requestedAmountCents: transactionAmountCents,
        platform,
      });
      return res.json();
    },
    enabled: !!platform && !!transactionAmountCents && (transactionAmountCents > 0),
    staleTime: 10000,
  });

  const createRedemption = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/credit-wallet/redemptions', {
        platform: platform || 'k9000',
        requestedAmountCents: transactionAmountCents || 0,
        serviceType: platform,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.redemption) {
        setActiveRedemption(data.redemption);
        setShowQrDialog(true);
        if (onRedeemCredits && previewData?.preview) {
          onRedeemCredits(previewData.preview, data.redemption);
        }
      }
    },
  });

  const wallet = walletData?.wallet;
  const preview = previewData?.preview;

  if (isLoading) {
    return (
      <div className="luxury-wallet-hero p-8 flex items-center justify-center min-h-[280px]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#d4af37] mx-auto mb-4" />
          <p className="luxury-dark-text-small">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return null;
  }

  const tier = wallet.loyaltyTier || 'bronze';
  const tierInfo = tierConfig[tier] || tierConfig.bronze;
  const TierIcon = tierInfo.icon;

  if (compact) {
    return (
      <div className="luxury-dark-card overflow-hidden">
        <div className={cn('h-1', tierInfo.gradient)} />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[rgba(212,175,55,0.2)] to-[rgba(212,175,55,0.1)] flex items-center justify-center">
                <Wallet className="w-6 h-6 text-[#d4af37]" />
              </div>
              <div>
                <p className="luxury-dark-text-small mb-1">Available Credits</p>
                <p className="luxury-stat-value luxury-dark-text-gold text-2xl">
                  {formatCurrency(wallet.totalCreditsValueCents)}
                </p>
              </div>
            </div>
            <div className={cn('luxury-dark-badge-gold flex items-center gap-2')}>
              <TierIcon className="w-3.5 h-3.5" />
              <span>{tierInfo.label}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="luxury-wallet-hero" style={{ boxShadow: `0 0 60px ${tierInfo.glow}` }}>
        <div className={cn('h-1.5 rounded-t-[28px]', tierInfo.gradient)} />
        
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[rgba(212,175,55,0.25)] to-[rgba(212,175,55,0.1)] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#d4af37]" />
              </div>
              <div>
                <h3 className="luxury-dark-heading-sm text-lg">Pet Wash™ Wallet</h3>
                <p className="luxury-dark-text-small text-xs mt-0.5">Premium Credits</p>
              </div>
            </div>
            <div 
              className={cn('luxury-dark-badge-gold flex items-center gap-2 py-2 px-4')}
              style={{ boxShadow: `0 0 20px ${tierInfo.glow}` }}
            >
              <TierIcon className="w-4 h-4" />
              <span className="font-semibold tracking-wider">{tierInfo.label}</span>
            </div>
          </div>
          
          <div className="text-center py-6 sm:py-8">
            <p className="luxury-dark-text-small text-xs mb-3">Total Credit Value</p>
            <p className="luxury-stat-value luxury-dark-text-gold text-4xl sm:text-5xl lg:text-6xl">
              {formatCurrency(wallet.totalCreditsValueCents)}
            </p>
          </div>

          <div className="luxury-dark-divider" />

          <div className="luxury-dark-grid-2 gap-3 sm:gap-4">
            <CreditItem
              icon={<Gift className="w-4 h-4 sm:w-5 sm:h-5" />}
              label="E-Gift Balance"
              value={formatCurrency(wallet.egiftBalanceCents)}
              color="from-pink-500/20 to-rose-500/10"
              iconColor="text-pink-400"
            />
            <CreditItem
              icon={<Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />}
              label="Wash Packages"
              value={`${wallet.washPackageCredits} washes`}
              color="from-cyan-500/20 to-blue-500/10"
              iconColor="text-cyan-400"
            />
            <CreditItem
              icon={<Star className="w-4 h-4 sm:w-5 sm:h-5" />}
              label="Loyalty Points"
              value={`${wallet.loyaltyPointsBalance.toLocaleString()} pts`}
              subtitle={`≈ ${formatCurrency(wallet.loyaltyPointsBalance * 10)}`}
              color="from-amber-500/20 to-yellow-500/10"
              iconColor="text-amber-400"
            />
            <CreditItem
              icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
              label="Referral Credit"
              value={formatCurrency(wallet.referralBalanceCents)}
              color="from-emerald-500/20 to-green-500/10"
              iconColor="text-emerald-400"
            />
          </div>

          {preview && transactionAmountCents && transactionAmountCents > 0 && (
            <>
              <div className="luxury-dark-divider" />
              <div className="luxury-dark-surface p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="luxury-dark-text-small">Transaction Total</span>
                  <span className="luxury-dark-heading-sm">
                    {formatCurrency(transactionAmountCents)}
                  </span>
                </div>
                
                {preview.totalCreditsApplicableCents > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="luxury-dark-text-small text-emerald-400">Credits Applied</span>
                    <span className="luxury-dark-heading-sm text-emerald-400">
                      -{formatCurrency(preview.totalCreditsApplicableCents)}
                    </span>
                  </div>
                )}
                
                <div className="luxury-dark-divider !my-3" />
                
                <div className="flex items-center justify-between">
                  <span className="luxury-dark-heading-sm">You Pay</span>
                  <span className="luxury-stat-value luxury-dark-text-gradient text-2xl sm:text-3xl">
                    {formatCurrency(preview.cashDueCents)}
                  </span>
                </div>

                {platform && preview.totalCreditsApplicableCents > 0 && (
                  <Button
                    onClick={() => createRedemption.mutate()}
                    disabled={createRedemption.isPending}
                    className="w-full mt-4 luxury-dark-btn-gold h-14 text-base font-semibold"
                  >
                    {createRedemption.isPending ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="w-5 h-5 mr-2" />
                    )}
                    Apply Credits
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="mt-6 text-center">
            <p className="luxury-dark-text-small text-xs">
              {wallet.tierPointsThisYear.toLocaleString()} points earned this year
            </p>
          </div>
        </div>
      </div>

      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="luxury-dark-card border-0 max-w-sm p-0 overflow-hidden">
          <div className="luxury-tier-gold h-1" />
          <div className="p-6">
            <DialogHeader className="text-center mb-6">
              <DialogTitle className="luxury-dark-heading-md">Redemption Code</DialogTitle>
              <DialogDescription className="luxury-dark-text-body">
                Show this code at the K9000 station or use it during checkout
              </DialogDescription>
            </DialogHeader>
            
            {activeRedemption && (
              <div className="flex flex-col items-center gap-6">
                <div className="luxury-qr-container">
                  <QRCode 
                    value={activeRedemption.qrData} 
                    size={180}
                    level="H"
                  />
                </div>
                
                <div className="text-center">
                  <p className="luxury-dark-text-small mb-2">Manual Code</p>
                  <p className="text-3xl font-mono font-bold tracking-[0.25em] luxury-dark-text-gold">
                    {activeRedemption.redemptionCode}
                  </p>
                </div>

                <div className="w-full luxury-dark-surface p-5 space-y-3">
                  <div className="flex justify-between">
                    <span className="luxury-dark-text-small">Credits Applied</span>
                    <span className="luxury-dark-heading-sm text-emerald-400">
                      {formatCurrency(
                        activeRedemption.creditsApplied.egiftCents +
                        activeRedemption.creditsApplied.promoCents +
                        activeRedemption.creditsApplied.loyaltyPoints
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="luxury-dark-text-small">Amount Due</span>
                    <span className="luxury-dark-heading-sm">
                      {formatCurrency(activeRedemption.cashDueCents)}
                    </span>
                  </div>
                </div>

                <p className="luxury-dark-text-small text-xs opacity-60">
                  Expires in 10 minutes
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface CreditItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
  iconColor: string;
}

function CreditItem({ icon, label, value, subtitle, color, iconColor }: CreditItemProps) {
  return (
    <div className="luxury-credit-item">
      <div className={cn('w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3', color)}>
        <div className={iconColor}>{icon}</div>
      </div>
      <p className="luxury-dark-text-small text-[10px] sm:text-xs mb-1">{label}</p>
      <p className="luxury-dark-heading-sm text-base sm:text-lg">{value}</p>
      {subtitle && (
        <p className="luxury-dark-text-small text-[10px] mt-0.5 opacity-60">{subtitle}</p>
      )}
    </div>
  );
}
