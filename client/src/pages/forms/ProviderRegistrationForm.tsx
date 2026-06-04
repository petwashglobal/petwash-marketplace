import { useState } from 'react';
import { Briefcase, Shield, Star } from 'lucide-react';
import { MobileFormShell, MobileSection, MobileField, MobileInput, MobileSelect, MobilePrimaryButton, MobileSuccessScreen } from './components/MobileFormShell';
import { MobileFileCapture } from './components/MobileFileCapture';
import { GooglePlacesAutocomplete } from '@/components/ui/google-places-autocomplete';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const PLATFORMS = ['K9000 Operator', 'Sitter Suite', 'Walk My Pet', 'PetTrek Guide', 'Academy Trainer', 'Plush Lab Groomer', 'Mobile Groomer', 'Other'];
const EXPERIENCE = ['Under 1 year', '1–2 years', '3–5 years', '5–10 years', '10+ years'];

export default function ProviderRegistrationForm() {
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    dateOfBirth: '', idNumber: '',
    address: '', city: '', postalCode: '',
    platform: '', experienceYears: '', bio: '',
    businessName: '', vatNumber: '',
    certificationName: '', certificationBody: '',
    selfieUrl: '', idDocUrl: '', certDocUrl: '', portfolioUrl: '',
    bankAccount: '', bankName: '',
    availability: '',
    acceptTerms: false, acceptBackground: false,
  });

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));

  const next = () => {
    if (
      step === 1 &&
      (!form.firstName || !form.lastName || !form.email || !form.phone || !form.platform || !form.experienceYears || !form.idNumber)
    ) {
      toast({ variant: 'destructive', title: 'Please fill all required fields' }); return;
    }
    if (step === 2 && !form.selfieUrl) {
      toast({ variant: 'destructive', title: 'Selfie photo is required for verification' }); return;
    }
    if (step === 3 && !form.idDocUrl) {
      toast({ variant: 'destructive', title: 'Government ID is required for verification' }); return;
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    if (!form.acceptTerms || !form.acceptBackground) {
      toast({ variant: 'destructive', title: 'Please accept all required agreements' }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/provider-registration', form) as any;
      setSuccess(res?.applicationId || `PRV-${Date.now().toString(36).toUpperCase()}`);
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Please try again or email providers@petwash.co.il' });
    } finally { setLoading(false); }
  };

  if (success) return (
    <MobileSuccessScreen
      emoji="🎉"
      title="Application Submitted!"
      titleHe="הבקשה נשלחה בהצלחה!"
      message="Our Provider team will review your application within 2–3 business days. You'll receive an email with next steps."
      messageHe="צוות הספקים שלנו יחזור אליך תוך 2–3 ימי עסקים"
      refId={success}
      refLabel="Application ID"
      onDone={() => nav('/')}
    />
  );

  const TOTAL = 4;

  return (
    <MobileFormShell
      emoji="🐾"
      title="Become a Provider"
      titleHe="הגש מועמדות כספק"
      subtitle="Join Israel's largest pet care network"
      step={step}
      totalSteps={TOTAL}
      onBack={step > 1 ? () => setStep(s => s - 1) : undefined}
      footer={
        step < TOTAL ? (
          <MobilePrimaryButton onClick={next}>Continue →</MobilePrimaryButton>
        ) : (
          <MobilePrimaryButton onClick={submit} loading={loading}>Submit Application →</MobilePrimaryButton>
        )
      }
    >
      {step === 1 && (
        <>
          <MobileSection title="Role & Platform" titleHe="תפקיד ופלטפורמה">
            <MobileField label="Platform" labelHe="פלטפורמה" required>
              <MobileSelect value={form.platform} onChange={v => set('platform', v)}>
                <option value="">Select a platform…</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </MobileSelect>
            </MobileField>
            <MobileField label="Years of Experience" labelHe="שנות ניסיון" required>
              <MobileSelect value={form.experienceYears} onChange={v => set('experienceYears', v)}>
                <option value="">Select…</option>
                {EXPERIENCE.map(e => <option key={e} value={e}>{e}</option>)}
              </MobileSelect>
            </MobileField>
            <MobileField label="Business / Trade Name" labelHe="שם עסק">
              <MobileInput value={form.businessName} onChange={v => set('businessName', v)} placeholder="My Pet Services Ltd." />
            </MobileField>
            <MobileField label="VAT Number (Osek Murshe)" labelHe="מספר עוסק מורשה">
              <MobileInput value={form.vatNumber} onChange={v => set('vatNumber', v)} inputMode="numeric" placeholder="123456789" maxLength={9} />
            </MobileField>
          </MobileSection>

          <MobileSection title="Personal Details" titleHe="פרטים אישיים">
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="First Name" required>
                <MobileInput value={form.firstName} onChange={v => set('firstName', v)} placeholder="David" autoComplete="given-name" />
              </MobileField>
              <MobileField label="Last Name" required>
                <MobileInput value={form.lastName} onChange={v => set('lastName', v)} placeholder="Cohen" autoComplete="family-name" />
              </MobileField>
            </div>
            <MobileField label="Email" required>
              <MobileInput type="email" value={form.email} onChange={v => set('email', v)} inputMode="email" autoComplete="email" placeholder="you@example.com" />
            </MobileField>
            <MobileField label="Mobile" required>
              <MobileInput type="tel" value={form.phone} onChange={v => set('phone', v)} inputMode="tel" autoComplete="tel" placeholder="+972 50 000 0000" />
            </MobileField>
            <MobileField label="Date of Birth" labelHe="תאריך לידה">
              <MobileInput type="date" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} max={new Date().toISOString().split('T')[0]} />
            </MobileField>
            <MobileField label="ID Number" labelHe="תעודת זהות" required>
              <MobileInput value={form.idNumber} onChange={v => set('idNumber', v)} inputMode="numeric" placeholder="123456789" maxLength={9} />
            </MobileField>
          </MobileSection>

          <MobileSection title="Service Area" titleHe="אזור שירות">
            <MobileField label="Address" labelHe="כתובת">
              <GooglePlacesAutocomplete
                value={form.address}
                onChange={(v, d) => {
                  set('address', v);
                  if (d?.city) set('city', d.city);
                  if (d?.postalCode) set('postalCode', d.postalCode);
                }}
                placeholder="Search address…"
                country={['il']}
                inputClassName="bg-black/40 border-white/12 text-white placeholder:text-white/30 rounded-xl px-4 py-3.5 focus:border-[#C6A35B]/60"
              />
            </MobileField>
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="City">
                <MobileInput value={form.city} onChange={v => set('city', v)} placeholder="Tel Aviv" />
              </MobileField>
              <MobileField label="Postal Code">
                <MobileInput value={form.postalCode} onChange={v => set('postalCode', v)} inputMode="numeric" placeholder="6100000" />
              </MobileField>
            </div>
          </MobileSection>
        </>
      )}

      {step === 2 && (
        <>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-blue-300 text-sm font-semibold">📸 Identity Verification</p>
            <p className="text-blue-200/60 text-xs mt-1">We need a selfie and your government ID to verify your identity. Photos are encrypted and stored securely.</p>
            <p className="text-blue-200/40 text-xs mt-0.5" dir="rtl">התמונות מוצפנות ומאוחסנות בצורה מאובטחת</p>
          </div>

          <MobileSection title="Selfie / Live Photo" titleHe="סלפי לאימות זהות">
            <MobileFileCapture
              label="Take a Selfie"
              labelHe="צלם סלפי"
              capture="user"
              accept="image/*"
              storagePath="providers/selfies"
              hint="Look directly at the camera with good lighting. No sunglasses."
              required
              onUploaded={(url) => set('selfieUrl', url)}
              onClear={() => set('selfieUrl', '')}
            />
          </MobileSection>

          <MobileSection title="About You" titleHe="ספר על עצמך">
            <MobileField label="Short Bio" labelHe="תיאור קצר">
              <MobileInput
                value={form.bio}
                onChange={v => set('bio', v)}
                placeholder="Tell customers about your experience with animals, certifications, and why you love pet care…"
                rows={5}
              />
            </MobileField>
            <MobileField label="Availability" labelHe="זמינות">
              <MobileSelect value={form.availability} onChange={v => set('availability', v)}>
                <option value="">Select…</option>
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time (evenings/weekends)</option>
                <option value="weekends">Weekends only</option>
                <option value="flexible">Flexible / On-demand</option>
              </MobileSelect>
            </MobileField>
          </MobileSection>
        </>
      )}

      {step === 3 && (
        <>
          <MobileSection title="Government ID" titleHe="תעודת זהות / דרכון">
            <MobileFileCapture
              label="ID / Passport Photo"
              labelHe="תעודת זהות או דרכון"
              capture="environment"
              accept="image/*,application/pdf"
              storagePath="providers/id-documents"
              hint="Clear photo of both sides of your Teudat Zehut, or your passport photo page."
              required
              onUploaded={(url) => set('idDocUrl', url)}
              onClear={() => set('idDocUrl', '')}
            />
          </MobileSection>

          <MobileSection title="Certifications (Optional)" titleHe="תעודות מקצועיות (אופציונלי)">
            <MobileField label="Certification Name" labelHe="שם הסמכה">
              <MobileInput value={form.certificationName} onChange={v => set('certificationName', v)} placeholder="Dog Training Certification, Vet Tech Diploma, etc." />
            </MobileField>
            <MobileField label="Issuing Body" labelHe="גוף מנפיק">
              <MobileInput value={form.certificationBody} onChange={v => set('certificationBody', v)} placeholder="Israel Veterinary Association, etc." />
            </MobileField>
            <MobileFileCapture
              label="Certification Document"
              labelHe="מסמך הסמכה"
              capture="environment"
              accept="image/*,application/pdf"
              storagePath="providers/certificates"
              hint="Photo or PDF of your certificate"
              onUploaded={(url) => set('certDocUrl', url)}
              onClear={() => set('certDocUrl', '')}
            />
          </MobileSection>

          <MobileSection title="Payment Details" titleHe="פרטי תשלום">
            <MobileField label="Bank Name" labelHe="שם הבנק">
              <MobileSelect value={form.bankName} onChange={v => set('bankName', v)}>
                <option value="">Select bank…</option>
                <option value="hapoalim">Bank Hapoalim</option>
                <option value="leumi">Bank Leumi</option>
                <option value="discount">Discount Bank</option>
                <option value="mizrahi">Mizrahi-Tefahot</option>
                <option value="yahav">Bank Yahav</option>
                <option value="mercantile">Mercantile</option>
                <option value="other">Other</option>
              </MobileSelect>
            </MobileField>
            <MobileField label="IBAN / Account Number" labelHe="מספר חשבון">
              <MobileInput value={form.bankAccount} onChange={v => set('bankAccount', v)} inputMode="numeric" placeholder="IL00 000 0 000000 000000000" />
            </MobileField>
          </MobileSection>
        </>
      )}

      {step === 4 && (
        <>
          <div className="bg-gradient-to-br from-[#C6A35B]/10 to-transparent border border-[#C6A35B]/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Briefcase className="w-7 h-7 text-[#E7C978]" />
              <div>
                <p className="font-bold text-white">{form.platform || 'Provider'} Application</p>
                <p className="text-white/40 text-xs">PetWash™ Provider Network</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-white/40">Name</span><p className="text-white font-medium">{form.firstName} {form.lastName}</p></div>
              <div><span className="text-white/40">Experience</span><p className="text-white font-medium">{form.experienceYears || '—'}</p></div>
              <div><span className="text-white/40">City</span><p className="text-white font-medium">{form.city || '—'}</p></div>
              <div><span className="text-white/40">Documents</span><p className="text-green-400 font-medium">{[form.selfieUrl, form.idDocUrl].filter(Boolean).length}/2 ✓</p></div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'acceptTerms', label: 'I accept the Provider Terms & Conditions and Service Agreement', he: 'אני מקבל/ת את תנאי ספק השירות', req: true },
              { key: 'acceptBackground', label: 'I consent to a background check and identity verification by PetWash™', he: 'אני מסכים/ה לבדיקת רקע', req: true },
            ].map(item => (
              <label key={item.key} className="flex gap-3 items-start p-4 bg-white/[0.03] border border-white/8 rounded-xl cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-5 h-5 rounded accent-[#C6A35B]"
                  checked={form[item.key as keyof typeof form] as boolean}
                  onChange={e => set(item.key as keyof typeof form, e.target.checked)} />
                <div>
                  <p className="text-white/80 text-sm">{item.label}{item.req && <span className="text-red-400 ml-1">*</span>}</p>
                  <p className="text-white/35 text-xs mt-0.5" dir="rtl">{item.he}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 text-white/30 text-xs px-1">
            <Shield className="w-4 h-4 shrink-0" />
            <span>All documents are encrypted. Stored under Israeli Privacy Protection Law 5742-1981.</span>
          </div>
        </>
      )}
    </MobileFormShell>
  );
}
