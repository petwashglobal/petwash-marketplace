import { useState, type FormEvent } from "react";
import { getApiUrl } from "@/lib/apiConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/PhoneInput";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";
import {
  Package, Leaf, Truck, Award,
  Send, CheckCircle2, Loader2, Mail, Phone, User, MapPin, Globe, X,
} from "lucide-react";

export default function SuppliersPartners() {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    message: '',
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.phone) {
      toast({
        title: isHe ? 'שדות חובה חסרים' : 'Missing required fields',
        description: isHe ? 'אנא מלא שם, אימייל וטלפון' : 'Please fill in name, email and phone',
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      // POSTs to the existing public franchise-inquiry endpoint
      // (server/routes/franchise.ts:26, now CSRF-exempt). The "[SUPPLIER]"
      // prefix in the message field lets the franchise/partnerships inbox
      // route supplier inquiries to the right team without a new endpoint.
      const supplierMessage = `[SUPPLIER inquiry from /partners/suppliers]\n\n${formData.message || '(no message provided)'}`;
      const res = await fetch(getApiUrl('/api/franchise/inquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, message: supplierMessage }),
      });
      if (!res.ok) {
        throw new Error('Failed to submit');
      }
      setSubmitted(true);
      toast({
        title: isHe ? 'הבקשה נשלחה בהצלחה!' : 'Request Submitted!',
        description: isHe ? 'נציג יצור איתך קשר בהקדם' : 'A representative will contact you soon',
      });
    } catch (err) {
      toast({
        title: isHe ? 'שגיאה' : 'Error',
        description: isHe ? 'לא הצלחנו לשלוח את הבקשה. נסה שוב.' : 'Could not submit request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen luxury-bg-mesh py-12">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-full mb-4 luxury-shadow-lg luxury-animate-scale-in">
            <Package className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">
            {isHe ? 'ספקים ומותגים' : 'Suppliers & Brands'}
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            {isHe
              ? 'הצטרפו ל-⁦Pet Wash™⁩ כספקים מובילים או שותפי מותג פרימיום.'
              : 'Partner with ⁦Pet Wash™⁩ as a premium supplier or brand partner'}
          </p>
        </div>

        <div className="luxury-grid-3 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
            <Leaf className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">
              {isHe ? 'מוצרים אורגניים' : 'Organic Products'}
            </h3>
            <p className="luxury-text-body">
              {isHe
                ? 'שמפו, מרכך ומוצרי טיפוח אורגניים פרימיום לחיות מחמד.'
                : 'Premium organic shampoos, conditioners, and pet care products'}
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
            <Truck className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">
              {isHe ? 'ספקי ציוד' : 'Equipment Suppliers'}
            </h3>
            <p className="luxury-text-body">
              {isHe
                ? 'רכיבים, חלקי חילוף ואספקה לתחזוקת תחנות ⁦K9000™⁩.'
                : 'K9000 station components, spare parts, and maintenance supplies'}
            </p>
          </div>

          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
            <Award className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="luxury-heading-sm mb-2">
              {isHe ? 'שיתופי מותג' : 'Brand Partnerships'}
            </h3>
            <p className="luxury-text-body">
              {isHe
                ? 'הזדמנויות שיתופי מותג עם מותגי טיפוח חיות מחמד פרימיום.'
                : 'Co-branding opportunities with premium pet care brands'}
            </p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 text-center bg-gradient-to-r from-green-500/10 to-blue-500/10 luxury-animate-fade-in luxury-delay-5">
          <h2 className="luxury-heading-lg mb-4">
            {isHe ? 'הצטרפו כשותפי אספקה' : 'Become a Supplier Partner'}
          </h2>
          <p className="luxury-text-body mb-6">
            {isHe
              ? 'הצטרפו לרשת האספקה וההפצה הגלובלית שלנו.'
              : 'Join our global supply chain and distribution network'}
          </p>
          <Button
            className="luxury-btn-primary luxury-shadow-xl px-8 py-4"
            data-testid="button-supplier-application"
            onClick={() => setShowForm(true)}
          >
            {isHe ? 'הגישו בקשה כספק' : 'Apply as Supplier'}
          </Button>
        </div>

        {showForm && !submitted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
            <div
              className="relative w-full max-w-lg bg-white dark:bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                onClick={() => setShowForm(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white dark:bg-white flex items-center justify-center hover:bg-white dark:hover:bg-white transition-colors"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-black" />
              </Button>

              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-black">
                  {isHe ? 'בקשת שותפות אספקה' : 'Supplier Partnership Request'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {isHe ? 'מלא את הפרטים ונחזור אליך בהקדם' : 'Fill in your details and we\'ll contact you soon'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-gray-700 dark:text-black flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {isHe ? 'שם מלא' : 'Full Name'} *
                  </Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder={isHe ? 'ישראל ישראלי' : 'Your full name'}
                    className="mt-1"
                    required
                    data-testid="input-supplier-name"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-black flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {isHe ? 'אימייל' : 'Email'} *
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    className="mt-1"
                    required
                    data-testid="input-supplier-email"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-black flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {isHe ? 'טלפון' : 'Phone'} *
                  </Label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(val) => setFormData({ ...formData, phone: val || '' })}
                    defaultCountry="IL"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-700 dark:text-black flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {isHe ? 'מדינה' : 'Country'}
                    </Label>
                    <Input
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder={isHe ? 'ישראל' : 'Israel'}
                      className="mt-1"
                      data-testid="input-supplier-country"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-black flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {isHe ? 'עיר' : 'City'}
                    </Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder={isHe ? 'תל אביב' : 'Tel Aviv'}
                      className="mt-1"
                      data-testid="input-supplier-city"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-black">
                    {isHe ? 'תחום אספקה / מותג' : 'Supply category / brand'}
                  </Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={isHe
                      ? 'ספרו לנו על המוצרים, המותג או הציוד שאתם מספקים...'
                      : 'Tell us about the products, brand or equipment you supply...'}
                    className="mt-1 min-h-[80px]"
                    data-testid="input-supplier-message"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 text-base font-semibold rounded-xl bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white border-0 shadow-lg"
                  data-testid="button-submit-supplier"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {isHe ? 'שלח בקשה' : 'Submit Request'}
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        )}

        {submitted && showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setShowForm(false); setSubmitted(false); }}>
            <div
              className="relative w-full max-w-md bg-white dark:bg-white rounded-3xl shadow-2xl p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-black mb-2">
                {isHe ? 'הבקשה נשלחה!' : 'Request Submitted!'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {isHe
                  ? 'תודה על ההתעניינות! נציג יצור איתך קשר תוך 1-2 ימי עסקים.'
                  : 'Thank you for your interest! A representative will contact you within 1-2 business days.'}
              </p>
              <Button
                onClick={() => { setShowForm(false); setSubmitted(false); }}
                className="px-8 py-3 rounded-xl"
                data-testid="button-close-success"
              >
                {isHe ? 'סגור' : 'Close'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
