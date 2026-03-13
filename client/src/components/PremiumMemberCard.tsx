import { QRCodeSVG } from 'qrcode.react';

interface PremiumMemberCardProps {
  ownerName: string;
  balanceCents: number;
  cardDisplay: string;
  cardId: string;
}

function EmvChip() {
  return (
    <svg width="44" height="34" viewBox="0 0 44 34" fill="none">
      <rect x="0.5" y="0.5" width="43" height="33" rx="5.5" fill="url(#chipGrad)" stroke="#a07820" strokeWidth="0.5" />
      {/* Chip contact lines */}
      <line x1="14" y1="0" x2="14" y2="34" stroke="#8a6515" strokeWidth="0.8" opacity="0.6" />
      <line x1="30" y1="0" x2="30" y2="34" stroke="#8a6515" strokeWidth="0.8" opacity="0.6" />
      <line x1="0" y1="11" x2="44" y2="11" stroke="#8a6515" strokeWidth="0.8" opacity="0.6" />
      <line x1="0" y1="23" x2="44" y2="23" stroke="#8a6515" strokeWidth="0.8" opacity="0.6" />
      {/* Center square */}
      <rect x="14" y="11" width="16" height="12" rx="1.5" fill="url(#chipCenter)" />
      {/* Highlight shimmer */}
      <rect x="0.5" y="0.5" width="43" height="7" rx="5.5" fill="rgba(255,255,255,0.18)" />
      <defs>
        <linearGradient id="chipGrad" x1="0" y1="0" x2="44" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8c76a" />
          <stop offset="35%" stopColor="#c9a33a" />
          <stop offset="65%" stopColor="#b8901a" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
        <linearGradient id="chipCenter" x1="14" y1="11" x2="30" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8c76a" />
          <stop offset="100%" stopColor="#a07820" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PetWashLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* Paw icon SVG */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <ellipse cx="5" cy="7" rx="2.2" ry="3" fill="#C6A35B" />
        <ellipse cx="9.5" cy="4.5" rx="2" ry="2.8" fill="#C6A35B" />
        <ellipse cx="14.5" cy="4.5" rx="2" ry="2.8" fill="#C6A35B" />
        <ellipse cx="19" cy="7" rx="2.2" ry="3" fill="#C6A35B" />
        <path d="M12 9.5c-4.2 0-7.5 2.8-7.5 6 0 3 2.8 5.5 7.5 5.5s7.5-2.5 7.5-5.5c0-3.2-3.3-6-7.5-6z" fill="#C6A35B" />
      </svg>
      {/* Text */}
      <span style={{
        fontFamily: "'SF Pro Display', 'Helvetica Neue', Helvetica, sans-serif",
        fontSize: '18px',
        fontWeight: 700,
        color: '#C6A35B',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        Pet<span style={{ fontWeight: 800 }}>Wash</span>™
      </span>
    </div>
  );
}

export function PremiumMemberCard({ ownerName, balanceCents, cardDisplay, cardId }: PremiumMemberCardProps) {
  const balanceILS = (balanceCents / 100).toLocaleString('he-IL', { maximumFractionDigits: 0 });

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '400px',
      aspectRatio: '1.586',
      margin: '0 auto',
      /* 3-D depth trick: offset shadow on bottom-left, gold edge on bottom */
      filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.18)) drop-shadow(0 4px 10px rgba(198,163,91,0.25))',
    }}>
      {/* Card body */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1.5px solid #C6A35B',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 18px 14px',
        boxSizing: 'border-box',
      }}>

        {/* Top thin gold shimmer line */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, #C6A35B 0%, #E7C978 50%, #C6A35B 100%)',
          opacity: 0.9,
          borderRadius: '16px 16px 0 0',
        }} />

        {/* Row 1 — Logo */}
        <div style={{ marginBottom: 'auto' }}>
          <PetWashLogo />
        </div>

        {/* Row 2 — Chip + Member info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '10px',
        }}>
          <EmvChip />
          <div>
            <div style={{
              fontFamily: "'SF Pro Text', 'Helvetica Neue', sans-serif",
              fontSize: '11px',
              color: '#9E9E9E',
              letterSpacing: '0.03em',
              marginBottom: '2px',
            }}>
              Premium Member
            </div>
            <div style={{
              fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif",
              fontSize: '16px',
              fontWeight: 700,
              color: '#1A1A1A',
              letterSpacing: '-0.01em',
            }}>
              {ownerName || 'Member'}
            </div>
          </div>
        </div>

        {/* Row 3 — Balance + QR (flex row) */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}>
          {/* Balance block */}
          <div>
            <div style={{
              fontFamily: "'SF Pro Text', 'Helvetica Neue', sans-serif",
              fontSize: '11px',
              color: '#9E9E9E',
              letterSpacing: '0.03em',
              marginBottom: '2px',
            }}>
              Balance
            </div>
            <div style={{
              fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif",
              fontSize: '30px',
              fontWeight: 700,
              color: '#1A1A1A',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              ₪{balanceILS}
            </div>
          </div>

          {/* QR code — padded white box */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E0E0E0',
            borderRadius: '6px',
            padding: '5px',
            display: 'inline-flex',
          }}>
            <QRCodeSVG
              value={cardId}
              size={72}
              bgColor="#FFFFFF"
              fgColor="#1A1A1A"
              level="M"
            />
          </div>
        </div>

        {/* Row 4 — Card number + paw */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '8px',
        }}>
          {/* Mini paw */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <ellipse cx="5" cy="7" rx="2.2" ry="3" fill="#C6A35B" />
            <ellipse cx="9.5" cy="4.5" rx="2" ry="2.8" fill="#C6A35B" />
            <ellipse cx="14.5" cy="4.5" rx="2" ry="2.8" fill="#C6A35B" />
            <ellipse cx="19" cy="7" rx="2.2" ry="3" fill="#C6A35B" />
            <path d="M12 9.5c-4.2 0-7.5 2.8-7.5 6 0 3 2.8 5.5 7.5 5.5s7.5-2.5 7.5-5.5c0-3.2-3.3-6-7.5-6z" fill="#C6A35B" />
          </svg>
          <span style={{
            fontFamily: "'SF Pro Mono', 'Menlo', 'Courier New', monospace",
            fontSize: '12px',
            fontWeight: 600,
            color: '#C6A35B',
            letterSpacing: '0.12em',
          }}>
            {cardDisplay}
          </span>
        </div>

        {/* Bottom thin gold edge */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, #C6A35B 0%, #E7C978 50%, #C6A35B 100%)',
          opacity: 0.9,
          borderRadius: '0 0 16px 16px',
        }} />
      </div>

      {/* 3D edge — gold bottom-left visible edge */}
      <div style={{
        position: 'absolute',
        bottom: '-4px',
        left: '4px',
        right: '8px',
        height: '8px',
        background: 'linear-gradient(90deg, #b8941f, #d4af37, #e7c978, #d4af37)',
        borderRadius: '0 0 14px 14px',
        zIndex: -1,
        opacity: 0.7,
      }} />
    </div>
  );
}
