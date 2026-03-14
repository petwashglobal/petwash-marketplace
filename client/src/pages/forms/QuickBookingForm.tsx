import { useState } from 'react';
import { Calendar, MapPin, Shield } from 'lucide-react';
import { MobileFormShell, MobileSection, MobileField, MobileInput, MobileSelect, MobilePrimaryButton, MobileSuccessScreen } from './components/MobileFormShell';
import { GooglePlacesAutocomplete } from '@/components/ui/google-places-autocomplete';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const PLATFORMS = [
  { value: 'k9000', label: '🤖 K9000 – Automated Pet Wash', he: 'כביסה אוטומטית' },
  { value: 'sitter-suite', label: '🏠 Sitter Suite – Pet Sitting', he: 'שמירה על חיות מחמד' },
  { value: 'walk', label: '🦮 Walk My Pet – Dog Walking', he: 'הוצאת כלבים לטיול' },
  { value: 'pettrek', label: '🏔️ PetTrek – Nature Walks', he: 'טיולי טבע' },
  { value: 'academy', label: '🎓 Academy – Training', he: 'אילוף ואקדמיה' },
  { value: 'plush', label: '✂️ Plush Lab – Grooming', he: 'גרומינג' },
  { value: 'mobile', label: '🚐 Mobile Grooming', he: 'גרומינג נייד' },
];

const SERVICE_MAP: Record<string, string[]> = {
  k9000: ['Quick Wash (15 min)', 'Full Wash + Dry (30 min)', 'Deluxe Wash + Blow Dry (45 min)', 'Premium Spa Pack'],
  'sitter-suite': ['Drop-In Visit (30 min)', 'Half Day (4h)', 'Full Day', 'Overnight Stay'],
  walk: ['30-Minute Walk', '60-Minute Walk', 'Group Walk (30 min)', 'Solo Premium Walk (60 min)'],
  pettrek: ['Morning Trek (2h)', 'Half-Day Trek', 'Full-Day Adventure', 'Overnight Camping'],
  academy: ['Puppy Basics (1h)', 'Obedience Training', 'Behavioral Therapy', 'Group Class'],
  plush: ['Bath & Brush', 'Full Groom', 'Lion Cut (Cats)', 'Nail + Ear + Hygiene'],
  mobile: ['Home Groom – Basic', 'Home Groom – Full', 'Home Spa Premium'],
};

const PET_TYPES = ['Dog', 'Cat', 'Both', 'Other'];
const SIZES = ['Tiny (< 5 kg)', 'Small (5–10 kg)', 'Medium (10–20 kg)', 'Large (20–35 kg)', 'XL (35 kg+)'];

