import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
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

interface ContactProps {
  language: Language;
}

export default function Contact({ language }: ContactProps) {
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState<Language>(language);
  const [submitting, setSubmitting] = useState(false);
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

  // Load HubSpot form when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      createHubSpotForm('hubspot-contact-form');
    }, 1000); // Wait for HubSpot script to load

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
      const response = await fetch('/api/contact', {
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
    <div className={`min-h-screen bg-white ${currentLanguage === 'he' ? 'rtl' : 'ltr'}`}>
      <Header language={currentLanguage} onLanguageChange={handleLanguageChange} />
      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" />
                {currentLanguage === 'en' ? 'Back to Home' : 'חזרה לעמוד הבית'}
              </Button>
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center">
                  {currentLanguage === 'en' ? 'Contact Information' : 'פרטי התקשרות'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-4 rtl:space-x-reverse">
                  <Phone className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">
                      {currentLanguage === 'en' ? 'Phone Support' : 'תמיכה טלפונית'}
                    </h3>
                    <p className="text-gray-600">+972-54-983-3355</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 rtl:space-x-reverse">
                  <Mail className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">
                      {currentLanguage === 'en' ? 'Email Support' : 'תמיכה במייל'}
                    </h3>
                    <p className="text-gray-600">Support@PetWash.co.il</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 rtl:space-x-reverse">
                  <MapPin className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">
                      {currentLanguage === 'en' ? 'Company' : 'חברה'}
                    </h3>
                    <p className="text-gray-600">
                      {currentLanguage === 'en' ? 'Pet Wash Ltd' : 'פט ווש בע"מ'}<br />
                      {currentLanguage === 'en' ? 'Company Number: 517145033' : 'מספר חברה: 517145033'}
                    </p>
                  </div>
                </div>

                <Button onClick={openWhatsApp} className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {currentLanguage === 'en' ? 'Chat on WhatsApp' : 'צ\'אט בוואטסאפ'}
                </Button>
              </CardContent>
            </Card>

            {/* HubSpot Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center">
                  {currentLanguage === 'en' ? 'Send us a Message' : 'שלח לנו הודעה'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* HubSpot Form Container */}
                <div id="hubspot-contact-form" className="min-h-[400px]"></div>
                
                {/* Fallback message while HubSpot form loads */}
                <script dangerouslySetInnerHTML={{
                  __html: `
                    document.addEventListener('DOMContentLoaded', function() {
                      const formContainer = document.getElementById('hubspot-contact-form');
                      if (formContainer && !formContainer.innerHTML.trim()) {
                        formContainer.innerHTML = '<div class="text-center p-8 text-gray-600">${currentLanguage === 'en' ? 'Loading contact form...' : 'טוען טופס יצירת קשר...'}</div>';
                      }
                    });
                  `
                }} />
              </CardContent>
            </Card>
          </div>

          {/* Get Directions Section */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
                <Navigation className="h-6 w-6 text-blue-600" />
                {currentLanguage === 'en' ? 'Get Directions' : 'קבל הוראות הגעה'}
              </CardTitle>
              <p className="text-center text-gray-600 mt-2">
                {currentLanguage === 'en' 
                  ? 'Navigate to Pet Wash™ using your preferred map service' 
                  : 'נווט לפט ווש™ באמצעות שירות המפות המועדף עליך'}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 justify-center">
                {/* Google Maps */}
                <a
                  href="https://maps.app.goo.gl/yrWXbYi6eMqxntRX8?g_st=ipc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[180px] max-w-[240px] px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 font-semibold text-base group"
                  data-testid="button-directions-google"
                >
                  <MapPin className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span>{currentLanguage === 'en' ? 'Google Maps' : 'גוגל מפות'}</span>
                </a>

                {/* Apple Maps */}
                <a
                  href="https://maps.apple.com/?q=Pet+Wash+Ltd+Israel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[180px] max-w-[240px] px-6 py-4 bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 font-semibold text-base group"
                  data-testid="button-directions-apple"
                >
                  <MapPin className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span>{currentLanguage === 'en' ? 'Apple Maps' : 'אפל מפות'}</span>
                </a>

                {/* Waze */}
                <a
                  href="https://waze.com/ul?q=Pet+Wash+Ltd+Israel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[180px] max-w-[240px] px-6 py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 font-semibold text-base group"
                  data-testid="button-directions-waze"
                >
                  <Navigation className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span>Waze</span>
                </a>
              </div>
              
              <p className="text-center text-sm text-gray-500 mt-6">
                {currentLanguage === 'en' 
                  ? 'Choose your preferred navigation app to get turn-by-turn directions' 
                  : 'בחר את אפליקציית הניווט המועדפת עליך לקבלת הוראות הגעה צעד אחר צעד'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer language={currentLanguage} />
    </div>
  );
}