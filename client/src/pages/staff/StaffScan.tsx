import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Scan, User, CheckCircle, AlertCircle, CreditCard, Loader2, RotateCcw } from 'lucide-react';

// ─── Service catalogue with ILS prices ───────────────────────────────────────
const SERVICES = [
  { id: 'full_wash',  label: 'Full Wash',      labelHe: 'שטיפה מלאה',   price: 15000, color: '#0ea5e9' },
  { id: 'quick_wash', label: 'Quick Wash',     labelHe: 'שטיפה מהירה',  price: 9000,  color: '#22c55e' },
  { id: 'grooming',   label: 'Grooming',       labelHe: 'טיפוח',        price: 22000, color: '#8b5cf6' },
  { id: 'academy',    label: 'Academy Session',labelHe: 'אימון אקדמיה', price: 25000, color: '#f59e0b' },
  { id: 'vet',        label: 'Vet Visit',      labelHe: 'ביקור וטרינר', price: 30000, color: '#ef4444' },
  { id: 'retail',     label: 'Retail / Store', labelHe: 'חנות',         price: 0,     color: '#6b7280', custom: true },
] as const;

const PET_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', rabbit: '🐰', bird: '🐦', other: '🐾' };
const fmt = (cents: number) => `₪${(cents / 100).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

interface Profile {
  customer: { displayName: string; tier: string; cardId: string; serialNumber: string };
  pet: { petName: string | null; petType: string | null; petBreed: string | null; petNotes: string | null };
  balances: { totalLiquidCents: number; cashWalletCents: number; egiftCents: number; packageWashes: number; loyaltyPoints: number };
}

export default function StaffScan() {
  const { toast } = useToast();
  const inputRef    = useRef<HTMLInputElement>(null);
  const [input,     setInput]     = useState('');
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [charging,  setCharging]  = useState(false);
  const [charged,   setCharged]   = useState<{ service: string; amount: number; newBalance: number } | null>(null);
  const [customAmt, setCustomAmt] = useState('');
  const [selectedSvc, setSelectedSvc] = useState<string | null>(null);

  // Autofocus scanner input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Handle QR scan (keyboard-emulated scanner sends Enter after card ID)
  const handleScan = async (raw: string) => {
    const cardId = raw.replace(/^petwash:\/\/card\//i, '').trim().toUpperCase();
    if (!cardId) return;

    setLoading(true);
    setProfile(null);
    setCharged(null);
    setSelectedSvc(null);

    try {
      const res  = await apiRequest('POST', '/api/prestige-pass/staff/lookup', { cardId });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Card not found');
      setProfile(data);
    } catch (e: any) {
      toast({ title: 'Card not found', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleScan(input);
  };

  const handleCharge = async (svcId: string, amountCents: number) => {
    if (!profile) return;
    if (amountCents <= 0) { toast({ title: 'Enter an amount', variant: 'destructive' }); return; }
    if (profile.balances.totalLiquidCents < amountCents) {
      toast({ title: 'Insufficient balance', description: `Card has ${fmt(profile.balances.totalLiquidCents)}, service costs ${fmt(amountCents)}`, variant: 'destructive' });
      return;
    }

    setCharging(true);
    try {
      const res  = await apiRequest('POST', '/api/prestige-pass/staff/charge', {
        cardId:      profile.customer.cardId,
        serviceType: svcId,
        amountCents,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Charge failed');

      const svc = SERVICES.find(s => s.id === svcId);
      setCharged({ service: svc?.label ?? svcId, amount: amountCents, newBalance: data.newBalanceCents });

      // Update profile balance locally
      setProfile(p => p ? {
        ...p,
        balances: { ...p.balances, totalLiquidCents: data.newBalanceCents },
      } : p);
    } catch (e: any) {
      toast({ title: 'Charge failed', description: e.message, variant: 'destructive' });
    } finally {
      setCharging(false);
      setSelectedSvc(null);
      setCustomAmt('');
    }
  };

  return (
    <Layout>
      <div style={{ background: '#FFFFFF', minHeight: '100vh', paddingBottom: '40px' }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)',
          padding: '32px 20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scan size={22} color="#D4AF37" />
            </div>
            <div>
              <div style={{ color: '#D4AF37', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>Staff POS</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>PetWash™ Prestige Card Scanner</div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 20px 0' }}>

          {/* ── Scanner Input ── */}
          <div style={{
            background: '#FFFFFF', border: '2px solid rgba(212,175,55,0.3)', borderRadius: '16px',
            padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '20px',
          }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 700, color: '#7A7068', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Scan Card QR or Enter ID
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="PW-45872043  or scan with QR reader…"
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: '10px',
                  border: '1.5px solid rgba(212,175,55,0.3)', fontSize: '0.9rem',
                  fontFamily: 'monospace', outline: 'none', color: '#1A1A1A',
                  background: '#ffffff',
                }}
              />
              <button
                onClick={() => handleScan(input)}
                disabled={loading || !input}
                style={{
                  padding: '12px 18px', borderRadius: '10px', border: 'none',
                  background: '#D4AF37', color: '#FFFFFF', fontWeight: 700,
                  fontSize: '0.85rem', cursor: loading ? 'wait' : 'pointer',
                  opacity: !input ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {loading ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Scan size={16} />}
                {loading ? '' : 'Look up'}
              </button>
            </div>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#9E9E9E' }}>
              <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Looking up card…</p>
            </div>
          )}

          {/* ── Success charge banner ── */}
          {charged && (
            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.3)',
              borderRadius: '14px', padding: '16px 18px', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <CheckCircle size={28} color="#16a34a" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#16a34a' }}>
                  {charged.service} — {fmt(charged.amount)} charged ✓
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9E9E9E', marginTop: '2px' }}>
                  New card balance: {fmt(charged.newBalance)}
                </div>
              </div>
              <button onClick={() => setCharged(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9E9E9E', fontSize: '18px' }}>×</button>
            </div>
          )}

          {/* ── Customer Profile Card ── */}
          {profile && (
            <>
              <div style={{
                background: '#FFFFFF', border: '1.5px solid rgba(212,175,55,0.25)',
                borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '16px',
              }}>
                {/* Customer header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #D4AF37, #C6A35B)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px',
                  }}>
                    <User size={26} color="#FFFFFF" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A1A1A' }}>
                      {profile.customer.displayName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9E9E9E', marginTop: '2px' }}>
                      {profile.customer.cardId} · {profile.customer.tier.charAt(0).toUpperCase() + profile.customer.tier.slice(1)} member
                    </div>
                  </div>
                </div>

                {/* Pet profile */}
                {profile.pet.petName && (
                  <div style={{
                    background: 'rgba(212,175,55,0.06)', borderRadius: '12px', padding: '12px 14px',
                    border: '1px solid rgba(212,175,55,0.15)', marginBottom: '14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '22px' }}>{PET_EMOJI[profile.pet.petType ?? 'dog'] ?? '🐾'}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1A1A1A' }}>
                          {profile.pet.petName}
                          {profile.pet.petBreed && <span style={{ fontWeight: 400, color: '#9E9E9E' }}> · {profile.pet.petBreed}</span>}
                        </div>
                        {profile.pet.petNotes && (
                          <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                            ⚠ {profile.pet.petNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Balance row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Total Balance', value: fmt(profile.balances.totalLiquidCents), color: '#1A1A1A', big: true },
                    { label: 'Package Washes', value: `${profile.balances.packageWashes}`, color: '#22c55e' },
                    { label: 'Loyalty Pts', value: profile.balances.loyaltyPoints.toLocaleString(), color: '#8b5cf6' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'rgba(0,0,0,0.02)', borderRadius: '10px', padding: '10px 10px',
                      border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6rem', color: '#9E9E9E', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ fontWeight: 800, fontSize: item.big ? '1.2rem' : '0.95rem', color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Service Buttons ── */}
              <div style={{
                background: '#FFFFFF', border: '1.5px solid rgba(212,175,55,0.2)',
                borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              }}>
                <p style={{ margin: '0 0 14px', fontSize: '0.78rem', fontWeight: 700, color: '#7A7068', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Charge Service
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {SERVICES.map(svc => {
                    const canCharge = svc.custom
                      ? (parseInt(customAmt) * 100 || 0) <= profile.balances.totalLiquidCents
                      : profile.balances.totalLiquidCents >= svc.price;
                    const isSelected = selectedSvc === svc.id;

                    return (
                      <div key={svc.id}>
                        <button
                          onClick={() => setSelectedSvc(isSelected ? null : svc.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '13px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: isSelected ? `${svc.color}14` : 'rgba(0,0,0,0.02)',
                            outline: isSelected ? `2px solid ${svc.color}50` : 'none',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: svc.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1A1A1A' }}>{svc.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {!svc.custom && (
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: canCharge ? svc.color : '#dc2626' }}>
                                {fmt(svc.price)}
                              </span>
                            )}
                            {!canCharge && !svc.custom && (
                              <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 600 }}>Insufficient</span>
                            )}
                          </div>
                        </button>

                        {/* Confirmation row */}
                        {isSelected && (
                          <div style={{
                            background: 'rgba(212,175,55,0.06)', borderRadius: '0 0 12px 12px',
                            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                            border: `1px solid ${svc.color}30`, borderTop: 'none',
                          }}>
                            {svc.custom ? (
                              <>
                                <span style={{ fontSize: '0.82rem', color: '#9E9E9E', fontWeight: 600 }}>₪</span>
                                <input
                                  type="number" min="1" max="5000"
                                  value={customAmt}
                                  onChange={e => setCustomAmt(e.target.value)}
                                  placeholder="Enter amount"
                                  style={{
                                    flex: 1, padding: '8px 10px', borderRadius: '8px',
                                    border: '1.5px solid rgba(212,175,55,0.3)', fontSize: '0.9rem',
                                    outline: 'none', fontFamily: 'monospace',
                                  }}
                                />
                              </>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#7A7068', flex: 1 }}>
                                Charge {fmt(svc.price)} to {profile.customer.displayName}?
                              </span>
                            )}
                            <button
                              disabled={charging || (!svc.custom && !canCharge) || (svc.custom && !customAmt)}
                              onClick={() => {
                                const amt = svc.custom ? parseInt(customAmt) * 100 : svc.price;
                                handleCharge(svc.id, amt);
                              }}
                              style={{
                                padding: '8px 16px', borderRadius: '8px', border: 'none',
                                background: canCharge ? svc.color : '#9E9E9E',
                                color: '#FFFFFF', fontWeight: 700, fontSize: '0.82rem',
                                cursor: charging ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                opacity: charging ? 0.7 : 1,
                              }}
                            >
                              {charging
                                ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                                : <CheckCircle size={14} />}
                              {charging ? 'Charging…' : 'Confirm'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Reset ── */}
              <button
                onClick={() => { setProfile(null); setCharged(null); inputRef.current?.focus(); }}
                style={{
                  width: '100%', marginTop: '14px', padding: '12px',
                  background: 'none', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: '12px',
                  color: '#9E9E9E', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <RotateCcw size={14} /> Scan another card
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}
