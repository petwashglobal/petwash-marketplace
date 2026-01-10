import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Wallet, 
  Gift, 
  Star, 
  Sparkles, 
  Users, 
  QrCode,
  ChevronRight,
  Loader2
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

const tierColors: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-900',
  silver: 'from-slate-400 to-slate-600',
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-slate-200 to-slate-400',
  diamond: 'from-cyan-300 to-blue-400',
  black: 'from-slate-900 to-black',
  royal: 'from-purple-600 to-indigo-800',
};

const tierLabels: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  black: 'Black Card',
  royal: 'Royal Elite',
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
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </CardContent>
      </Card>
    );
  }

  if (!wallet) {
    return null;
  }

  const tier = wallet.loyaltyTier || 'bronze';
  const tierGradient = tierColors[tier] || tierColors.bronze;

  if (compact) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
        <div className={cn('h-1 bg-gradient-to-r', tierGradient)} />
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-xl bg-gradient-to-br', tierGradient)}>
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Available Credits</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(wallet.totalCreditsValueCents)}
                </p>
              </div>
            </div>
            <Badge className={cn('bg-gradient-to-r text-white border-0', tierGradient)}>
              {tierLabels[tier]}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
        <div className={cn('h-2 bg-gradient-to-r', tierGradient)} />
        
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              Pet Wash™ Wallet
            </CardTitle>
            <Badge className={cn('bg-gradient-to-r text-white border-0 px-3', tierGradient)}>
              <Star className="w-3 h-3 mr-1" />
              {tierLabels[tier]}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-sm text-slate-400 mb-1">Total Credit Value</p>
            <p className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {formatCurrency(wallet.totalCreditsValueCents)}
            </p>
          </div>

          <Separator className="bg-slate-700" />

          <div className="grid grid-cols-2 gap-3">
            <CreditItem
              icon={<Gift className="w-4 h-4" />}
              label="E-Gift Balance"
              value={formatCurrency(wallet.egiftBalanceCents)}
              color="text-pink-400"
            />
            <CreditItem
              icon={<Sparkles className="w-4 h-4" />}
              label="Wash Packages"
              value={`${wallet.washPackageCredits} washes`}
              color="text-cyan-400"
            />
            <CreditItem
              icon={<Star className="w-4 h-4" />}
              label="Loyalty Points"
              value={`${wallet.loyaltyPointsBalance.toLocaleString()} pts`}
              subtitle={`≈ ${formatCurrency(wallet.loyaltyPointsBalance * 10)}`}
              color="text-amber-400"
            />
            <CreditItem
              icon={<Users className="w-4 h-4" />}
              label="Referral Credit"
              value={formatCurrency(wallet.referralBalanceCents)}
              color="text-green-400"
            />
          </div>

          {preview && transactionAmountCents && transactionAmountCents > 0 && (
            <>
              <Separator className="bg-slate-700" />
              <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Transaction Total</span>
                  <span className="text-white font-medium">
                    {formatCurrency(transactionAmountCents)}
                  </span>
                </div>
                
                {preview.totalCreditsApplicableCents > 0 && (
                  <div className="flex items-center justify-between text-green-400">
                    <span className="text-sm">Credits Applied</span>
                    <span className="font-medium">
                      -{formatCurrency(preview.totalCreditsApplicableCents)}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                  <span className="text-white font-medium">You Pay</span>
                  <span className="text-xl font-bold text-white">
                    {formatCurrency(preview.cashDueCents)}
                  </span>
                </div>

                {platform && preview.totalCreditsApplicableCents > 0 && (
                  <Button
                    onClick={() => createRedemption.mutate()}
                    disabled={createRedemption.isPending}
                    className={cn(
                      'w-full mt-2 bg-gradient-to-r text-white',
                      tierGradient
                    )}
                  >
                    {createRedemption.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4 mr-2" />
                    )}
                    Apply Credits
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="pt-2">
            <p className="text-xs text-slate-500 text-center">
              {wallet.tierPointsThisYear.toLocaleString()} points earned this year
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Redemption Code</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Show this code at the K9000 station or use it during checkout
            </DialogDescription>
          </DialogHeader>
          
          {activeRedemption && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-2xl">
                <QRCode 
                  value={activeRedemption.qrData} 
                  size={180}
                  level="H"
                />
              </div>
              
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-1">Manual Code</p>
                <p className="text-3xl font-mono font-bold tracking-wider text-amber-400">
                  {activeRedemption.redemptionCode}
                </p>
              </div>

              <div className="w-full bg-slate-800/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Credits Applied</span>
                  <span className="text-green-400 font-medium">
                    {formatCurrency(
                      activeRedemption.creditsApplied.egiftCents +
                      activeRedemption.creditsApplied.promoCents +
                      activeRedemption.creditsApplied.loyaltyPoints
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Amount Due</span>
                  <span className="text-white font-medium">
                    {formatCurrency(activeRedemption.cashDueCents)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Expires in 10 minutes
              </p>
            </div>
          )}
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
}

function CreditItem({ icon, label, value, subtitle, color }: CreditItemProps) {
  return (
    <div className="bg-slate-800/30 rounded-xl p-3">
      <div className={cn('flex items-center gap-2 mb-1', color)}>
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-white font-semibold">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}
