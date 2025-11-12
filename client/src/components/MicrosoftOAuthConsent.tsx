import { useState } from 'react';
import { Shield, User, Mail, Check, Building2, Grid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface MicrosoftOAuthConsentProps {
  language: Language;
  userEmail?: string;
  onContinue: () => void;
  onCancel: () => void;
}

export function MicrosoftOAuthConsent({ 
  language, 
  userEmail,
  onContinue, 
  onCancel 
}: MicrosoftOAuthConsentProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleContinue = () => {
    setIsProcessing(true);
    
    // Save consent to localStorage
    const consent = {
      type: 'oauth_microsoft',
      timestamp: new Date().toISOString(),
      agreed: true,
    };
    localStorage.setItem('petwash_oauth_consent_microsoft', JSON.stringify(consent));
    
    onContinue();
  };

  const text = {
    en: {
      title: 'Sign in with Microsoft',
      subtitle: 'Review what data will be shared with Pet Wash',
      whatWeReceive: 'What we receive from Microsoft',
      permissions: [
        'Your name (first and last name)',
        'Your email address',
        'Microsoft account identifier',
        'Profile picture (if available)',
      ],
      whyWeNeed: 'Why we need this',
      whyList: [
        'Create your Pet Wash account',
        'Send service notifications and receipts',
        'Identify you securely across devices',
        'Provide personalized pet care services',
      ],
      security: 'Microsoft Security',
      securityDesc: 'Microsoft uses enterprise-grade security and encryption to protect your data. You can review and manage permissions anytime from your Microsoft account settings.',
      dataUsage: 'How we use your data',
      dataUsageDesc: 'We only use your Microsoft account data to create and manage your Pet Wash account. We never share your personal information with third parties without your explicit consent.',
      seePolicy: 'See our',
      privacyPolicy: 'Privacy Policy',
      and: 'and',
      termsOfService: 'Terms of Service',
      cancel: 'Cancel',
      continue: 'Continue with Microsoft',
    },
    he: {
      title: 'התחבר עם Microsoft',
      subtitle: 'סקור מה ישותף עם Pet Wash',
      whatWeReceive: 'מה אנחנו מקבלים מ-Microsoft',
      permissions: [
        'השם שלך (שם פרטי ושם משפחה)',
        'כתובת האימייל שלך',
        'מזהה חשבון Microsoft',
        'תמונת פרופיל (אם קיימת)',
      ],
      whyWeNeed: 'למה אנחנו צריכים את זה',
      whyList: [
        'ליצור את חשבון Pet Wash שלך',
        'לשלוח התראות שירות וקבלות',
        'לזהות אותך בצורה מאובטחת בין מכשירים',
        'לספק שירותי טיפול בחיות מחמד מותאמים אישית',
      ],
      security: 'אבטחת Microsoft',
      securityDesc: 'Microsoft משתמשת באבטחה והצפנה ברמה ארגונית כדי להגן על הנתונים שלך. אתה יכול לסקור ולנהל הרשאות בכל עת מההגדרות של חשבון Microsoft שלך.',
      dataUsage: 'איך אנחנו משתמשים בנתונים שלך',
      dataUsageDesc: 'אנחנו משתמשים בנתוני חשבון Microsoft שלך רק כדי ליצור ולנהל את חשבון Pet Wash שלך. אנחנו אף פעם לא משתפים את המידע האישי שלך עם צדדים שלישיים בלי הסכמתך המפורשת.',
      seePolicy: 'ראה את',
      privacyPolicy: 'מדיניות הפרטיות',
      and: 'ו',
      termsOfService: 'תנאי השירות',
      cancel: 'ביטול',
      continue: 'המשך עם Microsoft',
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
        <div className="bg-gradient-to-r from-[#00A4EF] to-[#0078D4] p-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Grid className="w-8 h-8 text-white" />
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
              <Shield className="w-5 h-5 text-[#0078D4]" />
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

          {/* Microsoft Security */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">{t.security}</h3>
            <p className="text-sm text-blue-800">{t.securityDesc}</p>
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
              <a href="/privacy-policy" target="_blank" className="text-[#0078D4] hover:underline font-medium">
                {t.privacyPolicy}
              </a>
              {' '}{t.and}{' '}
              <a href="/terms" target="_blank" className="text-[#0078D4] hover:underline font-medium">
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
            data-testid="button-cancel-microsoft-consent"
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleContinue}
            className="bg-[#0078D4] hover:bg-[#005A9E] text-white"
            disabled={isProcessing}
            data-testid="button-continue-microsoft-consent"
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
