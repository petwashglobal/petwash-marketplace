import { useState } from 'react';
import { FormLayout, FormSuccess, Field, FormSection, inputCls, textareaCls, selectCls, SubmitButton } from './FormLayout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} type="button" onClick={() => onChange(star)} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} className="focus:outline-none">
            <Star className={`h-8 w-8 transition-colors ${(hover || value) >= star ? 'fill-[#C6A35B] text-[#C6A35B]' : 'text-gray-600'}`} />
          </button>
        ))}
        {value > 0 && <span className="ml-2 text-sm text-gray-400 self-center">{value}/5</span>}
      </div>
    </div>
  );
}

export default function ReviewForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [overall, setOverall] = useState(0);
  const [quality, setQuality] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', phone: '', platform: '', reviewTitle: '', reviewText: '', wouldRecommend: '', bookingRef: '', referralSource: '' });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.platform || overall === 0 || !form.reviewText) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' }); return;
    }
    if (form.reviewText.length < 20) { toast({ variant: 'destructive', title: 'Review must be at least 20 characters' }); return; }
    setLoading(true);
    try {
      await apiRequest('POST', '/api/global-forms/feedback', {
        customerName: form.name, email: form.email, platform: form.platform,
        serviceType: form.platform, rating: overall, reviewTitle: form.reviewTitle || 'Review',
        reviewText: form.reviewText, wouldRecommend: form.wouldRecommend === 'yes',
      });
      setSuccess(true);
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Please try again or contact us directly.' });
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <FormLayout title="Customer Review" titleHe="ביקורת לקוח" description="" descriptionHe="" icon="⭐">
        <FormSuccess title="Thank you for your review!" subtitle="תודה על הביקורת שלך!" detail="Your feedback helps us improve our services for all pet owners." onReset={() => { setSuccess(false); setForm({ name: '', email: '', phone: '', platform: '', reviewTitle: '', reviewText: '', wouldRecommend: '', bookingRef: '', referralSource: '' }); setOverall(0); setQuality(0); setProfessionalism(0); setValueForMoney(0); }} />
      </FormLayout>
    );
  }

  return (
    <FormLayout title="Customer Review & Rating" titleHe="ביקורת לקוח וציון" description="Share your experience with PetWash™ services. Your honest feedback helps us improve and helps other pet owners make informed decisions." descriptionHe="שתפו את חווייתכם עם שירותי PetWash™. המשוב שלכם עוזר לנו להשתפר." icon="⭐">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSection title="Your Details / פרטים אישיים" />
          <Field label="Full Name" labelHe="שם מלא" required><input className={inputCls} value={form.name} onChange={set('name')} placeholder="John Smith" /></Field>
          <Field label="Email Address" labelHe="כתובת אימייל" required><input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="you@example.com" /></Field>
          <Field label="Phone Number" labelHe="טלפון"><input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+972 50 000 0000" /></Field>
          <Field label="Service Platform" labelHe="פלטפורמה" required>
            <select className={selectCls} value={form.platform} onChange={set('platform')}>
              <option value="">Select platform...</option>
              <option value="K9000">K9000 Dog Wash</option>
              <option value="SITTER">Sitter Suite</option>
              <option value="WALKER">Walk My Pet</option>
              <option value="PETTREK">PetTrek Transport</option>
              <option value="ACADEMY">PetWash Academy</option>
            </select>
          </Field>
          <Field label="Booking Reference" labelHe="מזהה הזמנה"><input className={inputCls} value={form.bookingRef} onChange={set('bookingRef')} placeholder="e.g. K9000-123456" /></Field>

          <FormSection title="Your Ratings / דירוגים" />
          <div className="col-span-full grid sm:grid-cols-2 gap-4">
            <StarRating value={overall} onChange={setOverall} label="Overall Experience / חוויה כוללת *" />
            <StarRating value={quality} onChange={setQuality} label="Quality of Service / איכות שירות" />
            <StarRating value={professionalism} onChange={setProfessionalism} label="Professionalism / מקצועיות" />
            <StarRating value={valueForMoney} onChange={setValueForMoney} label="Value for Money / תמורה לכסף" />
          </div>

          <FormSection title="Your Review / הביקורת שלכם" />
          <Field label="Review Title" labelHe="כותרת"><input className={inputCls} value={form.reviewTitle} onChange={set('reviewTitle')} placeholder="e.g. Excellent grooming experience!" /></Field>
          <Field label="Would You Recommend?" labelHe="ממליצים?" required>
            <select className={selectCls} value={form.wouldRecommend} onChange={set('wouldRecommend')}>
              <option value="">Select...</option>
              <option value="yes">Yes, definitely! / כן, בהחלט!</option>
              <option value="probably">Probably yes / כנראה שכן</option>
              <option value="maybe">Not sure / לא בטוח</option>
              <option value="no">No / לא</option>
            </select>
          </Field>
          <div className="col-span-full">
            <Field label="Your Review" labelHe="ביקורתכם" required>
              <textarea className={textareaCls} rows={5} value={form.reviewText} onChange={set('reviewText')} placeholder="Tell us about your experience in detail. What did you enjoy? What could be improved?" />
              <p className="text-xs text-gray-600 mt-1">{form.reviewText.length}/20 characters minimum</p>
            </Field>
          </div>
          <Field label="How did you hear about us?" labelHe="איך שמעתם עלינו?">
            <select className={selectCls} value={form.referralSource} onChange={set('referralSource')}>
              <option value="">Select...</option>
              <option value="google">Google Search</option>
              <option value="social">Social Media</option>
              <option value="friend">Friend Referral</option>
              <option value="returning">Returning Customer</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>
        <SubmitButton loading={loading} label="Submit Review / שלח ביקורת" />
      </form>
    </FormLayout>
  );
}
