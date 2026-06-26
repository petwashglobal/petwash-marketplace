/**
 * BookingContact — the luxury "Get in touch" booking-request screen.
 *
 * The customer's booking-intent moment (Mad-Paws-class, PetWash white/gold):
 * provider mini-card → choose service mode → location → dates → pick pet(s) →
 * brief message → (country-aware phone if missing) → "Send booking request".
 *
 * CONTACT-FIRST, NO PAYMENT. This posts a booking *request* to the canonical
 * `/api/ln` engine (server `booking-requests`) where the provider accepts BEFORE
 * any charge — hence the reassurance "You won't be asked to pay yet." Money is
 * never touched here; pricing/payment happen later on acceptance.
 *
 * providerId for /api/ln = the provider's Firebase UID (provider.userId), the
 * same id SitterDetail/WalkerDetail use to enter this engine.
 *
 * Brand: PURE WHITE + black + metallic gold (#D4AF37). No cream/teal/purple.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useProviderDetails } from '@/services/marketplace';
import { PhoneInput, isValidE164 } from '@/components/PhoneInput';
import { apiRequest } from '@/lib/queryClient';
import {
  ArrowLeft, X, Star, MapPin, Home, House, Sun, DoorOpen, Dog,
  CalendarDays, Check, ShieldCheck, PlusCircle, Lock,
} from 'lucide-react';
import type { MarketplacePlatformId } from '@shared/schema';

const GOLD = '#D4AF37';

type ServiceMode = {
  key: string;
  serviceType: 'pet_sitting' | 'dog_walking' | 'daycare';
  modeTag: string;               // fine-grained mode carried in specialRequirements
  labelEn: string; labelHe: string;
  subEn: string; subHe: string;
  unitEn: string; unitHe: string;
  ranged: boolean;               // multi-day (true) vs single-day/hourly (false)
  Icon: typeof Home;
};

// The five Mad-Paws-style modes, mapped onto our enum (Hosting/Sitting/House
// visits → pet_sitting; Day care → daycare; Dog walks → dog_walking).
const SITTER_MODES: ServiceMode[] = [
  { key: 'hosting', serviceType: 'pet_sitting', modeTag: 'hosting', labelEn: 'Hosting', labelHe: 'אירוח', subEn: "At sitter's home", subHe: 'בבית המטפל/ת', unitEn: 'night', unitHe: 'ללילה', ranged: true, Icon: House },
  { key: 'sitting', serviceType: 'pet_sitting', modeTag: 'home_sitting', labelEn: 'Sitting', labelHe: 'שמירה בביתך', subEn: 'Sitter stays at your home', subHe: 'המטפל/ת נשאר/ת בביתך', unitEn: 'night', unitHe: 'ללילה', ranged: true, Icon: Home },
  { key: 'daycare', serviceType: 'daycare', modeTag: 'daycare', labelEn: 'Day care', labelHe: 'פנסיון יומי', subEn: 'Care during the day', subHe: 'טיפול במהלך היום', unitEn: 'day', unitHe: 'ליום', ranged: true, Icon: Sun },
  { key: 'visits', serviceType: 'pet_sitting', modeTag: 'drop_in', labelEn: 'House visits', labelHe: 'ביקורי בית', subEn: 'Drop-in to check on your pet', subHe: 'ביקור קצר לבדיקת החיה', unitEn: 'visit', unitHe: 'לביקור', ranged: false, Icon: DoorOpen },
];
const WALKER_MODES: ServiceMode[] = [
  { key: 'walk', serviceType: 'dog_walking', modeTag: 'walk', labelEn: 'Dog walks', labelHe: 'טיולי כלבים', subEn: 'Exercise your dog', subHe: 'הוצאת הכלב לטיול', unitEn: 'walk', unitHe: 'לטיול', ranged: false, Icon: Dog },
];

function todayISO() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
}

export default function BookingContact() {
  const { platform, id } = useParams<{ platform: MarketplacePlatformId; id: string }>();
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const qpService = params.get('service') || '';
  const qpStart = params.get('start') || '';
  const qpEnd = params.get('end') || '';

  const { data, isLoading, error } = useProviderDetails(platform!, id!);
  const provider: any = data?.provider;

  const modes = useMemo<ServiceMode[]>(
    () => (platform === 'walk_my_pet' ? WALKER_MODES : SITTER_MODES),
    [platform],
  );
  const [modeKey, setModeKey] = useState<string>(() => {
    const fromQp = (platform === 'walk_my_pet' ? WALKER_MODES : SITTER_MODES)
      .find((m) => m.key === qpService || m.serviceType === qpService);
    return fromQp?.key
      ?? (platform === 'walk_my_pet' ? WALKER_MODES[0].key : SITTER_MODES[0].key);
  });
  const mode = modes.find((m) => m.key === modeKey) || modes[0];

  const [startDate, setStartDate] = useState(qpStart || todayISO());
  const [endDate, setEndDate] = useState(qpEnd || qpStart || todayISO());
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');

  // Current user (for phone-on-file check)
  const { data: me } = useQuery<any>({
    queryKey: ['/api/auth/whoami'],
    queryFn: async () => {
      const r = await apiRequest('GET', '/api/auth/whoami');
      return r.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  const phoneOnFile: string | null = me?.user?.phone || null;
  const needsPhone = !phoneOnFile;

  // User's pets
  const { data: petsData } = useQuery<any>({
    queryKey: ['/api/pets'],
    queryFn: async () => {
      const r = await apiRequest('GET', '/api/pets');
      return r.json();
    },
    enabled: !!user,
    staleTime: 30_000,
  });
  const pets: any[] = petsData?.pets ?? petsData ?? [];

  const togglePet = (petId: string) =>
    setSelectedPetIds((cur) =>
      cur.includes(petId) ? cur.filter((p) => p !== petId) : [...cur, petId],
    );

  const phoneValid = !needsPhone || (!!phone && isValidE164(phone));
  const canSend =
    !!provider &&
    selectedPetIds.length > 0 &&
    !!startDate &&
    (!mode.ranged || (!!endDate && endDate >= startDate)) &&
    phoneValid;

  const sendMutation = useMutation({
    mutationFn: async () => {
      // 1) Persist a missing phone first (country-aware E.164), never shared
      //    without consent. Uses the PARTIAL profile-update endpoint — it only
      //    writes `phone` (complete-profile would require name + null out the
      //    user's address). Server enforces the phone-unique constraint.
      if (needsPhone && phone) {
        await apiRequest('PATCH', '/api/user/settings/profile', { phone });
      }

      // 2) Build start/end. Ranged modes use the date range; single modes book a
      //    1-hour window on the chosen day (the engine requires end > start).
      const startISO = new Date(`${startDate}T09:00:00`).toISOString();
      const endISO = mode.ranged
        ? new Date(`${endDate}T09:00:00`).toISOString()
        : new Date(`${startDate}T10:00:00`).toISOString();

      const providerType = platform === 'walk_my_pet' ? 'walker' : 'sitter';
      const modeLabel = isHebrew ? `${mode.labelHe} — ${mode.subHe}` : `${mode.labelEn} — ${mode.subEn}`;

      const payload = {
        providerId: provider.userId,           // /api/ln keys on provider Firebase UID
        providerType,
        serviceType: mode.serviceType,
        startDate: startISO,
        endDate: endISO,
        petIds: selectedPetIds,
        petCount: selectedPetIds.length,
        message: message || undefined,
        specialRequirements: modeLabel,        // carries Hosting vs Sitting vs drop-in
      };
      const res = await apiRequest('POST', '/api/ln', payload);
      return res.json();
    },
    onSuccess: (resp: any) => {
      const requestId = resp?.booking?.requestId || resp?.requestId;
      const name = provider?.firstName || (isHebrew ? 'המטפל/ת' : 'The sitter');
      toast({
        title: isHebrew ? 'הבקשה נשלחה' : 'Request sent',
        description: isHebrew
          ? `${name} יקבל/תקבל את הבקשה ויחזור/תחזור אליך. עדיין לא חויבת.`
          : `${name} will get your request and reply. You haven't been charged.`,
      });
      navigate(requestId ? `/booking/confirmation/${requestId}` : '/bookings');
    },
    onError: (err: any) => {
      toast({
        title: isHebrew ? 'שליחת הבקשה נכשלה' : "Couldn't send request",
        description: err?.message || (isHebrew ? 'נסה/י שוב' : 'Please try again.'),
        variant: 'destructive',
      });
    },
  });

  // ── States ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[100dvh] flex items-center justify-center bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/10" style={{ borderBottomColor: GOLD }} />
        </div>
      </Layout>
    );
  }
  if (error || !provider) {
    return (
      <Layout>
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-6 text-center">
          <p className="text-black/70">{isHebrew ? 'לא הצלחנו לטעון את הפרופיל.' : "We couldn't load this profile."}</p>
          <Button onClick={() => navigate('/marketplace')} className="mt-4">{isHebrew ? 'חזרה' : 'Back to marketplace'}</Button>
        </div>
      </Layout>
    );
  }

  const firstName = provider.firstName || (isHebrew ? 'המטפל/ת' : 'the sitter');
  const fullName = [provider.firstName, provider.lastName].filter(Boolean).join(' ') || firstName;
  const rating = Number(provider.rating ?? 0);
  const reviewCount = Number(provider.totalReviews ?? provider.totalBookings ?? 0);
  const priceDisplay = provider.priceDisplay || (isHebrew ? 'צור/צרי קשר למחיר' : 'Contact for price');

  return (
    <Layout>
      <div dir={isHebrew ? 'rtl' : 'ltr'} className="min-h-[100dvh] bg-white text-black pb-40">
        {/* sub-header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <button onClick={() => window.history.back()} aria-label="Back" className="rounded-full p-2 hover:bg-black/5">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={() => navigate(`/marketplace/${platform}/${id}`)} aria-label="Close" className="rounded-full p-2 hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto w-full max-w-lg px-5">
          <h1 className="mt-1 mb-5 text-2xl font-semibold tracking-tight">
            {isHebrew ? `יצירת קשר עם ${firstName}` : `Get in touch with ${firstName}`}
          </h1>

          {/* provider mini-card */}
          <div className="mb-4 flex items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: GOLD }}>
            {provider.profilePictureUrl ? (
              <img src={provider.profilePictureUrl} alt={fullName} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/5 text-lg font-semibold">
                {fullName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-lg font-semibold">{fullName}</span>
                {provider.isVerified && <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: GOLD }} />}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-sm text-black/60">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4" style={{ color: GOLD, fill: GOLD }} />
                  {rating.toFixed(1)} ({reviewCount})
                </span>
                <span className="text-black/20">|</span>
                <span className="truncate">{priceDisplay}</span>
              </div>
            </div>
          </div>

          {/* service mode */}
          <Section label={isHebrew ? 'שירות' : 'Service'}>
            <div className="grid gap-2">
              {modes.map((m) => {
                const active = m.key === modeKey;
                return (
                  <button
                    key={m.key}
                    onClick={() => setModeKey(m.key)}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 text-start transition"
                    style={{ borderColor: active ? GOLD : 'rgba(0,0,0,0.12)', background: active ? 'rgba(212,175,55,0.06)' : 'white' }}
                  >
                    <m.Icon className="h-5 w-5 shrink-0" style={{ color: active ? GOLD : '#000' }} />
                    <span className="flex-1">
                      <span className="block font-medium">{isHebrew ? m.labelHe : m.labelEn}</span>
                      <span className="block text-sm text-black/55">{isHebrew ? m.subHe : m.subEn}</span>
                    </span>
                    {active && <Check className="h-5 w-5" style={{ color: GOLD }} />}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* location (provider area — privacy-safe, no exact address) */}
          {provider.city && (
            <Section label={isHebrew ? 'מיקום' : 'Location'}>
              <div className="flex items-center gap-2 rounded-xl border border-black/10 px-4 py-3">
                <MapPin className="h-5 w-5 text-black/50" />
                <span>{provider.city}</span>
              </div>
            </Section>
          )}

          {/* dates */}
          <Section label={isHebrew ? (mode.ranged ? 'תאריכים' : 'תאריך') : (mode.ranged ? 'Dates' : 'Date')}>
            <div className={mode.ranged ? 'grid grid-cols-2 gap-2' : ''}>
              <DateField value={startDate} min={todayISO()} onChange={(v) => { setStartDate(v); if (v > endDate) setEndDate(v); }} />
              {mode.ranged && <DateField value={endDate} min={startDate} onChange={setEndDate} />}
            </div>
          </Section>

          {/* pets */}
          <Section label={isHebrew ? 'בחר/י חיית מחמד' : 'Select your pet'}>
            {pets.length === 0 ? (
              <button onClick={() => navigate('/pets?return=' + encodeURIComponent(window.location.pathname + window.location.search))}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 font-medium" style={{ borderColor: GOLD, color: GOLD }}>
                <PlusCircle className="h-5 w-5" /> {isHebrew ? 'הוספת חיית מחמד' : 'Add a pet'}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pets.map((p) => {
                  const pid = String(p.id);
                  const active = selectedPetIds.includes(pid);
                  return (
                    <button key={pid} onClick={() => togglePet(pid)}
                      className="flex items-center gap-2 rounded-full border py-1.5 ps-1.5 pe-4 transition"
                      style={{ borderColor: active ? GOLD : 'rgba(0,0,0,0.12)', background: active ? 'rgba(212,175,55,0.06)' : 'white' }}>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-xs font-semibold">{(p.name || '?').charAt(0)}</span>
                      )}
                      <span className="text-start leading-tight">
                        <span className="block text-sm font-medium">{p.name}</span>
                        {p.breed && <span className="block text-xs text-black/50">{p.breed}</span>}
                      </span>
                      {active && <Check className="h-4 w-4" style={{ color: GOLD }} />}
                    </button>
                  );
                })}
                <button onClick={() => navigate('/pets?return=' + encodeURIComponent(window.location.pathname + window.location.search))}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium" style={{ color: GOLD }}>
                  <PlusCircle className="h-4 w-4" /> {isHebrew ? 'הוספה' : 'Add pet'}
                </button>
              </div>
            )}
          </Section>

          {/* message */}
          <Section label={isHebrew ? `כתוב/כתבי הודעה קצרה ל${firstName}` : `Write a brief message to ${firstName}`}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={isHebrew
                ? 'היי, רציתי לבדוק אם תוכל/י לטפל בכלב שלי בתאריכים האלה? תודה רבה!'
                : "Hi there, wondering if you're available to care for my dog over these dates? Thanks in advance!"}
              className="w-full resize-none rounded-xl border border-black/15 p-3 text-[16px] outline-none focus:border-black/40"
            />
          </Section>

          {/* phone — only if not on file. Country-aware (IL/AU/US/UK + more). */}
          {needsPhone && (
            <Section label={isHebrew ? 'הוספת מספר טלפון' : 'Add your phone number'}>
              <div className="rounded-xl border p-3" style={{ borderColor: GOLD, background: 'rgba(212,175,55,0.04)' }}>
                <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
                <p className="mt-2 flex items-center gap-1.5 text-xs text-black/55">
                  <Lock className="h-3.5 w-3.5" />
                  {isHebrew ? 'הפרטים לעולם לא משותפים ללא הסכמתך.' : 'Details are never shared without consent.'}
                </p>
              </div>
            </Section>
          )}
        </div>

        {/* sticky CTA */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 backdrop-blur"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto w-full max-w-lg px-5 pt-3">
            <Button
              disabled={!canSend || sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
              className="h-12 w-full rounded-full text-base font-semibold text-black hover:opacity-90 disabled:opacity-50"
              style={{ background: GOLD }}
            >
              {sendMutation.isPending
                ? (isHebrew ? 'שולח…' : 'Sending…')
                : (isHebrew ? 'שליחת בקשת הזמנה' : 'Send booking request')}
            </Button>
            <p className="py-2 text-center text-sm text-black/55">
              {isHebrew ? 'עדיין לא תתבקש/י לשלם.' : "You won't be asked to pay yet."}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-sm font-medium text-black/70">{label}</p>
      {children}
    </div>
  );
}

function DateField({ value, min, onChange }: { value: string; min?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/15 px-3 py-2.5 focus-within:border-black/40">
      <CalendarDays className="h-5 w-5 shrink-0 text-black/50" />
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[16px] outline-none"
      />
    </div>
  );
}
