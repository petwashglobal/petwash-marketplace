/**
 * PartnerEnquiryForm — the single real enquiry form behind the public
 * /partners/* CTAs.
 *
 * Why this exists (PR-NAV-3, 2026-09-05):
 * "Submit Partnership Enquiry" (/partners/locations) and "Submit Council
 * Enquiry" (/partners/municipal) were `<Button>` elements with NO onClick at
 * all — a landlord or a council clerk could tap them forever and nothing was
 * sent anywhere. That is the exact "label must match action" violation the
 * public-surface lane exists to kill.
 *
 * Contract enforced here:
 *  - Submit reaches a REAL server route (POST /api/franchise/inquiry,
 *    server/routes.ts:12248 — public + CSRF-exempt at server/index.ts:936).
 *  - Validation errors RENDER (inline field errors + a toast), they are not
 *    swallowed.
 *  - Success requires a real server result: res.ok AND a truthy `success`
 *    body. A 200 with `{success:false}` is treated as failure, never as a
 *    green toast.
 *  - Failure shows a real, actionable error — never a blank panel and never
 *    an endless spinner (the `finally` always clears `isSubmitting`).
 *  - Double-submit is guarded twice: a re-entrancy check at the top of the
 *    handler (fires before React can re-render) AND the disabled button.
 *
 * Every string ships HE + EN. No marketing claims, no counts, no ratings,
 * no response-time guarantees — the copy promises only that the enquiry was
 * received and a person will be in touch.
 */

import { useState, type FormEvent } from 'react';
import { getApiUrl } from '@/lib/apiConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/PhoneInput';
import { useToast } from '@/hooks/use-toast';
import {
  Send, CheckCircle2, Loader2, Mail, Phone, User, MapPin, Globe, X, AlertCircle,
} from 'lucide-react';

/** Which public surface the enquiry came from. Prefixed onto the message so
 *  the franchise/partnerships inbox can route it without a new endpoint —
 *  the same technique /partners/suppliers already uses. */
export type PartnerEnquiryKind = 'location' | 'municipal';

interface PartnerEnquiryFormProps {
  kind: PartnerEnquiryKind;
  isHe: boolean;
  open: boolean;
  onClose: () => void;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  phone?: string;
}

