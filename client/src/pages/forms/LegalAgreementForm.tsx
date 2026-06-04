import { useState, useRef } from 'react';
import { FileText, ScrollText, Shield, Download, CheckCircle2 } from 'lucide-react';
import { MobileFormShell, MobileSection, MobileField, MobileInput, MobileSelect, MobilePrimaryButton, MobileSuccessScreen } from './components/MobileFormShell';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const AGREEMENTS = [
  {
    id: 'terms-of-service',
    title: 'Terms of Service',
    titleHe: 'תנאי שימוש',
    version: 'v4.2 – March 2026',
    description: 'General terms governing use of all PetWash™ platforms',
    content: `PETWASH™ TERMS OF SERVICE – VERSION 4.2 (MARCH 2026)

1. PARTIES
These Terms of Service ("Agreement") are entered into between PetWash™ Ltd., company registration number 515234567, registered in Israel ("PetWash", "we", "us"), and the user ("you", "User").

2. SERVICES
PetWash™ operates the following platforms: K9000 automated pet wash stations, Sitter Suite, Walk My Pet, PetTrek, Academy, and Plush Lab. By using any of our platforms, you agree to these terms.

3. ELIGIBILITY
You must be at least 18 years old to use our services. By accepting, you represent that you meet this requirement.

4. PAYMENT & VAT
All prices include VAT at the current Israeli rate (18% as of 2026). Payments are processed via secure PCI-DSS compliant gateways. Refunds are processed within 3–7 business days.

5. PET SAFETY
You are responsible for ensuring your pet is healthy and fit for the requested service. PetWash™ reserves the right to refuse service if a pet displays signs of illness, aggression, or other conditions that may compromise safety.

6. CANCELLATION POLICY
Free cancellation up to 2 hours before scheduled service. Late cancellations may incur a fee of 50% of the service price.

7. LIABILITY
PetWash™ carries full commercial liability insurance. In the event of an incident, please contact us immediately at support@petwash.co.il.

8. DATA PROTECTION
Your personal data is processed in accordance with Israeli Privacy Protection Law 5742-1981 and GDPR principles. See our Privacy Policy at petwash.co.il/privacy-policy.

9. GOVERNING LAW
This agreement is governed by the laws of the State of Israel. Disputes shall be resolved in Tel Aviv courts.

10. CONTACT
PetWash™ Ltd. | 1 Rothschild Blvd, Tel Aviv 6688101 | support@petwash.co.il | 1-800-PETWASH`,
  },
  {
    id: 'provider-agreement',
    title: 'Provider Service Agreement',
    titleHe: 'הסכם ספק שירות',
    version: 'v3.1 – March 2026',
    description: 'Agreement for service providers on all PetWash™ platforms',
    content: `PETWASH™ PROVIDER SERVICE AGREEMENT – VERSION 3.1

1. ENGAGEMENT
This agreement governs the independent contractor relationship between PetWash™ Ltd. and the Provider. The Provider is not an employee of PetWash™.

2. COMMISSION STRUCTURE
PetWash™ retains a platform commission of 15–25% depending on the service tier. Providers receive payment within 3 business days of service completion.

3. STANDARDS OF SERVICE
All providers must maintain a minimum rating of 4.2 stars. Providers are required to comply with all animal welfare laws in force in Israel.

4. BACKGROUND VERIFICATION
All providers consent to identity verification and background checks. False information will result in immediate suspension.

5. INSURANCE
Providers are required to maintain professional liability insurance with a minimum coverage of ₪500,000.

6. INTELLECTUAL PROPERTY
PetWash™ retains all rights to its brand, marks, and platform content. Providers may not use the PetWash™ brand independently.

7. TERMINATION
Either party may terminate this agreement with 14 days written notice. PetWash™ may terminate immediately for breach of conduct standards.`,
  },
  {
    id: 'club-membership',
    title: 'Club Membership Agreement',
    titleHe: 'הסכם חברות במועדון',
    version: 'v2.0 – March 2026',
    description: 'Terms for Prestige Club Gold, Platinum, and Diamond members',
    content: `PETWASH™ PRESTIGE CLUB MEMBERSHIP AGREEMENT – VERSION 2.0

1. MEMBERSHIP TIERS
Gold: ₪89/month | Platinum: ₪149/month | Diamond: ₪249/month
All prices include VAT 18%.

2. BENEFITS
Club benefits are non-transferable and apply to one registered pet per membership.

3. BILLING
Membership fees are billed monthly by automatic credit card charge. You may cancel at any time with 30 days notice.

4. REFUND POLICY
Monthly fees are non-refundable after the 14-day cooling-off period. Unused wash credits roll over for one month.

5. SUSPENSION
PetWash™ reserves the right to suspend a membership for violation of our Terms of Service.`,
  },
  {
    id: 'data-processing',
    title: 'Data Processing Agreement',
    titleHe: 'הסכם עיבוד נתונים',
    version: 'v1.5 – March 2026',
    description: 'GDPR & Israeli Privacy Law DPA for business customers',
    content: `PETWASH™ DATA PROCESSING AGREEMENT – VERSION 1.5

This Data Processing Agreement ("DPA") applies to the processing of personal data by PetWash™ on behalf of business customers ("Controller").

1. ROLES
PetWash™ acts as Data Processor. The business customer acts as Data Controller.

2. DATA CATEGORIES
Personal data processed includes: name, email, phone, address, payment data, and pet health information.

3. LEGAL BASIS
Processing is conducted under consent (Art. 6(1)(a) GDPR) and contractual necessity (Art. 6(1)(b) GDPR).

4. SECURITY MEASURES
AES-256 encryption at rest, TLS 1.3 in transit, access controls, audit logging, and annual penetration testing.

5. SUB-PROCESSORS
Approved sub-processors: Google Cloud Platform (Firebase, Cloud Run), SendGrid, Twilio, uPay, Sumit, Nayax.

6. DATA RETENTION
Personal data is retained for 7 years to comply with Israeli tax law, then securely deleted.

7. RIGHTS
Data subjects may exercise rights of access, correction, deletion, and portability at privacy@petwash.co.il.`,
  },
];

