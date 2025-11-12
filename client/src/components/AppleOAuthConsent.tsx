import { useState } from 'react';
import { Apple, Shield, User, Mail, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface AppleOAuthConsentProps {
  language: Language;
  userEmail?: string;
  onContinue: () => void;
  onCancel: () => void;
}

export function AppleOAuthConsent({ 
  language, 
  userEmail,
  onContinue, 
  onCancel 
}: AppleOAuthConsentProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleContinue = () => {
    setIsProcessing(true);
    
    // Save consent to localStorage
    const consent = {
      type: 'oauth_apple',
      timestamp: new Date().toISOString(),
      agreed: true,
    };
    localStorage.setItem('petwash_oauth_consent_apple', JSON.stringify(consent));
    
    onContinue();
  };

  const text = {
    en: {
      title: 'Sign in with Apple',
      subtitle: 'Review what data will be shared with Pet Wash',
      whatWeReceive: 'What we receive from Apple',
      permissions: [
        'Your name (as registered with Apple ID)',
        'Your email address (or Apple-generated email)',
        'Apple ID user identifier',
      ],
      whyWeNeed: 'Why we need this',
      whyList: [
        'Create your Pet Wash account',
        'Send service notifications and receipts',
        'Identify you securely across devices',
        'Provide personalized pet care services',
      ],
      privacy: 'Apple Privacy Protection',
      privacyDesc: 'Apple uses advanced security and privacy features to protect your data. You can manage or revoke access anytime from your Apple ID settings.',
      dataUsage: 'How we use your data',
      dataUsageDesc: 'We only use your Apple ID data to create and manage your Pet Wash account. We never share your personal information with third parties without your explicit consent.',
      seePolicy: 'See our',
      privacyPolicy: 'Privacy Policy',
      and: 'and',
      termsOfService: 'Terms of Service',
      cancel: 'Cancel',
      continue: 'Continue with Apple',
    },
    he: {
      title: 'התחבר עם Apple',
      subtitle: 'סקור מה ישותף עם Pet Wash',
      whatWeReceive: 'מה אנחנו מקבלים מ-Apple',
      permissions: [
        'השם שלך (כפי שרשום ב-Apple ID)',
        'כתובת האימייל שלך (או אימייל שנוצר על ידי Apple)',
        'מזהה משתמש Apple ID',
      ],
      whyWeNeed: 'למה אנחנו צריכים את זה',
      whyList: [
        'ליצור את חשבון Pet Wash שלך',
        'לשלוח התראות שירות וקבלות',
        'לזהות אותך בצורה מאובטחת בין מכשירים',
        'לספק שירותי טיפול בחיות מחמד מותאמים אישית',
      ],
      privacy: 'הגנת פרטיות Apple',
      privacyDesc: 'Apple משתמשת בתכונות אבטחה ופרטיות מתקדמות כדי להגן על הנתונים שלך. אתה יכול לנהל או לבטל גישה בכל עת מההגדרות של Apple ID שלך.',
      dataUsage: 'איך אנחנו משתמשים בנתונים שלך',
      dataUsageDesc: 'אנחנו משתמשים בנתוני Apple ID שלך רק כדי ליצור ולנהל את חשבון Pet Wash שלך. אנחנו אף פעם לא משתפים את המידע האישי שלך עם צדדים שלישיים בלי הסכמתך המפורשת.',
      seePolicy: 'ראה את',
      privacyPolicy: 'מדיניות הפרטיות',
      and: 'ו',
      termsOfService: 'תנאי השירות',
      cancel: 'ביטול',
      continue: 'המשך עם Apple',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto my-8"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="bg-black p-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Apple className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">{t.title}</h2>
              <p className="text-sm text-white/90 mt-1">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* What we receive */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-black" />
              {t.whatWeReceive}
            </h3>
            <ul className="space-y-2">
              {t.permissions.map((permission, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{permission}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Why we need */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.whyWeNeed}</h3>
            <ul className="space-y-2">
              {t.whyList.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Apple Privacy Protection */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.privacy}</h3>
            <p className="text-sm text-gray-700">{t.privacyDesc}</p>
          </div>

          {/* Data Usage */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.dataUsage}</h3>
            <p className="text-sm text-gray-700">{t.dataUsageDesc}</p>
          </div>

          {/* Privacy Links */}
          <div className="text-xs text-gray-600 text-center space-y-1">
            <div>
              {t.seePolicy}{' '}
              <a href="/privacy-policy" target="_blank" className="text-black hover:underline font-medium">
                {t.privacyPolicy}
              </a>
              {' '}{t.and}{' '}
              <a href="/terms" target="_blank" className="text-black hover:underline font-medium">
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
            data-testid="button-cancel-apple-consent"
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleContinue}
            className="bg-black hover:bg-gray-800 text-white"
            disabled={isProcessing}
            data-testid="button-continue-apple-consent"
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
