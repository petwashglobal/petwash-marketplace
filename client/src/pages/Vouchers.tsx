/**
 * Vouchers Page - Display User's 7-Star Luxury Vouchers
 */

import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { VoucherCard2025 } from '@/components/VoucherCard2025';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Wallet, Plus } from 'lucide-react';
import { useLocation } from 'wouter';
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

  const { data, isLoading } = useQuery({
    queryKey: ['/api/vouchers-2025/my-vouchers'],
    enabled: !!user
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/vouchers-2025/stats/summary'],
    enabled: !!user
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to view your vouchers</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/signin')} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading your luxury vouchers...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              My 7-Star Vouchers
            </h1>
            <p className="text-gray-600">
              Premium luxury vouchers with enhanced security
            </p>
          </div>
          <Button
            onClick={() => navigate('/egift')}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
            data-testid="button-create-voucher"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Voucher
          </Button>
        </div>

        {/* Stats Cards */}
        {stats?.stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Wallet className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Active Vouchers</p>
                    <p className="text-2xl font-bold">{stats.stats.active_vouchers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-emerald-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-2xl font-bold">₪{stats.stats.total_value_remaining.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-pink-600" />
                  <div>
                    <p className="text-sm text-gray-600">Washes Remaining</p>
                    <p className="text-2xl font-bold">{stats.stats.total_washes_remaining}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Vouchers Grid */}
        {vouchers.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Vouchers Yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first luxury voucher to get started
              </p>
              <Button
                onClick={() => navigate('/egift')}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Voucher
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vouchers.map((dbVoucher) => {
              const voucher = convertToVoucherFormat(dbVoucher);
              return (
                <VoucherCard2025
                  key={voucher.voucher_id}
                  voucher={voucher}
                  onUse={() => {
                    // TODO: Implement redemption flow
                    console.log('Redeem voucher:', voucher.public_code);
                  }}
                  showActions={true}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
