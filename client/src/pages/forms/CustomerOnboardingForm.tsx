import { useState } from 'react';
import { FormLayout, FormSuccess, Field, FormSection, inputCls, textareaCls, selectCls, SubmitButton } from './FormLayout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';

export default function CustomerOnboardingForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    ownerFirstName: '', ownerLastName: '', email: '', phone: '',
    address: '', city: '', country: 'Israel / ישראל', language: '',
    // Israel-aware structured address (auto-filled by Google Places autocomplete)
    apartment: '', postalCode: '', latitude: '', longitude: '', placeId: '',
    petName: '', species: '', breed: '', age: '', weight: '', gender: '',
    microchipNumber: '', vetName: '', vetPhone: '',
    allergies: '', medicalNotes: '', vaccinationsUpToDate: '', referralSource: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ownerFirstName || !form.ownerLastName || !form.email || !form.phone || !form.address || !form.city || !form.petName || !form.species || !form.age || !form.vaccinationsUpToDate) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' }); return;
    }
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/global-forms/customer-onboarding', form) as any;
      setSuccess(res.petId || 'PET-OK');
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Please try again.' });
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <FormLayout title="Customer Onboarding" titleHe="אונבורדינג לקוחות" description="" descriptionHe="" icon="🐾">
        <FormSuccess title={`Welcome to PetWash™! 🐾`} subtitle="ברוכים הבאים ל-PetWash™!" refId={success} detail={`${form.petName} is now registered. You'll receive a confirmation email shortly.`} onReset={() => setSuccess(null)} />
      </FormLayout>
    );
  }

  return (
    <FormLayout title="Customer Onboarding & Pet Registration" titleHe="אונבורדינג לקוחות ורישום חיית מחמד" description="Welcome to PetWash™! Complete your profile and register your pet to unlock all our services. It takes about 3 minutes." descriptionHe="ברוכים הבאים ל-PetWash™! השלימו את פרופילכם ורשמו את חיית המחמד שלכם." icon="🐾">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSection title="Owner Details / פרטי הבעלים" />
          <Field label="First Name" labelHe="שם פרטי" required><input className={inputCls} value={form.ownerFirstName} onChange={set('ownerFirstName')} placeholder="First name" /></Field>
          <Field label="Last Name" labelHe="שם משפחה" required><input className={inputCls} value={form.ownerLastName} onChange={set('ownerLastName')} placeholder="Last name" /></Field>
          <Field label="Email Address" labelHe="אימייל" required><input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="you@example.com" /></Field>
          <Field label="Phone Number" labelHe="טלפון" required><input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+972 50 000 0000" /></Field>

          <FormSection title="Address / כתובת" />
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
              label="Street Address / כתובת"
              required
              apartmentLabel="דירה / Apartment"
              apartmentPlaceholder="77"
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
          <Field label="Preferred Language" labelHe="שפה מועדפת">
            <select className={selectCls} value={form.language} onChange={set('language')}>
              <option value="">Any</option>
              <option value="he">Hebrew / עברית</option>
              <option value="en">English</option>
              <option value="ar">Arabic / ערבית</option>
              <option value="ru">Russian / רוסית</option>
            </select>
          </Field>

          <FormSection title="Pet Details / פרטי חיית המחמד" />
          <Field label="Pet Name" labelHe="שם החיה" required><input className={inputCls} value={form.petName} onChange={set('petName')} placeholder="e.g. Buddy" /></Field>
          <Field label="Animal Species" labelHe="סוג בעל חיים" required>
            <select className={selectCls} value={form.species} onChange={set('species')}>
              <option value="">Select species...</option>
              <option>Dog / כלב</option>
              <option>Cat / חתול</option>
              <option>Rabbit / ארנב</option>
              <option>Bird / ציפור</option>
              <option>Reptile / זוחל</option>
              <option>Other / אחר</option>
            </select>
          </Field>
          <Field label="Breed" labelHe="גזע"><input className={inputCls} value={form.breed} onChange={set('breed')} placeholder="e.g. Golden Retriever" /></Field>
          <Field label="Age (years)" labelHe="גיל" required><input className={inputCls} value={form.age} onChange={set('age')} placeholder="e.g. 3" /></Field>
          <Field label="Weight (kg)" labelHe='משקל (ק"ג)'><input className={inputCls} value={form.weight} onChange={set('weight')} placeholder="e.g. 25" /></Field>
          <Field label="Gender" labelHe="מין">
            <select className={selectCls} value={form.gender} onChange={set('gender')}>
              <option value="">Select...</option>
              <option>Male / זכר</option>
              <option>Female / נקבה</option>
              <option>Neutered Male / זכר מסורס</option>
              <option>Spayed Female / נקבה מעוקרת</option>
            </select>
          </Field>
          <Field label="Microchip Number" labelHe="מספר שבב"><input className={inputCls} value={form.microchipNumber} onChange={set('microchipNumber')} placeholder="15-digit chip number (optional)" /></Field>
          <Field label="Vaccinations Up to Date?" labelHe="חיסונים עדכניים?" required>
            <select className={selectCls} value={form.vaccinationsUpToDate} onChange={set('vaccinationsUpToDate')}>
              <option value="">Select...</option>
              <option>Yes / כן</option>
              <option>No / לא</option>
              <option>Don't know / לא יודע</option>
            </select>
          </Field>

          <FormSection title="Veterinary & Medical / ווטרינר ובריאות" />
          <Field label="Vet Name" labelHe="שם הווטרינר"><input className={inputCls} value={form.vetName} onChange={set('vetName')} placeholder="Dr. Cohen" /></Field>
          <Field label="Vet Phone" labelHe="טלפון וטרינר"><input className={inputCls} value={form.vetPhone} onChange={set('vetPhone')} placeholder="+972 3 000 0000" /></Field>
          <div className="col-span-full">
            <Field label="Known Allergies" labelHe="אלרגיות ידועות">
              <textarea className={textareaCls} rows={2} value={form.allergies} onChange={set('allergies')} placeholder="e.g. Allergic to chicken-based food, bee stings..." />
            </Field>
          </div>
          <div className="col-span-full">
            <Field label="Medical Notes" labelHe="הערות רפואיות">
              <textarea className={textareaCls} rows={3} value={form.medicalNotes} onChange={set('medicalNotes')} placeholder="Any conditions, medications, or special needs we should know about..." />
            </Field>
          </div>
          <Field label="How did you hear about PetWash™?">
            <select className={selectCls} value={form.referralSource} onChange={set('referralSource')}>
              <option value="">Select...</option>
              <option>Google</option><option>App Store</option><option>Social Media</option>
              <option>Friend Referral</option><option>Vet Recommendation</option>
              <option>Walk-in / K9000 Station</option><option>Other</option>
            </select>
          </Field>
        </div>
        <SubmitButton loading={loading} label="Register My Pet / רשום את חיית המחמד שלי" />
      </form>
    </FormLayout>
  );
}
