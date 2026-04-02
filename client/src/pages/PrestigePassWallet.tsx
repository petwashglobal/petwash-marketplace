import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { QRCodeSVG } from 'qrcode.react';
import {
  Shield, RefreshCw, Wallet, ChevronRight, CreditCard, Zap, Gift,
  Star, Clock, CheckCircle, AlertCircle, Home, MapPin, BookOpen,
  Droplets, ArrowUpCircle, Monitor, Package, QrCode as QrCodeIcon,
  Activity, TrendingUp, Users, GraduationCap, Car,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import prestigeLogoDiamond from '@assets/prestige-logo-diamond.png';
import petWashBrandLogo from '@assets/CE834507-240F-494E-9540-CEC964F3A22E_1774629703208.jpeg';
import { PremiumMemberCard } from '@/components/PremiumMemberCard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WalletData {
  pass: {
    serialNumber: string;
    userId: string;
    tier: string;
    variant: 'black' | 'gold' | 'platinum';
    tierDisplay: { en: string; he: string };
    passClass: string;
    issuedAt: string;
  };
  balances: {
    cashWalletCents: number;
    egiftBalanceCents: number;
    promoBalanceCents: number;
    packageWashesLeft: number;
    loyaltyPoints: number;
    referralBalanceCents: number;
    pendingBalanceCents: number;
    lifetimeEarnedCents: number;
    lifetimeRedeemedCents: number;
  };
}

interface QrToken {
  token: string;
  jti: string;
  bay: 'left' | 'right' | 'any';
  expiresAt: number;
  ttl: number;
}

interface DivisionEntry {
  entryId: string;
  divisionCode: string | null;
  sourceType: string | null;
  amountCents: number;
  bucket: string;
  eventType: string;
  bookingId: string | null;
  kioskId: string | null;
  createdAt: string;
}

interface DivisionActivity {
  ok: boolean;
  activity: Record<string, DivisionEntry[]>;
  totals: Record<string, number>;
  lifetimeRedeemedCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (cents: number) => `₪${(cents / 100).toFixed(0)}`;
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  } catch { return ''; }
};

const QR_TTL = 45;

const DIVISION_CONFIG: Record<string, { iconEn: string; labelEn: string; labelHe: string; color: string }> = {
  station_k9000: { iconEn: '🐾',  labelEn: 'K9000 Dog Wash',   labelHe: 'K9000 שטיפת כלבים',  color: '#22c55e' },
  petsitter:     { iconEn: '🏠',  labelEn: 'Pet Sitter / Care', labelHe: 'פנסיון ומטפל',        color: '#8b5cf6' },
  walkers:       { iconEn: '🐕',  labelEn: 'Walk My Pet',       labelHe: 'מטייל כלבים',         color: '#0ea5e9' },
  academy:       { iconEn: '🎓',  labelEn: 'Academy',           labelHe: 'אקדמיה',              color: '#f59e0b' },
  pettrek:       { iconEn: '🚐',  labelEn: 'PetTrek Transport', labelHe: 'PetTrek הסעות',       color: '#06b6d4' },
  general:       { iconEn: '💳',  labelEn: 'General',           labelHe: 'כללי',                color: '#D4AF37' },
};

// ─── CountdownRing ────────────────────────────────────────────────────────────
function CountdownRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const progress = (secondsLeft / total) * circ;
  const color = secondsLeft < 10 ? '#ef4444' : secondsLeft < 20 ? '#f59e0b' : '#22c55e';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${progress} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s linear, stroke 0.3s' }} />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700"
        fill={color} style={{ transform: 'rotate(90deg)', transformOrigin: '22px 22px', fontFamily: 'Inter, sans-serif' }}>
        {secondsLeft}
      </text>
    </svg>
  );
}

// ─── BalanceRow ───────────────────────────────────────────────────────────────
function BalanceRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid rgba(212,175,55,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(212,175,55,0.08)', display:'flex', alignItems:'center', justifyContent:'center', color: color || '#D4AF37' }}>
          {icon}
        </div>
        <span style={{ fontSize:'0.88rem', color:'#3A3228', fontWeight:500 }}>{label}</span>
      </div>
      <span style={{ fontSize:'0.95rem', fontWeight:700, color: color || '#1A1A1A' }}>{value}</span>
    </div>
  );
}