const DEPARTMENTS = [
  'Customer / Individual',
  'HR & Employment',
  'Legal & Compliance',
  'Finance & Accounting',
  'Operations',
  'Marketing',
  'Technology',
  'Provider Relations',
];

export default function LegalAgreementForm() {
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const contractRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState('');
  const [hasScrolled, setHasScrolled] = useState(false);
  const [form, setForm] = useState({
    fullName: '', idNumber: '', email: '', department: '',
    representingCompany: '', companyRegNumber: '',
    accepted: false,
  });

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));
  const agreement = AGREEMENTS.find(a => a.id === selected);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 60) setHasScrolled(true);
  };

  const submit = async () => {
    if (!form.fullName || !form.idNumber || !form.email) {
      toast({ variant: 'destructive', title: 'Name, ID and email are required' }); return;
    }
    if (!form.accepted) {
      toast({ variant: 'destructive', title: 'You must read and accept the agreement' }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/legal-agreement', {
        ...form,
        agreementId: selected,
        agreementTitle: agreement?.title,
        agreementVersion: agreement?.version,
        signedAt: new Date().toISOString(),
      }) as any;
      setSuccess(res?.signatureId || `SIG-${Date.now().toString(36).toUpperCase()}`);
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Contact legal@petwash.co.il' });
    } finally { setLoading(false); }
  };

  if (success) return (
    <MobileSuccessScreen
      emoji="✍️"
      title="Agreement Signed"
      titleHe="ההסכם נחתם"
      message="A signed copy has been sent to your email. This acceptance is legally binding."
      messageHe="עותק חתום נשלח לאימייל שלך"
      refId={success}
      refLabel="Signature ID"
      onDone={() => nav('/')}
    />
  );

  return (
    <MobileFormShell
      emoji="📜"
      title="Legal Agreements"
      titleHe="הסכמים משפטיים"
      subtitle="Digital signing — legally binding under Israeli law"
      step={step}
      totalSteps={2}
      onBack={step > 1 ? () => { setStep(1); setHasScrolled(false); } : undefined}
      footer={
        step === 1 ? (
          <MobilePrimaryButton onClick={() => {
            if (!selected) { toast({ variant: 'destructive', title: 'Select an agreement' }); return; }
            setStep(2);
          }}>
            Read & Sign →
          </MobilePrimaryButton>
        ) : (
          <MobilePrimaryButton onClick={submit} loading={loading} disabled={!hasScrolled || !form.accepted}>
            {!hasScrolled ? 'Scroll to read full agreement ↓' : '✍️ Sign Agreement'}
          </MobilePrimaryButton>
        )
      }
    >
      {step === 1 && (
        <>
          <MobileSection title="Select Agreement" titleHe="בחר הסכם">
            <div className="space-y-2">
              {AGREEMENTS.map(a => (
                <label
                  key={a.id}
                  className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    selected === a.id
                      ? 'border-[#C6A35B] bg-[#C6A35B]/10'
                      : 'border-white/8 bg-white/[0.02]'
                  }`}
                >
                  <input type="radio" name="agreement" value={a.id} checked={selected === a.id}
                    onChange={() => setSelected(a.id)} className="mt-0.5 accent-[#C6A35B] w-4 h-4 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-semibold">{a.title}</p>
                      <span className="text-white/30 text-xs">{a.version}</span>
                    </div>
                    <p className="text-white/40 text-xs mt-0.5" dir="rtl">{a.titleHe}</p>
                    <p className="text-white/35 text-xs mt-1">{a.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </MobileSection>

          <MobileSection title="Your Details" titleHe="פרטי החותם">
            <MobileField label="Full Legal Name" labelHe="שם מלא" required>
              <MobileInput value={form.fullName} onChange={v => set('fullName', v)} placeholder="David Ben Cohen" autoComplete="name" />
            </MobileField>
            <MobileField label="ID / Passport Number" labelHe="תעודת זהות" required>
              <MobileInput value={form.idNumber} onChange={v => set('idNumber', v)} inputMode="numeric" placeholder="123456789" />
            </MobileField>
            <MobileField label="Email" labelHe="אימייל" required>
              <MobileInput type="email" value={form.email} onChange={v => set('email', v)} inputMode="email" placeholder="legal@company.co.il" />
            </MobileField>
            <MobileField label="Department / Role" labelHe="מחלקה / תפקיד">
              <MobileSelect value={form.department} onChange={v => set('department', v)}>
                <option value="">Select…</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </MobileSelect>
            </MobileField>
            <MobileField label="Company Name (if applicable)" labelHe="שם חברה">
              <MobileInput value={form.representingCompany} onChange={v => set('representingCompany', v)} placeholder="ABC Ltd." />
            </MobileField>
            <MobileField label="Company Reg. No." labelHe="מספר חברה">
              <MobileInput value={form.companyRegNumber} onChange={v => set('companyRegNumber', v)} inputMode="numeric" placeholder="515000000" />
            </MobileField>
          </MobileSection>
        </>
      )}

      {step === 2 && agreement && (
        <>
          <div className="flex items-center gap-3 bg-[#C6A35B]/10 border border-[#C6A35B]/30 rounded-2xl p-4">
            <ScrollText className="w-6 h-6 text-[#E7C978] shrink-0" />
            <div>
              <p className="text-white font-semibold text-sm">{agreement.title}</p>
              <p className="text-white/40 text-xs">{agreement.version} · {agreement.description}</p>
            </div>
          </div>

          <div
            ref={contractRef}
            onScroll={handleScroll}
            className="bg-black/30 border border-white/8 rounded-2xl p-5 h-72 overflow-y-auto text-white/65 text-xs leading-relaxed font-mono whitespace-pre-wrap"
          >
            {agreement.content}
            <div className="h-12 flex items-center justify-center mt-4">
              {hasScrolled ? (
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>You have read the full agreement</span>
                </div>
              ) : (
                <span className="text-white/25 text-xs">↓ Continue reading…</span>
              )}
            </div>
          </div>

          <label className={`flex gap-3 items-start p-4 rounded-xl border cursor-pointer transition-all ${
            hasScrolled ? 'border-[#C6A35B]/40 bg-[#C6A35B]/8' : 'border-white/8 bg-white/[0.02] opacity-50'
          }`}>
            <input
              type="checkbox"
              className="mt-0.5 w-5 h-5 rounded accent-[#C6A35B]"
              checked={form.accepted}
              disabled={!hasScrolled}
              onChange={e => set('accepted', e.target.checked)}
            />
            <div>
              <p className="text-white/80 text-sm font-medium">I have read, understood, and accept this agreement <span className="text-red-400">*</span></p>
              <p className="text-white/35 text-xs mt-0.5" dir="rtl">קראתי והבנתי את ההסכם ואני מסכים/ה לתנאיו</p>
              <p className="text-white/25 text-xs mt-1">Signed electronically as {form.fullName} · ID {form.idNumber}</p>
            </div>
          </label>

          <div className="flex items-center gap-2 text-white/25 text-xs px-1">
            <Shield className="w-4 h-4 shrink-0" />
            <span>Electronic signatures are legally binding under the Israeli Electronic Signature Law 5761-2001.</span>
          </div>
        </>
      )}
    </MobileFormShell>
  );
}
