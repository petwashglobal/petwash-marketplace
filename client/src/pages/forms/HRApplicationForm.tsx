import { useState } from 'react';
import { FormLayout, FormSuccess, Field, FormSection, inputCls, textareaCls, selectCls, SubmitButton } from './FormLayout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function HRApplicationForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
    address: '', city: '', country: 'Israel / ישראל',
    position: '', department: '', yearsExperience: '', educationLevel: '',
    taxId: '', linkedinUrl: '', expectedSalary: '', startDate: '',
    coverLetter: '', referencesAvailable: '', referralSource: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.position || !form.department || !form.coverLetter) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/hr-application', form) as any;
      setSuccess(res.applicationId || 'HR-OK');
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Please try again.' });
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <FormLayout title="HR Job Application" titleHe="בקשת מועמדות לתפקיד" description="" descriptionHe="" icon="💼">
        <FormSuccess title="Application Received!" subtitle="הבקשה התקבלה!" refId={success} detail="We review all applications within 5 business days. You'll hear from our HR team shortly." onReset={() => setSuccess(null)} />
      </FormLayout>
    );
  }

  return (
    <FormLayout title="HR Job Application" titleHe="בקשת מועמדות לתפקיד" description="Apply for a position at PetWash™. We are a fast-growing Israeli pet care technology company with operations across multiple countries. We'll review your application within 5 business days." descriptionHe="הגישו מועמדות לתפקיד ב-PetWash™. אנו חברת טכנולוגיה ישראלית בצמיחה מהירה." icon="💼">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSection title="Personal Details / פרטים אישיים" />
          <Field label="First Name" labelHe="שם פרטי" required><input className={inputCls} value={form.firstName} onChange={set('firstName')} placeholder="First name" /></Field>
          <Field label="Last Name" labelHe="שם משפחה" required><input className={inputCls} value={form.lastName} onChange={set('lastName')} placeholder="Last name" /></Field>
          <Field label="Email Address" labelHe="אימייל" required><input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="you@example.com" /></Field>
          <Field label="Phone Number" labelHe="טלפון" required><input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+972 50 000 0000" /></Field>
          <Field label="Date of Birth" labelHe="תאריך לידה"><input type="date" className={inputCls} value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
          <Field label="ID / Tax Number" labelHe="ת.ז. / מספר מס"><input className={inputCls} value={form.taxId} onChange={set('taxId')} placeholder="Optional" /></Field>

          <FormSection title="Location / מיקום" />
          <div className="col-span-full">
            <Field label="Street Address" labelHe="כתובת"><input className={inputCls} value={form.address} onChange={set('address')} placeholder="123 Rothschild Blvd" /></Field>
          </div>
          <Field label="City" labelHe="עיר" required><input className={inputCls} value={form.city} onChange={set('city')} placeholder="Tel Aviv" /></Field>
          <Field label="Country" labelHe="מדינה" required>
            <select className={selectCls} value={form.country} onChange={set('country')}>
              <option>Israel / ישראל</option>
              <option>United Kingdom</option>
              <option>Australia</option>
              <option>Canada</option>
              <option>United States</option>
              <option>Other</option>
            </select>
          </Field>

          <FormSection title="Position Details / פרטי התפקיד" />
          <Field label="Position Applying For" labelHe="תפקיד מבוקש" required>
            <select className={selectCls} value={form.position} onChange={set('position')}>
              <option value="">Select position...</option>
              <option>Operations Manager</option>
              <option>Customer Success</option>
              <option>Software Engineer</option>
              <option>Data Analyst</option>
              <option>Marketing & Growth</option>
              <option>Finance & Accounting</option>
              <option>Legal & Compliance</option>
              <option>Sales Executive</option>
              <option>Regional Manager</option>
              <option>Other / אחר</option>
            </select>
          </Field>
          <Field label="Department" labelHe="מחלקה" required>
            <select className={selectCls} value={form.department} onChange={set('department')}>
              <option value="">Select department...</option>
              <option>Engineering / הנדסה</option>
              <option>Operations / תפעול</option>
              <option>Customer Success / שירות לקוחות</option>
              <option>Marketing / שיווק</option>
              <option>Finance / כספים</option>
              <option>HR / משאבי אנוש</option>
              <option>Legal / משפטי</option>
              <option>Sales / מכירות</option>
            </select>
          </Field>
          <Field label="Years of Experience" labelHe="שנות ניסיון" required>
            <select className={selectCls} value={form.yearsExperience} onChange={set('yearsExperience')}>
              <option value="">Select...</option>
              <option>0–1 years (Entry)</option>
              <option>2–3 years</option>
              <option>4–6 years</option>
              <option>7–10 years</option>
              <option>10+ years (Senior)</option>
            </select>
          </Field>
          <Field label="Education Level" labelHe="השכלה" required>
            <select className={selectCls} value={form.educationLevel} onChange={set('educationLevel')}>
              <option value="">Select...</option>
              <option>High School / תיכון</option>
              <option>Vocational / מקצועי</option>
              <option>Bachelor's Degree / תואר ראשון</option>
              <option>Master's Degree / תואר שני</option>
              <option>PhD / דוקטורט</option>
            </select>
          </Field>
          <Field label="Expected Salary (₪/month)" labelHe="משכורת מבוקשת"><input className={inputCls} value={form.expectedSalary} onChange={set('expectedSalary')} placeholder="e.g. 18,000" /></Field>
          <Field label="Available Start Date" labelHe="תאריך התחלה"><input type="date" className={inputCls} value={form.startDate} onChange={set('startDate')} /></Field>
          <Field label="LinkedIn / Portfolio URL"><input type="url" className={inputCls} value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/..." /></Field>
          <Field label="How did you hear about this position?">
            <select className={selectCls} value={form.referralSource} onChange={set('referralSource')}>
              <option value="">Select...</option>
              <option>LinkedIn</option><option>Indeed</option><option>Company Website</option>
              <option>Referred by Employee</option><option>Social Media</option><option>Other</option>
            </select>
          </Field>

          <FormSection title="Cover Letter / מכתב מוטיבציה" />
          <div className="col-span-full">
            <Field label="Cover Letter" labelHe="מכתב מוטיבציה" required>
              <textarea className={textareaCls} rows={7} value={form.coverLetter} onChange={set('coverLetter')} placeholder="Tell us why you want to work at PetWash™ and what you bring to the team. Minimum 50 characters." />
              <p className="text-xs text-gray-600 mt-1">{form.coverLetter.length} characters (minimum 50)</p>
            </Field>
          </div>
          <Field label="References Available?" labelHe="אסמכתאות?">
            <select className={selectCls} value={form.referencesAvailable} onChange={set('referencesAvailable')}>
              <option value="">Select...</option>
              <option>Yes, upon request / כן, לפי בקשה</option>
              <option>No / לא</option>
            </select>
          </Field>
        </div>
        <SubmitButton loading={loading} label="Submit Application / שלח מועמדות" />
      </form>
    </FormLayout>
  );
}