// ─── Section 1: Privilege Hero ────────────────────────────────────────────────
function PrivilegeHeroSection({ wallet, walletData, he }: { wallet: WalletData; walletData: any; he: boolean }) {
  const { pass, balances } = wallet;
  const totalLiquid = balances.cashWalletCents + balances.egiftBalanceCents + balances.promoBalanceCents + balances.referralBalanceCents;

  return (
    <div style={{ background: '#FFFFFF' }}>
      {/* Gold top bar */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg,#c9a96e,#f0d060,#d4af37,#c9a96e)' }} />

      {/* Hero header — logo + privilege label + name as ONE UNIT */}
      <div style={{ padding: '16px 20px 20px', textAlign: 'center', background: '#FFFFFF' }}>

        {/* LOGO — dominant focal point */}
        <img
          src={petWashBrandLogo}
          alt="PetWash™"
          style={{
            width: 'min(210px, 58vw)',
            height: 'auto',
            margin: '0 auto 6px',
            display: 'block',
            objectFit: 'contain',
          }}
        />

        {/* Privilege label — tightly coupled to logo */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', marginBottom:'4px' }}>
          <Shield size={11} color="#C5A55A" />
          <span style={{ color:'#7A7068', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase' }}>
            Official Member
          </span>
        </div>
        <h1 style={{ color:'#1A1A1A', fontSize:'1.15rem', fontWeight:800, letterSpacing:'-0.01em', margin:'0 0 4px' }}>
          PetWash <span style={{ color:'#C5A55A' }}>Privilege</span>
        </h1>

        {/* User name — balanced with privilege label */}
        {walletData?.displayName && (
          <p style={{ color:'#5A4A38', fontSize:'0.88rem', fontWeight:600, margin:'0 0 2px' }}>
            {he ? `שלום, ${walletData.displayName}` : `Welcome, ${walletData.displayName}`}
          </p>
        )}

        {/* Tier badge */}
        <div style={{ display:'flex', justifyContent:'center', marginTop:'6px' }}>
          <div style={{ background:'linear-gradient(90deg,#c9a96e,#f0d060,#d4af37,#c9a96e)', padding:'4px 20px', borderRadius:'100px' }}>
            <span style={{ color:'#fff', fontWeight:700, fontSize:'0.68rem', letterSpacing:'0.12em', textTransform:'uppercase' }}>
              {he ? pass.tierDisplay.he : pass.tierDisplay.en}
            </span>
          </div>
        </div>
      </div>

      {/* Premium card */}
      <div style={{ padding: '0 20px 24px' }}>
        <PremiumMemberCard
          ownerName={walletData?.displayName || pass.userId.slice(0, 10)}
          balanceCents={totalLiquid}
          cardDisplay={walletData?.cardDisplay || `PW • ${pass.serialNumber.slice(-8, -4)} ${pass.serialNumber.slice(-4)}`}
          cardId={walletData?.cardId || `PW-${pass.serialNumber.slice(-8)}`}
          petName={walletData?.pet?.petName}
          petType={walletData?.pet?.petType ?? undefined}
        />
      </div>

      {/* Member ID row */}
      <div style={{ padding:'0 20px 24px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(212,175,55,0.12)' }}>
        <div>
          <div style={{ fontSize:'0.6rem', fontWeight:600, color:'#9E9E9E', letterSpacing:'0.1em', textTransform:'uppercase' }}>
            {he ? 'מספר חבר' : 'Member ID'}
          </div>
          <div style={{ fontSize:'0.85rem', fontWeight:700, color:'#1A1A1A', fontFamily:'monospace', letterSpacing:'0.08em' }}>
            {pass.serialNumber}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'0.6rem', fontWeight:600, color:'#9E9E9E', letterSpacing:'0.1em', textTransform:'uppercase' }}>
            {he ? 'נקודות' : 'Points'}
          </div>
          <div style={{ fontSize:'0.95rem', fontWeight:700, color:'#C5A55A' }}>
            {balances.loyaltyPoints.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section 2: Benefits Grid ─────────────────────────────────────────────────
function BenefitsSection({ he, tier }: { he: boolean; tier: string }) {
  const isGold     = ['gold', 'platinum', 'diamond', 'elite', 'vip'].includes(tier);
  const isPlatinum = ['platinum', 'diamond', 'elite', 'vip'].includes(tier);

  const benefits = [
    {
      icon: <Droplets size={20} color="#22c55e" />,
      bg: 'rgba(34,197,94,0.08)',
      titleEn: 'K9000 Wash Station',
      titleHe: 'תחנת K9000',
      descEn: isGold ? '10% off every wash + priority bay access' : 'Pay via Privilege balance — any bay',
      descHe: isGold ? '10% הנחה בכל שטיפה + עדיפות בתא' : 'תשלום ביתרת Privilege — כל תא',
    },
    {
      icon: <MapPin size={20} color="#0ea5e9" />,
      bg: 'rgba(14,165,233,0.08)',
      titleEn: 'Walk My Pet',
      titleHe: 'Walk My Pet',
      descEn: isPlatinum ? '15% member discount on walks' : isGold ? '10% member discount on walks' : 'Pay with Privilege balance',
      descHe: isPlatinum ? '15% הנחת חבר על טיולים' : isGold ? '10% הנחת חבר על טיולים' : 'תשלום ביתרת Privilege',
    },
    {
      icon: <Home size={20} color="#8b5cf6" />,
      bg: 'rgba(139,92,246,0.08)',
      titleEn: 'Sitter Suite',
      titleHe: 'Sitter Suite',
      descEn: isPlatinum ? 'Priority matching + 15% off boarding' : 'Pay with Privilege balance',
      descHe: isPlatinum ? 'עדיפות + 15% הנחה על פנסיון' : 'תשלום ביתרת Privilege',
    },
    {
      icon: <GraduationCap size={20} color="#f59e0b" />,
      bg: 'rgba(245,158,11,0.08)',
      titleEn: 'Academy',
      titleHe: 'אקדמיה',
      descEn: isGold ? 'Member pricing on all courses' : 'Pay courses with Privilege balance',
      descHe: isGold ? 'מחיר חבר בכל הקורסים' : 'תשלום קורסים ביתרת Privilege',
    },
    {
      icon: <Car size={20} color="#06b6d4" />,
      bg: 'rgba(6,182,212,0.08)',
      titleEn: 'PetTrek Transport',
      titleHe: 'PetTrek הסעות',
      descEn: 'Pay taxi & transport with Privilege',
      descHe: 'תשלום הסעות ביתרת Privilege',
    },
    {
      icon: <Star size={20} color="#D4AF37" />,
      bg: 'rgba(212,175,55,0.08)',
      titleEn: 'Birthday Bonus',
      titleHe: 'בונוס יום הולדת',
      descEn: 'Free service credit on your pet\'s birthday',
      descHe: 'קרדיט שירות חינם ביום ההולדת של החיה',
    },
  ];

  return (
    <div style={{ padding: '24px 20px 0', background: '#FFFFFF' }}>
      <div style={{ marginBottom: '14px', display:'flex', alignItems:'center', gap:'8px' }}>
        <Users size={15} color="#C5A55A" />
        <h2 style={{ fontSize:'0.78rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.12em', textTransform:'uppercase', margin:0 }}>
          {he ? 'הטבות החברות — כל הפלטפורמות' : 'Membership Benefits — All Platforms'}
        </h2>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        {benefits.map((b, i) => (
          <div key={i} style={{
            background: '#FFFFFF',
            border: '1.5px solid rgba(212,175,55,0.15)',
            borderRadius: '14px',
            padding: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:b.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'8px' }}>
              {b.icon}
            </div>
            <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#1A1A1A', marginBottom:'3px' }}>
              {he ? b.titleHe : b.titleEn}
            </div>
            <div style={{ fontSize:'0.68rem', color:'#9E9E9E', lineHeight:1.4 }}>
              {he ? b.descHe : b.descEn}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:'12px', padding:'10px 14px', background:'rgba(197,165,90,0.06)', borderRadius:'12px', border:'1px solid rgba(197,165,90,0.2)' }}>
        <p style={{ margin:0, fontSize:'0.7rem', color:'#7A7068', lineHeight:1.5 }}>
          <strong style={{ color:'#B8941F' }}>PetWash Privilege </strong>
          {he
            ? '— כרטיס אחד לכל השירותים. יתרה אחת. פלטפורמה אחת.'
            : '— one card across all services. One shared balance. One ecosystem.'}
        </p>
      </div>
    </div>
  );
}

// ─── Section 3: Division Activity ─────────────────────────────────────────────
function DivisionActivitySection({ he }: { he: boolean }) {
  const [activeTab, setActiveTab] = useState<string>('all');

  const { data: divData, isLoading } = useQuery<DivisionActivity>({
    queryKey: ['/api/prestige-pass/division-activity'],
    refetchInterval: 60_000,
  });

  const TABS = [
    { key: 'all',          labelEn: 'All',     labelHe: 'הכל'    },
    { key: 'station_k9000',labelEn: 'K9000',   labelHe: 'K9000'  },
    { key: 'walkers',      labelEn: 'Walkers', labelHe: 'מטיילים' },
    { key: 'petsitter',    labelEn: 'Sitters', labelHe: 'מסיטרים' },
    { key: 'academy',      labelEn: 'Academy', labelHe: 'אקדמיה' },
  ];

  const getEntries = (): DivisionEntry[] => {
    if (!divData?.activity) return [];
    if (activeTab === 'all') {
      const all: DivisionEntry[] = [];
      for (const entries of Object.values(divData.activity)) all.push(...entries);
      return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12);
    }
    return divData.activity[activeTab] ?? [];
  };

  const entries = getEntries();
  const totals  = divData?.totals ?? {};

  return (
    <div style={{ padding: '24px 20px 0', background: '#FFFFFF' }}>
      <div style={{ marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <Activity size={15} color="#C5A55A" />
          <h2 style={{ fontSize:'0.78rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.12em', textTransform:'uppercase', margin:0 }}>
            {he ? 'פעילות לפי מחלקה' : 'Activity by Division'}
          </h2>
        </div>
        {divData?.lifetimeRedeemedCents != null && divData.lifetimeRedeemedCents > 0 && (
          <div style={{ fontSize:'0.72rem', color:'#B8941F', fontWeight:600 }}>
            {he ? `סה"כ: ${fmt(divData.lifetimeRedeemedCents)}` : `Total: ${fmt(divData.lifetimeRedeemedCents)}`}
          </div>
        )}
      </div>

      {/* Division totals row */}
      {divData && Object.entries(totals).some(([, v]) => v > 0) && (
        <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'8px', marginBottom:'12px' }}>
          {Object.entries(DIVISION_CONFIG).map(([key, cfg]) => {
            const total = totals[key] ?? 0;
            if (total === 0) return null;
            return (
              <div key={key} style={{
                flexShrink: 0, padding:'8px 12px', borderRadius:'12px',
                background:`${cfg.color}10`, border:`1px solid ${cfg.color}30`,
                textAlign:'center', minWidth:'80px',
              }}>
                <div style={{ fontSize:'0.65rem', color:'#9E9E9E', marginBottom:'2px' }}>
                  {cfg.iconEn} {he ? cfg.labelHe : cfg.labelEn}
                </div>
                <div style={{ fontSize:'0.88rem', fontWeight:700, color: cfg.color }}>
                  {fmt(total)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab navigation */}
      <div style={{ display:'flex', gap:'6px', overflowX:'auto', marginBottom:'14px', paddingBottom:'4px' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flexShrink: 0,
              padding:'6px 14px',
              borderRadius:'100px',
              border: activeTab === t.key ? '2px solid #D4AF37' : '2px solid rgba(212,175,55,0.2)',
              background: activeTab === t.key ? 'rgba(212,175,55,0.08)' : '#FFFFFF',
              color: activeTab === t.key ? '#B8941F' : '#7A7068',
              fontWeight: activeTab === t.key ? 700 : 500,
              fontSize:'0.78rem',
              cursor:'pointer',
            }}
          >
            {he ? t.labelHe : t.labelEn}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div style={{ background:'#FFFFFF', border:'1.5px solid rgba(212,175,55,0.15)', borderRadius:'16px', overflow:'hidden' }}>
        {isLoading ? (
          <div style={{ padding:'24px', textAlign:'center', color:'#9E9E9E', fontSize:'0.85rem' }}>
            {he ? 'טוען...' : 'Loading…'}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding:'24px', textAlign:'center' }}>
            <Activity size={32} color="rgba(212,175,55,0.3)" style={{ margin:'0 auto 8px' }} />
            <p style={{ color:'#9E9E9E', fontSize:'0.85rem', margin:0 }}>
              {he ? 'עדיין אין עסקאות בקטגוריה זו' : 'No transactions in this division yet'}
            </p>
          </div>
        ) : (
          entries.map((entry, i) => {
            const div    = DIVISION_CONFIG[entry.divisionCode ?? 'general'] ?? DIVISION_CONFIG['general'];
            const isLast = i === entries.length - 1;
            return (
              <div key={entry.entryId} style={{
                display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px',
                borderBottom: isLast ? 'none' : '1px solid rgba(212,175,55,0.08)',
              }}>
                <div style={{
                  width:'34px', height:'34px', borderRadius:'10px', flexShrink:0,
                  background:`${div.color}12`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'16px',
                }}>
                  {div.iconEn}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.82rem', fontWeight:600, color:'#1A1A1A' }}>
                    {he ? div.labelHe : div.labelEn}
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'#9E9E9E', marginTop:'1px' }}>
                    {entry.kioskId ? `K9000 · ${entry.kioskId}` : entry.bookingId ? `#${entry.bookingId.slice(-6)}` : entry.eventType}
                    {entry.createdAt ? ` · ${fmtDate(entry.createdAt)}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight:700, fontSize:'0.9rem', color:'#dc2626' }}>
                  -{fmt(entry.amountCents)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Section 4: PetWash Wallet Balance ────────────────────────────────────────
function WalletBalanceSection({ balances, he }: { balances: WalletData['balances']; he: boolean }) {
  const totalLiquid = balances.cashWalletCents + balances.egiftBalanceCents + balances.promoBalanceCents + balances.referralBalanceCents;
  const pending = balances.pendingBalanceCents || 0;
  const lifetimeEarned = balances.lifetimeEarnedCents || 0;
  const lifetimeRedeemed = balances.lifetimeRedeemedCents || 0;

  return (
    <div style={{ padding:'24px 20px 0', background:'#FFFFFF' }}>
      <div style={{ marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
        <TrendingUp size={15} color="#C5A55A" />
        <h2 style={{ fontSize:'0.78rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.12em', textTransform:'uppercase', margin:0 }}>
          {he ? 'PetWash Wallet — יתרות' : 'PetWash Wallet — Balances'}
        </h2>
      </div>

      {/* Total balance hero number */}
      <div style={{
        background: 'linear-gradient(135deg,#1A1A1A 0%,#2a2a2a 100%)',
        borderRadius:'20px', padding:'24px 22px', marginBottom:'14px',
        boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'6px' }}>
          {he ? 'יתרה כוללת זמינה' : 'Total Available Balance'}
        </div>
        <div style={{ color:'#D4AF37', fontSize:'2.4rem', fontWeight:800, letterSpacing:'-0.03em', lineHeight:1 }}>
          {fmt(totalLiquid)}
        </div>

        {/* Pending hold chip — shown only when funds are locked on active bookings */}
        {pending > 0 && (
          <div style={{ marginTop:'10px', display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(245,158,11,0.15)', borderRadius:'100px', padding:'5px 12px', border:'1px solid rgba(245,158,11,0.3)' }}>
            <Clock size={12} color="#f59e0b" />
            <span style={{ color:'#f59e0b', fontSize:'0.72rem', fontWeight:700 }}>
              {fmt(pending)} {he ? 'מוקפא — ממתין לאישור הזמנה' : 'on hold — pending booking'}
            </span>
          </div>
        )}

        {balances.packageWashesLeft > 0 && (
          <div style={{ marginTop:'8px', display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(34,197,94,0.15)', borderRadius:'100px', padding:'4px 12px' }}>
            <Droplets size={12} color="#22c55e" />
            <span style={{ color:'#22c55e', fontSize:'0.72rem', fontWeight:700 }}>
              {balances.packageWashesLeft} {he ? 'שטיפות בחבילה' : 'package washes'}
            </span>
          </div>
        )}
        <div style={{ marginTop:'10px', fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', letterSpacing:'0.08em' }}>
          {he ? 'ניתן לשימוש בכל מחלקות PetWash' : 'Redeemable across all PetWash divisions'}
        </div>
      </div>

      {/* Bucket breakdown */}
      <div style={{ background:'#FFFFFF', border:'1.5px solid rgba(212,175,55,0.2)', borderRadius:'16px', padding:'4px 16px' }}>
        <BalanceRow icon={<Wallet size={16} />}    label={he ? 'ארנק מזומן' : 'Cash Wallet'}      value={fmt(balances.cashWalletCents)}        color="#1A1A1A" />
        <BalanceRow icon={<Gift size={16} />}       label={he ? 'eGift' : 'eGift Balance'}          value={fmt(balances.egiftBalanceCents)}       color="#D4AF37" />
        <BalanceRow icon={<Zap size={16} />}        label={he ? 'קרדיט מבצע' : 'Promo Credit'}      value={fmt(balances.promoBalanceCents)}       color="#f59e0b" />
        {balances.referralBalanceCents > 0 && (
          <BalanceRow icon={<CheckCircle size={16} />} label={he ? 'קרדיט הפניה' : 'Referral Credit'} value={fmt(balances.referralBalanceCents)} color="#06b6d4" />
        )}
        <BalanceRow icon={<Droplets size={16} />}  label={he ? 'חבילת שטיפות K9000' : 'K9000 Package Washes'} value={balances.packageWashesLeft > 0 ? `${balances.packageWashesLeft} ${he ? 'שטיפות' : 'washes'}` : '—'} color="#22c55e" />
        <BalanceRow icon={<Star size={16} />}       label={he ? 'נקודות נאמנות' : 'Loyalty Points'}  value={balances.loyaltyPoints.toLocaleString()} color="#8b5cf6" />
        {pending > 0 && (
          <BalanceRow icon={<Clock size={16} />}    label={he ? 'מוקפא (הזמנות פעילות)' : 'On Hold (active bookings)'} value={fmt(pending)} color="#f59e0b" />
        )}
      </div>

      {/* Lifetime stats — shown only when there's history */}
      {(lifetimeEarned > 0 || lifetimeRedeemed > 0) && (
        <div style={{ marginTop:'10px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          <div style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'12px', padding:'12px 14px' }}>
            <div style={{ fontSize:'0.62rem', color:'#5a7a5a', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'4px' }}>
              {he ? 'סה"כ נצבר' : 'Lifetime Earned'}
            </div>
            <div style={{ fontSize:'1.2rem', fontWeight:800, color:'#16a34a' }}>{fmt(lifetimeEarned)}</div>
          </div>
          <div style={{ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:'12px', padding:'12px 14px' }}>
            <div style={{ fontSize:'0.62rem', color:'#5a5070', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'4px' }}>
              {he ? 'סה"כ מומש' : 'Lifetime Redeemed'}
            </div>
            <div style={{ fontSize:'1.2rem', fontWeight:800, color:'#7c3aed' }}>{fmt(lifetimeRedeemed)}</div>
          </div>
        </div>
      )}

      {/* Deduction order */}
      <div style={{ marginTop:'10px', padding:'10px 14px', background:'rgba(197,165,90,0.05)', borderRadius:'10px', border:'1px solid rgba(197,165,90,0.15)' }}>
        <p style={{ margin:0, fontSize:'0.7rem', color:'#7A7068', lineHeight:1.5 }}>
          <strong style={{ color:'#B8941F' }}>{he ? 'סדר מימוש: ' : 'Redemption order: '}</strong>
          {he ? 'קרדיט מבצע → eGift → חבילה → ארנק → כרטיס' : 'Promo → eGift → Package → Wallet → Card'}
        </p>
      </div>
    </div>
  );
}

// ─── Section 5: Digital Card & K9000 QR ──────────────────────────────────────
function DigitalCardSection({
  wallet, walletData, he,
  selectedBay, setSelectedBay,
  qrToken, secondsLeft, isGenerating, generateQr,
  setShowTopUpDialog, navigate,
  resendEmailMutation,
  toast,
  petEditOpen, setPetEditOpen, petForm, setPetForm, savingPet, setSavingPet, queryClient,
}: any) {
  const { pass, balances } = wallet;
  const totalLiquid = balances.cashWalletCents + balances.egiftBalanceCents + balances.promoBalanceCents + balances.referralBalanceCents;
  const K9000_MIN_CENTS  = 3900;
  const K9000_FULL_CENTS = 7900;
  const hasPackage   = balances.packageWashesLeft > 0;
  const canWash      = hasPackage || totalLiquid >= K9000_MIN_CENTS;
  const canWashFull  = hasPackage || totalLiquid >= K9000_FULL_CENTS;
  const shortfall    = Math.max(0, K9000_MIN_CENTS - totalLiquid);

  return (
    <div style={{ padding: '24px 20px 0', background: '#FFFFFF' }}>
      {/* Section header */}
      <div style={{ marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
        <CreditCard size={15} color="#C5A55A" />
        <h2 style={{ fontSize:'0.78rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.12em', textTransform:'uppercase', margin:0 }}>
          {he ? 'כרטיס דיגיטלי ו-K9000' : 'Digital Card & K9000 Kiosk'}
        </h2>
      </div>

      {/* Bay selector */}
      <div style={{ marginBottom:'16px' }}>
        <p style={{ textAlign:'center', color:'#9E9E9E', fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px' }}>
          {he ? 'בחר תא שטיפה — K9000' : 'Select Wash Bay — K9000'}
        </p>
        <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
          {(['left', 'any', 'right'] as const).map((b) => (
            <button key={b} onClick={() => setSelectedBay(b)} style={{
              padding:'8px 18px', borderRadius:'100px',
              border: selectedBay === b ? '2px solid #D4AF37' : '2px solid rgba(212,175,55,0.2)',
              background: selectedBay === b ? 'rgba(212,175,55,0.08)' : '#FFFFFF',
              color: selectedBay === b ? '#B8941F' : '#7A7068',
              fontWeight: selectedBay === b ? 700 : 500,
              fontSize:'0.82rem', cursor:'pointer',
            }}>
              {b === 'left' ? (he ? 'תא שמאל' : 'Left Bay') : b === 'right' ? (he ? 'תא ימין' : 'Right Bay') : (he ? 'כל תא' : 'Any Bay')}
            </button>
          ))}
        </div>
      </div>

      {/* QR Section */}
      <div style={{ background:'#FFFFFF', border:'1.5px solid rgba(212,175,55,0.2)', borderRadius:'20px', padding:'20px', marginBottom:'16px', boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <h3 style={{ fontSize:'0.9rem', fontWeight:700, color:'#1A1A1A', margin:0 }}>
              {he ? 'סרוק לפדיון — K9000' : 'Scan to Redeem — K9000'}
            </h3>
            <p style={{ fontSize:'0.72rem', color:'#9E9E9E', margin:'2px 0 0' }}>
              {he ? 'קוד חד-פעמי מאובטח • 45 שניות' : 'One-time secure token • 45 seconds'}
            </p>
          </div>
          {qrToken && <CountdownRing secondsLeft={secondsLeft} total={QR_TTL} />}
        </div>

        {qrToken ? (
          <div className="prestige-qr-wrap" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
            <div style={{ background:'#FFFFFF', padding:'16px', borderRadius:'16px', border:'1.5px solid rgba(212,175,55,0.15)', boxShadow:'0 2px 16px rgba(0,0,0,0.06)' }}>
              <QRCodeSVG value={qrToken.token} size={200} level="H"
                imageSettings={{ src: prestigeLogoDiamond, height:32, width:32, excavate:true }} />
            </div>
            <div style={{ background:'#FFFFFF', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'10px', padding:'8px 20px', textAlign:'center' }}>
              <p style={{ margin:0, fontSize:'0.6rem', color:'#9E9E9E', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                {he ? 'קוד חבר' : 'Member Code'}
              </p>
              <p style={{ margin:'2px 0 0', fontSize:'0.9rem', fontWeight:700, color:'#B8941F', fontFamily:'monospace', letterSpacing:'0.15em' }}>
                {pass.serialNumber}
              </p>
            </div>
            <button onClick={() => { generateQr(); }} style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', cursor:'pointer', color:'#9E9E9E', fontSize:'0.78rem', fontWeight:600, padding:'4px 8px' }}>
              <RefreshCw size={13} /> {he ? 'רענן קוד' : 'Refresh code'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', padding:'20px 0' }}>
            <div style={{ width:'180px', height:'180px', borderRadius:'12px', background:'rgba(212,175,55,0.04)', border:'2px dashed rgba(212,175,55,0.2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              <QrCodeIcon size={40} color="rgba(212,175,55,0.35)" />
              <p style={{ margin:0, color:'rgba(212,175,55,0.5)', fontSize:'0.75rem', textAlign:'center' }}>
                {he ? 'לחץ להפעלת קוד QR' : 'Tap to activate QR'}
              </p>
            </div>
            <Button onClick={generateQr} disabled={isGenerating} style={{ background:'linear-gradient(135deg,#c9a96e,#d4af37)', color:'#fff', border:'none', fontWeight:700, padding:'12px 32px', borderRadius:'12px', fontSize:'0.9rem' }}>
              {isGenerating ? (he ? 'מייצר...' : 'Generating…') : (he ? 'הפעל קוד QR' : 'Generate QR Code')}
            </Button>
          </div>
        )}
      </div>

      {/* K9000 readiness panel */}
      <div style={{ background:'#FFFFFF', border:`1.5px solid ${canWash ? 'rgba(34,197,94,0.3)' : 'rgba(212,175,55,0.2)'}`, borderRadius:'16px', padding:'16px', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
          <Droplets size={18} color={canWash ? '#22c55e' : '#D4AF37'} />
          <div>
            <div style={{ fontWeight:700, fontSize:'0.88rem', color:'#1A1A1A' }}>
              {he ? 'מוכנות K9000' : 'K9000 Readiness'}
            </div>
          </div>
          <div style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:'100px', background: canWash ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', border:`1px solid ${canWash ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}` }}>
            <span style={{ fontSize:'0.68rem', fontWeight:700, color: canWash ? '#16a34a' : '#dc2626' }}>
              {canWash ? (he ? '✓ מוכן' : '✓ Ready') : (he ? '✗ יתרה נמוכה' : '✗ Low balance')}
            </span>
          </div>
        </div>

        {canWash ? (
          <div style={{ background:'rgba(34,197,94,0.06)', borderRadius:'10px', padding:'10px 14px', border:'1px solid rgba(34,197,94,0.2)', display:'flex', alignItems:'center', gap:'8px' }}>
            <CheckCircle size={16} color="#16a34a" style={{ flexShrink:0 }} />
            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#16a34a' }}>
              {hasPackage
                ? (he ? 'חבילת שטיפות — סרוק QR למעלה' : 'Package wash ready — scan QR above')
                : canWashFull
                  ? (he ? 'יתרה מלאה — סרוק QR להפעלה' : 'Full balance — scan QR to activate')
                  : (he ? 'יתרה לשטיפה בסיסית — סרוק QR' : 'Covers basic wash — scan QR above')}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ background:'rgba(239,68,68,0.05)', borderRadius:'8px', padding:'8px 12px', border:'1px solid rgba(239,68,68,0.15)' }}>
              <span style={{ fontSize:'0.78rem', color:'#dc2626', fontWeight:600 }}>
                {he ? `חסרים ${fmt(shortfall)} להפעלה` : `${fmt(shortfall)} short to activate via pass`}
              </span>
            </div>
            <button onClick={() => setShowTopUpDialog(true)} style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(212,175,55,0.08)', border:'1.5px solid rgba(212,175,55,0.3)', borderRadius:'12px', padding:'12px 14px', cursor:'pointer', textAlign:'left' }}>
              <ArrowUpCircle size={18} color="#D4AF37" style={{ flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#B8941F' }}>
                  {he ? `טען ${fmt(shortfall)} ויותר` : `Top up ${fmt(shortfall)}+`}
                </div>
                <div style={{ fontSize:'0.68rem', color:'#9E9E9E' }}>
                  {he ? 'הוסף כסף ל-PetWash Wallet' : 'Add credit to your PetWash Wallet'}
                </div>
              </div>
              <ChevronRight size={16} color="#D4AF37" style={{ marginLeft:'auto' }} />
            </button>
            <button onClick={() => toast({ title: he ? 'תשלום בטרמינל Nayax' : 'Pay at Nayax Terminal', description: he ? 'הניח כרטיס אשראי, Apple Pay או Google Pay על קורא הכרטיסים שבמכונה.' : "Tap your card, Apple Pay, or Google Pay on the machine's card reader." })} style={{ display:'flex', alignItems:'center', gap:'10px', background:'#FFFFFF', border:'1.5px solid rgba(0,0,0,0.1)', borderRadius:'12px', padding:'12px 14px', cursor:'pointer', textAlign:'left' }}>
              <Monitor size={18} color="#1A1A1A" style={{ flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#1A1A1A' }}>
                  {he ? 'שלם ישירות בטרמינל Nayax' : 'Pay at Nayax terminal'}
                </div>
                <div style={{ fontSize:'0.68rem', color:'#9E9E9E' }}>
                  Apple Pay • Google Pay • {he ? 'כרטיס אשראי' : 'Credit card'}
                </div>
              </div>
              <ChevronRight size={16} color="#9E9E9E" style={{ marginLeft:'auto' }} />
            </button>
          </div>
        )}
      </div>

      {/* Book Online services */}
      <div style={{ background:'#FFFFFF', border:'1.5px solid rgba(212,175,55,0.2)', borderRadius:'16px', padding:'16px', marginBottom:'16px' }}>
        <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px' }}>
          {he ? 'הזמן שירות עם PetWash Privilege' : 'Book with PetWash Privilege'}
        </h3>
        {[
          { id:'sitter', icon:<Home size={16}/>, en:'Pet Sitter / Boarding', he2:'פנסיון ומטפל', detEn:'from ₪80/night', detHe:'מ-₪80/לילה', from:8000, path:'/sitter-suite', color:'#8b5cf6' },
          { id:'walker', icon:<MapPin size={16}/>, en:'Dog Walker', he2:'מטייל כלבים', detEn:'from ₪65/session', detHe:'מ-₪65/טיול', from:6500, path:'/walk-my-pet', color:'#0ea5e9' },
          { id:'academy', icon:<BookOpen size={16}/>, en:'Academy — Training', he2:'אקדמיה — אימון', detEn:'from ₪200', detHe:'מ-₪200', from:20000, path:'/academy', color:'#f59e0b' },
        ].map((svc) => {
          const canBook  = totalLiquid >= svc.from;
          const partial  = totalLiquid > 0 && !canBook;
          const sfILS    = ((Math.max(0, svc.from - totalLiquid)) / 100).toFixed(0);
          return (
            <div key={svc.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:'1px solid rgba(212,175,55,0.08)' }}>
              <div style={{ width:'34px', height:'34px', borderRadius:'9px', background:`${svc.color}14`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:svc.color }}>
                {svc.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#1A1A1A' }}>{he ? svc.he2 : svc.en}</div>
                <div style={{ fontSize:'0.68rem', color:'#9E9E9E', marginTop:'1px' }}>{he ? svc.detHe : svc.detEn}</div>
                {canBook
                  ? <div style={{ fontSize:'0.65rem', color:'#16a34a', fontWeight:600, marginTop:'2px' }}>{he ? '✓ מכוסה ע"י יתרה' : '✓ Covered by balance'}</div>
                  : partial
                    ? <div style={{ fontSize:'0.65rem', color:'#f59e0b', fontWeight:600, marginTop:'2px' }}>{he ? `⚠ חסרים ₪${sfILS}` : `⚠ ₪${sfILS} short`}</div>
                    : <div style={{ fontSize:'0.65rem', color:'#dc2626', fontWeight:600, marginTop:'2px' }}>{he ? '✗ יש לטעון' : '✗ Top up needed'}</div>
                }
              </div>
              <button onClick={() => navigate(svc.path)} style={{ flexShrink:0, padding:'8px 14px', borderRadius:'100px', border:`1.5px solid ${canBook ? 'rgba(34,197,94,0.4)' : partial ? 'rgba(245,158,11,0.4)' : 'rgba(212,175,55,0.3)'}`, background: canBook ? 'rgba(34,197,94,0.08)' : partial ? 'rgba(245,158,11,0.06)' : 'rgba(212,175,55,0.05)', color: canBook ? '#16a34a' : partial ? '#d97706' : '#B8941F', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                {canBook ? (he ? 'הזמן' : 'Book') : partial ? (he ? 'הזמן →' : 'Book →') : (he ? 'טעינה' : 'Top Up')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Pet Profile */}
      <div style={{ background:'#FFFFFF', border:'1.5px solid rgba(212,175,55,0.15)', borderRadius:'16px', padding:'16px', marginBottom:'16px' }}>
        <div onClick={() => setPetEditOpen((o: boolean) => !o)} style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
          <span style={{ fontSize:'18px' }}>{walletData?.pet?.petName ? '🐾' : '➕'}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:'0.85rem', color:'#1A1A1A' }}>
              {walletData?.pet?.petName
                ? `${walletData.pet.petName}${walletData.pet.petBreed ? ` · ${walletData.pet.petBreed}` : ''}`
                : (he ? 'הוסף פרטי חיית מחמד לכרטיס' : 'Add your pet to the card')}
            </div>
            <div style={{ fontSize:'0.68rem', color:'#9E9E9E', marginTop:'1px' }}>
              {he ? 'מוצג על הכרטיס ולצוות' : 'Shown on card · visible to staff at scan'}
            </div>
          </div>
          <span style={{ color:'#D4AF37', fontSize:'0.75rem' }}>{petEditOpen ? '▲' : '▼'}</span>
        </div>
        {petEditOpen && (
          <div style={{ marginTop:'14px', display:'flex', flexDirection:'column', gap:'10px' }}>
            {[
              { key:'petName', label: he ? 'שם' : 'Pet name', placeholder:'e.g. Bella' },
              { key:'petBreed', label: he ? 'גזע' : 'Breed', placeholder:'e.g. Golden Retriever' },
              { key:'petNotes', label: he ? 'הערות לצוות' : 'Staff notes', placeholder:'e.g. Sensitive skin' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:'0.68rem', fontWeight:600, color:'#9E9E9E', marginBottom:'4px', letterSpacing:'0.05em', textTransform:'uppercase' }}>{label}</label>
                <input value={(petForm as any)[key]} onChange={e => setPetForm((f: any) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1.5px solid rgba(212,175,55,0.25)', fontSize:'0.88rem', outline:'none', boxSizing:'border-box', color:'#1A1A1A' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:'6px' }}>
              {(['dog','cat','rabbit','bird','other'] as const).map(t => (
                <button key={t} onClick={() => setPetForm((f: any) => ({ ...f, petType: t }))} style={{ padding:'6px 10px', borderRadius:'100px', border:'none', cursor:'pointer', background: petForm.petType === t ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.04)', outline: petForm.petType === t ? '1.5px solid #D4AF37' : 'none', color: petForm.petType === t ? '#B8941F' : '#7A7068', fontWeight: petForm.petType === t ? 700 : 400, fontSize:'0.72rem' }}>
                  {t === 'dog' ? '🐶' : t === 'cat' ? '🐱' : t === 'rabbit' ? '🐰' : t === 'bird' ? '🐦' : '🐾'} {t}
                </button>
              ))}
            </div>
            <button disabled={savingPet || !petForm.petName?.trim()} onClick={async () => {
              setSavingPet(true);
              try {
                const r = await apiRequest('POST', '/api/prestige-pass/pet', petForm);
                const d = await r.json();
                if (d.ok) {
                  queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/wallet'] });
                  setPetEditOpen(false);
                  toast({ title: he ? '🐾 נשמר!' : '🐾 Saved!', description: he ? `${petForm.petName} נוסף לכרטיס` : `${petForm.petName} added to your card` });
                }
              } finally { setSavingPet(false); }
            }} style={{ padding:'11px', borderRadius:'10px', border:'none', background: petForm.petName?.trim() ? '#D4AF37' : 'rgba(212,175,55,0.3)', color:'#FFFFFF', fontWeight:700, fontSize:'0.88rem', cursor: savingPet ? 'wait' : 'pointer' }}>
              {savingPet ? (he ? 'שומר…' : 'Saving…') : (he ? 'שמור פרופיל חיית מחמד' : 'Save pet profile')}
            </button>
          </div>
        )}
      </div>

      {/* Apple / Google Wallet */}
      <div style={{ background:'#FFFFFF', border:'1.5px solid rgba(212,175,55,0.2)', borderRadius:'16px', padding:'20px', marginBottom:'16px' }}>
        <h3 style={{ fontSize:'0.78rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px' }}>
          {he ? 'הוסף לארנק הנייד' : 'Add to Mobile Wallet'}
        </h3>
        <p style={{ fontSize:'0.78rem', color:'#9E9E9E', margin:'0 0 14px', lineHeight:1.5 }}>
          {he
            ? 'קבל את PetWash Privilege שלך ב-Apple Wallet וב-Google Wallet. הכרטיס מתעדכן אוטומטית.'
            : 'Receive your PetWash Privilege in Apple Wallet and Google Wallet. Auto-updates automatically.'}
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <a href={`/api/prestige-pass/apple-wallet?userId=${pass.userId}`} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'#000', color:'#fff', padding:'13px', borderRadius:'12px', textDecoration:'none', fontWeight:700, fontSize:'0.9rem' }}>
            <span>🍎</span> {he ? 'הוסף ל-Apple Wallet' : 'Add to Apple Wallet'}
          </a>
          <a href={`/api/prestige-pass/google-wallet?userId=${pass.userId}`} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'#4285F4', color:'#fff', padding:'13px', borderRadius:'12px', textDecoration:'none', fontWeight:700, fontSize:'0.9rem' }}>
            <span>🔵</span> {he ? 'הוסף ל-Google Wallet' : 'Add to Google Wallet'}
          </a>
          <button onClick={() => resendEmailMutation.mutate()} disabled={resendEmailMutation.isPending}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'#FFFFFF', border:'1.5px solid rgba(212,175,55,0.3)', color:'#B8941F', padding:'12px', borderRadius:'12px', cursor:'pointer', fontWeight:600, fontSize:'0.85rem' }}>
            <Clock size={15} />
            {resendEmailMutation.isPending ? (he ? 'שולח...' : 'Sending…') : (he ? 'שלח למייל (עם כפתורי Wallet)' : 'Send to email (with Wallet buttons)')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kiosk Pass Overlay ───────────────────────────────────────────────────────
function PrestigeKioskPass({
  wallet, walletData, he,
  selectedBay, setSelectedBay,
  qrToken, secondsLeft, isGenerating, generateQr,
  onClose,
}: {
  wallet: WalletData;
  walletData: any;
  he: boolean;
  selectedBay: 'left' | 'right' | 'any';
  setSelectedBay: (b: 'left' | 'right' | 'any') => void;
  qrToken: QrToken | null;
  secondsLeft: number;
  isGenerating: boolean;
  generateQr: () => void;
  onClose: () => void;
}) {
  const { pass, balances } = wallet;
  const name = walletData?.displayName || pass.userId.slice(0, 10);
  const tierLabel = he ? pass.tierDisplay.he : pass.tierDisplay.en;

  // Attempt to keep screen bright while pass is open
  useEffect(() => {
    try {
      const el = document.documentElement;
      el.style.setProperty('--screen-bright', '1');
    } catch { /* ignore */ }
    return () => {
      try { document.documentElement.style.removeProperty('--screen-bright'); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      animation: 'kioskFadeIn 0.22s ease',
    }}>
      <style>{`
        @keyframes kioskFadeIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        @keyframes kioskQrIn { from { opacity:0; transform:translateY(6px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
      `}</style>

      {/* Pass Card */}
      <div style={{
        width: '100%', maxWidth: '360px',
        background: '#FFFFFF',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.3)',
        position: 'relative',
      }}>
        {/* Gold shimmer top */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg,#c9a96e,#f0d060,#d4af37,#f0d060,#c9a96e)' }} />

        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '12px', right: '14px',
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', color: '#9E9E9E', zIndex: 1,
        }}>✕</button>

        {/* Header */}
        <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
          {/* Logo wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginBottom: '4px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <ellipse cx="5" cy="7" rx="2.2" ry="3" fill="#C6A35B" />
              <ellipse cx="9.5" cy="4.5" rx="2" ry="2.8" fill="#C6A35B" />
              <ellipse cx="14.5" cy="4.5" rx="2" ry="2.8" fill="#C6A35B" />
              <ellipse cx="19" cy="7" rx="2.2" ry="3" fill="#C6A35B" />
              <path d="M12 9.5c-4.2 0-7.5 2.8-7.5 6 0 3 2.8 5.5 7.5 5.5s7.5-2.5 7.5-5.5c0-3.2-3.3-6-7.5-6z" fill="#C6A35B" />
            </svg>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#C6A35B', letterSpacing: '-0.02em', fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif" }}>
              PetWash™
            </span>
          </div>

          {/* Prestige label */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(90deg,#c9a96e,#d4af37,#c9a96e)', borderRadius: '100px', padding: '3px 14px', marginBottom: '14px' }}>
            <span style={{ color: '#fff', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {tierLabel}
            </span>
          </div>

          {/* Member name */}
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.01em', marginBottom: '2px', fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif" }}>
            {name.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.62rem', color: '#9E9E9E', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '18px' }}>
            {he ? 'חבר מכובד' : 'Member'}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)', margin: '0 20px' }} />

        {/* QR Code — the centrepiece */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', animation: 'kioskQrIn 0.3s ease' }}>
          {qrToken ? (
            <>
              {/* QR + countdown ring */}
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                {/* Countdown ring — positioned around the QR */}
                <div style={{ position: 'absolute', top: '-10px', right: '-10px', zIndex: 1 }}>
                  <CountdownRing secondsLeft={secondsLeft} total={QR_TTL} />
                </div>
                <div style={{
                  background: '#FFFFFF', padding: '14px', borderRadius: '16px',
                  border: '2px solid rgba(212,175,55,0.25)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                }}>
                  <QRCodeSVG
                    value={qrToken.token}
                    size={200}
                    level="H"
                    imageSettings={{ src: prestigeLogoDiamond, height: 36, width: 36, excavate: true }}
                  />
                </div>
              </div>

              {/* Instruction */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#B8941F', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  {he ? 'סרוק בקיוסק K9000' : 'Scan at K9000 Kiosk'}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#9E9E9E' }}>
                  {he ? 'קוד חד-פעמי מאובטח' : 'One-time secure token'}
                  {' · '}
                  {qrToken.bay !== 'any' ? (he ? (qrToken.bay === 'left' ? 'תא שמאל' : 'תא ימין') : `${qrToken.bay} bay`) : (he ? 'כל תא' : 'any bay')}
                </div>
              </div>

              {/* Refresh */}
              <button onClick={generateQr} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#C5A55A', fontSize: '0.72rem', fontWeight: 600, padding: '4px 8px',
              }}>
                <RefreshCw size={12} /> {he ? 'רענן קוד' : 'Refresh code'}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
              <div style={{ width: '200px', height: '200px', borderRadius: '16px', background: 'rgba(212,175,55,0.04)', border: '2px dashed rgba(212,175,55,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <QrCodeIcon size={44} color="rgba(212,175,55,0.35)" />
                <p style={{ margin: 0, color: 'rgba(212,175,55,0.55)', fontSize: '0.75rem', textAlign: 'center' }}>
                  {he ? 'לחץ להפעלת קוד QR' : 'Tap to activate QR'}
                </p>
              </div>
              <Button onClick={generateQr} disabled={isGenerating} style={{ background: 'linear-gradient(135deg,#c9a96e,#d4af37)', color: '#fff', border: 'none', fontWeight: 700, padding: '12px 36px', borderRadius: '12px', fontSize: '0.9rem' }}>
                {isGenerating ? (he ? 'מייצר...' : 'Generating…') : (he ? 'הפעל QR' : 'Activate QR')}
              </Button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)', margin: '0 20px' }} />

        {/* Footer — membership number + points */}
        <div style={{ padding: '14px 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#9E9E9E', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
              {he ? 'מספר חבר' : 'Member No.'}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A1A1A', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
              {pass.serialNumber}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.55rem', color: '#9E9E9E', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
              {he ? 'נקודות' : 'Points'}
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#C5A55A' }}>
              {balances.loyaltyPoints.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Bay selector — compact, below footer */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
          {(['left', 'any', 'right'] as const).map((b) => (
            <button key={b} onClick={() => { setSelectedBay(b); generateQr(); }} style={{
              flex: 1, padding: '7px 4px', borderRadius: '100px',
              border: selectedBay === b ? '2px solid #D4AF37' : '2px solid rgba(212,175,55,0.18)',
              background: selectedBay === b ? 'rgba(212,175,55,0.1)' : '#FFFFFF',
              color: selectedBay === b ? '#B8941F' : '#9E9E9E',
              fontWeight: selectedBay === b ? 700 : 500,
              fontSize: '0.72rem', cursor: 'pointer',
            }}>
              {b === 'left' ? (he ? 'שמאל' : 'Left') : b === 'right' ? (he ? 'ימין' : 'Right') : (he ? 'כל תא' : 'Any')}
            </button>
          ))}
        </div>

        {/* Valid footer */}
        <div style={{ background: 'rgba(212,175,55,0.04)', padding: '8px 20px 14px', textAlign: 'center', borderTop: '1px solid rgba(212,175,55,0.1)' }}>
          <div style={{ fontSize: '0.56rem', color: '#BFAC8A', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {he ? 'תקף בתחנות K9000 ברחבי העולם' : 'Valid at K9000 Dog Wash Kiosks Worldwide'}
          </div>
        </div>

        {/* Gold shimmer bottom */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg,#c9a96e,#f0d060,#d4af37,#f0d060,#c9a96e)' }} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PrestigePassWallet() {
  const { language } = useLanguage() as { language: 'he' | 'en' };
  const he = language === 'he';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedBay, setSelectedBay]       = useState<'left' | 'right' | 'any'>('any');
  const [qrToken, setQrToken]               = useState<QrToken | null>(null);
  const [secondsLeft, setSecondsLeft]       = useState(QR_TTL);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [showKioskPass, setShowKioskPass]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [washEvent, setWashEvent]           = useState<{ bay:string; stationId:string|null; deductedCents:number; newBalanceCents:number; source:string; } | null>(null);
  const [petEditOpen, setPetEditOpen]       = useState(false);
  const [petForm, setPetForm]               = useState({ petName:'', petType:'dog', petBreed:'', petNotes:'' });
  const [savingPet, setSavingPet]           = useState(false);

  const { data: walletData, isLoading, error } = useQuery<{
    ok: boolean;
    pass: WalletData['pass'];
    balances: WalletData['balances'];
    displayName?: string;
    cardId?: string;
    cardDisplay?: string;
    pet?: { petName: string|null; petType: string|null; petBreed: string|null; petNotes: string|null };
  }>({ queryKey: ['/api/prestige-pass/wallet'], refetchInterval: 30_000 });

  const wallet: WalletData | null = walletData?.ok ? { pass: walletData.pass, balances: walletData.balances } : null;

  const generateQr = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const resp = await apiRequest('POST', '/api/prestige-pass/token/generate', { bay: selectedBay });
      const data = await resp.json();
      if (data.ok) {
        setQrToken(data);
        setSecondsLeft(QR_TTL);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setSecondsLeft(s => {
            if (s <= 1) { clearInterval(timerRef.current!); setQrToken(null); return 0; }
            return s - 1;
          });
        }, 1000);
      } else {
        toast({ title: he ? 'שגיאה' : 'Error', description: data.error, variant:'destructive' });
      }
    } catch {
      toast({ title: he ? 'שגיאת רשת' : 'Network error', variant:'destructive' });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedBay, isGenerating, he, toast]);

  useEffect(() => {
    if (wallet) generateQr();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [wallet?.pass.userId]);

  useEffect(() => {
    if (!wallet?.pass.userId) return;
    const es = new EventSource('/api/prestige-pass/session/stream');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'wash_started') {
          setWashEvent(data);
          queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/wallet'] });
          queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/division-activity'] });
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [wallet?.pass.userId]);

  useEffect(() => {
    if (walletData?.pet) {
      setPetForm({ petName: walletData.pet.petName ?? '', petType: walletData.pet.petType ?? 'dog', petBreed: walletData.pet.petBreed ?? '', petNotes: walletData.pet.petNotes ?? '' });
    }
  }, [walletData?.pet?.petName]);

  const resendEmailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/prestige-pass/resend-wallet-email', {}),
    onSuccess: async (resp) => {
      const data = await resp.json();
      if (data.ok) toast({ title: he ? 'נשלח!' : 'Sent!', description: he ? 'הפאס נשלח למייל עם כפתורי Apple/Google Wallet.' : 'Pass sent to your email with Apple & Google Wallet buttons.' });
      else toast({ title: he ? 'שגיאה' : 'Error', description: data.error, variant:'destructive' });
    },
    onError: () => toast({ title: he ? 'שגיאת רשת' : 'Network error', variant:'destructive' }),
  });

  // ── Loading ──
  if (isLoading) {
    return (
      <Layout>
        <div style={{ minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FFFFFF' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ width:'56px', height:'56px', borderRadius:'50%', border:'3px solid rgba(212,175,55,0.2)', borderTopColor:'#D4AF37', animation:'spin 1s linear infinite', margin:'0 auto 16px' }} />
            <p style={{ color:'#9E9E9E', fontSize:'0.9rem' }}>{he ? 'טוען את הכרטיס...' : 'Loading your pass…'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Error / unauthenticated ──
  if (error || !wallet) {
    const is401 = (error as any)?.status === 401 || (error as any)?.message?.includes('401');
    return (
      <Layout>
        <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FFFFFF', padding:'2rem' }}>
          <div style={{ textAlign:'center', maxWidth:'320px' }}>
            <AlertCircle size={48} color="#ef4444" style={{ margin:'0 auto 16px' }} />
            <p style={{ color:'#3A3228', fontWeight:600, marginBottom:'8px' }}>
              {is401 ? (he ? 'נדרשת התחברות' : 'Sign in required') : (he ? 'שגיאה בטעינת הכרטיס' : 'Could not load your pass')}
            </p>
            <p style={{ color:'#9E9E9E', fontSize:'0.85rem', marginBottom:'20px' }}>
              {is401 ? (he ? 'יש להתחבר כדי לגשת ל-PetWash Privilege.' : 'Please sign in to access PetWash Privilege.') : (he ? 'אנא נסה שוב.' : 'Please try again.')}
            </p>
            <a href="/signin" style={{ display:'inline-block', background:'linear-gradient(135deg,#C5A55A,#D4AF37)', color:'#fff', fontWeight:600, padding:'10px 28px', borderRadius:'8px', textDecoration:'none', fontSize:'0.95rem' }}>
              {he ? 'כניסה לחשבון' : 'Sign In'}
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .prestige-qr-wrap { animation: fadeIn 0.3s ease; }
        @keyframes passButtonPulse { 0%,100% { box-shadow:0 4px 20px rgba(212,175,55,0.35); } 50% { box-shadow:0 4px 32px rgba(212,175,55,0.6); } }
      `}</style>

      {/* ── Kiosk Pass Overlay ── */}
      {showKioskPass && (
        <PrestigeKioskPass
          wallet={wallet}
          walletData={walletData}
          he={he}
          selectedBay={selectedBay}
          setSelectedBay={setSelectedBay}
          qrToken={qrToken}
          secondsLeft={secondsLeft}
          isGenerating={isGenerating}
          generateQr={generateQr}
          onClose={() => setShowKioskPass(false)}
        />
      )}

      {/* ── Sticky "Scan at K9000" FAB ── */}
      <button
        onClick={() => setShowKioskPass(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'linear-gradient(135deg,#c9a96e 0%,#d4af37 50%,#c9a96e 100%)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '100px',
          padding: '14px 28px',
          fontWeight: 800,
          fontSize: '0.88rem',
          letterSpacing: '0.04em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap',
          animation: 'passButtonPulse 3s ease-in-out infinite',
        }}
      >
        <QrCodeIcon size={17} />
        {he ? 'הצג כרטיס — K9000' : 'Show Pass — K9000'}
      </button>

      <div style={{ background:'#FFFFFF', minHeight:'100vh', paddingBottom:'calc(180px + env(safe-area-inset-bottom, 0px))' }}>

        {/* Live wash banner */}
        {washEvent && (
          <div style={{ position:'sticky', top:0, zIndex:50, background:'linear-gradient(90deg,#16a34a,#22c55e)', padding:'12px 20px', display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ fontSize:'22px' }}>🚿</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:'0.9rem', color:'#FFFFFF' }}>
                {he ? 'השטיפה התחילה!' : 'Wash started!'} {washEvent.bay !== 'any' ? `— ${washEvent.bay === 'left' ? (he ? 'תא שמאל' : 'Left bay') : (he ? 'תא ימין' : 'Right bay')}` : ''}
              </div>
              <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.85)', marginTop:'1px' }}>
                {he ? `${fmt(washEvent.deductedCents)} נוכו • יתרה: ${fmt(washEvent.newBalanceCents)}` : `${fmt(washEvent.deductedCents)} deducted • Balance: ${fmt(washEvent.newBalanceCents)}`}
              </div>
            </div>
            <button onClick={() => setWashEvent(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.7)', fontSize:'20px', padding:0, lineHeight:1 }}>×</button>
          </div>
        )}

        {/* ── SECTION 1: Hero ── */}
        <PrivilegeHeroSection wallet={wallet} walletData={walletData} he={he} />

        {/* ── SECTION 2: Benefits ── */}
        <BenefitsSection he={he} tier={wallet.pass.tier} />

        {/* ── SECTION 3: Division Activity ── */}
        <DivisionActivitySection he={he} />

        {/* ── SECTION 4: Wallet Balance ── */}
        <WalletBalanceSection balances={wallet.balances} he={he} />

        {/* ── SECTION 5: Digital Card & K9000 ── */}
        <DigitalCardSection
          wallet={wallet}
          walletData={walletData}
          he={he}
          selectedBay={selectedBay}
          setSelectedBay={setSelectedBay}
          qrToken={qrToken}
          secondsLeft={secondsLeft}
          isGenerating={isGenerating}
          generateQr={generateQr}
          setShowTopUpDialog={setShowTopUpDialog}
          navigate={navigate}
          resendEmailMutation={resendEmailMutation}
          toast={toast}
          petEditOpen={petEditOpen}
          setPetEditOpen={setPetEditOpen}
          petForm={petForm}
          setPetForm={setPetForm}
          savingPet={savingPet}
          setSavingPet={setSavingPet}
          queryClient={queryClient}
        />

        {/* Bottom spacing handled by paddingBottom on container */}
      </div>
    </Layout>
  );
}
