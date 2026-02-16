import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/languageStore";
import { Building2, Globe, DollarSign, Users, TrendingUp, Award, Send, CheckCircle2, Loader2, Mail, Phone, User, MapPin, X } from "lucide-react";

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
      const res = await fetch('/api/franchise/inquiry', {
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
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">
            {isHe ? 'שותפויות זכיינות ועירוניות' : 'Franchise & City Partners'}
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            {isHe 
              ? 'הצטרפו לרשת הזכיינות הבינלאומית של ⁦Pet Wash™⁩. מודל עסקי מוכח, תמיכה מלאה, מותג פרימיום.'
              : 'Join the ⁦Pet Wash™⁩ global franchise network. Proven business model, enterprise support, luxury brand.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-1">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'התרחבות עולמית' : 'Global Expansion'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'פעילות במדינות רבות עם תוכניות צמיחה אגרסיביות' : 'Operating in multiple countries with aggressive growth plans'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'פוטנציאל הכנסה' : 'Revenue Potential'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'מקורות הכנסה מרובים ב-8 פלטפורמות עסקיות' : 'Multiple revenue streams across 8 business platforms'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'תמיכה ארגונית' : 'Enterprise Support'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'הכשרה מלאה, טכנולוגיה, שיווק ותמיכה תפעולית' : 'Full training, technology, marketing, and operational support'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'מודל מוכח' : 'Proven Model'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'מערכות מוכחות, מותג מבוסס, ביקוש שוק גובר' : 'Tested systems, established brand, growing market demand'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 luxury-animate-fade-in luxury-delay-5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <Award className="w-7 h-7 text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'מותג פרימיום' : 'Premium Brand'}
            </h3>
            <p className="luxury-text-body">
              {isHe ? 'מיצוב יוקרתי עם תקני שירות 7 כוכבים' : 'Luxury positioning with 7-star service standards'}
            </p>
          </div>

          <div className="luxury-glass-card shadow-lg p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 luxury-animate-fade-in luxury-delay-6">
            <h3 className="luxury-heading-sm mb-2 luxury-text-gradient">
              {isHe ? 'מוכנים להתחיל?' : 'Ready to Start?'}
            </h3>
            <p className="luxury-text-body mb-4">
              {isHe ? 'בקשו חבילת מידע על זכיינות' : 'Request franchise information package'}
            </p>
            <button 
              className="w-full luxury-btn-primary" 
              data-testid="button-request-info"
              onClick={() => setShowForm(true)}
            >
              {isHe ? 'בקש מידע' : 'Request Information'}
            </button>
          </div>
        </div>

        {showForm && !submitted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
            <div 
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowForm(false)} 
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isHe ? 'בקשת מידע על זכיינות' : 'Franchise Information Request'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {isHe ? 'מלא את הפרטים ונחזור אליך בהקדם' : 'Fill in your details and we\'ll contact you soon'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
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
                  <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
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
                  <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {isHe ? 'טלפון' : 'Phone'} *
                  </Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555-000-0000"
                    className="mt-1"
                    required
                    data-testid="input-franchise-phone"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {isHe ? 'מדינה' : 'Country'}
                    </Label>
                    <Input
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder={isHe ? 'קנדה, ארה"ב...' : 'Canada, USA...'}
                      className="mt-1"
                      data-testid="input-franchise-country"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {isHe ? 'עיר' : 'City'}
                    </Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder={isHe ? 'טורונטו' : 'Toronto'}
                      className="mt-1"
                      data-testid="input-franchise-city"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-gray-300">
                    {isHe ? 'הודעה נוספת' : 'Additional Message'}
                  </Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={isHe ? 'ספר לנו על הניסיון שלך ותחומי העניין...' : 'Tell us about your experience and interests...'}
                    className="mt-1 min-h-[80px]"
                    data-testid="input-franchise-message"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-5 text-base font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg"
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
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {isHe ? 'הבקשה נשלחה!' : 'Request Submitted!'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {isHe ? 'תודה על ההתעניינות! נציג יצור איתך קשר תוך 1-2 ימי עסקים.' : 'Thank you for your interest! A representative will contact you within 1-2 business days.'}
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
