import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, RefreshCw, Wallet, ChevronLeft, ChevronRight, CreditCard, Zap, Gift, Star, Clock, CheckCircle, AlertCircle, Home, MapPin, BookOpen, Droplets, ArrowUpCircle, Monitor, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import prestigeCardBlack from '@assets/prestige-card-black.png';
import prestigeCardGold from '@assets/prestige-card-gold.png';
import prestigeLogoDiamond from '@assets/prestige-logo-diamond.png';
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
  };
}

interface QrToken {
  token: string;
  jti: string;
  bay: 'left' | 'right' | 'any';
  expiresAt: number;
  ttl: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (cents: number) => `₪${(cents / 100).toFixed(0)}`;

const CARD_STYLES = {
  black: {
    bg:       'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 40%, #0f0f0f 100%)',
    shine:    'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, transparent 50%, rgba(212,175,55,0.08) 100%)',
    border:   'rgba(212,175,55,0.4)',
    logo:     'white',
    text:     'white',
    sub:      'rgba(255,255,255,0.55)',
    accent:   '#D4AF37',
    badge:    'linear-gradient(90deg,#c9a96e,#f0d060,#d4af37,#c9a96e)',
    shadow:   '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.25)',
    chipBg:   '#c9a96e',
  },
  gold: {
    bg:       'linear-gradient(135deg, #b8860b 0%, #d4af37 30%, #f0d060 60%, #c9a96e 100%)',
    shine:    'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%, rgba(255,255,255,0.08) 100%)',
    border:   'rgba(255,255,255,0.35)',
    logo:     'white',
    text:     'white',
    sub:      'rgba(255,255,255,0.7)',
    accent:   'rgba(255,255,255,0.9)',
    badge:    'linear-gradient(90deg,rgba(255,255,255,0.3),rgba(255,255,255,0.5),rgba(255,255,255,0.3))',
    shadow:   '0 32px 80px rgba(180,135,40,0.45), 0 0 0 1px rgba(255,255,255,0.2)',
    chipBg:   'rgba(255,255,255,0.35)',
  },
  platinum: {
    bg:       'linear-gradient(135deg, #d8d8d8 0%, #f0f0f0 40%, #c8c8c8 100%)',
    shine:    'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 50%, rgba(255,255,255,0.2) 100%)',
    border:   'rgba(212,175,55,0.5)',
    logo:     '#1a1a1a',
    text:     '#1a1a1a',
    sub:      'rgba(0,0,0,0.5)',
    accent:   '#B8941F',
    badge:    'linear-gradient(90deg,#c9a96e,#f0d060,#d4af37,#c9a96e)',
    shadow:   '0 32px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(212,175,55,0.3)',
    chipBg:   '#d4af37',
  },
} as const;

const QR_TTL = 45;

// ─── Countdown Ring ───────────────────────────────────────────────────────────
function CountdownRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const progress = (secondsLeft / total) * circ;
  const color = secondsLeft < 10 ? '#ef4444' : secondsLeft < 20 ? '#f59e0b' : '#22c55e';

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${progress} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s linear, stroke 0.3s' }}
      />
      <text
        x="22" y="22"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontWeight="700"
        fill={color}
        style={{ transform: 'rotate(90deg)', transformOrigin: '22px 22px', fontFamily: 'Inter, sans-serif' }}
      >
        {secondsLeft}
      </text>
    </svg>
  );
}

