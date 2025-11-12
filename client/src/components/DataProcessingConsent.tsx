import { useState } from 'react';
import { Shield, Check, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface DataProcessingConsentProps {
  language: Language;
  onAccept: () => void;
  onDecline: () => void;
  providerName?: string; // e.g., "Google", "Facebook", or undefined for email/password
}

export function DataProcessingConsent({ 
  language, 
  onAccept, 
  onDecline,
  providerName 
}: DataProcessingConsentProps) {
  const [hasRead, setHasRead] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (!agreed) return;
    
    // Save consent to localStorage
    const consent = {
      type: providerName ? `oauth_${providerName.toLowerCase()}` : 'email_password',
      timestamp: new Date().toISOString(),
      agreed: true,
    };
    localStorage.setItem('petwash_data_processing_consent', JSON.stringify(consent));
    
    onAccept();
  };

  const text = {
    en: {
      title: 'Data Processing Consent',
      subtitle: providerName 
        ? `Before signing in with ${providerName}, please review and accept our data processing terms.`
        : 'Before creating your account, please review and accept our data processing terms.',
      dataWeCollect: 'Data We Collect',
      dataList: providerName 
        ? [
            `${providerName} profile information (name, email, profile picture)`,
            'Pet information you add to your account',
            'Service usage data (wash history, purchases)',
            'Payment information (processed securely)',
            'Location data (for station finder)',
          ]
        : [
            'Email address and password (encrypted)',
            'Pet information you add to your account',
            'Service usage data (wash history, purchases)',
            'Payment information (processed securely)',
            'Location data (for station finder)',
          ],
      whyWeCollect: 'Why We Collect This Data',
      whyList: [
        'To provide and improve our pet washing services',
        'To send service notifications and appointment reminders',
        'To process payments securely',
        'To customize your experience and offers',
        'To comply with legal and regulatory requirements',
      ],
      yourRights: 'Your Rights Under Israeli Privacy Law',
      rightsList: [
        'Access your personal data',
        'Correct inaccurate data',
        'Request data deletion',
        'Withdraw consent at any time',
        'Export your data',
        'File a complaint with the Privacy Protection Authority',
      ],
      dataSharing: 'Data Sharing',
      dataSharingText: 'We never sell your personal data. We only share data with service providers (payment processors, analytics) who are contractually bound to protect your privacy.',
      dataRetention: 'Data Retention',
      dataRetentionText: 'We retain your data as long as your account is active. You can request deletion at any time from your account settings.',
      security: 'Security',
      securityText: 'We use industry-standard encryption and security measures including banking-level WebAuthn authentication to protect your data.',
      iHaveRead: 'I have read and understood the data processing terms',
      iAgree: 'I agree to the processing of my personal data as described above',
      viewPrivacy: 'View Full Privacy Policy',
      viewTerms: 'View Terms of Service',
      decline: 'Decline',
      accept: 'Accept and Continue',
      mustAgree: 'You must read and agree to the terms to continue',
    },
    he: {
      title: 'הסכמה לעיבוד נתונים',
      subtitle: providerName 
        ? `לפני הכניסה עם ${providerName}, אנא עיין וקבל את תנאי עיבוד הנתונים שלנו.`
        : 'לפני יצירת החשבון שלך, אנא עיין וקבל את תנאי עיבוד הנתונים שלנו.',
      dataWeCollect: 'נתונים שאנו אוספים',
      dataList: providerName 
        ? [
            `מידע פרופיל ${providerName} (שם, אימייל, תמונת פרופיל)`,
            'מידע על חיות המחמד שתוסיף לחשבונך',
            'נתוני שימוש בשירות (היסטוריית רחיצה, רכישות)',
            'מידע תשלום (מעובד בצורה מאובטחת)',
            'נתוני מיקום (למציאת תחנות)',
          ]
        : [
            'כתובת אימייל וסיסמה (מוצפנת)',
            'מידע על חיות המחמד שתוסיף לחשבונך',
            'נתוני שימוש בשירות (היסטוריית רחיצה, רכישות)',
            'מידע תשלום (מעובד בצורה מאובטחת)',
            'נתוני מיקום (למציאת תחנות)',
          ],
      whyWeCollect: 'מדוע אנו אוספים נתונים אלה',
      whyList: [
        'לספק ולשפר את שירותי רחיצת החיות שלנו',
        'לשלוח התראות שירות ותזכורות לפגישות',
        'לעבד תשלומים בצורה מאובטחת',
        'להתאים אישית את החוויה והמבצעים שלך',
        'לעמוד בדרישות חוקיות ורגולטוריות',
      ],
      yourRights: 'זכויותיך על פי חוק הגנת הפרטיות הישראלי',
      rightsList: [
        'גישה למידע האישי שלך',
        'תיקון מידע לא מדויק',
        'בקשת מחיקת נתונים',
        'ביטול הסכמה בכל עת',
        'ייצוא הנתונים שלך',
        'הגשת תלונה לרשות להגנת הפרטיות',
      ],
      dataSharing: 'שיתוף נתונים',
      dataSharingText: 'אנחנו אף פעם לא מוכרים את המידע האישי שלך. אנו משתפים נתונים רק עם ספקי שירות (מעבדי תשלום, אנליטיקה) שמחויבים חוזית להגן על פרטיותך.',
      dataRetention: 'שמירת נתונים',
      dataRetentionText: 'אנו שומרים את הנתונים שלך כל עוד החשבון שלך פעיל. תוכל לבקש מחיקה בכל עת מהגדרות החשבון.',
      security: 'אבטחה',
      securityText: 'אנו משתמשים בהצפנה ובאמצעי אבטחה בתקן תעשייתי כולל אימות WebAuthn ברמה בנקאית כדי להגן על הנתונים שלך.',
      iHaveRead: 'קראתי והבנתי את תנאי עיבוד הנתונים',
      iAgree: 'אני מסכים לעיבוד המידע האישי שלי כמתואר לעיל',
      viewPrivacy: 'צפה במדיניות הפרטיות המלאה',
      viewTerms: 'צפה בתנאי השירות',
      decline: 'דחה',
      accept: 'קבל והמשך',
      mustAgree: 'עליך לקרוא ולהסכים לתנאים כדי להמשיך',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#d4af37] to-[#f4d03f] p-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">{t.title}</h2>
              <p className="text-sm text-white/90 mt-1">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Data We Collect */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#d4af37]" />
              {t.dataWeCollect}
            </h3>
            <ul className="space-y-2">
              {t.dataList.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Why We Collect */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.whyWeCollect}</h3>
            <ul className="space-y-2">
              {t.whyList.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Your Rights */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">{t.yourRights}</h3>
            <ul className="space-y-2">
              {t.rightsList.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                  <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Data Sharing */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.dataSharing}</h3>
            <p className="text-sm text-gray-700">{t.dataSharingText}</p>
          </div>

          {/* Data Retention */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.dataRetention}</h3>
            <p className="text-sm text-gray-700">{t.dataRetentionText}</p>
          </div>

          {/* Security */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h3 className="text-lg font-semibold text-green-900 mb-2">{t.security}</h3>
            <p className="text-sm text-green-800">{t.securityText}</p>
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-3 pt-4 border-t">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasRead}
                onChange={(e) => setHasRead(e.target.checked)}
                className="mt-1 w-4 h-4 cursor-pointer"
                data-testid="checkbox-data-processing-read"
              />
              <span className="text-sm text-gray-900 font-medium">{t.iHaveRead}</span>
            </label>
            
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={!hasRead}
                className="mt-1 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="checkbox-data-processing-agree"
              />
              <span className={`text-sm ${!hasRead ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
                {t.iAgree}
              </span>
            </label>
          </div>

          {!agreed && hasRead && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-800">{t.mustAgree}</p>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-3 text-sm">
            <a href="/privacy-policy" target="_blank" className="text-[#d4af37] hover:underline">
              {t.viewPrivacy} →
            </a>
            <a href="/terms" target="_blank" className="text-[#d4af37] hover:underline">
              {t.viewTerms} →
            </a>
            <a href="/account-settings#data-rights" className="text-blue-600 hover:underline">
              {language === 'he' ? 'זכויות הנתונים שלי' : 'My Data Rights'} →
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t p-6 flex flex-col-reverse sm:flex-row gap-3 justify-end bg-gray-50 sticky bottom-0">
          <Button
            onClick={onDecline}
            variant="outline"
            data-testid="button-decline-data-processing"
          >
            {t.decline}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!agreed}
            className="bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-white hover:opacity-90 disabled:opacity-50"
            data-testid="button-accept-data-processing"
          >
            {t.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
