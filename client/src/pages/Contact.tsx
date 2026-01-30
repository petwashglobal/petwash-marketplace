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

interface ContactProps {
  language: Language;
}

export default function Contact({ language }: ContactProps) {
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
              <button className="luxury-btn-ghost flex items-center gap-2" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4" />
                {currentLanguage === 'en' ? 'Back to Home' : 'חזרה לעמוד הבית'}
              </button>
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="luxury-heading-sm">
                      {currentLanguage === 'en' ? 'Company' : 'חברה'}
                    </h3>
                    <p className="luxury-text-small">
                      {currentLanguage === 'en' ? 'Pet Wash Ltd' : 'פט ווש בע"מ'}<br />
                      {currentLanguage === 'en' ? 'Company Number: 517145033' : 'מספר חברה: 517145033'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={openWhatsApp} 
                  className="luxury-btn-primary w-full flex items-center justify-center gap-2"
                  data-testid="button-whatsapp"
                >
                  <MessageCircle className="h-5 w-5" />
                  {currentLanguage === 'en' ? 'Chat on WhatsApp' : 'צ\'אט בוואטסאפ'}
                </button>
              </div>
            </div>

            {/* Contact Form */}
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <h2 className="luxury-heading-md text-center mb-8">
                {currentLanguage === 'en' ? 'Send us a Message' : 'שלח לנו הודעה'}
              </h2>
              
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
                    <Input
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+972-50-123-4567"
                      className="w-full"
                      data-testid="input-phone"
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
            </div>
          </div>

          {/* Get Directions Section */}
          <div className="luxury-glass-card luxury-shadow-lg p-8 mt-8 luxury-animate-fade-in luxury-delay-3">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Navigation className="h-6 w-6 text-white" />
                </div>
                <h2 className="luxury-heading-lg">
                  {currentLanguage === 'en' ? 'Get Directions' : 'קבל הוראות הגעה'}
                </h2>
              </div>
              <p className="luxury-text-body">
                {currentLanguage === 'en' 
                  ? 'Navigate to Pet Wash™ using your preferred map service' 
                  : 'נווט לפט ווש™ באמצעות שירות המפות המועדף עליך'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 justify-center">
              {/* Google Maps */}
              <a
                href="https://maps.app.goo.gl/yrWXbYi6eMqxntRX8?g_st=ipc"
                target="_blank"
                rel="noopener noreferrer"
                className="luxury-btn-primary flex-1 min-w-[180px] max-w-[240px] flex items-center justify-center gap-3"
                data-testid="button-directions-google"
              >
                <MapPin className="h-5 w-5" />
                <span>{currentLanguage === 'en' ? 'Google Maps' : 'גוגל מפות'}</span>
              </a>

              {/* Apple Maps */}
              <a
                href="https://maps.apple.com/?q=Pet+Wash+Ltd+Israel"
                target="_blank"
                rel="noopener noreferrer"
                className="luxury-btn-secondary flex-1 min-w-[180px] max-w-[240px] flex items-center justify-center gap-3"
                data-testid="button-directions-apple"
              >
                <MapPin className="h-5 w-5" />
                <span>{currentLanguage === 'en' ? 'Apple Maps' : 'אפל מפות'}</span>
              </a>

              {/* Waze */}
              <a
                href="https://waze.com/ul?q=Pet+Wash+Ltd+Israel"
                target="_blank"
                rel="noopener noreferrer"
                className="luxury-btn-primary flex-1 min-w-[180px] max-w-[240px] flex items-center justify-center gap-3"
                data-testid="button-directions-waze"
              >
                <Navigation className="h-5 w-5" />
                <span>Waze</span>
              </a>
            </div>
            
            <p className="text-center luxury-text-small mt-6">
              {currentLanguage === 'en' 
                ? 'Choose your preferred navigation app to get turn-by-turn directions' 
                : 'בחר את אפליקציית הניווט המועדפת עליך לקבלת הוראות הגעה צעד אחר צעד'}
            </p>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
}