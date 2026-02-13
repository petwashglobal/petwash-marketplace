/**
 * ⁦PetWash™⁩ Voucher Card 2025
 * 7-Star Luxury Card with Glassmorphism & Metallic Themes
 */

import { type CardTheme, type PetWashVoucher2025 } from '@shared/petwashVoucher2025';
import { QrCode, Sparkles, Calendar, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoucherCard2025Props {
  voucher: PetWashVoucher2025;
  onUse?: () => void;
  showActions?: boolean;
}

const THEME_STYLES: Record<CardTheme, {
  gradient: string;
  glowColor: string;
  borderGlow: string;
}> = {
  neo_black_platinum: {
    gradient: 'radial-gradient(circle at 10% -10%, rgba(255, 255, 255, 0.24), transparent 55%), radial-gradient(circle at 95% 110%, rgba(0, 255, 196, 0.2), transparent 55%), linear-gradient(135deg, #05070a, #121b2a 60%, #1a3542 100%)',
    glowColor: 'rgba(255, 255, 255, 0.18)',
    borderGlow: 'rgba(255, 255, 255, 0.08)'
  },
  neo_emerald: {
    gradient: 'radial-gradient(circle at 10% -10%, rgba(16, 185, 129, 0.3), transparent 55%), radial-gradient(circle at 95% 110%, rgba(5, 150, 105, 0.25), transparent 55%), linear-gradient(135deg, #064e3b, #065f46 60%, #047857 100%)',
    glowColor: 'rgba(16, 185, 129, 0.3)',
    borderGlow: 'rgba(16, 185, 129, 0.12)'
  },
  neo_silver: {
    gradient: 'radial-gradient(circle at 10% -10%, rgba(203, 213, 225, 0.28), transparent 55%), radial-gradient(circle at 95% 110%, rgba(148, 163, 184, 0.22), transparent 55%), linear-gradient(135deg, #475569, #64748b 60%, #94a3b8 100%)',
    glowColor: 'rgba(203, 213, 225, 0.25)',
    borderGlow: 'rgba(203, 213, 225, 0.1)'
  }
};

export function VoucherCard2025({ voucher, onUse, showActions = true }: VoucherCard2025Props) {
  const theme = THEME_STYLES[voucher.visual.card_theme];
  const isCurrency = voucher.rules.value_type === 'currency';
  const isExpired = voucher.rules.expires_at && new Date(voucher.rules.expires_at) < new Date();
  
  // Display values
  const mainValue = isCurrency 
    ? `₪${voucher.rules.value_remaining}`
    : `${voucher.rules.washes_remaining} washes`;
  
  const subtitle = isCurrency
    ? `${voucher.rules.currency} Gift Card`
    : `Multi-Wash Package`;
  
  const validText = voucher.rules.expires_at 
    ? `Valid until ${new Date(voucher.rules.expires_at).toLocaleDateString()}`
    : 'No expiration';

  return (
    <div 
      className="pw-voucher-card group relative w-full rounded-[18px] p-5 sm:p-6 text-white overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
      style={{
        background: theme.gradient,
        border: `1.4px solid ${theme.glowColor}`,
        boxShadow: `inset 0 0 14px ${theme.borderGlow}, 0 18px 45px rgba(0, 0, 0, 0.45)`
      }}
      data-testid={`voucher-card-${voucher.public_code}`}
    >
      {/* Animated Highlight Overlay */}
      {voucher.visual.animated_highlight && (
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
          style={{
            background: `conic-gradient(from 180deg, ${theme.borderGlow}, ${theme.glowColor}, ${theme.borderGlow})`
          }}
        />
      )}

      {/* Top Section - Type & Code */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-[11px] tracking-[0.14em] uppercase opacity-85">
            {voucher.type === 'egift' ? '7-Star E-Gift' : 
             voucher.type === 'package_single' ? 'Premium Single' : 
             'Luxury Package'}
          </span>
        </div>
        <span className="font-mono text-xs opacity-95" data-testid="voucher-public-code">
          {voucher.public_code}
        </span>
      </div>

      {/* Middle Section - Value Display */}
      <div className="relative z-10 flex-1 mb-6">
        <h2 className="text-3xl sm:text-4xl font-bold mb-2" data-testid="voucher-value">
          {mainValue}
        </h2>
        <p className="text-sm opacity-85 mb-1">
          {subtitle}
        </p>
        <p className="text-xs opacity-80 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {validText}
        </p>
        
        {isExpired && (
          <div className="mt-3 inline-block px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-lg text-xs">
            Expired
          </div>
        )}
      </div>

      {/* Bottom Section - Meta & Actions */}
      <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex flex-col gap-1 text-xs opacity-90">
          <span className="flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            {voucher.owner.name}
          </span>
          {voucher.usage.last_used && (
            <span className="text-[10px] opacity-70">
              Last used: {new Date(voucher.usage.last_used).toLocaleDateString()}
            </span>
          )}
        </div>

        {showActions && !isExpired && (
          <Button
            onClick={onUse}
            size="sm"
            className="bg-white/16 hover:bg-white/26 backdrop-blur-sm text-white border-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            data-testid="button-use-voucher"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Use Now
          </Button>
        )}
      </div>

      {/* 7-Star Metal Badge */}
      <div className="absolute top-3 right-3 px-2 py-1 bg-gradient-to-r from-yellow-400/20 to-amber-500/20 backdrop-blur-sm rounded-md border border-yellow-400/30">
        <span className="text-[10px] font-bold tracking-wider text-yellow-300">
          7-STAR
        </span>
      </div>
    </div>
  );
}

// Voucher Card CSS (to be added to global styles if needed)
export const VOUCHER_CARD_STYLES = `
.pw-voucher-card {
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

@supports not (backdrop-filter: blur(18px)) {
  .pw-voucher-card {
    background: rgba(0, 0, 0, 0.8);
  }
}
`.trim();
