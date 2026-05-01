import { useState } from 'react';
import { FormLayout, FormSuccess, Field, FormSection, inputCls, textareaCls, selectCls, SubmitButton } from './FormLayout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';

export default function RefundForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', address: '', city: '',
    // Israel-aware structured address (auto-filled by Google Places autocomplete; optional)
    apartment: '', postalCode: '', latitude: '', longitude: '', placeId: '',
    bookingId: '', serviceType: '', bookingDate: '',
    amountPaid: '', refundAmount: '', reason: '', description: '', refundMethod: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.phone || !form.bookingId || !form.serviceType || !form.amountPaid || !form.refundAmount || !form.reason || !form.description || !form.refundMethod) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/refund-request', form) as any;
      setSuccess(res.requestId || 'REF-OK');
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Please try again or email finance@petwash.co.il' });
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <FormLayout title="Refund Request" titleHe="בקשת החזר כספי" description="" descriptionHe="" icon="↩️">
        <FormSuccess title="Refund Request Submitted" subtitle="בקשת ההחזר נשלחה" refId={success} detail="Our finance team reviews requests within 2–5 business days. You'll receive an email update." onReset={() => setSuccess(null)} />
      </FormLayout>
    );
  }

  return (
    <FormLayout title="Refund Request" titleHe="בקשת החזר כספי" description="Submit a refund request for any PetWash™ service. Our finance team reviews all requests within 2–5 business days and will notify you by email." descriptionHe="הגישו בקשה להחזר כספי. צוות הכספים שלנו בוחן כל בקשה תוך 2–5 ימי עסקים." icon="↩️">
      <div className="mb-4 bg-amber-950/30 border border-amber-700/30 rounded-lg p-3 flex gap-2 text-sm text-amber-200">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-400" />
        <span>For urgent issues or disputes, please also contact us directly at <strong>finance@petwash.co.il</strong></span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSection title="Your Details / פרטים אישיים" />
          <Field label="Full Name" labelHe="שם מלא" required><input className={inputCls} value={form.fullName} onChange={set('fullName')} placeholder="Full name" /></Field>
          <Field label="Email Address" labelHe="אימייל" required><input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="you@example.com" /></Field>
          <Field label="Phone Number" labelHe="טלפון" required><input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+972 50 000 0000" /></Field>
          <Field label="City" labelHe="עיר"><input className={inputCls} value={form.city} onChange={set('city')} placeholder="Tel Aviv" /></Field>
          <div className="col-span-full">
            <GooglePlacesAutocomplete
              value={form.address}
              onChange={(v) => setForm(f => ({ ...f, address: v }))}
              onPlaceSelected={(place: PlaceDetails) => setForm(f => ({
                ...f,
                address: place.formattedAddress || f.address,
                city: place.city || f.city,
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

          <FormSection title="Booking Details / פרטי ההזמנה" />
          <Field label="Booking / Transaction ID" labelHe="מזהה הזמנה" required><input className={inputCls} value={form.bookingId} onChange={set('bookingId')} placeholder="e.g. K9000-123456 or SITTER-789" /></Field>
          <Field label="Service Type" labelHe="סוג שירות" required>
            <select className={selectCls} value={form.serviceType} onChange={set('serviceType')}>
              <option value="">Select service...</option>
              <option>K9000 Dog Wash</option>
              <option>Sitter Suite</option>
              <option>Walk My Pet</option>
              <option>PetTrek Transport</option>
              <option>PetWash Academy</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Booking Date" labelHe="תאריך ההזמנה"><input type="date" className={inputCls} value={form.bookingDate} onChange={set('bookingDate')} /></Field>
          <Field label="Reason for Refund" labelHe="סיבת ההחזר" required>
            <select className={selectCls} value={form.reason} onChange={set('reason')}>
              <option value="">Select reason...</option>
              <option>Service not provided / השירות לא ניתן</option>
              <option>Service quality issue / בעיית איכות</option>
              <option>Pet injury / פציעת חיית מחמד</option>
              <option>Cancelled by provider / בוטל ע"י ספק</option>
              <option>Duplicate charge / חיוב כפול</option>
              <option>Other / אחר</option>
            </select>
          </Field>

          <FormSection title="Refund Amount / סכום ההחזר" />
          <Field label="Amount Paid (₪)" labelHe="סכום ששולם" required><input className={inputCls} value={form.amountPaid} onChange={set('amountPaid')} placeholder="e.g. 249" /></Field>
          <Field label="Refund Amount Requested (₪)" labelHe="סכום החזר מבוקש" required><input className={inputCls} value={form.refundAmount} onChange={set('refundAmount')} placeholder="e.g. 249" /></Field>
          <Field label="Preferred Refund Method" labelHe="שיטת החזר" required>
            <select className={selectCls} value={form.refundMethod} onChange={set('refundMethod')}>
              <option value="">Select method...</option>
              <option>Original payment method / שיטת התשלום המקורית</option>
              <option>Credit to PetWash™ Wallet / קרדיט לארנק</option>
              <option>Bank Transfer / העברה בנקאית</option>
            </select>
          </Field>

          <div className="col-span-full">
            <Field label="Description of Issue" labelHe="תיאור הבעיה" required>
              <textarea className={textareaCls} rows={5} value={form.description} onChange={set('description')} placeholder="Please describe in detail what happened and why you are requesting a refund..." />
            </Field>
          </div>
        </div>
        <SubmitButton loading={loading} label="Submit Refund Request / שלח בקשת החזר" />
      </form>
    </FormLayout>
  );
}