export default function QuickBookingForm() {
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    platform: '', serviceType: '',
    date: '', time: '',
    address: '', city: '', lat: 0, lng: 0,
    firstName: '', lastName: '', email: '', phone: '',
    petName: '', petType: 'Dog', petSize: '', petBreed: '', petNotes: '',
    specialRequests: '',
    coupon: '',
  });

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));

  const services = form.platform ? (SERVICE_MAP[form.platform] || []) : [];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const next = () => {
    if (step === 1 && (!form.platform || !form.serviceType || !form.date || !form.time)) {
      toast({ variant: 'destructive', title: 'Please select platform, service, date & time' }); return;
    }
    if (step === 2 && (!form.firstName || !form.email || !form.phone || !form.address)) {
      toast({ variant: 'destructive', title: 'Contact details and address required' }); return;
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    if (!form.petName || !form.petSize) {
      toast({ variant: 'destructive', title: 'Pet name and size required' }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/quick-booking', form) as any;
      setSuccess(res?.bookingRef || `BK-${Date.now().toString(36).toUpperCase()}`);
    } catch {
      toast({ variant: 'destructive', title: 'Booking failed', description: 'Please try again or call 1-800-PETWASH' });
    } finally { setLoading(false); }
  };

  if (success) return (
    <MobileSuccessScreen
      emoji="✅"
      title="Booking Confirmed!"
      titleHe="ההזמנה אושרה!"
      message={`Your ${PLATFORMS.find(p => p.value === form.platform)?.label.split('–')[0].trim() || ''} booking is confirmed. You'll receive an SMS and email confirmation shortly.`}
      messageHe="קיבלת אישור ב-SMS ובאימייל"
      refId={success}
      refLabel="Booking Reference"
      onDone={() => nav('/')}
    />
  );

  const TOTAL = 3;

  return (
    <MobileFormShell
      emoji="📅"
      title="Quick Booking"
      titleHe="הזמנה מהירה"
      subtitle="Book any PetWash™ service in 2 minutes"
      step={step}
      totalSteps={TOTAL}
      onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
      footer={
        step < TOTAL ? (
          <MobilePrimaryButton onClick={next}>Continue →</MobilePrimaryButton>
        ) : (
          <MobilePrimaryButton onClick={submit} loading={loading}>Confirm Booking 🐾</MobilePrimaryButton>
        )
      }
    >
      {step === 1 && (
        <>
          <MobileSection title="Choose Service" titleHe="בחר שירות">
            <MobileField label="Platform" labelHe="פלטפורמה" required>
              <div className="space-y-2">
                {PLATFORMS.map(p => (
                  <label
                    key={p.value}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      form.platform === p.value
                        ? 'border-[#C6A35B] bg-[#C6A35B]/10'
                        : 'border-white/8 bg-white/[0.02]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="platform"
                      value={p.value}
                      checked={form.platform === p.value}
                      onChange={() => { set('platform', p.value); set('serviceType', ''); }}
                      className="accent-[#C6A35B] w-4 h-4"
                    />
                    <div>
                      <p className="text-white text-sm font-medium">{p.label}</p>
                      <p className="text-white/35 text-xs" dir="rtl">{p.he}</p>
                    </div>
                  </label>
                ))}
              </div>
            </MobileField>

            {services.length > 0 && (
              <MobileField label="Service Type" labelHe="סוג שירות" required>
                <MobileSelect value={form.serviceType} onChange={v => set('serviceType', v)}>
                  <option value="">Select service…</option>
                  {services.map(s => <option key={s} value={s}>{s}</option>)}
                </MobileSelect>
              </MobileField>
            )}
          </MobileSection>

          <MobileSection title="Date & Time" titleHe="תאריך ושעה">
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="Date" labelHe="תאריך" required>
                <MobileInput type="date" value={form.date} onChange={v => set('date', v)} min={minDateStr} />
              </MobileField>
              <MobileField label="Time" labelHe="שעה" required>
                <MobileInput type="time" value={form.time} onChange={v => set('time', v)} min="08:00" max="20:00" />
              </MobileField>
            </div>
          </MobileSection>
        </>
      )}

      {step === 2 && (
        <>
          <MobileSection title="Your Details" titleHe="פרטים אישיים">
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="First Name" required>
                <MobileInput value={form.firstName} onChange={v => set('firstName', v)} placeholder="David" autoComplete="given-name" />
              </MobileField>
              <MobileField label="Last Name">
                <MobileInput value={form.lastName} onChange={v => set('lastName', v)} placeholder="Cohen" autoComplete="family-name" />
              </MobileField>
            </div>
            <MobileField label="Email" required>
              <MobileInput type="email" value={form.email} onChange={v => set('email', v)} inputMode="email" autoComplete="email" placeholder="you@example.com" />
            </MobileField>
            <MobileField label="Mobile" required>
              <MobileInput type="tel" value={form.phone} onChange={v => set('phone', v)} inputMode="tel" autoComplete="tel" placeholder="+972 50 000 0000" />
            </MobileField>
          </MobileSection>

          <MobileSection title="Service Location" titleHe="כתובת לשירות">
            <div className="flex items-center gap-2 text-[#C6A35B] text-xs mb-2">
              <MapPin className="w-3.5 h-3.5" />
              <span>We'll use this to find the nearest K9000 station or send the groomer to you</span>
            </div>
            <MobileField label="Address" required>
              <GooglePlacesAutocomplete
                value={form.address}
                onChange={(v, d) => {
                  set('address', v);
                  if (d?.city) set('city', d.city);
                  if (d?.lat) set('lat', d.lat);
                  if (d?.lng) set('lng', d.lng);
                }}
                placeholder="Search your address…"
                country={['il']}
                inputClassName="bg-black/40 border-white/12 text-white placeholder:text-white/30 rounded-xl px-4 py-3.5 focus:border-[#C6A35B]/60"
              />
            </MobileField>
            <MobileField label="City">
              <MobileInput value={form.city} onChange={v => set('city', v)} placeholder="Tel Aviv" />
            </MobileField>
          </MobileSection>
        </>
      )}

      {step === 3 && (
        <>
          <MobileSection title="Your Pet" titleHe="הפוצ׳ה שלך">
            <MobileField label="Pet Name" required>
              <MobileInput value={form.petName} onChange={v => set('petName', v)} placeholder="Rex" />
            </MobileField>
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="Type" required>
                <MobileSelect value={form.petType} onChange={v => set('petType', v)}>
                  {PET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </MobileSelect>
              </MobileField>
              <MobileField label="Size" required>
                <MobileSelect value={form.petSize} onChange={v => set('petSize', v)}>
                  <option value="">Select…</option>
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </MobileSelect>
              </MobileField>
            </div>
            <MobileField label="Breed">
              <MobileInput value={form.petBreed} onChange={v => set('petBreed', v)} placeholder="Labrador, Poodle, Mixed, etc." />
            </MobileField>
            <MobileField label="Health / Behavior Notes" labelHe="הערות רפואיות/התנהגותיות">
              <MobileInput
                value={form.petNotes}
                onChange={v => set('petNotes', v)}
                placeholder="Allergies, aggression, health conditions…"
                rows={3}
              />
            </MobileField>
          </MobileSection>

          <MobileSection title="Special Requests" titleHe="בקשות מיוחדות">
            <MobileInput
              value={form.specialRequests}
              onChange={v => set('specialRequests', v)}
              placeholder="Any special instructions for our team…"
              rows={3}
            />
          </MobileSection>

          <MobileSection title="Coupon Code" titleHe="קוד קופון">
            <MobileInput
              value={form.coupon}
              onChange={v => set('coupon', v.toUpperCase())}
              placeholder="PETWASH10"
              autoComplete="off"
            />
          </MobileSection>

          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 space-y-2">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Booking Summary</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-white/35">Service</span><p className="text-white font-medium">{form.serviceType}</p></div>
              <div><span className="text-white/35">Date</span><p className="text-white font-medium">{form.date} {form.time}</p></div>
              <div><span className="text-white/35">Location</span><p className="text-white font-medium truncate">{form.city || form.address.split(',')[0] || '—'}</p></div>
              <div><span className="text-white/35">Pet</span><p className="text-white font-medium">{form.petName || '—'} ({form.petSize.split(' ')[0] || '—'})</p></div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-white/25 text-xs px-1">
            <Shield className="w-4 h-4 shrink-0" />
            <span>Price confirmed on arrival. Includes VAT 18%. Free cancellation up to 2h before.</span>
          </div>
        </>
      )}
    </MobileFormShell>
  );
}