const COPY: Record<PartnerEnquiryKind, {
  title: { he: string; en: string };
  subtitle: { he: string; en: string };
  messageLabel: { he: string; en: string };
  messagePlaceholder: { he: string; en: string };
  tag: string;
}> = {
  location: {
    title: { he: 'בקשת שותפות למיקום', en: 'Location Partnership Enquiry' },
    subtitle: {
      he: 'מלאו את הפרטים ונחזור אליכם לגבי אירוח תחנת ⁦K9000™⁩ בנכס שלכם.',
      en: 'Fill in your details and we will come back to you about hosting a ⁦K9000™⁩ station at your property.',
    },
    messageLabel: { he: 'על הנכס והמיקום', en: 'About the property and location' },
    messagePlaceholder: {
      he: 'סוג הנכס, כתובת או אזור, שטח פנוי משוער, חניה, גישה למים וחשמל...',
      en: 'Property type, address or area, approximate free space, parking, water and power access...',
    },
    tag: '[LOCATION / LANDLORD enquiry from /partners/locations]',
  },
  municipal: {
    title: { he: 'פנייה מטעם רשות מקומית', en: 'Municipal & Council Enquiry' },
    subtitle: {
      he: 'מלאו את הפרטים ונחזור אליכם לגבי פרויקט עירוני או שותפות ציבורית-פרטית.',
      en: 'Fill in your details and we will come back to you about a municipal project or public-private partnership.',
    },
    messageLabel: { he: 'על הרשות והפרויקט', en: 'About the authority and the project' },
    messagePlaceholder: {
      he: 'שם הרשות, תפקידכם, האזור או הפארק המדובר, לוח זמנים משוער...',
      en: 'Authority name, your role, the area or park in question, approximate timeline...',
    },
    tag: '[MUNICIPAL / COUNCIL enquiry from /partners/municipal]',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PartnerEnquiryForm({ kind, isHe, open, onClose }: PartnerEnquiryFormProps) {
  const { toast } = useToast();
  const copy = COPY[kind];
  const L = <T,>(pair: { he: T; en: T }) => (isHe ? pair.he : pair.en);

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    message: '',
  });

  if (!open) return null;

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!formData.fullName.trim()) {
      next.fullName = isHe ? 'נא להזין שם מלא' : 'Please enter your full name';
    }
    if (!formData.email.trim()) {
      next.email = isHe ? 'נא להזין כתובת אימייל' : 'Please enter an email address';
    } else if (!EMAIL_RE.test(formData.email.trim())) {
      next.email = isHe ? 'כתובת האימייל אינה תקינה' : 'That email address is not valid';
    }
    if (!formData.phone.trim()) {
      next.phone = isHe ? 'נא להזין מספר טלפון' : 'Please enter a phone number';
    }
    return next;
  };

  const closeAll = () => {
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Guard 1 of 2 — re-entrancy. Fires on a double-tap that lands before
    // React has re-rendered the button into its disabled state.
    if (isSubmitting) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({
        variant: 'destructive',
        title: isHe ? 'חסרים פרטים' : 'Missing details',
        description: isHe
          ? 'נא להשלים את השדות המסומנים ולנסות שוב.'
          : 'Please complete the highlighted fields and try again.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/franchise/inquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          country: formData.country.trim(),
          city: formData.city.trim(),
          message: `${copy.tag}\n\n${formData.message.trim() || '(no message provided)'}`,
        }),
      });

      // A real server result is required before we claim success. Parse
      // defensively: an HTML error page must not crash into a blank panel.
      let body: any = null;
      try { body = await res.json(); } catch { /* non-JSON body */ }

      if (!res.ok || body?.success !== true) {
        const serverMsg = typeof body?.error === 'string' ? body.error : null;
        throw new Error(serverMsg || `Request failed (${res.status})`);
      }

      setSubmitted(true);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isHe ? 'הפנייה לא נשלחה' : 'Enquiry not sent',
        description: isHe
          ? 'לא הצלחנו לשלוח את הפנייה. בדקו את החיבור ונסו שוב, או כתבו לנו במייל.'
          : 'We could not send your enquiry. Check your connection and try again, or email us instead.',
      });
    } finally {
      // Always clears — no endless spinner, even on a thrown/aborted request.
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={closeAll}
      >
        <div
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isHe ? 'הפנייה נשלחה' : 'Enquiry sent'}
          </h2>
          <p className="text-gray-600 mb-6">
            {isHe
              ? 'קיבלנו את הפנייה שלכם. נציג ⁦PetWash™⁩ יחזור אליכם באימייל או בטלפון שהשארתם.'
              : 'We have received your enquiry. A ⁦PetWash™⁩ representative will get back to you at the email or phone you left.'}
          </p>
          <Button onClick={closeAll} className="px-8 py-3 rounded-xl" data-testid="button-partner-enquiry-close-success">
            {isHe ? 'סגור' : 'Close'}
          </Button>
        </div>
      </div>
    );
  }

  const fieldError = (msg?: string) =>
    msg ? (
      <p className="mt-1 flex items-center gap-1 text-xs text-red-600" role="alert">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        {msg}
      </p>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label={isHe ? 'סגור' : 'Close'}
          data-testid="button-partner-enquiry-dismiss"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8932F] flex items-center justify-center mx-auto mb-3">
            <Send className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{L(copy.title)}</h2>
          <p className="text-sm text-gray-500 mt-1">{L(copy.subtitle)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate data-testid={`form-partner-enquiry-${kind}`}>
          <div>
            <Label className="text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4" />
              {isHe ? 'שם מלא' : 'Full Name'} *
            </Label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder={isHe ? 'ישראל ישראלי' : 'Your full name'}
              className="mt-1"
              aria-invalid={!!errors.fullName}
              data-testid="input-partner-enquiry-name"
            />
            {fieldError(errors.fullName)}
          </div>

          <div>
            <Label className="text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {isHe ? 'אימייל' : 'Email'} *
            </Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              className="mt-1"
              aria-invalid={!!errors.email}
              data-testid="input-partner-enquiry-email"
            />
            {fieldError(errors.email)}
          </div>

          <div>
            <Label className="text-gray-700 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {isHe ? 'טלפון' : 'Phone'} *
            </Label>
            <PhoneInput
              value={formData.phone}
              onChange={(val) => setFormData({ ...formData, phone: val || '' })}
              defaultCountry="IL"
              required
              error={errors.phone}
            />
            {fieldError(errors.phone)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {isHe ? 'מדינה' : 'Country'}
              </Label>
              <Input
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder={isHe ? 'ישראל' : 'Israel'}
                className="mt-1"
                data-testid="input-partner-enquiry-country"
              />
            </div>
            <div>
              <Label className="text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {isHe ? 'עיר' : 'City'}
              </Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder={isHe ? 'כפר סבא' : 'Kfar Saba'}
                className="mt-1"
                data-testid="input-partner-enquiry-city"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-700">{L(copy.messageLabel)}</Label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder={L(copy.messagePlaceholder)}
              className="mt-1 min-h-[90px]"
              data-testid="input-partner-enquiry-message"
            />
          </div>

          <Button
            type="submit"
            // Guard 2 of 2 — the disabled state.
            disabled={isSubmitting}
            className="w-full py-5 text-base font-semibold rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8932F] hover:from-[#B8932F] hover:to-[#B8932F] text-white border-0 shadow-lg"
            data-testid="button-partner-enquiry-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin me-2" />
                {isHe ? 'שולח…' : 'Sending…'}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 me-2" />
                {isHe ? 'שלח פנייה' : 'Send Enquiry'}
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default PartnerEnquiryForm;
