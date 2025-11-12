import { MapPin, Camera, Bell, Smartphone, Fingerprint, Image, Network, Mic, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';
import { FaChrome } from 'react-icons/fa';

interface iOSPermissionsGuideProps {
  language: Language;
  onClose?: () => void;
}

/**
 * LUXURY 2025: iOS Permissions Guide
 * Shows what iOS permissions Pet Wash™ needs and why
 * Matches iOS Settings style
 */
export function iOSPermissionsGuide({ language, onClose }: iOSPermissionsGuideProps) {
  const text = {
    en: {
      title: 'Allow Pet Wash™ to Access',
      subtitle: 'Enable these permissions for the best experience',
      permissions: [
        {
          icon: MapPin,
          iconBg: 'bg-blue-500',
          name: 'Location',
          status: 'While Using',
          description: 'Find nearby pet wash stations and show weather-based recommendations',
          enabled: true,
        },
        {
          icon: Image,
          iconBg: 'bg-pink-500',
          name: 'Photos',
          status: 'Add Photos Only',
          description: 'Save wash receipts and loyalty cards to your photo library',
          enabled: true,
        },
        {
          icon: Network,
          iconBg: 'bg-blue-600',
          name: 'Local Network',
          status: 'Enabled',
          description: 'Connect to Pet Wash™ smart stations for contactless payment',
          enabled: true,
        },
        {
          icon: Mic,
          iconBg: 'bg-orange-500',
          name: 'Microphone',
          status: 'Disabled',
          description: 'Voice commands for hands-free wash station control (optional)',
          enabled: false,
        },
        {
          icon: Camera,
          iconBg: 'bg-gray-700',
          name: 'Camera',
          status: 'Enabled',
          description: 'Scan QR codes at wash stations and take pet photos',
          enabled: true,
        },
        {
          icon: Fingerprint,
          iconBg: 'bg-green-500',
          name: 'Face ID',
          status: 'Enabled',
          description: 'Fast, secure biometric login without passwords',
          enabled: true,
        },
        {
          icon: Bell,
          iconBg: 'bg-red-500',
          name: 'Notifications',
          status: 'Deliver Quietly',
          description: 'Wash reminders, appointment confirmations, and loyalty rewards',
          enabled: true,
        },
        {
          icon: Smartphone,
          iconBg: 'bg-gray-600',
          name: 'Mobile Data',
          status: 'Enabled',
          description: 'Use cellular data when Wi-Fi is unavailable',
          enabled: true,
        },
      ],
      defaultBrowser: 'Default Browser App',
      defaultBrowserValue: 'Chrome',
      crossWebsite: 'Allow Cross-Website Tracking',
      crossWebsiteStatus: 'Disabled',
      crossWebsiteDesc: 'We respect your privacy and never track you across websites',
      lowPowerNote: 'When in Low Power Mode, background app refresh is disabled.',
      howTo: 'How to Enable Permissions',
      howToSteps: [
        'Open iOS Settings app',
        'Scroll down and tap "Pet Wash"',
        'Enable permissions you want to grant',
        'Return to Pet Wash app',
      ],
      privacyNote: '🔒 Your privacy is protected',
      privacyDesc: 'We only request permissions essential for app functionality. You can change these anytime in iOS Settings.',
      close: 'Got It',
    },
    he: {
      title: 'אפשר ל-Pet Wash™ לגשת',
      subtitle: 'הפעל הרשאות אלה לחוויה הטובה ביותר',
      permissions: [
        {
          icon: MapPin,
          iconBg: 'bg-blue-500',
          name: 'מיקום',
          status: 'בזמן שימוש',
          description: 'מצא תחנות רחיצה קרובות והצג המלצות מבוססות מזג אוויר',
          enabled: true,
        },
        {
          icon: Image,
          iconBg: 'bg-pink-500',
          name: 'תמונות',
          status: 'הוסף תמונות בלבד',
          description: 'שמור קבלות רחיצה וכרטיסי נאמנות בספריית התמונות שלך',
          enabled: true,
        },
        {
          icon: Network,
          iconBg: 'bg-blue-600',
          name: 'רשת מקומית',
          status: 'מופעל',
          description: 'התחבר לתחנות Pet Wash™ החכמות לתשלום ללא מגע',
          enabled: true,
        },
        {
          icon: Mic,
          iconBg: 'bg-orange-500',
          name: 'מיקרופון',
          status: 'כבוי',
          description: 'פקודות קוליות לשליטה בתחנת רחיצה ללא ידיים (אופציונלי)',
          enabled: false,
        },
        {
          icon: Camera,
          iconBg: 'bg-gray-700',
          name: 'מצלמה',
          status: 'מופעל',
          description: 'סרוק קודי QR בתחנות רחיצה וצלם תמונות של חיות מחמד',
          enabled: true,
        },
        {
          icon: Fingerprint,
          iconBg: 'bg-green-500',
          name: 'Face ID',
          status: 'מופעל',
          description: 'כניסה ביומטרית מהירה ומאובטחת ללא סיסמאות',
          enabled: true,
        },
        {
          icon: Bell,
          iconBg: 'bg-red-500',
          name: 'התראות',
          status: 'מסירה שקטה',
          description: 'תזכורות רחיצה, אישורי תורים ותגמולי נאמנות',
          enabled: true,
        },
        {
          icon: Smartphone,
          iconBg: 'bg-gray-600',
          name: 'נתונים סלולריים',
          status: 'מופעל',
          description: 'השתמש בנתונים סלולריים כאשר Wi-Fi לא זמין',
          enabled: true,
        },
      ],
      defaultBrowser: 'אפליקציית דפדפן ברירת מחדל',
      defaultBrowserValue: 'Chrome',
      crossWebsite: 'אפשר מעקב בין אתרים',
      crossWebsiteStatus: 'כבוי',
      crossWebsiteDesc: 'אנחנו מכבדים את הפרטיות שלך ולעולם לא עוקבים אחריך באתרים',
      lowPowerNote: 'במצב חיסכון בסוללה, רענון אפליקציה ברקע מושבת.',
      howTo: 'כיצד להפעיל הרשאות',
      howToSteps: [
        'פתח את אפליקציית ההגדרות iOS',
        'גלול למטה והקש על "Pet Wash"',
        'הפעל הרשאות שברצונך להעניק',
        'חזור לאפליקציית Pet Wash',
      ],
      privacyNote: '🔒 הפרטיות שלך מוגנת',
      privacyDesc: 'אנו מבקשים רק הרשאות חיוניות לפונקציונליות האפליקציה. תוכל לשנות אותן בכל עת בהגדרות iOS.',
      close: 'הבנתי',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 overflow-y-auto">
      <div 
        className="min-h-screen pb-20"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* iOS-Style Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3 mb-2">
              <FaChrome className="w-8 h-8 text-gray-700 dark:text-gray-300" />
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Pet Wash™
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Permissions List - iOS Style */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm">
            {t.permissions.map((permission, index) => (
              <div 
                key={index}
                className={`
                  flex items-center gap-4 px-4 py-3
                  ${index !== t.permissions.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''}
                `}
              >
                {/* Icon */}
                <div className={`w-8 h-8 ${permission.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <permission.icon className="w-4 h-4 text-white" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="text-base font-normal text-gray-900 dark:text-white">
                    {permission.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {permission.description}
                  </div>
                </div>

                {/* Status / Toggle */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {permission.status !== 'Enabled' && permission.status !== 'Disabled' && permission.status !== 'מופעל' && permission.status !== 'כבוי' ? (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {permission.status}
                    </span>
                  ) : (
                    <div className={`
                      relative w-12 h-7 rounded-full transition-colors duration-200
                      ${permission.enabled 
                        ? 'bg-green-500' 
                        : 'bg-gray-300 dark:bg-gray-600'
                      }
                    `}>
                      <div className={`
                        absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200
                        ${permission.enabled 
                          ? (isRTL ? 'left-0.5' : 'right-0.5') 
                          : (isRTL ? 'right-0.5' : 'left-0.5')
                        }
                      `} />
                    </div>
                  )}
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Default Browser */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-base text-gray-900 dark:text-white">
                {t.defaultBrowser}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base text-gray-500 dark:text-gray-400">
                  {t.defaultBrowserValue}
                </span>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Cross-Website Tracking */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-base text-gray-900 dark:text-white">
                  {t.crossWebsite}
                </span>
                <div className="relative w-12 h-7 rounded-full bg-gray-300 dark:bg-gray-600">
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md ${isRTL ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t.crossWebsiteDesc}
              </p>
            </div>
          </div>

          {/* Low Power Note */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {t.lowPowerNote}
            </p>
          </div>

          {/* How To Enable */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
            <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-3">
              {t.howTo}
            </h3>
            <ol className="space-y-2">
              {t.howToSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm text-blue-800 dark:text-blue-200 pt-0.5">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Privacy Note */}
          <div className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-4 border border-green-200 dark:border-green-800">
            <h4 className="text-base font-semibold text-green-900 dark:text-green-100 mb-2">
              {t.privacyNote}
            </h4>
            <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
              {t.privacyDesc}
            </p>
          </div>

          {/* Close Button */}
          {onClose && (
            <Button
              onClick={onClose}
              className="w-full h-14 bg-[#d4af37] hover:bg-[#c4a030] text-white text-lg font-semibold rounded-xl shadow-lg"
              data-testid="button-close-ios-permissions"
            >
              {t.close}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
