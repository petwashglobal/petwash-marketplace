import { useState, type FormEvent } from "react";
import { getApiUrl } from "@/lib/apiConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/PhoneInput";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";
import { Building2, ClipboardCheck, GraduationCap, Handshake, PackageCheck, Send, CheckCircle2, Loader2, Mail, Phone, User, MapPin, X } from "lucide-react";

export default function FranchisePartners() {
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
      const res = await fetch(getApiUrl('/api/franchise/inquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-stone-950 via-stone-800 to-amber-600 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">
            {isHe ? 'בדיקת שותפי מיקום ומפעילים מורשים' : 'Location Partner & Licensed Operator Review'}
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            {isHe 
              ? 'Pet Wash Ltd בוחנת שותפי מיקום ומפעילים רק במסלול מבוקר: NDA, בדיקת אתר, חוזים, הדרכה, אספקה ותמיכה, ביקורת משפטית/חשבונאית ואישור Nir לפני כל התחייבות.'
              : 'Pet Wash Ltd reviews location partners and operators through a controlled path only: NDA, site review, contracts, training, supply/support model, legal/accountant review, and Nir approval before any commitment.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-1">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-950 to-amber-600 flex items-center justify-center mb-4">
              <ClipboardCheck className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'בדיקת אתר לפני הכול' : 'Site Review First'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'אין הבטחת טריטוריה, הכנסה או פעילות לפני בדיקת מיקום, תשתיות, ביטוח, תפעול וסיכון.' : 'No territory, income, or operating promise before location, infrastructure, insurance, operational, and risk review.'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-950 to-amber-600 flex items-center justify-center mb-4">
              <Handshake className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'חוזים ו-NDA' : 'Contracts + NDA'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'תנאים מסחריים, תמיכה, אספקה, הכשרה ותמלוגים נבחנים במסמכים חתומים בלבד.' : 'Commercial terms, support, supply, training, and fee logic are handled only through signed documents.'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-950 to-amber-600 flex items-center justify-center mb-4">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'הדרכה ותפעול' : 'Training + Operations'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'מסלול ההפעלה חייב לכלול מדריך תפעול, הדרכה, אחריות שירות, SLA ותיעוד תמיכה.' : 'Every launch path must include an operations manual, training, service responsibility, SLA, and support evidence.'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-950 to-amber-600 flex items-center justify-center mb-4">
              <PackageCheck className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'אספקה ואיכות' : 'Supply + Quality'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'מוצרים, חלקים, K9000, ניקיון, ביטוח ותיעוד איכות צריכים להיות מאושרים לפני פעילות.' : 'Products, parts, K9000, cleaning, insurance, and quality records must be approved before activity.'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-950 to-amber-600 flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'שמירה על המותג' : 'Brand Compliance'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'כל שימוש בשם Pet Wash™, שילוט, מחיר, מבצע או פרסום מחייב כללים ואישור.' : 'Any use of the Pet Wash™ name, signage, pricing, offer, or advertising requires rules and approval.'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 bg-gradient-to-br from-stone-50 to-amber-50 dark:from-stone-900/20 dark:to-amber-900/20 luxury-animate-fade-in luxury-delay-6">
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'רוצה שנבדוק?' : 'Request a Review'}
            </h3>
            <p className="luxury-text-body mb-4">
              {isHe ? 'שלח פנייה ראשונית. זו אינה הצעה מסחרית ואינה אישור פעילות.' : 'Send an initial request. This is not a commercial offer and not approval to operate.'}
            </p>
            <Button 
              className="w-full luxury-btn-primary" 
              data-testid="button-request-info"
              onClick={() => setShowForm(true)}
            >
              {isHe ? 'בקש בדיקה' : 'Request Review'}
            </Button>
          </div>
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
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-stone-950 to-amber-600 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-black">
                  {isHe ? 'בקשת בדיקת שותף מיקום' : 'Location Partner Review Request'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {isHe ? 'מלא פרטים ראשוניים. המשך התהליך דורש NDA, מסמכים ואישורים.' : 'Share first details. The next step requires NDA, evidence, and approvals.'}
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
                    placeholder={isHe ? 'ישראל ישראלי' : 'John Smith'}
                    className="mt-1"
                    required
                    data-testid="input-franchise-name"
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
                    data-testid="input-franchise-email"
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
                      <Building2 className="w-4 h-4" />
                      {isHe ? 'מדינה' : 'Country'}
                    </Label>
                    <Input
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder={isHe ? 'ישראל' : 'Israel'}
                      className="mt-1"
                      data-testid="input-franchise-country"
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
                      data-testid="input-franchise-city"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-black">
                    {isHe ? 'הודעה נוספת' : 'Additional Message'}
                  </Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={isHe ? 'ספר לנו על המיקום, ניסיון תפעולי, בעלות/שכירות, ולוח זמנים...' : 'Tell us about the site, operating experience, ownership/lease status, and timeline...'}
                    className="mt-1 min-h-[80px]"
                    data-testid="input-franchise-message"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-5 text-base font-semibold rounded-xl bg-gradient-to-r from-stone-950 via-stone-800 to-amber-600 hover:from-black hover:via-stone-900 hover:to-amber-700 text-white border-0 shadow-lg"
                  data-testid="button-submit-franchise"
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
                {isHe ? 'תודה. נבדוק את הפנייה ונחזור עם השלב הבא אם היא מתאימה למסלול המבוקר.' : 'Thank you. We will review the request and respond with the next controlled step if it fits the program.'}
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
