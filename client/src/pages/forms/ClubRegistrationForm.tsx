import { useState } from 'react';
import { Crown, Star, Shield } from 'lucide-react';
import { MobileFormShell, MobileSection, MobileField, MobileInput, MobileSelect, MobilePrimaryButton, MobileSuccessScreen } from './components/MobileFormShell';
import { MobileFileCapture } from './components/MobileFileCapture';
import { GooglePlacesAutocomplete } from '@/components/ui/google-places-autocomplete';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const PLANS = [
  { value: 'gold', label: 'Gold – ₪89/mo', he: 'זהב' },
  { value: 'platinum', label: 'Platinum – ₪149/mo', he: 'פלטינום' },
  { value: 'diamond', label: 'Diamond – ₪249/mo', he: 'יהלום' },
];

const PET_TYPES = ['Dog', 'Cat', 'Both', 'Other'];
const PET_BREEDS_DOG = ['Labrador', 'Golden Retriever', 'Poodle', 'German Shepherd', 'Bulldog', 'Chihuahua', 'Mixed / Other'];

export default function ClubRegistrationForm() {
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    dateOfBirth: '', idNumber: '',
    address: '', city: '', postalCode: '',
    plan: 'gold',
    petName: '', petType: 'Dog', petBreed: '', petAge: '', petWeight: '',
    vetName: '', vetPhone: '',
    emergencyContact: '', emergencyPhone: '',
    how: '',
    photoUrl: '',
    acceptTerms: false, acceptMarketing: false,
  });

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));

  const next = () => {
    if (step === 1 && (!form.firstName || !form.lastName || !form.email || !form.phone)) {
      toast({ variant: 'destructive', title: 'Fill all required fields' }); return;
    }
    if (step === 2 && (!form.address || !form.petName || !form.petType)) {
      toast({ variant: 'destructive', title: 'Fill all required fields' }); return;
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    if (!form.acceptTerms) { toast({ variant: 'destructive', title: 'Please accept the Terms & Conditions' }); return; }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/club-registration', form) as any;
      setSuccess(res?.memberId || `CLUB-${Date.now().toString(36).toUpperCase()}`);
    } catch {
      toast({ variant: 'destructive', title: 'Registration failed', description: 'Please try again or call 1-800-PETWASH' });
    } finally { setLoading(false); }
  };

  if (success) return (
    <MobileSuccessScreen
      emoji="👑"
      title="Welcome to the Club!"
      titleHe="ברוכים הבאים למועדון!"
      message="Your Prestige Club membership is being activated. You'll receive a confirmation email and your digital card shortly."
      messageHe="כרטיסך הדיגיטלי יישלח בקרוב"
      refId={success}
      refLabel="Member ID"
      onDone={() => nav('/')}
    />
  );

  const TOTAL = 4;

  return (
    <MobileFormShell
      emoji="👑"
      title="Join Prestige Club"
      titleHe="הצטרפות למועדון יוקרה"
      subtitle="Israel's premier pet care membership"
      step={step}
      totalSteps={TOTAL}
      onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
      footer={
        step < TOTAL ? (
          <MobilePrimaryButton onClick={next}>
            Continue →
          </MobilePrimaryButton>
        ) : (
          <MobilePrimaryButton onClick={submit} loading={loading}>
            Activate Membership 👑
          </MobilePrimaryButton>
        )
      }
    >
      {step === 1 && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
            {PLANS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => set('plan', p.value)}
                className={`snap-start shrink-0 flex flex-col items-center gap-1 rounded-2xl px-6 py-4 border-2 transition-all ${
                  form.plan === p.value
                    ? 'border-[#C6A35B] bg-[#C6A35B]/15'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <Crown className={`w-6 h-6 ${form.plan === p.value ? 'text-[#E7C978]' : 'text-white/40'}`} />
                <span className={`text-sm font-bold ${form.plan === p.value ? 'text-[#E7C978]' : 'text-white/60'}`}>{p.he}</span>
                <span className={`text-xs ${form.plan === p.value ? 'text-white/80' : 'text-white/40'}`}>{p.label}</span>
              </button>
            ))}
          </div>

          <MobileSection title="Personal Details" titleHe="פרטים אישיים">
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="First Name" labelHe="שם פרטי" required>
                <MobileInput value={form.firstName} onChange={v => set('firstName', v)} placeholder="David" autoComplete="given-name" />
              </MobileField>
              <MobileField label="Last Name" labelHe="שם משפחה" required>
                <MobileInput value={form.lastName} onChange={v => set('lastName', v)} placeholder="Cohen" autoComplete="family-name" />
              </MobileField>
            </div>
            <MobileField label="Email" labelHe="אימייל" required>
              <MobileInput type="email" value={form.email} onChange={v => set('email', v)} placeholder="you@example.com" inputMode="email" autoComplete="email" />
            </MobileField>
            <MobileField label="Mobile" labelHe="טלפון" required>
              <MobileInput type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder="+972 50 000 0000" inputMode="tel" autoComplete="tel" />
            </MobileField>
            <MobileField label="Date of Birth" labelHe="תאריך לידה">
              <MobileInput type="date" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} max={new Date().toISOString().split('T')[0]} />
            </MobileField>
            <MobileField label="ID / Passport Number" labelHe="מספר תעודת זהות">
              <MobileInput value={form.idNumber} onChange={v => set('idNumber', v)} placeholder="123456789" inputMode="numeric" />
            </MobileField>
          </MobileSection>

          <MobileSection title="Profile Photo" titleHe="תמונת פרופיל">
            <MobileFileCapture
              label="Your Photo"
              labelHe="תמונה שלך"
              capture="user"
              accept="image/*"
              storagePath="club-members/photos"
              hint="Clear selfie — used for your digital membership card"
              onUploaded={(url) => set('photoUrl', url)}
              onClear={() => set('photoUrl', '')}
            />
          </MobileSection>
        </>
      )}

      {step === 2 && (
        <>
          <MobileSection title="Address" titleHe="כתובת">
            <MobileField label="Street Address" labelHe="רחוב" required>
              <GooglePlacesAutocomplete
                value={form.address}
                onChange={(v, details) => {
                  set('address', v);
                  if (details?.city) set('city', details.city);
                  if (details?.postalCode) set('postalCode', details.postalCode);
                }}
                placeholder="Search your address…"
                country={['il']}
                inputClassName="bg-black/40 border-white/12 text-white placeholder:text-white/30 rounded-xl px-4 py-3.5 focus:border-[#C6A35B]/60"
              />
            </MobileField>
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="City" labelHe="עיר">
                <MobileInput value={form.city} onChange={v => set('city', v)} placeholder="Tel Aviv" />
              </MobileField>
              <MobileField label="Postal Code" labelHe="מיקוד">
                <MobileInput value={form.postalCode} onChange={v => set('postalCode', v)} inputMode="numeric" placeholder="6100000" />
              </MobileField>
            </div>
          </MobileSection>

          <MobileSection title="Your Pet" titleHe="הפוצ׳ה שלך">
            <MobileField label="Pet Name" labelHe="שם החיה" required>
              <MobileInput value={form.petName} onChange={v => set('petName', v)} placeholder="Rex" />
            </MobileField>
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="Type" labelHe="סוג" required>
                <MobileSelect value={form.petType} onChange={v => set('petType', v)}>
                  {PET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </MobileSelect>
              </MobileField>
              <MobileField label="Age (years)" labelHe="גיל">
                <MobileInput type="number" value={form.petAge} onChange={v => set('petAge', v)} inputMode="numeric" placeholder="3" min="0" max="30" />
              </MobileField>
            </div>
            <MobileField label="Breed" labelHe="גזע">
              <MobileSelect value={form.petBreed} onChange={v => set('petBreed', v)}>
                <option value="">Select breed…</option>
                {PET_BREEDS_DOG.map(b => <option key={b} value={b}>{b}</option>)}
                <option value="other">Other</option>
              </MobileSelect>
            </MobileField>
            <MobileField label="Weight (kg)" labelHe="משקל">
              <MobileInput type="number" value={form.petWeight} onChange={v => set('petWeight', v)} inputMode="decimal" placeholder="12" min="0" max="100" />
            </MobileField>
          </MobileSection>
        </>
      )}

      {step === 3 && (
        <>
          <MobileSection title="Veterinarian" titleHe="וטרינר">
            <MobileField label="Vet / Clinic Name" labelHe="שם הוטרינר">
              <MobileInput value={form.vetName} onChange={v => set('vetName', v)} placeholder="Dr. Levi Animal Clinic" />
            </MobileField>
            <MobileField label="Vet Phone" labelHe="טלפון וטרינר">
              <MobileInput type="tel" value={form.vetPhone} onChange={v => set('vetPhone', v)} inputMode="tel" placeholder="+972 3 000 0000" />
            </MobileField>
          </MobileSection>

          <MobileSection title="Emergency Contact" titleHe="איש קשר לחירום">
            <MobileField label="Name" labelHe="שם">
              <MobileInput value={form.emergencyContact} onChange={v => set('emergencyContact', v)} placeholder="Miriam Cohen" autoComplete="off" />
            </MobileField>
            <MobileField label="Phone" labelHe="טלפון">
              <MobileInput type="tel" value={form.emergencyPhone} onChange={v => set('emergencyPhone', v)} inputMode="tel" placeholder="+972 50 000 0000" />
            </MobileField>
          </MobileSection>

          <MobileSection title="How did you find us?" titleHe="איך הגעת אלינו?">
            <MobileSelect value={form.how} onChange={v => set('how', v)}>
              <option value="">Select…</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="google">Google Search</option>
              <option value="friend">Friend / Family</option>
              <option value="vet">My Vet</option>
              <option value="k9000">K9000 Station</option>
              <option value="other">Other</option>
            </MobileSelect>
          </MobileSection>
        </>
      )}

      {step === 4 && (
        <>
          <div className="bg-gradient-to-br from-[#C6A35B]/10 to-[#E7C978]/5 border border-[#C6A35B]/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-[#E7C978]" />
              <div>
                <p className="font-bold text-white">{PLANS.find(p => p.value === form.plan)?.label}</p>
                <p className="text-white/50 text-xs">Prestige Club Membership</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-white/40">Member</span><p className="text-white font-medium">{form.firstName} {form.lastName}</p></div>
              <div><span className="text-white/40">Pet</span><p className="text-white font-medium">{form.petName} ({form.petType})</p></div>
              <div><span className="text-white/40">Email</span><p className="text-white font-medium truncate">{form.email}</p></div>
              <div><span className="text-white/40">City</span><p className="text-white font-medium">{form.city || '—'}</p></div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'acceptTerms', label: 'I accept the Terms & Conditions and Privacy Policy', he: 'אני מקבל/ת את התנאים ומדיניות הפרטיות', required: true },
              { key: 'acceptMarketing', label: 'I agree to receive promotions and updates from PetWash™', he: 'אני מסכים/ה לקבל הצעות ועדכונים', required: false },
            ].map(item => (
              <label key={item.key} className="flex gap-3 items-start p-4 bg-white/[0.03] border border-white/8 rounded-xl active:bg-white/[0.06] cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-5 h-5 rounded accent-[#C6A35B]"
                  checked={form[item.key as keyof typeof form] as boolean}
                  onChange={e => set(item.key as keyof typeof form, e.target.checked)}
                />
                <div>
                  <p className="text-white/80 text-sm">{item.label}{item.required && <span className="text-red-400 ml-1">*</span>}</p>
                  <p className="text-white/35 text-xs mt-0.5" dir="rtl">{item.he}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 text-white/30 text-xs px-1">
            <Shield className="w-4 h-4 shrink-0" />
            <span>Your data is encrypted and stored securely. VAT 18% included in all prices.</span>
          </div>
        </>
      )}
    </MobileFormShell>
  );
}
