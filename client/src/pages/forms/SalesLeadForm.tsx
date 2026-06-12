import { useState } from 'react';
import { FormLayout, FormSuccess, Field, FormSection, inputCls, textareaCls, selectCls, SubmitButton } from './FormLayout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';

export default function SalesLeadForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    contactName: '', company: '', email: '', phone: '', address: '', city: '', country: 'Israel / ישראל',
    // Israel-aware structured address (auto-filled by Google Places autocomplete; optional)
    apartment: '', postalCode: '', latitude: '', longitude: '', placeId: '',
    inquiryType: '', serviceInterest: '', estimatedVolume: '', numberOfPets: '',
    description: '', bestContactTime: '', referralSource: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactName || !form.email || !form.phone || !form.city || !form.inquiryType || !form.serviceInterest || !form.description) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/sales-lead', form) as any;
      setSuccess(res.leadId || 'LEAD-OK');
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Please try again.' });
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <FormLayout title="Business Inquiry" titleHe="פנייה עסקית" description="" descriptionHe="" icon="🤝">
        <FormSuccess title="Inquiry Received!" subtitle="הפנייה התקבלה!" refId={success} detail="Our sales team will contact you within 24 hours." onReset={() => setSuccess(null)} />
      </FormLayout>
    );
  }

  return (
    <FormLayout title="Business Inquiry & Sales Lead" titleHe="פנייה עסקית ולידים" description="Interested in partnering with PetWash™ or using our enterprise services? Fill in the form and our sales team will contact you within 24 hours." descriptionHe="מעוניינים בשיתוף פעולה עסקי עם PetWash™? נחזור אליכם תוך 24 שעות." icon="🤝">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSection title="Contact Details / פרטי יצירת קשר" />
          <Field label="Contact Name" labelHe="שם איש קשר" required><input className={inputCls} value={form.contactName} onChange={set('contactName')} placeholder="Full name" /></Field>
          <Field label="Company / Organization" labelHe="חברה"><input className={inputCls} value={form.company} onChange={set('company')} placeholder="Company name (optional)" /></Field>
          <Field label="Email Address" labelHe="אימייל" required><input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="you@company.com" /></Field>
          <Field label="Phone Number" labelHe="טלפון" required><input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+972 50 000 0000" /></Field>
          <div className="col-span-full">
            <GooglePlacesAutocomplete
              value={form.address}
              onChange={(v) => setForm(f => ({ ...f, address: v }))}
              onPlaceSelected={(place: PlaceDetails) => setForm(f => ({
                ...f,
                address: place.formattedAddress || f.address,
                city: place.city || f.city,
                country: place.country || f.country,
                postalCode: place.postalCode || '',
                latitude: place.lat != null ? String(place.lat) : '',
                longitude: place.lng != null ? String(place.lng) : '',
                placeId: place.placeId || '',
              }))}
              label="Street Address / כתובת (Optional)"
              apartmentLabel="דירה / Apartment"
              postalCodeLabel="מיקוד / Postal Code"
            />
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
          <Field label="Best Time to Contact" labelHe="זמן נוח לצור קשר">
            <select className={selectCls} value={form.bestContactTime} onChange={set('bestContactTime')}>
              <option value="">Any time</option>
              <option>Morning 8–12</option>
              <option>Afternoon 12–17</option>
              <option>Evening 17–20</option>
            </select>
          </Field>

          <FormSection title="Inquiry Details / פרטי הפנייה" />
          <Field label="Inquiry Type" labelHe="סוג הפנייה" required>
            <select className={selectCls} value={form.inquiryType} onChange={set('inquiryType')}>
              <option value="">Select type...</option>
              <option>Enterprise Partnership</option>
              <option>API Integration</option>
              <option>Reseller / Distributor</option>
              <option>White Label Licensing</option>
              <option>Bulk Bookings</option>
              <option>Supplier / Vendor</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Service Interest" labelHe="שירות מבוקש" required>
            <select className={selectCls} value={form.serviceInterest} onChange={set('serviceInterest')}>
              <option value="">Select service...</option>
              <option>K9000 Wash Stations</option>
              <option>Sitter Suite Platform</option>
              <option>Walk My Pet</option>
              <option>PetTrek Transport</option>
              <option>PetWash Academy</option>
              <option>Multiple Platforms</option>
              <option>Full Suite</option>
            </select>
          </Field>
          <Field label="Estimated Monthly Volume" labelHe="נפח חודשי משוער">
            <select className={selectCls} value={form.estimatedVolume} onChange={set('estimatedVolume')}>
              <option value="">Not sure yet</option>
              <option>Under ₪10,000</option>
              <option>₪10K–₪50K</option>
              <option>₪50K–₪200K</option>
              <option>Over ₪200K</option>
            </select>
          </Field>
          <Field label="Number of Pets / Animals" labelHe="מספר בעלי חיים"><input className={inputCls} value={form.numberOfPets} onChange={set('numberOfPets')} placeholder="e.g. 50 dogs monthly" /></Field>
          <Field label="How did you hear about PetWash™?">
            <select className={selectCls} value={form.referralSource} onChange={set('referralSource')}>
              <option value="">Select...</option>
              <option>Google</option><option>LinkedIn</option><option>Referral</option>
              <option>Industry Event</option><option>News / Media</option><option>Other</option>
            </select>
          </Field>

          <div className="col-span-full">
            <Field label="Describe Your Needs" labelHe="תיאור הצרכים שלכם" required>
              <textarea className={textareaCls} rows={5} value={form.description} onChange={set('description')} placeholder="Tell us about your business, your needs, and what you're looking to achieve with PetWash™..." />
            </Field>
          </div>
        </div>
        <SubmitButton loading={loading} label="Send Inquiry / שלח פנייה" />
      </form>
    </FormLayout>
  );
}