// ─── Luxury Card Face ─────────────────────────────────────────────────────────
function LuxuryCard({
  wallet,
  language,
}: {
  wallet: WalletData;
  language: 'he' | 'en';
}) {
  const { pass, balances } = wallet;
  const cs = CARD_STYLES[pass.variant];
  const tierName = language === 'he' ? pass.tierDisplay.he : pass.tierDisplay.en;
  const totalLiquid = (balances.cashWalletCents + balances.egiftBalanceCents + balances.promoBalanceCents + balances.referralBalanceCents);

  return (
    <div style={{
      position:     'relative',
      borderRadius: '20px',
      width:        '100%',
      maxWidth:     '380px',
      aspectRatio:  '1.586',
      background:   cs.bg,
      boxShadow:    cs.shadow,
      border:       `1px solid ${cs.border}`,
      overflow:     'hidden',
      userSelect:   'none',
      margin:       '0 auto',
    }}>
      {/* Shine overlay */}
      <div style={{ position:'absolute', inset:0, background:cs.shine, pointerEvents:'none', borderRadius:'20px' }} />

      {/* Gold shimmer bar at top */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:cs.badge, opacity:0.8 }} />

      {/* Top row: logo + tier badge */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <img src={prestigeLogoDiamond} alt="PetWash" style={{ height:'26px', objectFit:'contain', filter: pass.variant === 'black' ? 'none' : (pass.variant === 'gold' ? 'brightness(2)' : 'none') }} />
        </div>
        <span style={{
          background:    cs.badge,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  pass.variant === 'black' ? 'transparent' : 'transparent',
          color:         pass.variant === 'gold' ? 'rgba(255,255,255,0.9)' : cs.accent,
          fontSize:      '0.68rem',
          fontWeight:    700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {tierName}
        </span>
      </div>

      {/* Chip + balance */}
      <div style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 22px 0' }}>
        {/* EMV chip (decorative) */}
        <div style={{
          width:'38px', height:'28px', borderRadius:'5px',
          background: cs.chipBg,
          border:`1px solid rgba(255,255,255,0.3)`,
          display:'grid',
          gridTemplateColumns:'1fr 1fr',
          gridTemplateRows:'1fr 1fr 1fr',
          gap:'2px',
          padding:'4px',
        }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background:'rgba(0,0,0,0.15)', borderRadius:'1px' }} />
          ))}
        </div>

        <div>
          <div style={{ color:cs.sub, fontSize:'0.6rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>
            {language === 'he' ? 'יתרה זמינה' : 'Available Balance'}
          </div>
          <div style={{ color:cs.text, fontSize:'1.5rem', fontWeight:700, letterSpacing:'-0.02em', lineHeight:1 }}>
            {fmt(totalLiquid)}
          </div>
        </div>
      </div>

      {/* Wash credits row */}
      {balances.packageWashesLeft > 0 && (
        <div style={{ padding:'6px 22px 0', display:'flex', gap:'6px', alignItems:'center' }}>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:cs.accent }} />
          <span style={{ color:cs.sub, fontSize:'0.72rem', fontWeight:600 }}>
            {language === 'he' ? `${balances.packageWashesLeft} שטיפות בחבילה` : `${balances.packageWashesLeft} package washes`}
          </span>
        </div>
      )}

      {/* Bottom row: serial + member */}
      <div style={{
        position: 'absolute', bottom:0, left:0, right:0,
        display:'flex', justifyContent:'space-between', alignItems:'flex-end',
        padding:'0 22px 16px',
      }}>
        <div>
          <div style={{ color:cs.sub, fontSize:'0.55rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>
            {language === 'he' ? 'מספר חבר' : 'Member ID'}
          </div>
          <div style={{ color:cs.text, fontSize:'0.78rem', fontWeight:600, fontFamily:'monospace', letterSpacing:'0.05em' }}>
            {pass.serialNumber}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ color:cs.sub, fontSize:'0.55rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>
            {language === 'he' ? 'נקודות' : 'Points'}
          </div>
          <div style={{ color:cs.accent, fontSize:'0.95rem', fontWeight:700 }}>
            {balances.loyaltyPoints.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Balance Row ──────────────────────────────────────────────────────────────
function BalanceRow({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'12px 0',
      borderBottom:'1px solid rgba(212,175,55,0.08)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{
          width:'36px', height:'36px', borderRadius:'10px',
          background:'rgba(212,175,55,0.08)',
          display:'flex', alignItems:'center', justifyContent:'center',
          color: color || '#D4AF37',
        }}>
          {icon}
        </div>
        <span style={{ fontSize:'0.88rem', color:'#3A3228', fontWeight:500 }}>{label}</span>
      </div>
      <span style={{ fontSize:'0.95rem', fontWeight:700, color: color || '#1A1A1A' }}>{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PrestigePassWallet() {
  const { language } = useLanguage() as { language: 'he' | 'en' };
  const he = language === 'he';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [, navigate]                  = useLocation();
  const [selectedBay, setSelectedBay] = useState<'left' | 'right' | 'any'>('any');
  const [qrToken, setQrToken]         = useState<QrToken | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch wallet state
  const [washEvent, setWashEvent] = useState<{
    bay: string; stationId: string | null; deductedCents: number; newBalanceCents: number; source: string;
  } | null>(null);
  const [petEditOpen, setPetEditOpen] = useState(false);
  const [petForm, setPetForm] = useState({ petName: '', petType: 'dog', petBreed: '', petNotes: '' });
  const [savingPet, setSavingPet] = useState(false);

  const { data: walletData, isLoading, error } = useQuery<{
    ok: boolean;
    pass: WalletData['pass'];
    balances: WalletData['balances'];
    displayName?: string;
    cardId?: string;
    cardDisplay?: string;
    pet?: { petName: string | null; petType: string | null; petBreed: string | null; petNotes: string | null };
  }>({
    queryKey: ['/api/prestige-pass/wallet'],
    refetchInterval: 30_000,
  });

  const wallet: WalletData | null = walletData?.ok
    ? { pass: walletData.pass, balances: walletData.balances }
    : null;

  // Generate QR token
  const generateQr = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const resp = await apiRequest('POST', '/api/prestige-pass/token/generate', {
        bay: selectedBay,
      });
      const data = await resp.json();
      if (data.ok) {
        setQrToken(data);
        setSecondsLeft(QR_TTL);
        // Restart countdown timer
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setSecondsLeft((s) => {
            if (s <= 1) {
              clearInterval(timerRef.current!);
              setQrToken(null);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      } else {
        toast({ title: he ? 'שגיאה' : 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: he ? 'שגיאת רשת' : 'Network error', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedBay, isGenerating, he, toast]);

  // Auto-generate on mount
  useEffect(() => {
    if (wallet) generateQr();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [wallet?.pass.userId]);

  // ── SSE: subscribe to real-time K9000 wash events ──────────────────────────
  useEffect(() => {
    if (!wallet?.pass.userId) return;
    const es = new EventSource('/api/prestige-pass/session/stream');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'wash_started') {
          setWashEvent(data);
          queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/wallet'] });
        }
      } catch { /* malformed event */ }
    };
    return () => es.close();
  }, [wallet?.pass.userId]);

  // Pre-populate pet form from existing wallet data
  useEffect(() => {
    if (walletData?.pet) {
      setPetForm({
        petName:  walletData.pet.petName  ?? '',
        petType:  walletData.pet.petType  ?? 'dog',
        petBreed: walletData.pet.petBreed ?? '',
        petNotes: walletData.pet.petNotes ?? '',
      });
    }
  }, [walletData?.pet?.petName]);

  // Fetch transaction history
  const { data: historyData } = useQuery<{ ok: boolean; events: any[] }>({
    queryKey: ['/api/prestige-pass/history'],
    enabled: !!wallet,
  });

  const events = historyData?.events?.slice(0, 3) || [];

  // Resend wallet email (Google + Apple buttons) to user's email
  const resendEmailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/prestige-pass/resend-wallet-email', {}),
    onSuccess: async (resp) => {
      const data = await resp.json();
      if (data.ok) {
        toast({ title: he ? 'נשלח!' : 'Sent!', description: he ? 'הפאס נשלח למייל שלך עם כפתורי Apple/Google Wallet.' : 'Wallet pass sent to your email with Apple & Google Wallet buttons.' });
      } else {
        toast({ title: he ? 'שגיאה' : 'Error', description: data.error, variant: 'destructive' });
      }
    },
    onError: () => toast({ title: he ? 'שגיאת רשת' : 'Network error', variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <Layout>
        <div style={{ minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#ffffff' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{
              width:'60px', height:'60px', borderRadius:'50%',
              border:'3px solid rgba(212,175,55,0.2)',
              borderTopColor:'#D4AF37',
              animation:'spin 1s linear infinite',
              margin:'0 auto 16px',
            }} />
            <p style={{ color:'#7A7068', fontSize:'0.9rem' }}>{he ? 'טוען את הכרטיס...' : 'Loading your pass…'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !wallet) {
    const is401 = (error as any)?.status === 401 || (error as any)?.message?.includes('401');
    return (
      <Layout>
        <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#ffffff', padding:'2rem' }}>
          <div style={{ textAlign:'center', maxWidth:'320px' }}>
            <AlertCircle size={48} color="#ef4444" style={{ margin:'0 auto 16px' }} />
            <p style={{ color:'#3A3228', fontWeight:600, marginBottom:'8px' }}>
              {is401
                ? (he ? 'נדרשת התחברות' : 'Sign in required')
                : (he ? 'שגיאה בטעינת הכרטיס' : 'Could not load your pass')}
            </p>
            <p style={{ color:'#7A7068', fontSize:'0.85rem', marginBottom:'20px' }}>
              {is401
                ? (he ? 'יש להתחבר כדי לגשת לכרטיס הפרסטיז.' : 'Please sign in to access your Prestige Pass.')
                : (he ? 'אנא נסה שוב או התחבר מחדש.' : 'Please try again or sign in again.')}
            </p>
            <a
              href="/signin"
              style={{
                display:'inline-block',
                background:'linear-gradient(135deg,#C5A55A,#D4AF37)',
                color:'#fff',
                fontWeight:600,
                padding:'10px 28px',
                borderRadius:'8px',
                textDecoration:'none',
                fontSize:'0.95rem',
              }}
            >
              {he ? 'כניסה לחשבון' : 'Sign In'}
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  const { pass, balances } = wallet;
  const cs = CARD_STYLES[pass.variant];
  const totalLiquid = balances.cashWalletCents + balances.egiftBalanceCents + balances.promoBalanceCents + balances.referralBalanceCents;

  return (
    <Layout>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        .prestige-qr-wrap { animation: fadeIn 0.3s ease; }
      `}</style>

      <div style={{ background:'#ffffff', minHeight:'100vh', paddingBottom:'80px' }}>

        {/* ── Hero bar ── */}
        <div style={{
          background:   '#ffffff',
          padding:      '32px 20px 100px',
          textAlign:    'center',
          position:     'relative',
          overflow:     'hidden',
          borderBottom: '1px solid rgba(212,175,55,0.15)',
        }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:cs.badge }} />

          {/* Diamond logo — large & centered */}
          <img
            src={prestigeLogoDiamond}
            alt="PetWash Prestige"
            style={{ width: '110px', height: 'auto', margin: '0 auto 12px', display: 'block' }}
          />

          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginBottom:'6px' }}>
            <Shield size={13} color="#C5A55A" />
            <span style={{ color:'#7A7068', fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase' }}>
              {he ? 'כרטיס פרסטיז רשמי' : 'Official Prestige Pass'}
            </span>
          </div>
          <h1 style={{ color:'#1A1A1A', fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em', margin:0 }}>
            PetWash <span style={{ color:'#C5A55A' }}>Prestige</span>
          </h1>
        </div>

        {/* ── Wash-started SSE banner ── */}
        {washEvent && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: 'linear-gradient(90deg, #16a34a, #22c55e)',
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ fontSize: '24px' }}>🚿</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#FFFFFF' }}>
                {he ? 'השטיפה התחילה!' : 'Wash started!'} {washEvent.bay !== 'any' ? `— ${washEvent.bay === 'left' ? (he ? 'תא שמאל' : 'Left bay') : (he ? 'תא ימין' : 'Right bay')}` : ''}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', marginTop: '1px' }}>
                {he
                  ? `₪${((washEvent.deductedCents) / 100).toFixed(0)} נוכו • יתרה חדשה: ₪${(washEvent.newBalanceCents / 100).toFixed(0)}`
                  : `₪${(washEvent.deductedCents / 100).toFixed(0)} deducted • New balance: ₪${(washEvent.newBalanceCents / 100).toFixed(0)}`}
              </div>
            </div>
            <button onClick={() => setWashEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '20px', padding: 0, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* ── Premium card ── */}
        <div style={{ padding: '0 20px', marginTop: '-80px', position: 'relative', zIndex: 10 }}>
          <PremiumMemberCard
            ownerName={walletData?.displayName || pass.userId.slice(0, 10)}
            balanceCents={
              balances.cashWalletCents +
              balances.egiftBalanceCents +
              balances.promoBalanceCents
            }
            cardDisplay={walletData?.cardDisplay || `PW • ${pass.serialNumber.slice(-8, -4)} ${pass.serialNumber.slice(-4)}`}
            cardId={walletData?.cardId || `PW-${pass.serialNumber.slice(-8)}`}
            petName={walletData?.pet?.petName}
            petType={walletData?.pet?.petType ?? undefined}
          />
        </div>

        {/* ── Tier badge ── */}
        <div style={{ display:'flex', justifyContent:'center', marginTop:'20px' }}>
          <div style={{
            background:    'linear-gradient(90deg,#c9a96e,#f0d060,#d4af37,#c9a96e)',
            backgroundSize: '200%',
            padding:       '6px 24px',
            borderRadius:  '100px',
          }}>
            <span style={{ color:'#fff', fontWeight:700, fontSize:'0.75rem', letterSpacing:'0.12em', textTransform:'uppercase' }}>
              {he ? pass.tierDisplay.he : pass.tierDisplay.en}
            </span>
          </div>
        </div>

        {/* ── Bay selector ── */}
        <div style={{ padding:'24px 20px 0' }}>
          <p style={{ textAlign:'center', color:'#7A7068', fontSize:'0.75rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'10px' }}>
            {he ? 'בחר תא שטיפה — K9000' : 'Select Wash Bay — K9000'}
          </p>
          <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
            {(['left', 'any', 'right'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBay(b)}
                style={{
                  padding:      '8px 20px',
                  borderRadius: '100px',
                  border:       selectedBay === b ? '2px solid #D4AF37' : '2px solid rgba(212,175,55,0.2)',
                  background:   selectedBay === b ? 'rgba(212,175,55,0.08)' : '#ffffff',
                  color:        selectedBay === b ? '#B8941F' : '#7A7068',
                  fontWeight:   selectedBay === b ? 700 : 500,
                  fontSize:     '0.82rem',
                  cursor:       'pointer',
                  transition:   'all 0.2s',
                }}
              >
                {b === 'left'  ? (he ? 'תא שמאל' : 'Left Bay')
               : b === 'right' ? (he ? 'תא ימין' : 'Right Bay')
               :                 (he ? 'כל תא' : 'Any Bay')}
              </button>
            ))}
          </div>
        </div>

        {/* ── QR Section ── */}
        <div style={{ padding:'20px 20px 0' }}>
          <div style={{
            background:   '#ffffff',
            border:       '1.5px solid rgba(212,175,55,0.2)',
            borderRadius: '20px',
            padding:      '24px',
            boxShadow:    '0 4px 24px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div>
                <h3 style={{ fontSize:'0.9rem', fontWeight:700, color:'#1A1A1A', margin:0 }}>
                  {he ? 'סרוק לפדיון' : 'Scan to Redeem'}
                </h3>
                <p style={{ fontSize:'0.75rem', color:'#7A7068', margin:'2px 0 0' }}>
                  {he ? 'קוד חד-פעמי • מאובטח' : 'One-time token • Secured'}
                </p>
              </div>
              {qrToken && (
                <CountdownRing secondsLeft={secondsLeft} total={QR_TTL} />
              )}
            </div>

            {qrToken ? (
              <div className="prestige-qr-wrap" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
                {/* QR code */}
                <div style={{
                  background:   '#ffffff',
                  padding:      '16px',
                  borderRadius: '16px',
                  border:       '1.5px solid rgba(212,175,55,0.15)',
                  boxShadow:    '0 2px 16px rgba(0,0,0,0.06)',
                }}>
                  <QRCodeSVG
                    value={qrToken.token}
                    size={200}
                    level="H"
                    imageSettings={{
                      src: prestigeLogoDiamond,
                      height: 32,
                      width: 32,
                      excavate: true,
                    }}
                  />
                </div>

                {/* Short member code */}
                <div style={{
                  background:    '#ffffff',
                  border:        '1px solid rgba(212,175,55,0.2)',
                  borderRadius:  '10px',
                  padding:       '8px 20px',
                  textAlign:     'center',
                }}>
                  <p style={{ margin:0, fontSize:'0.6rem', color:'#7A7068', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                    {he ? 'קוד חבר' : 'Member Code'}
                  </p>
                  <p style={{ margin:'2px 0 0', fontSize:'0.9rem', fontWeight:700, color:'#B8941F', fontFamily:'monospace', letterSpacing:'0.15em' }}>
                    {wallet.pass.serialNumber}
                  </p>
                </div>

                {/* Refresh button */}
                <button
                  onClick={() => { setQrToken(null); generateQr(); }}
                  style={{
                    display:    'flex', alignItems:'center', gap:'6px',
                    background: 'none', border:'none', cursor:'pointer',
                    color:'#7A7068', fontSize:'0.78rem', fontWeight:600, padding:'4px 8px',
                  }}
                >
                  <RefreshCw size={13} />
                  {he ? 'רענן קוד' : 'Refresh code'}
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', padding:'20px 0' }}>
                <div style={{
                  width:'180px', height:'180px', borderRadius:'12px',
                  background:'rgba(212,175,55,0.04)',
                  border:'2px dashed rgba(212,175,55,0.2)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px',
                }}>
                  <QrCodeIcon size={40} color="rgba(212,175,55,0.35)" />
                  <p style={{ margin:0, color:'rgba(212,175,55,0.5)', fontSize:'0.75rem', textAlign:'center' }}>
                    {he ? 'לחץ להפעלת קוד QR' : 'Tap to activate QR'}
                  </p>
                </div>
                <Button
                  onClick={generateQr}
                  disabled={isGenerating}
                  style={{
                    background: 'linear-gradient(135deg,#c9a96e,#d4af37)',
                    color:      '#fff',
                    border:     'none',
                    fontWeight: 700,
                    padding:    '12px 32px',
                    borderRadius:'12px',
                    fontSize:   '0.9rem',
                  }}
                >
                  {isGenerating ? (he ? 'מייצר...' : 'Generating…') : (he ? 'הפעל קוד QR' : 'Generate QR Code')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Online Services ── */}
        <div style={{ padding:'20px 20px 0' }}>
          <div style={{
            background:'#ffffff',
            border:'1.5px solid rgba(212,175,55,0.2)',
            borderRadius:'20px',
            padding:'20px',
            boxShadow:'0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 4px' }}>
              {he ? 'שירותים מקוונים' : 'Online Services'}
            </h3>
            <p style={{ fontSize:'0.78rem', color:'#7A7068', margin:'4px 0 14px', lineHeight:1.5 }}>
              {he
                ? 'ניתן לשלם בארנק הפרסטיז עבור שירותים מקוונים — מסרק, מוביל, מאלף ועוד.'
                : 'Use your Prestige Pass balance to pay for online bookings — grooming, transport, academy and more.'}
            </p>

            {/* Available for online use */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'#ffffff',
              border:'1px solid rgba(212,175,55,0.2)',
              borderRadius:'12px',
              padding:'14px 16px',
              marginBottom:'14px',
            }}>
              <div>
                <p style={{ margin:0, fontSize:'0.68rem', fontWeight:600, color:'#7A7068', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                  {he ? 'זמין לשימוש מקוון' : 'Available for online use'}
                </p>
                <p style={{ margin:'4px 0 0', fontSize:'1.4rem', fontWeight:800, color:'#B8941F', lineHeight:1 }}>
                  {fmt(balances.cashWalletCents + balances.egiftBalanceCents + balances.promoBalanceCents)}
                </p>
              </div>
              <div style={{ textAlign: he ? 'left' : 'right' }}>
                <p style={{ margin:0, fontSize:'0.68rem', color:'#7A7068' }}>{he ? 'כולל:' : 'Includes:'}</p>
                {balances.promoBalanceCents > 0 && (
                  <p style={{ margin:'2px 0 0', fontSize:'0.7rem', color:'#f59e0b' }}>
                    {fmt(balances.promoBalanceCents)} {he ? 'מבצע' : 'promo'}
                  </p>
                )}
                {balances.egiftBalanceCents > 0 && (
                  <p style={{ margin:'2px 0 0', fontSize:'0.7rem', color:'#D4AF37' }}>
                    {fmt(balances.egiftBalanceCents)} eGift
                  </p>
                )}
                {balances.cashWalletCents > 0 && (
                  <p style={{ margin:'2px 0 0', fontSize:'0.7rem', color:'#1A1A1A' }}>
                    {fmt(balances.cashWalletCents)} {he ? 'ארנק' : 'wallet'}
                  </p>
                )}
              </div>
            </div>

            {/* Accepted services chips */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
              {[
                { icon:'🛁', en:'Grooming',   he:'מסרק' },
                { icon:'🚐', en:'Transport',  he:'הסעות' },
                { icon:'🎓', en:'Academy',    he:'אקדמיה' },
                { icon:'🐕', en:'Walker',     he:'מטייל' },
                { icon:'🏠', en:'Sitter',     he:'מסיטר' },
              ].map((s) => (
                <div key={s.en} style={{
                  display:'flex', alignItems:'center', gap:'5px',
                  background:'rgba(212,175,55,0.06)',
                  border:'1px solid rgba(212,175,55,0.2)',
                  borderRadius:'100px',
                  padding:'5px 12px',
                  fontSize:'0.75rem',
                  fontWeight:600,
                  color:'#5A4A38',
                }}>
                  <span>{s.icon}</span>
                  <span>{he ? s.he : s.en}</span>
                </div>
              ))}
            </div>

            <p style={{ margin:'14px 0 0', fontSize:'0.7rem', color:'#B0A898', lineHeight:1.5 }}>
              {he
                ? 'הקרדיט מנוכה אוטומטית בעת ההזמנה — ראשון פג: קרדיט מבצע, אז eGift, אז ארנק.'
                : 'Balance is deducted automatically at checkout — promo first, then eGift, then wallet.'}
            </p>
          </div>
        </div>

        {/* ── Pet Profile Card ── */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            background: '#FFFFFF', border: '1.5px solid rgba(212,175,55,0.2)',
            borderRadius: '16px', padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div
              onClick={() => setPetEditOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '20px' }}>
                {walletData?.pet?.petName ? '🐾' : '➕'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1A1A1A' }}>
                  {walletData?.pet?.petName
                    ? `${walletData.pet.petName}${walletData.pet.petBreed ? ` · ${walletData.pet.petBreed}` : ''}`
                    : (he ? 'הוסף פרטי חיית מחמד' : 'Add your pet to the card')}
                </div>
                {walletData?.pet?.petNotes && (
                  <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, marginTop: '1px' }}>
                    ⚠ {walletData.pet.petNotes}
                  </div>
                )}
                {!walletData?.pet?.petName && (
                  <div style={{ fontSize: '0.7rem', color: '#9E9E9E', marginTop: '1px' }}>
                    {he ? 'מוצג על הכרטיס ולצוות' : 'Shown on card · visible to staff at scan'}
                  </div>
                )}
              </div>
              <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.8rem' }}>
                {petEditOpen ? '▲' : '▼'}
              </span>
            </div>

            {petEditOpen && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { key: 'petName',  label: he ? 'שם' : 'Pet name',    placeholder: 'e.g. Bella' },
                  { key: 'petBreed', label: he ? 'גזע' : 'Breed',       placeholder: 'e.g. Golden Retriever' },
                  { key: 'petNotes', label: he ? 'הערות לצוות' : 'Staff notes', placeholder: 'e.g. Sensitive skin — use gentle shampoo' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#9E9E9E', marginBottom: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</label>
                    <input
                      value={(petForm as any)[key]}
                      onChange={e => setPetForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        border: '1.5px solid rgba(212,175,55,0.25)', fontSize: '0.88rem',
                        outline: 'none', boxSizing: 'border-box', color: '#1A1A1A',
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#9E9E9E', marginBottom: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {he ? 'סוג' : 'Pet type'}
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['dog', 'cat', 'rabbit', 'bird', 'other'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setPetForm(f => ({ ...f, petType: t }))}
                        style={{
                          padding: '6px 12px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                          background: petForm.petType === t ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.04)',
                          outline: petForm.petType === t ? '1.5px solid #D4AF37' : '1.5px solid transparent',
                          color: petForm.petType === t ? '#B8941F' : '#7A7068',
                          fontWeight: petForm.petType === t ? 700 : 400,
                          fontSize: '0.75rem',
                        }}
                      >
                        {t === 'dog' ? '🐶' : t === 'cat' ? '🐱' : t === 'rabbit' ? '🐰' : t === 'bird' ? '🐦' : '🐾'} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  disabled={savingPet || !petForm.petName.trim()}
                  onClick={async () => {
                    setSavingPet(true);
                    try {
                      const r = await apiRequest('POST', '/api/prestige-pass/pet', petForm);
                      const d = await r.json();
                      if (d.ok) {
                        queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/wallet'] });
                        setPetEditOpen(false);
                        toast({ title: he ? '🐾 נשמר!' : '🐾 Saved!', description: he ? `${petForm.petName} נוסף לכרטיס שלך` : `${petForm.petName} added to your card` });
                      }
                    } finally { setSavingPet(false); }
                  }}
                  style={{
                    padding: '11px', borderRadius: '10px', border: 'none',
                    background: petForm.petName.trim() ? '#D4AF37' : 'rgba(212,175,55,0.3)',
                    color: '#FFFFFF', fontWeight: 700, fontSize: '0.88rem', cursor: savingPet ? 'wait' : 'pointer',
                  }}
                >
                  {savingPet ? (he ? 'שומר…' : 'Saving…') : (he ? 'שמור פרופיל חיית מחמד' : 'Save pet profile')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Smart Pass Panel ── */}
        <div style={{ padding:'24px 20px 0' }}>

          {/* K9000 Machine Activation Card */}
          {(() => {
            const K9000_MIN_CENTS = 3900; // ₪39 basic self-service wash
            const K9000_FULL_CENTS = 7900; // ₪79 premium full-service
            const shortfall = Math.max(0, K9000_MIN_CENTS - totalLiquid);
            const hasPackage = balances.packageWashesLeft > 0;
            const canWash    = hasPackage || totalLiquid >= K9000_MIN_CENTS;
            const canWashFull = hasPackage || totalLiquid >= K9000_FULL_CENTS;

            return (
              <div style={{
                background: '#ffffff',
                border: `1.5px solid ${canWash ? 'rgba(34,197,94,0.3)' : 'rgba(212,175,55,0.2)'}`,
                borderRadius: '20px',
                padding: '20px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                marginBottom: '16px',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: canWash ? 'rgba(34,197,94,0.1)' : 'rgba(212,175,55,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Droplets size={20} color={canWash ? '#22c55e' : '#D4AF37'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1A1A1A' }}>
                      {he ? 'תחנת K9000' : 'K9000 Dog Wash Station'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9E9E9E', marginTop: '1px' }}>
                      {he ? 'מכונת שטיפה אוטומטית' : 'Automated self-service kiosk'}
                    </div>
                  </div>
                  {/* Status pill */}
                  <div style={{
                    marginLeft: 'auto',
                    padding: '4px 10px',
                    borderRadius: '100px',
                    background: canWash ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${canWash ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: canWash ? '#16a34a' : '#dc2626' }}>
                      {canWash ? (he ? '✓ מוכן' : '✓ Ready') : (he ? '✗ אין מספיק' : '✗ Insufficient')}
                    </span>
                  </div>
                </div>

                {/* Balance vs price */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '8px', marginBottom: '14px',
                }}>
                  <div style={{
                    background: '#ffffff', borderRadius: '10px', padding: '10px 12px',
                    border: '1px solid rgba(212,175,55,0.15)',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: '#9E9E9E', fontWeight: 600, marginBottom: '2px' }}>
                      {he ? 'יתרה זמינה' : 'Your Balance'}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: canWash ? '#16a34a' : '#dc2626' }}>
                      {hasPackage
                        ? `${balances.packageWashesLeft} ${he ? 'שטיפות' : 'washes'}`
                        : `₪${(totalLiquid / 100).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
                    </div>
                  </div>
                  <div style={{
                    background: '#ffffff', borderRadius: '10px', padding: '10px 12px',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: '#9E9E9E', fontWeight: 600, marginBottom: '2px' }}>
                      {he ? 'מחיר שטיפה' : 'Wash Price'}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1A1A' }}>
                      {he ? 'מ-₪39' : 'from ₪39'}
                    </div>
                  </div>
                </div>

                {canWash ? (
                  /* CAN WASH — prompt them to scan */
                  <div style={{
                    background: 'rgba(34,197,94,0.06)', borderRadius: '12px', padding: '12px 14px',
                    border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <CheckCircle size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                        {hasPackage
                          ? (he ? 'יש לך חבילת שטיפות — סרוק את קוד ה-QR למעלה' : 'Package wash ready — scan QR above to start machine')
                          : canWashFull
                            ? (he ? 'יתרה מלאה — סרוק את קוד ה-QR למעלה להפעלה' : 'Full balance — scan QR above to activate any wash')
                            : (he ? 'יתרה לשטיפה בסיסית — סרוק QR למעלה' : 'Balance covers basic wash — scan QR above to activate')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9E9E9E', marginTop: '2px' }}>
                        {he ? 'הקוד תקף 45 שניות • ניכוי אוטומטי בסיום' : '45-second token • auto-deducted on completion'}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* CANNOT WASH — show 3 options */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{
                      background: 'rgba(239,68,68,0.05)', borderRadius: '10px', padding: '10px 12px',
                      border: '1px solid rgba(239,68,68,0.15)', marginBottom: '4px',
                    }}>
                      <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                        {he
                          ? `חסרים ₪${(shortfall / 100).toFixed(0)} להפעלת מכונה דרך הכרטיס`
                          : `₪${(shortfall / 100).toFixed(0)} short to activate machine via pass`}
                      </span>
                    </div>

                    {/* Option 1: Top Up */}
                    <button
                      onClick={() => setShowTopUpDialog(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: 'rgba(212,175,55,0.08)', border: '1.5px solid rgba(212,175,55,0.3)',
                        borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <ArrowUpCircle size={18} color="#D4AF37" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#B8941F' }}>
                          {he ? `טען ₪${(shortfall / 100).toFixed(0)} ויותר` : `Top up ₪${(shortfall / 100).toFixed(0)}+`}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#9E9E9E' }}>
                          {he ? 'הוסף כסף לארנק הפרסטיז שלך' : 'Add credit to your Prestige wallet'}
                        </div>
                      </div>
                      <ChevronRight size={16} color="#D4AF37" style={{ marginLeft: 'auto' }} />
                    </button>

                    {/* Option 2: Pay at Nayax Terminal */}
                    <button
                      onClick={() => toast({
                        title: he ? 'תשלום בטרמינל Nayax' : 'Pay at Nayax Terminal',
                        description: he
                          ? 'הניח כרטיס אשראי, Apple Pay או Google Pay ישירות על קורא הכרטיסים שבמכונה.'
                          : 'Tap your card, Apple Pay, or Google Pay directly on the machine\'s card reader.',
                      })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: '#ffffff', border: '1.5px solid rgba(0,0,0,0.1)',
                        borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <Monitor size={18} color="#1A1A1A" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A1A1A' }}>
                          {he ? 'שלם ישירות בטרמינל Nayax' : 'Pay at Nayax terminal'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#9E9E9E' }}>
                          {he ? 'Apple Pay • Google Pay • כרטיס אשראי' : 'Apple Pay • Google Pay • Credit card'}
                        </div>
                      </div>
                      <ChevronRight size={16} color="#9E9E9E" style={{ marginLeft: 'auto' }} />
                    </button>

                    {/* Option 3: Buy Wash Package */}
                    <button
                      onClick={() => setShowTopUpDialog(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: '#ffffff', border: '1.5px solid rgba(0,0,0,0.1)',
                        borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <Package size={18} color="#8b5cf6" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A1A1A' }}>
                          {he ? 'רכוש חבילת שטיפות' : 'Buy wash package'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#9E9E9E' }}>
                          {he ? '3 שטיפות ב-₪99 • 5 שטיפות ב-₪149' : '3 washes ₪99 • 5 washes ₪149'}
                        </div>
                      </div>
                      <ChevronRight size={16} color="#9E9E9E" style={{ marginLeft: 'auto' }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Online Service Booking Panel */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid rgba(212,175,55,0.2)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7A7068', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>
              {he ? 'הזמן שירות עם הכרטיס' : 'Book a service with your pass'}
            </h3>

            {(() => {
              const services = [
                {
                  id: 'sitter',
                  icon: <Home size={18} />,
                  label:   { en: 'Pet Sitter / Boarding', he: 'פנסיון ומטפל לחיות' },
                  detail:  { en: 'Overnight care from ₪80/night', he: 'טיפול לילי מ-₪80/לילה' },
                  fromCents: 8000,
                  path: '/sitter-suite',
                  color: '#8b5cf6',
                },
                {
                  id: 'walker',
                  icon: <MapPin size={18} />,
                  label:   { en: 'Dog Walker', he: 'מטייל כלבים' },
                  detail:  { en: 'Walks from ₪65/session', he: 'טיולים מ-₪65 לטיול' },
                  fromCents: 6500,
                  path: '/walk-my-pet',
                  color: '#0ea5e9',
                },
                {
                  id: 'academy',
                  icon: <BookOpen size={18} />,
                  label:   { en: 'Academy — Training', he: 'אקדמיה — אימון' },
                  detail:  { en: 'Courses from ₪200', he: 'קורסים מ-₪200' },
                  fromCents: 20000,
                  path: '/academy',
                  color: '#f59e0b',
                },
              ];

              return services.map((svc) => {
                const canBook   = totalLiquid >= svc.fromCents;
                const partial   = totalLiquid > 0 && !canBook;
                const shortfall = Math.max(0, svc.fromCents - totalLiquid);
                const shortILS  = (shortfall / 100).toFixed(0);

                return (
                  <div
                    key={svc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '13px 0',
                      borderBottom: '1px solid rgba(212,175,55,0.08)',
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '9px',
                      background: `${svc.color}14`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      color: svc.color,
                    }}>
                      {svc.icon}
                    </div>

                    {/* Label + detail */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A1A1A' }}>
                        {he ? svc.label.he : svc.label.en}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9E9E9E', marginTop: '1px' }}>
                        {he ? svc.detail.he : svc.detail.en}
                      </div>
                      {/* Status line */}
                      {canBook ? (
                        <div style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 600, marginTop: '3px' }}>
                          {he ? '✓ ניתן להזמין עם יתרה' : '✓ Covered by your pass balance'}
                        </div>
                      ) : partial ? (
                        <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600, marginTop: '3px' }}>
                          {he
                            ? `⚠ חסרים ₪${shortILS} — הפרש יחויב מכרטיס`
                            : `⚠ ₪${shortILS} short — remainder charged to card`}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 600, marginTop: '3px' }}>
                          {he ? '✗ אין יתרה — יש לטעון כרטיס' : '✗ No balance — top up to book with pass'}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <button
                      onClick={() => navigate(svc.path)}
                      style={{
                        flexShrink: 0,
                        padding: '8px 14px',
                        borderRadius: '100px',
                        border: canBook
                          ? '1.5px solid rgba(34,197,94,0.4)'
                          : partial
                            ? '1.5px solid rgba(245,158,11,0.4)'
                            : '1.5px solid rgba(212,175,55,0.3)',
                        background: canBook
                          ? 'rgba(34,197,94,0.08)'
                          : partial
                            ? 'rgba(245,158,11,0.06)'
                            : 'rgba(212,175,55,0.05)',
                        color: canBook ? '#16a34a' : partial ? '#d97706' : '#B8941F',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {canBook
                        ? (he ? 'הזמן' : 'Book')
                        : partial
                          ? (he ? 'הזמן →' : 'Book →')
                          : (he ? 'טעינה' : 'Top Up')}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                );
              });
            })()}

            {/* Footnote: how partial payment works */}
            <div style={{
              marginTop: '12px', padding: '10px 12px',
              background: '#ffffff',
              borderRadius: '10px', border: '1px solid rgba(212,175,55,0.15)',
            }}>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#9E9E9E', lineHeight: 1.5 }}>
                <strong style={{ color: '#B8941F' }}>{he ? 'איך עובד: ' : 'How it works: '}</strong>
                {he
                  ? 'יתרת הכרטיס מנוכה קודם. הפרש (אם יש) יחויב מכרטיס אשראי מקושר. K9000 דורש כיסוי מלא מהכרטיס — אחרת שלם ב-Nayax.'
                  : 'Pass balance is deducted first. Any remainder is charged to your linked card. K9000 requires full pass coverage — otherwise pay at the Nayax terminal.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Balances ── */}
        <div style={{ padding:'24px 20px 0' }}>
          <div style={{
            background:'#ffffff',
            border:'1.5px solid rgba(212,175,55,0.2)',
            borderRadius:'20px',
            padding:'20px',
            boxShadow:'0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 4px' }}>
              {he ? 'יתרות' : 'Balances'}
            </h3>
            <div style={{ marginTop:'8px' }}>
              <BalanceRow
                icon={<Wallet size={16} />}
                label={he ? 'ארנק מזומן' : 'Cash Wallet'}
                value={fmt(balances.cashWalletCents)}
                color="#1A1A1A"
              />
              <BalanceRow
                icon={<Gift size={16} />}
                label={he ? 'יתרת מתנה (eGift)' : 'eGift Balance'}
                value={fmt(balances.egiftBalanceCents)}
                color="#D4AF37"
              />
              <BalanceRow
                icon={<Zap size={16} />}
                label={he ? 'קרדיט מבצע' : 'Promo Credit'}
                value={fmt(balances.promoBalanceCents)}
                color="#f59e0b"
              />
              <BalanceRow
                icon={<CreditCard size={16} />}
                label={he ? 'חבילת שטיפות' : 'Package Washes'}
                value={balances.packageWashesLeft > 0 ? `${balances.packageWashesLeft} ${he ? 'שטיפות' : 'washes'}` : '—'}
                color="#22c55e"
              />
              <BalanceRow
                icon={<Star size={16} />}
                label={he ? 'נקודות נאמנות' : 'Loyalty Points'}
                value={balances.loyaltyPoints.toLocaleString()}
                color="#8b5cf6"
              />
              {balances.referralBalanceCents > 0 && (
                <BalanceRow
                  icon={<CheckCircle size={16} />}
                  label={he ? 'קרדיט הפניה' : 'Referral Credit'}
                  value={fmt(balances.referralBalanceCents)}
                  color="#06b6d4"
                />
              )}
            </div>

            {/* Redemption order note */}
            <div style={{
              marginTop:'12px', padding:'10px 14px',
              background:'#ffffff',
              borderRadius:'10px',
              border:'1px solid rgba(212,175,55,0.15)',
            }}>
              <p style={{ margin:0, fontSize:'0.72rem', color:'#7A7068', lineHeight:1.5 }}>
                <strong style={{ color:'#B8941F' }}>{he ? 'סדר מימוש: ' : 'Redemption order: '}</strong>
                {he
                  ? 'קרדיט מבצע → eGift → חבילה → ארנק → כרטיס'
                  : 'Promo → eGift → Package → Wallet → Card'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Add to Wallet ── */}
        <div style={{ padding:'20px 20px 0' }}>
          <div style={{
            background:'#ffffff',
            border:'1.5px solid rgba(212,175,55,0.2)',
            borderRadius:'20px',
            padding:'20px',
            boxShadow:'0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 14px' }}>
              {he ? 'הוסף לארנק הנייד' : 'Add to Mobile Wallet'}
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {/* Apple Wallet */}
              <button
                onClick={() => {
                  toast({
                    title: he ? 'Apple Wallet' : 'Apple Wallet',
                    description: he ? 'הכרטיס מוכן — נדרש אישור Apple Developer לחתימה.' : 'Pass ready — Apple Developer cert required to activate.',
                  });
                }}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                  background:'#000000',
                  color:'#ffffff',
                  border:'none',
                  borderRadius:'12px',
                  padding:'14px 20px',
                  fontWeight:700,
                  fontSize:'0.9rem',
                  cursor:'pointer',
                }}
              >
                <AppleIcon />
                {he ? 'הוסף ל-Apple Wallet' : 'Add to Apple Wallet'}
              </button>

              {/* Google Wallet */}
              <button
                onClick={() => {
                  toast({
                    title: he ? 'Google Wallet' : 'Google Wallet',
                    description: he ? 'מחבר ל-Google Wallet...' : 'Connecting to Google Wallet…',
                  });
                }}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                  background:'#1a73e8',
                  color:'#ffffff',
                  border:'none',
                  borderRadius:'12px',
                  padding:'14px 20px',
                  fontWeight:700,
                  fontSize:'0.9rem',
                  cursor:'pointer',
                }}
              >
                <GoogleIcon />
                {he ? 'הוסף ל-Google Wallet' : 'Add to Google Wallet'}
              </button>

              {/* Send to Email — Google + Apple buttons in email body */}
              <button
                onClick={() => resendEmailMutation.mutate()}
                disabled={resendEmailMutation.isPending}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                  background:'transparent',
                  color:'#D4AF37',
                  border:'1.5px solid rgba(212,175,55,0.5)',
                  borderRadius:'12px',
                  padding:'13px 20px',
                  fontWeight:700,
                  fontSize:'0.9rem',
                  cursor: resendEmailMutation.isPending ? 'wait' : 'pointer',
                  opacity: resendEmailMutation.isPending ? 0.7 : 1,
                }}
              >
                {resendEmailMutation.isPending ? '...' : '✉'}
                {he
                  ? (resendEmailMutation.isPending ? 'שולח...' : 'שלח לי למייל (עם כפתורי Wallet)')
                  : (resendEmailMutation.isPending ? 'Sending…' : 'Email me wallet links')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Recent History ── */}
        {events.length > 0 && (
          <div style={{ padding:'20px 20px 0' }}>
            <div style={{
              background:'#ffffff',
              border:'1.5px solid rgba(212,175,55,0.2)',
              borderRadius:'20px',
              padding:'20px',
              boxShadow:'0 4px 24px rgba(0,0,0,0.04)',
            }}>
              <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'#7A7068', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px' }}>
                {he ? 'פעילות אחרונה' : 'Recent Activity'}
              </h3>
              {events.map((e, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i < events.length-1 ? '1px solid rgba(212,175,55,0.07)' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <Clock size={14} color="#D4AF37" />
                    <div>
                      <p style={{ margin:0, fontSize:'0.82rem', fontWeight:600, color:'#1A1A1A' }}>
                        {e.creditType === 'wash_package'  ? (he ? 'שטיפה' : 'Wash')
                         : e.creditType === 'egift'        ? 'eGift'
                         : e.creditType === 'promo_credit' ? (he ? 'קרדיט מבצע' : 'Promo')
                         : e.creditType === 'online_redeem' ? (he ? 'שירות מקוון' : 'Online Service')
                         : e.creditType === 'referral_credit' ? (he ? 'הפניה' : 'Referral')
                         : (he ? 'עסקה' : 'Transaction')}
                      </p>
                      <p style={{ margin:0, fontSize:'0.7rem', color:'#7A7068' }}>
                        {new Date(e.createdAt).toLocaleDateString(he ? 'he-IL' : 'en-US')}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize:'0.88rem', fontWeight:700, color: (e.amountCents || 0) < 0 ? '#ef4444' : '#22c55e' }}>
                    {(e.amountCents || 0) < 0
                      ? fmt(Math.abs(e.amountCents))
                      : e.amountUnits ? `${Math.abs(e.amountUnits)} ${he ? 'שטיפות' : 'wash'}`
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Security footer ── */}
        <div style={{ padding:'20px', textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginBottom:'4px' }}>
            <Shield size={12} color="#D4AF37" />
            <span style={{ fontSize:'0.7rem', color:'#7A7068', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>
              {he ? 'אבטחה ברמת תעשייה' : 'Industry-Grade Security'}
            </span>
          </div>
          <p style={{ fontSize:'0.68rem', color:'#B0A898', margin:0 }}>
            {he
              ? 'קוד QR חתום דיגיטלית • חד-פעמי • מוגן מפני שחזור'
              : 'Digitally signed QR • One-time use • Anti-replay protected'}
          </p>
        </div>
      </div>

      {/* ── Top-Up / Wash Package Dialog ──────────────────────────────── */}
      {showTopUpDialog && (
        <div
          onClick={() => setShowTopUpDialog(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9200,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '20px 20px 0 0',
              padding: '28px 24px 40px', width: '100%', maxWidth: '480px',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
            }}
          >
            {/* Drag handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ddd', margin: '0 auto 20px' }} />

            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 6, textAlign: he ? 'right' : 'left' }}>
              {he ? 'טעינת ארנק פרסטיז׳' : 'Top Up Prestige Pass'}
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#666', marginBottom: 20, textAlign: he ? 'right' : 'left' }}>
              {he
                ? 'בחרו כמה תרצו לטעון — נציג שלנו יאשר את הטעינה תוך דקות.'
                : 'Choose an amount — our team confirms the credit within minutes.'}
            </p>

            {/* Amount tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[{ ils: 50, label: he ? '₪50' : '₪50' }, { ils: 100, label: he ? '₪100' : '₪100' }, { ils: 200, label: he ? '₪200' : '₪200', hot: true }, { ils: 300, label: '₪300' }, { ils: 500, label: '₪500' }, { ils: 1000, label: '₪1,000' }].map(opt => (
                <a
                  key={opt.ils}
                  href={`https://wa.me/972543060770?text=${encodeURIComponent(he ? `שלום, אני רוצה לטעון ₪${opt.ils} לארנק פרסטיז׳ שלי` : `Hi, I'd like to top up my Prestige Pass with ₪${opt.ils}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: opt.hot ? '2px solid #C5A55A' : '1.5px solid #e5e7eb',
                    borderRadius: 12, padding: '12px 8px', textDecoration: 'none',
                    background: opt.hot ? 'rgba(197,165,90,0.07)' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a' }}>{opt.label}</span>
                  {opt.hot && <span style={{ fontSize: '0.65rem', color: '#C5A55A', fontWeight: 700, marginTop: 2 }}>{he ? 'פופולרי' : 'Popular'}</span>}
                </a>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <a
              href={`https://wa.me/972543060770?text=${encodeURIComponent(he ? 'שלום, אני רוצה לטעון את ארנק פרסטיז׳ שלי' : "Hi, I'd like to top up my Prestige Pass")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: '#25D366', borderRadius: 12, padding: '14px',
                color: '#fff', fontWeight: 700, fontSize: '0.97rem',
                textDecoration: 'none', marginBottom: 12,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {he ? 'צור קשר בוואטסאפ לטעינה' : 'Chat on WhatsApp to Top Up'}
            </a>

            {/* Phone */}
            <a
              href="tel:+972543060770"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '12px',
                color: '#444', fontWeight: 600, fontSize: '0.92rem',
                textDecoration: 'none', marginBottom: 16,
              }}
            >
              {he ? '📞 התקשרו: 054-306-0770' : '📞 Call: 054-306-0770'}
            </a>

            <button
              onClick={() => setShowTopUpDialog(false)}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 12,
                background: '#f3f4f6', color: '#666', fontWeight: 600, fontSize: '0.92rem',
                cursor: 'pointer',
              }}
            >
              {he ? 'סגור' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── Inline icon components ────────────────────────────────────────────────────
function QrCodeIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/><rect x="19" y="19" width="2" height="2"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
