import { useState } from 'react';
import { Shield, Mail, Users, Calendar, AlertCircle, ExternalLink, Info } from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface PremiumGoogleOAuthConsentProps {
  language: Language;
  userEmail?: string;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * LUXURY 2025: Premium Google OAuth Consent Screen
 * Shows comprehensive permissions for Gmail, Contacts, and Calendar
 * Matches official Google OAuth consent design for Pet Wash™ Ltd
 */
export function PremiumGoogleOAuthConsent({ language, userEmail, onContinue, onCancel }: PremiumGoogleOAuthConsentProps) {
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
      header: 'accounts.google.com',
      willAllow: 'This will allow Pet Wash™ Ltd to:',
      permissions: [
        {
          icon: Mail,
          iconBg: 'bg-red-500',
          title: 'Read, compose, send, and permanently delete all your email from Gmail',
          info: 'Pet Wash™ will be able to access, send, and manage all your Gmail messages',
        },
        {
          icon: Users,
          iconBg: 'bg-blue-500',
          title: 'See, edit, download, and permanently delete your contacts',
          info: 'Access to your Google Contacts for appointment reminders and communications',
        },
        {
          icon: Calendar,
          iconBg: 'bg-yellow-500',
          title: 'See, edit, share, and permanently delete all the calendars you can access using Google Calendar',
          info: 'Schedule and manage pet washing appointments directly in your Google Calendar',
        },
      ],
      makeSure: 'Make sure you trust Pet Wash™ Ltd',
      trustMessage: 'You may be sharing sensitive info with this site or app. You can always see or remove access in your',
      googleAccount: 'Google Account',
      learnHow: 'Learn how Google helps you',
      shareDataSafely: 'share data safely',
      seePetWash: "See Pet Wash™ Ltd's",
      privacyPolicy: 'Privacy Policy',
      and: 'and',
      termsOfService: 'Terms of Service',
      cancel: 'Cancel',
      allow: 'Allow',
      appName: 'Pet Wash™ Ltd',
    },
    he: {
      header: 'accounts.google.com',
      willAllow: 'זה יאפשר ל-Pet Wash™ Ltd:',
      permissions: [
        {
          icon: Mail,
          iconBg: 'bg-red-500',
          title: 'קריאה, כתיבה, שליחה ומחיקה קבועה של כל האימיילים שלך ב-Gmail',
          info: 'Pet Wash™ תוכל לגשת, לשלוח ולנהל את כל הודעות Gmail שלך',
        },
        {
          icon: Users,
          iconBg: 'bg-blue-500',
          title: 'צפייה, עריכה, הורדה ומחיקה קבועה של אנשי הקשר שלך',
          info: 'גישה לאנשי הקשר של Google שלך לתזכורות תורים ותקשורת',
        },
        {
          icon: Calendar,
          iconBg: 'bg-yellow-500',
          title: 'צפייה, עריכה, שיתוף ומחיקה קבועה של כל היומנים שאליהם יש לך גישה ב-Google Calendar',
          info: 'קביעה וניהול תורי רחיצת כלבים ישירות ביומן Google שלך',
        },
      ],
      makeSure: 'ודא שאתה סומך על Pet Wash™ Ltd',
      trustMessage: 'ייתכן שאתה משתף מידע רגיש עם אתר או אפליקציה זו. תמיד תוכל לראות או להסיר גישה ב',
      googleAccount: 'חשבון Google',
      learnHow: 'למד כיצד Google עוזרת לך',
      shareDataSafely: 'לשתף נתונים בבטחה',
      seePetWash: 'ראה את',
      privacyPolicy: 'מדיניות הפרטיות',
      and: 'ו',
      termsOfService: 'תנאי השירות',
      cancel: 'ביטול',
      allow: 'אפשר',
      appName: 'Pet Wash™ Ltd',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];
  const isRTL = language === 'he' || language === 'ar';

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center overflow-y-auto">
      <div 
        className="bg-white w-full max-w-lg mx-auto min-h-screen md:min-h-0 md:rounded-xl md:shadow-xl"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header - Google Style */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Shield className="w-4 h-4" />
              <span className="font-medium">{t.header}</span>
            </div>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
                <span className="text-gray-600">aA</span>
              </button>
              <button className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* App Logo & Name */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f4d03f] flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <span className="text-base font-medium text-gray-900">{t.appName}</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Will Allow Section */}
          <div>
            <h2 className="text-2xl font-normal text-gray-900 mb-6">
              {t.willAllow}
            </h2>

            {/* Permissions List */}
            <div className="space-y-4">
              {t.permissions.map((permission, index) => (
                <div key={index} className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 ${permission.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <permission.icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="text-base text-gray-900 leading-tight mb-0.5">
                      {permission.title}
                    </div>
                  </div>

                  {/* Info Button */}
                  <button className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0 group relative">
                    <Info className="w-5 h-5 text-gray-500" />
                    {/* Tooltip */}
                    <div className="absolute right-0 top-10 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                      {permission.info}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Warning Section - Google Style */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <h3 className="text-base font-medium text-gray-900 mb-2">
              {t.makeSure}
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {t.trustMessage}{' '}
              <a 
                href="https://myaccount.google.com/permissions" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#1a73e8] hover:underline font-medium"
              >
                {t.googleAccount}
              </a>.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {t.learnHow}{' '}
              <a 
                href="https://support.google.com/accounts/answer/3466521" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#1a73e8] hover:underline font-medium"
              >
                {t.shareDataSafely}
              </a>.
            </p>
          </div>

          {/* Privacy Links */}
          <div className="text-sm text-gray-700">
            {t.seePetWash}{' '}
            <a href="/privacy-policy" target="_blank" className="text-[#1a73e8] hover:underline">
              {t.privacyPolicy}
            </a>
            {' '}{t.and}{' '}
            <a href="/terms" target="_blank" className="text-[#1a73e8] hover:underline">
              {t.termsOfService}
            </a>.
          </div>
        </div>

        {/* Actions - Google Style */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isProcessing}
            className="px-6 h-10 border-gray-300 hover:bg-gray-50 text-[#1a73e8] font-medium"
            data-testid="button-cancel-google-oauth"
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isProcessing}
            className="px-6 h-10 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium shadow-none"
            data-testid="button-allow-google-oauth"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.allow}
              </div>
            ) : (
              t.allow
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
