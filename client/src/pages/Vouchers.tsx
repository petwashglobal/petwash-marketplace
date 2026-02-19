/**
 * Vouchers Page - Display User's 7-Star Luxury Vouchers
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { VoucherCard2025 } from '@/components/VoucherCard2025';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Wallet, Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { PetWashVoucher2025 } from '@shared/petwashVoucher2025';

interface VoucherWithHistory extends Omit<PetWashVoucher2025, 'rules' | 'visual' | 'owner' | 'security' | 'usage'> {
  // Database fields (snake_case)
  type: string;
  valueType: string;
  tier: string;
  cardTheme: 'neo_black_platinum' | 'neo_emerald' | 'neo_silver';
  animatedHighlight: boolean;
  highresSvgUrl: string;
  valueOriginal: string | null;
  valueRemaining: string | null;
  washesOriginal: number | null;
  washesRemaining: number | null;
  currency: string | null;
  expiresAt: string | null;
  transferable: boolean;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdInApp: string;
  qrUrl: string;
  sha256Hash: string;
  signedJws: string | null;
  lastUsed: string | null;
  redeemMethod: string;
  createdAt: string;
  updatedAt: string;
  usage_history?: any[];
}

export default function Vouchers() {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/vouchers-2025/my-vouchers'],
    enabled: !!user
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/vouchers-2025/stats/summary'],
    enabled: !!user
  });

  const redeemMutation = useMutation({
    mutationFn: async (publicCode: string) => {
      const res = await apiRequest('POST', '/api/vouchers-2025/redeem', {
        public_code: publicCode,
        method: 'wash',
        washes: 1,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Voucher redeemed!', description: data.message || 'Successfully redeemed' });
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers-2025/my-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers-2025/stats/summary'] });
    },
    onError: (err: any) => {
      toast({ title: 'Redemption failed', description: err.message || 'Could not redeem voucher', variant: 'destructive' });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="luxury-glass-card luxury-shadow-xl max-w-md p-8 text-center luxury-animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h2 className="luxury-heading-md mb-3">Authentication Required</h2>
          <p className="luxury-text-body mb-8">Please sign in to view your vouchers</p>
          <Button 
            onClick={() => setLocation('/signin')} 
            className="luxury-btn-primary w-full"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center">
          <div className="luxury-spinner mx-auto mb-6" />
          <p className="luxury-text-body">Loading your luxury vouchers...</p>
        </div>
      </div>
    );
  }

  const vouchers = (data?.vouchers || []) as VoucherWithHistory[];
  
  // Convert DB format to PetWashVoucher2025 format for VoucherCard2025
  const convertToVoucherFormat = (dbVoucher: VoucherWithHistory): PetWashVoucher2025 => ({
    voucher_id: dbVoucher.id,
    public_code: dbVoucher.publicCode,
    type: dbVoucher.type as any,
    visual: {
      tier: '7star_metal',
      card_theme: dbVoucher.cardTheme,
      animated_highlight: dbVoucher.animatedHighlight,
      highres_svg_url: dbVoucher.highresSvgUrl
    },
    rules: {
      value_type: dbVoucher.valueType as any,
      value_original: dbVoucher.valueOriginal ? Number(dbVoucher.valueOriginal) : null,
      value_remaining: dbVoucher.valueRemaining ? Number(dbVoucher.valueRemaining) : null,
      washes_original: dbVoucher.washesOriginal,
      washes_remaining: dbVoucher.washesRemaining,
      currency: dbVoucher.currency,
      expires_at: dbVoucher.expiresAt,
      transferable: dbVoucher.transferable
    },
    owner: {
      user_id: dbVoucher.ownerId,
      name: dbVoucher.ownerName,
      email: dbVoucher.ownerEmail,
      created_in_app: dbVoucher.createdInApp
    },
    security: {
      qr_url: dbVoucher.qrUrl,
      sha256: dbVoucher.sha256Hash,
      signed_jws: dbVoucher.signedJws || ''
    },
    usage: {
      last_used: dbVoucher.lastUsed,
      history: dbVoucher.usage_history || [],
      redeem_method: dbVoucher.redeemMethod as any
    }
  });

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-4 luxury-animate-fade-in">
          <div>
            <div className="luxury-badge-gold mb-4">
              <Sparkles className="w-4 h-4" />
              Active Vouchers Gallery
            </div>
            <h1 className="luxury-heading-xl mb-3">
              My 7-Star Vouchers
            </h1>
            <p className="luxury-text-body">
              Premium luxury vouchers with enhanced security
            </p>
          </div>
          <Button
            onClick={() => setLocation('/egift')}
            className="luxury-btn-primary"
            data-testid="button-create-voucher"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Voucher
          </Button>
        </div>

        {/* Stats Cards */}
        {stats?.stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 luxury-gap-md mb-12">
            <div className="luxury-glass-card luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-1">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center luxury-shadow-md">
                  <Wallet className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="luxury-text-small mb-1">Active Vouchers</p>
                  <p className="luxury-heading-lg luxury-text-gradient">{stats.stats.active_vouchers}</p>
                </div>
              </div>
            </div>
            
            <div className="luxury-glass-card luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-2">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center luxury-shadow-md">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="luxury-text-small mb-1">Total Value</p>
                  <p className="luxury-heading-lg luxury-text-gradient">₪{stats.stats.total_value_remaining.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <div className="luxury-glass-card luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-3">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center luxury-shadow-md">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="luxury-text-small mb-1">Washes Remaining</p>
                  <p className="luxury-heading-lg luxury-text-gradient">{stats.stats.total_washes_remaining}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vouchers Grid */}
        {vouchers.length === 0 ? (
          <div className="luxury-glass-card text-center py-16 px-8 luxury-animate-fade-in luxury-delay-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-purple-600" />
            </div>
            <h3 className="luxury-heading-md mb-3">No Vouchers Yet</h3>
            <p className="luxury-text-body mb-8 max-w-md mx-auto">
              Create your first luxury voucher to get started
            </p>
            <Button
              onClick={() => setLocation('/egift')}
              className="luxury-btn-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Voucher
            </Button>
          </div>
        ) : (
          <div className="luxury-grid-3">
            {vouchers.map((dbVoucher, index) => {
              const voucher = convertToVoucherFormat(dbVoucher);
              const delayClass = `luxury-delay-${Math.min(index + 4, 10)}`;
              return (
                <div 
                  key={voucher.voucher_id}
                  className={`luxury-glass-card luxury-hover-glow luxury-shadow-xl luxury-animate-fade-in ${delayClass}`}
                >
                  <VoucherCard2025
                    voucher={voucher}
                    onUse={() => {
                      redeemMutation.mutate(voucher.public_code);
                    }}
                    showActions={true}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
