import { useState, useEffect } from 'react';
import { Shield, Cookie, BarChart3, Target, Info, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface ConsentPreferences {
  necessary: boolean; // Always true, cannot be disabled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  location: boolean; // Location services for station finder
  camera: boolean; // Camera for QR code scanning
  washReminders: boolean; // Pet wash reminders
  vaccinationReminders: boolean; // Pet vaccination reminders
  promotionalNotifications: boolean; // Special offers and promotions
  timestamp: string;
}

interface ConsentManagerProps {
  language: Language;
}

export function ConsentManager({ language }: ConsentManagerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    location: false,
    camera: false,
    washReminders: false,
    vaccinationReminders: false,
    promotionalNotifications: false,
    timestamp: new Date().toISOString(),
  });

  useEffect(() => {
    const loadConsent = async () => {
      // First, try to load from backend (cross-device sync)
      try {
        const response = await fetch('/api/consent');
        if (response.ok) {
          const data = await response.json();
          if (data.consent) {
            // User has stored preferences - use them
            setPreferences(data.consent);
            localStorage.setItem('petwash_consent_preferences', JSON.stringify(data.consent));
            applyConsentPreferences(data.consent);
            return; // Don't show banner
          }
        }
      } catch (error) {
        console.error('Failed to fetch backend consent:', error);
        // Continue to localStorage fallback
      }
      
      // Fallback to localStorage
      const savedConsent = localStorage.getItem('petwash_consent_preferences');
      if (!savedConsent) {
        // Show consent banner after 1 second
        setTimeout(() => setIsVisible(true), 1000);
      } else {
        // Load saved preferences
        try {
          const saved = JSON.parse(savedConsent);
          setPreferences(saved);
          applyConsentPreferences(saved);
        } catch (e) {
          console.error('Failed to parse consent preferences', e);
          setTimeout(() => setIsVisible(true), 1000);
        }
      }
    };
    
    loadConsent();
  }, []);

  const handleAcceptAll = async () => {
    const consent: ConsentPreferences = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
      location: true,
      camera: true,
      washReminders: true,
      vaccinationReminders: true,
      promotionalNotifications: true,
      timestamp: new Date().toISOString(),
    };
    await saveConsent(consent);
  };

  const handleAcceptNecessary = async () => {
    const consent: ConsentPreferences = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      location: false,
      camera: false,
      washReminders: false,
      vaccinationReminders: false,
      promotionalNotifications: false,
      timestamp: new Date().toISOString(),
    };
    await saveConsent(consent);
  };

  const handleSavePreferences = async () => {
    const consent: ConsentPreferences = {
      ...preferences,
      timestamp: new Date().toISOString(),
    };
    await saveConsent(consent);
  };

  const saveConsent = async (consent: ConsentPreferences) => {
    localStorage.setItem('petwash_consent_preferences', JSON.stringify(consent));
    localStorage.setItem('petwash_cookie_consent', 'accepted'); // Backwards compatibility
    setPreferences(consent);
    setIsVisible(false);
    
    // Apply consent preferences
    applyConsentPreferences(consent);
    
    // Save to backend for audit trail and cross-device sync
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consent),
      });
    } catch (error) {
      console.error('Failed to save consent to backend:', error);
      // Continue anyway - localStorage is saved
    }
  };

  const applyConsentPreferences = (consent: ConsentPreferences) => {
    // Analytics (Google Analytics, Facebook Pixel, etc.)
    if (consent.analytics) {
      // Enable analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          analytics_storage: 'granted'
        });
      }
    } else {
      // Disable analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          analytics_storage: 'denied'
        });
      }
    }

    // Marketing (remarketing, ad personalization)
    if (consent.marketing) {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted'
        });
      }
    } else {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied'
        });
      }
    }
  };

  if (!isVisible) return null;

  const text = {
    en: {
      title: 'We Value Your Privacy',
      description: 'Pet Wash™ uses cookies and similar technologies to provide essential services, improve your experience, and analyze usage. We comply with Israeli Privacy Protection Law and GDPR.',
      necessary: 'Necessary',
      necessaryDesc: 'Essential for website functionality, security, and authentication. These cannot be disabled.',
      functional: 'Functional',
      functionalDesc: 'Remember your preferences, language selection, and improve user experience.',
      analytics: 'Analytics',
      analyticsDesc: 'Help us understand how visitors use our website to improve service quality.',
      marketing: 'Marketing',
      marketingDesc: 'Used for targeted advertising and personalized offers.',
      location: 'Location Services',
      locationDesc: 'Find nearest Pet Wash stations and provide location-based services.',
      camera: 'Camera Access',
      cameraDesc: 'Scan QR codes and upload photos of your pets.',
      washReminders: '🐕 Wash Reminders',
      washRemindersDesc: 'Get notifications when your pet is due for a wash (weekly/monthly schedule).',
      vaccinationReminders: '💉 Vaccination Reminders',
      vaccinationRemindersDesc: 'Receive timely reminders for your pet\'s vaccination appointments.',
      promotionalNotifications: '🎁 Promotional Offers',
      promotionalNotificationsDesc: 'Get special discounts, offers, and news from Pet Wash™.',
      acceptAll: 'Accept All',
      acceptNecessary: 'Necessary Only',
      customize: 'Customize',
      savePreferences: 'Save Preferences',
      learnMore: 'Learn More',
      privacyPolicy: 'Privacy Policy',
      yourRights: 'Your Rights: You can withdraw consent at any time. See our Privacy Policy for details.',
    },
    he: {
      title: 'אנו מעריכים את פרטיותך',
      description: 'Pet Wash™ משתמשת בעוגיות וטכנולוגיות דומות לאספקת שירותים חיוניים, שיפור החוויה וניתוח השימוש. אנו עומדים בחוק הגנת הפרטיות הישראלי ו-GDPR.',
      necessary: 'נחוצות',
      necessaryDesc: 'חיוניות לתפקוד האתר, אבטחה ואימות. לא ניתן לבטל.',
      functional: 'פונקציונליות',
      functionalDesc: 'שומרות את העדפותיך, בחירת שפה ומשפרות את חוויית המשתמש.',
      analytics: 'אנליטיקה',
      analyticsDesc: 'עוזרות לנו להבין כיצד מבקרים משתמשים באתר כדי לשפר את איכות השירות.',
      marketing: 'שיווק',
      marketingDesc: 'משמשות לפרסום ממוקד והצעות מותאמות אישית.',
      location: 'שירותי מיקום',
      locationDesc: 'מצא תחנות Pet Wash הקרובות ביותר וקבל שירותים מבוססי מיקום.',
      camera: 'גישה למצלמה',
      cameraDesc: 'סרוק קודי QR והעלה תמונות של חיות המחמד שלך.',
      washReminders: '🐕 תזכורות שטיפה',
      washRemindersDesc: 'קבל התראות כאשר הכלב שלך מגיע למועד שטיפה (שבועי/חודשי).',
      vaccinationReminders: '💉 תזכורות חיסונים',
      vaccinationRemindersDesc: 'קבל תזכורות בזמן למועדי החיסונים של חיית המחמד שלך.',
      promotionalNotifications: '🎁 הצעות מבצעים',
      promotionalNotificationsDesc: 'קבל הנחות מיוחדות, הצעות וחדשות מ-Pet Wash™.',
      acceptAll: 'אישור הכל',
      acceptNecessary: 'נחוצות בלבד',
      customize: 'התאמה אישית',
      savePreferences: 'שמור העדפות',
      learnMore: 'למד עוד',
      privacyPolicy: 'מדיניות פרטיות',
      yourRights: 'זכויותיך: ניתן לבטל הסכמה בכל עת. ראה מדיניות הפרטיות לפרטים.',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];
  const isRTL = language === 'he' || language === 'ar';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={() => !showDetails && setIsVisible(false)} />
      
      <div 
        className={`fixed ${isRTL ? 'left-1/2' : 'left-1/2'} bottom-6 -translate-x-1/2 z-50 w-full max-w-2xl mx-4`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#d4af37] to-[#f4d03f] p-6">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-white" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{t.title}</h2>
              </div>
              {!showDetails && (
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-white hover:opacity-80 transition-opacity"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-gray-700 mb-6 leading-relaxed">
              {t.description}
            </p>

            {showDetails && (
              <div className="space-y-4 mb-6">
                {/* Necessary Cookies */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Cookie className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">{t.necessary}</h3>
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="w-4 h-4 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-gray-600">{t.necessaryDesc}</p>
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">{t.functional}</h3>
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-gray-600">{t.functionalDesc}</p>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">{t.analytics}</h3>
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-gray-600">{t.analyticsDesc}</p>
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Target className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">{t.marketing}</h3>
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-gray-600">{t.marketingDesc}</p>
                  </div>
                </div>

                {/* Location Services */}
                <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-blue-900">{t.location}</h3>
                      <input
                        type="checkbox"
                        checked={preferences.location}
                        onChange={(e) => setPreferences({ ...preferences, location: e.target.checked })}
                        className="w-4 h-4 cursor-pointer"
                        data-testid="checkbox-location-consent"
                      />
                    </div>
                    <p className="text-xs text-blue-800">{t.locationDesc}</p>
                  </div>
                </div>

                {/* Camera Access */}
                <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-purple-900">{t.camera}</h3>
                      <input
                        type="checkbox"
                        checked={preferences.camera}
                        onChange={(e) => setPreferences({ ...preferences, camera: e.target.checked })}
                        className="w-4 h-4 cursor-pointer"
                        data-testid="checkbox-camera-consent"
                      />
                    </div>
                    <p className="text-xs text-purple-800">{t.cameraDesc}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Your Rights */}
            <div className="flex items-start gap-2 mb-6 p-3 bg-blue-50 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-900">{t.yourRights}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!showDetails ? (
                <>
                  <Button
                    onClick={handleAcceptAll}
                    className="flex-1 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-white hover:opacity-90"
                    data-testid="button-accept-all-cookies"
                  >
                    {t.acceptAll}
                  </Button>
                  <Button
                    onClick={() => setShowDetails(true)}
                    variant="outline"
                    className="flex-1 border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37]/10"
                  >
                    {t.customize}
                  </Button>
                  <Button
                    onClick={handleAcceptNecessary}
                    variant="ghost"
                    className="flex-1"
                  >
                    {t.acceptNecessary}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleSavePreferences}
                    className="flex-1 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-white hover:opacity-90"
                    data-testid="button-save-preferences"
                  >
                    {t.savePreferences}
                  </Button>
                  <Button
                    onClick={() => setShowDetails(false)}
                    variant="outline"
                  >
                    {t.learnMore}
                  </Button>
                </>
              )}
            </div>

            {/* Privacy Policy and Data Rights Links */}
            <div className="mt-4 text-center space-y-2">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <a 
                  href="/privacy-policy" 
                  className="text-xs text-[#d4af37] hover:underline inline-flex items-center gap-1"
                >
                  {t.privacyPolicy} →
                </a>
                <a 
                  href="/account-settings#data-rights" 
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  title={language === 'he' ? 'גישה, ייצוא או מחיקת נתונים' : 'Access, export or delete data'}
                >
                  {language === 'he' ? 'זכויות הנתונים שלי' : 'My Data Rights'} →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
