import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, RefreshCw, Wallet, ChevronLeft, ChevronRight, CreditCard, Zap, Gift, Star, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import prestigeCardBlack from '@assets/prestige-card-black.png';
import prestigeCardGold from '@assets/prestige-card-gold.png';
import prestigeLogoDiamond from '@assets/prestige-logo-diamond.png';

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

  const [selectedBay, setSelectedBay] = useState<'left' | 'right' | 'any'>('any');
  const [qrToken, setQrToken]         = useState<QrToken | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL);
  const [isGenerating, setIsGenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch wallet state
  const { data: walletData, isLoading, error } = useQuery<{ ok: boolean; pass: WalletData['pass']; balances: WalletData['balances'] }>({
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
    return (
      <Layout>
        <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#ffffff', padding:'2rem' }}>
          <div style={{ textAlign:'center', maxWidth:'320px' }}>
            <AlertCircle size={48} color="#ef4444" style={{ margin:'0 auto 16px' }} />
            <p style={{ color:'#3A3228', fontWeight:600, marginBottom:'8px' }}>
              {he ? 'נדרשת התחברות' : 'Sign in required'}
            </p>
            <p style={{ color:'#7A7068', fontSize:'0.85rem' }}>
              {he ? 'יש להתחבר כדי לגשת לכרטיס הפרסטיז.' : 'Please sign in to access your Prestige Pass.'}
            </p>
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
          background:   cs.bg,
          padding:      '40px 20px 100px',
          textAlign:    'center',
          position:     'relative',
          overflow:     'hidden',
        }}>
          <div style={{ position:'absolute', inset:0, background:cs.shine, pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:cs.badge }} />

          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', marginBottom:'6px', position:'relative' }}>
            <Shield size={14} color={cs.accent} />
            <span style={{ color:cs.sub, fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase' }}>
              {he ? 'כרטיס פרסטיז רשמי' : 'Official Prestige Pass'}
            </span>
          </div>
          <h1 style={{ color:cs.text, fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.02em', margin:0, position:'relative' }}>
            PetWash <span style={{ color:cs.accent }}>Prestige</span>
          </h1>
        </div>

        {/* ── Floating card ── */}
        <div style={{ padding:'0 20px', marginTop:'-80px', position:'relative', zIndex:10 }}>
          <LuxuryCard wallet={wallet} language={language} />
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
                  background:    'rgba(212,175,55,0.05)',
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
              background:'rgba(212,175,55,0.05)',
              border:'1px solid rgba(212,175,55,0.15)',
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
              background:'rgba(212,175,55,0.05)',
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
