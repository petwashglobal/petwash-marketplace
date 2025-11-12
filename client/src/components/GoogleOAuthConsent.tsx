import { useState } from 'react';
import { Shield, Mail, User, AlertCircle, ExternalLink } from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface GoogleOAuthConsentProps {
  language: Language;
  userEmail?: string;
  onContinue: () => void;
  onCancel: () => void;
}

export function GoogleOAuthConsent({ language, userEmail, onContinue, onCancel }: GoogleOAuthConsentProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleContinue = async () => {
    setIsProcessing(true);
    try {
      await onContinue();
    } finally {
      setIsProcessing(false);
    }
  };

  const text = {
    en: {
      title: 'Pet Wash™ wants to access your Google Account',
      email: userEmail || 'your account',
      selectWhat: 'Select what Pet Wash™ can access',
      becauseUsing: "Because you're using Sign in with Google, Pet Wash™ will be able to",
      permissions: [
        {
          icon: User,
          title: 'Associate you with your personal info on Google',
          description: 'Basic profile information to create your Pet Wash account',
        },
        {
          icon: User,
          title: "See your personal info, including any personal info you've made publicly available",
          description: 'Name, profile picture, and email address',
        },
        {
          icon: Mail,
          title: 'See your primary Google Account email address',
          description: 'Used for login, notifications, and service communications',
        },
      ],
      makeSure: 'Make sure you trust Pet Wash™',
      trustMessage: 'You may be sharing sensitive info with this site or app. You can always see or remove access in your',
      googleAccount: 'Google Account',
      learnHow: 'Learn how Google helps you',
      shareDataSafely: 'share data safely',
      seePolicy: "See Pet Wash™'s",
      privacyPolicy: 'Privacy Policy',
      and: 'and',
      termsOfService: 'Terms of Service',
      cancel: 'Cancel',
      continue: 'Continue',
      dataUsage: 'How we use your data',
      dataUsageDesc: 'We only use your Google data to create and manage your Pet Wash account. We never share your personal information with third parties without your explicit consent.',
    },
    he: {
      title: 'Pet Wash™ רוצה לגשת לחשבון Google שלך',
      email: userEmail || 'החשבון שלך',
      selectWhat: 'בחר למה Pet Wash™ יכולה לגשת',
      becauseUsing: 'מכיוון שאתה משתמש בכניסה עם Google, Pet Wash™ תוכל ל',
      permissions: [
        {
          icon: User,
          title: 'לשייך אותך עם המידע האישי שלך ב-Google',
          description: 'מידע פרופיל בסיסי ליצירת חשבון Pet Wash שלך',
        },
        {
          icon: User,
          title: 'לראות את המידע האישי שלך, כולל כל מידע אישי שהפכת לזמין לציבור',
          description: 'שם, תמונת פרופיל וכתובת אימייל',
        },
        {
          icon: Mail,
          title: 'לראות את כתובת האימייל הראשית של חשבון Google שלך',
          description: 'משמש להתחברות, התראות ותקשורת שירות',
        },
      ],
      makeSure: 'ודא שאתה סומך על Pet Wash™',
      trustMessage: 'ייתכן שאתה משתף מידע רגיש עם אתר או אפליקציה זו. תמיד תוכל לראות או להסיר גישה ב',
      googleAccount: 'חשבון Google',
      learnHow: 'למד כיצד Google עוזרת לך',
      shareDataSafely: 'לשתף נתונים בבטחה',
      seePolicy: 'ראה את',
      privacyPolicy: 'מדיניות הפרטיות',
      and: 'ו',
      termsOfService: 'תנאי השירות',
      cancel: 'ביטול',
      continue: 'המשך',
      dataUsage: 'כיצד אנו משתמשים בנתונים שלך',
      dataUsageDesc: 'אנו משתמשים בנתוני Google שלך רק ליצירה וניהול חשבון Pet Wash שלך. אנחנו אף פעם לא משתפים את המידע האישי שלך עם צדדים שלישיים ללא הסכמתך המפורשת.',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaGoogle className="w-6 h-6 text-gray-700" />
            <span className="text-sm text-gray-600">Sign in with Google</span>
          </div>
          <h2 className="text-2xl font-normal text-gray-900 mb-2">
            {t.title}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f4d03f] flex items-center justify-center text-white font-semibold">
              {t.email.charAt(0).toUpperCase()}
            </div>
            <span>{t.email}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Permissions Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              {t.selectWhat}
            </h3>
            
            {/* No checkboxes - auto-granted */}
            <div className="text-sm text-gray-700 mb-4">
              {t.becauseUsing}
            </div>

            <div className="space-y-3">
              {t.permissions.map((permission, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200">
                  <permission.icon className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 mb-1">
                      {permission.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {permission.description}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 rounded border-2 border-gray-400 bg-gray-400 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Usage Info */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  {t.dataUsage}
                </h4>
                <p className="text-xs text-blue-800">
                  {t.dataUsageDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Trust Section */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                  {t.makeSure}
                </h4>
                <p className="text-xs text-yellow-800 mb-2">
                  {t.trustMessage}{' '}
                  <a 
                    href="https://myaccount.google.com/permissions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    {t.googleAccount}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <p className="text-xs text-yellow-800">
                  {t.learnHow}{' '}
                  <a 
                    href="https://support.google.com/accounts/answer/3466521" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {t.shareDataSafely}
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Links */}
          <div className="text-xs text-gray-600 text-center space-y-1">
            <div>
              {t.seePolicy}{' '}
              <a href="/privacy-policy" target="_blank" className="text-[#d4af37] hover:underline">
                {t.privacyPolicy}
              </a>
              {' '}{t.and}{' '}
              <a href="/terms" target="_blank" className="text-[#d4af37] hover:underline">
                {t.termsOfService}
              </a>
            </div>
            <div>
              <a href="/account-settings#data-rights" className="text-blue-600 hover:underline">
                {language === 'he' ? 'זכויות הנתונים שלי' : 'My Data Rights'} →
              </a>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t p-6 flex flex-col-reverse sm:flex-row gap-3 justify-end">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isProcessing}
            data-testid="button-cancel-google-consent"
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleContinue}
            className="bg-[#1a73e8] hover:bg-[#1557b0] text-white"
            disabled={isProcessing}
            data-testid="button-continue-google-consent"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.continue}
              </div>
            ) : (
              t.continue
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
