import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { t, type Language } from '@/lib/i18n';
import { ArrowLeft, Phone, Mail, MapPin, MessageCircle, Loader2, Navigation } from 'lucide-react';
import { Link } from 'wouter';
import { createHubSpotForm } from '@/lib/utils';
import { logger } from "@/lib/logger";
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/apiConfig';
import { GoogleFormEmbed } from '@/components/GoogleFormEmbed';
import { PhoneInput } from '@/components/PhoneInput';
import { useSEO, pageSEO } from '@/lib/seo';

interface ContactProps {
  language: Language;
}

export default function Contact({ language }: ContactProps) {
  useSEO(pageSEO.contact);
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);
  const [submitting, setSubmitting] = useState(false);
  const [hubspotLoaded, setHubspotLoaded] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const handleLanguageChange = (newLanguage: Language) => {
    setCurrentLanguage(newLanguage);
  };

  // Load HubSpot form when component mounts with fallback detection
  useEffect(() => {
    const timer = setTimeout(() => {
      createHubSpotForm('hubspot-contact-form');
      // Check if HubSpot form loaded after another delay
      const checkTimer = setTimeout(() => {
        const container = document.getElementById('hubspot-contact-form');
        if (container && container.querySelector('form')) {
          setHubspotLoaded(true);
        }
      }, 2000);
      return () => clearTimeout(checkTimer);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const validateForm = () => {
    // Validate name
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: currentLanguage === 'he' ? "שם נדרש" : "Name required",
        description: currentLanguage === 'he' ? "אנא הזן את שמך" : "Please enter your name"
      });
      return false;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      toast({
        variant: "destructive",
        title: currentLanguage === 'he' ? "אימייל לא תקין" : "Invalid email",
        description: currentLanguage === 'he' ? "אנא הזן כתובת אימייל תקינה" : "Please enter a valid email address"
      });
      return false;
    }

    // Validate phone (international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (formData.phone && !phoneRegex.test(formData.phone.replace(/[\s\-()]/g, ''))) {
      toast({
        variant: "destructive",
        title: currentLanguage === 'he' ? "טלפון לא תקין" : "Invalid phone",
        description: currentLanguage === 'he' 
          ? "אנא הזן מספר טלפון בפורמט בינלאומי (+972...)" 
          : "Please enter phone in international format (+972...)"
      });
      return false;
    }

    // Validate message
    if (!formData.message.trim()) {
      toast({
        variant: "destructive",
        title: currentLanguage === 'he' ? "הודעה נדרשת" : "Message required",
        description: currentLanguage === 'he' ? "אנא כתוב הודעה" : "Please write a message"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double-submit guard — `disabled={submitting}` on the button only applies
    // after React re-renders; a fast double-tap can fire this handler twice
    // first and send the same message to the support inbox twice.
    if (submitting) return;

    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    logger.debug('Contact form submitted', { formData });
    
    try {
      // Send to backend API
      const response = await fetch(getApiUrl('/api/contact'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          language: currentLanguage
        })
      });

      if (response.ok) {
        toast({
          title: currentLanguage === 'he' ? "הודעה נשלחה!" : "Message sent!",
          description: currentLanguage === 'he' 
            ? "תודה! נחזור אליך בהקדם האפשרי." 
            : "Thank you! We'll get back to you as soon as possible."
        });
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: ''
        });
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      logger.error('Contact form submission error', error);
      toast({
        variant: "destructive",
        title: currentLanguage === 'he' ? "שגיאה" : "Error",
        description: currentLanguage === 'he' 
          ? "לא הצלחנו לשלוח את ההודעה. אנא נסה שוב או צור קשר בוואטסאפ." 
          : "Failed to send message. Please try again or contact us on WhatsApp."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/972549833355', '_blank');
  };

  return (
    <Layout language={currentLanguage} onLanguageChange={handleLanguageChange}>
      <div className={`min-h-screen luxury-bg-mesh ${currentLanguage === 'he' ? 'rtl' : 'ltr'}`}>
        <div className="luxury-section pt-20">
        <div className="luxury-container">
          <div className="mb-6 luxury-animate-fade-in">
            <Link href="/">
              <Button className="luxury-btn-ghost flex items-center gap-2" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4" />
                {currentLanguage === 'en' ? 'Back to Home' : 'חזרה לעמוד הבית'}
              </Button>
            </Link>
          </div>

          <div className="text-center mb-12 luxury-animate-fade-in luxury-delay-1">
            <h1 className="luxury-heading-xl mb-4">
              {currentLanguage === 'en' ? 'Contact Us' : 'צור קשר'}
            </h1>
            <p className="luxury-text-body">
              {currentLanguage === 'en' ? 'We\'re here to help 24/7' : 'אנחנו כאן כדי לעזור 24/7'}
            </p>
          </div>

          <div className="luxury-grid-2 luxury-animate-fade-in luxury-delay-2">
            {/* Contact Information */}
            <div className="luxury-glass-minimal luxury-hover-lift p-8">
              <h2 className="luxury-heading-md text-center mb-8">
                {currentLanguage === 'en' ? 'Contact Information' : 'פרטי התקשרות'}
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center space-x-4 rtl:space-x-reverse" data-testid="contact-phone">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="luxury-heading-sm">
                      {currentLanguage === 'en' ? 'Phone Support' : 'תמיכה טלפונית'}
                    </h3>
                    <p className="luxury-text-small">+972-54-983-3355</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 rtl:space-x-reverse" data-testid="contact-email">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="luxury-heading-sm">
                      {currentLanguage === 'en' ? 'Email Support' : 'תמיכה במייל'}
                    </h3>
                    <p className="luxury-text-small">Support@PetWash.co.il</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 rtl:space-x-reverse" data-testid="contact-company">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="luxury-heading-sm">
                      {currentLanguage === 'en' ? 'Company' : 'חברה'}
                    </h3>
                    <p className="luxury-text-small">
                      {currentLanguage === 'en' ? '⁦Pet Wash™⁩ Ltd' : '⁦Pet Wash™⁩ בע"מ'}<br />
                      {currentLanguage === 'en' ? 'Company Number: 517145033' : 'מספר חברה: 517145033'}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={openWhatsApp} 
                  className="luxury-btn-primary w-full flex items-center justify-center gap-2"
                  data-testid="button-whatsapp"
                >
                  <MessageCircle className="h-5 w-5" />
                  {currentLanguage === 'en' ? 'Chat on WhatsApp' : 'צ\'אט בוואטסאפ'}
                </Button>
              </div>
            </div>

            {/* Contact Form */}
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <h2 className="luxury-heading-md text-center mb-8">
                {currentLanguage === 'en' ? 'Send us a Message' : 'שלח לנו הודעה'}
              </h2>
              
              <GoogleFormEmbed
                formType="contact"
                language={currentLanguage}
                fallback={
                  <>
                    {/* HubSpot Form Container - hidden if not loaded */}
                    <div id="hubspot-contact-form" className={hubspotLoaded ? 'min-h-[400px]' : 'hidden'} data-testid="hubspot-form"></div>
                    
                    {/* Native Fallback Contact Form - shown when HubSpot doesn't load */}
                    {!hubspotLoaded && (
                      <form onSubmit={handleSubmit} className="space-y-4" data-testid="contact-form">
                        <div>
                          <label className="block luxury-text-small mb-1">
                            {currentLanguage === 'en' ? 'Your Name *' : 'שם מלא *'}
                          </label>
                          <Input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder={currentLanguage === 'en' ? 'Enter your name' : 'הכנס את שמך'}
                            className="w-full"
                            data-testid="input-name"
                          />
                        </div>
                        
                        <div>
                          <label className="block luxury-text-small mb-1">
                            {currentLanguage === 'en' ? 'Email Address *' : 'כתובת אימייל *'}
                          </label>
                          <Input
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder={currentLanguage === 'en' ? 'your@email.com' : 'your@email.com'}
                            className="w-full"
                            data-testid="input-email"
                          />
                        </div>
                        
                        <div>
                          <label className="block luxury-text-small mb-1">
                            {currentLanguage === 'en' ? 'Phone Number' : 'מספר טלפון'}
                          </label>
                          <PhoneInput
                            value={formData.phone}
                            onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                            language={currentLanguage === 'he' ? 'he' : 'en'}
                            defaultCountry="IL"
                          />
                        </div>
                        
                        <div>
                          <label className="block luxury-text-small mb-1">
                            {currentLanguage === 'en' ? 'Subject' : 'נושא'}
                          </label>
                          <Select 
                            value={formData.subject} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, subject: value }))}
                          >
                            <SelectTrigger data-testid="select-subject">
                              <SelectValue placeholder={currentLanguage === 'en' ? 'Select a topic' : 'בחר נושא'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">{currentLanguage === 'en' ? 'General Inquiry' : 'פנייה כללית'}</SelectItem>
                              <SelectItem value="support">{currentLanguage === 'en' ? 'Customer Support' : 'תמיכה טכנית'}</SelectItem>
                              <SelectItem value="business">{currentLanguage === 'en' ? 'Business Partnership' : 'שותפות עסקית'}</SelectItem>
                              <SelectItem value="franchise">{currentLanguage === 'en' ? 'Franchise Inquiry' : 'פנייה לזכיינות'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="block luxury-text-small mb-1">
                            {currentLanguage === 'en' ? 'Your Message *' : 'ההודעה שלך *'}
                          </label>
                          <Textarea
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            placeholder={currentLanguage === 'en' ? 'How can we help you?' : 'איך נוכל לעזור לך?'}
                            rows={5}
                            className="w-full"
                            data-testid="input-message"
                          />
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="luxury-btn-primary w-full"
                          disabled={submitting}
                          data-testid="button-submit"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              {currentLanguage === 'en' ? 'Sending...' : 'שולח...'}
                            </>
                          ) : (
                            currentLanguage === 'en' ? 'Send Message' : 'שלח הודעה'
                          )}
                        </Button>
                      </form>
                    )}
                  </>
                }
              />
            </div>
          </div>

          {/* Get Directions Section — KFAR-SABA-STATIONS-FIX (2026-08-23):
                previous section had ONE set of buttons with an opaque
                maps.app.goo.gl short-link (destination not verifiable from
                source) and two `?q=Pet+Wash+Ltd+Israel` text-searches. Google
                / Waze / Apple all resolved those to whatever their search
                index thought "Pet Wash Ltd" was — the CEO's exact "google
                link takes them to wrong places" report.
                Now: two named station cards with per-station lat/lng-anchored
                links to each of Google Maps, Waze, and Apple Maps. Ground
                truth pins provided by the CEO 2026-08-23.
                All links `target="_blank" rel="noopener noreferrer"` so the
                customer's PetWash tab (session, cart, half-typed OTP) is
                never blown away when they tap Directions. */}
          {(() => {
            const stations = [
              {
                key: 'wald',
                lat: 32.179964,
                lng: 34.925016,
                nameEn: 'K9000 — Yitzhak Wald Park, Kfar Saba',
                nameHe: 'K9000 — פארק יצחק ולד, כפר סבא',
                addressEn: 'Yitzhak Wald Park, Kfar Saba',
                addressHe: 'פארק יצחק ולד, כפר סבא',
                directionsEn: 'Enter from the Weizmann side, turn right after the park entrance — the machine is inside the fenced dog garden.',
                directionsHe: 'הכניסה של ויצמן, פונים ימינה לאחר הכניסה לפארק — המכונה בתוך גינת הכלבים.',
              },
              {
                key: 'park80',
                lat: 32.1982242,
                lng: 34.892436,
                nameEn: 'K9000 — Green Kfar Saba, Park 80',
                nameHe: 'K9000 — כפר סבא הירוקה, פארק 80',
                addressEn: 'Park 80, Green Kfar Saba',
                addressHe: 'פארק 80, כפר סבא הירוקה',
                directionsEn: 'Right next to the twago coffee cart.',
                directionsHe: 'צמוד לעגלת הקפה twago.',
              },
            ];
            return (
              <div className="luxury-glass-card luxury-shadow-lg p-8 mt-8 luxury-animate-fade-in luxury-delay-3">
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37] flex items-center justify-center">
                      <Navigation className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="luxury-heading-lg">
                      {currentLanguage === 'en' ? 'Our Stations' : 'התחנות שלנו'}
                    </h2>
                  </div>
                  <p className="luxury-text-body">
                    {currentLanguage === 'en'
                      ? 'Two K9000 self-service stations, both in Kfar Saba. Pick the closer one and tap your preferred navigation app.'
                      : 'שתי תחנות K9000 בשירות עצמי — שתיהן בכפר סבא. בחרו את הקרובה אליכם וגעו באפליקציית הניווט המועדפת.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {stations.map((s) => {
                    const label = currentLanguage === 'en' ? s.nameEn : s.nameHe;
                    const addr = currentLanguage === 'en' ? s.addressEn : s.addressHe;
                    const guide = currentLanguage === 'en' ? s.directionsEn : s.directionsHe;
                    // NO NAVIGATION LINKS (CEO 2026-08-23): the Google Maps /
                    // Waze / Apple Maps deep-links were removed by explicit CEO
                    // order — "take out google navigation and waze, its taking
                    // them wrong place when they click on it, safer not to
                    // have — its just information". Cards now render as
                    // information-only until the CEO validates each pin drops
                    // on the correct bay in every map app. Written directions
                    // stay so a customer who wants to open their own map app
                    // can type "פארק יצחק ולד" / "פארק 80 כפר סבא הירוקה" and
                    // find the site by name.
                    return (
                      <div
                        key={s.key}
                        className="rounded-2xl p-6 border"
                        style={{
                          background: 'linear-gradient(180deg,#FFFFFF 0%,#FFFCF4 100%)',
                          borderColor: 'rgba(212,175,55,0.35)',
                          boxShadow: '0 6px 24px rgba(0,0,0,0.06)',
                          direction: currentLanguage === 'en' ? 'ltr' : 'rtl',
                        }}
                        data-testid={`station-card-${s.key}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4" style={{ color: '#8A6A1B' }} />
                          <h3 className="luxury-heading-md" style={{ fontSize: '1.05rem' }}>{label}</h3>
                        </div>
                        <p className="luxury-text-small" style={{ color: '#555', marginBottom: 8 }}>{addr}</p>
                        <p className="luxury-text-body" style={{ fontSize: '0.92rem', marginBottom: 0 }}>{guide}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-center luxury-text-small mt-6">
                  {currentLanguage === 'en'
                    ? 'Both stations are open 24/7 — tap any button above for turn-by-turn directions.'
                    : 'שתי התחנות פתוחות 24/7 — הקישו על כל כפתור לקבלת ניווט מדויק.'}
                </p>
              </div>
            );
          })()}
        </div>
      </div>
      </div>
    </Layout>
  );
}