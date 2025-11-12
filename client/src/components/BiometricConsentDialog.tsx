import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Fingerprint, Smartphone, Key, Lock, FileText, ExternalLink, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

interface BiometricConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  type: 'passkey' | 'faceid' | 'touchid' | 'windowshello';
}

export function BiometricConsentDialog({ 
  isOpen, 
  onClose, 
  onAccept,
  type
}: BiometricConsentDialogProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [biometricConsent, setBiometricConsent] = useState(false);
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false);
  const [privacyPolicyConsent, setPrivacyPolicyConsent] = useState(false);

  const handleAccept = async () => {
    if (!biometricConsent || !dataProcessingConsent || !privacyPolicyConsent) return;
    
    // Log biometric consent to backend (REQUIRED by Apple/Google)
    try {
      await fetch('/api/consent/biometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          timestamp: new Date().toISOString(),
          consented: true,
          userAgent: navigator.userAgent,
          platform: navigator.platform
        })
      });
    } catch (error) {
      console.error('Failed to log biometric consent:', error);
    }

    onAccept();
    handleClose();
  };

  const handleClose = () => {
    setBiometricConsent(false);
    setDataProcessingConsent(false);
    setPrivacyPolicyConsent(false);
    onClose();
  };

  const content = {
    en: {
      passkey: {
        title: 'Enable Passkey Authentication',
        icon: Key,
        description: 'Use your device\'s biometric authentication (Face ID, Touch ID, or Windows Hello) for secure, password-free sign-in.',
        method: 'Passkey (WebAuthn Level 2)',
        whatIsIt: 'What is a Passkey?',
        whatIsItDesc: 'A passkey is a cryptographic credential stored securely on your device. It uses your biometric data (fingerprint, face, or PIN) to authenticate without transmitting passwords.',
        dataCollected: 'Biometric Data Processing',
        dataItems: [
          '🔒 Your biometric data (Face ID/Touch ID/Windows Hello) is processed locally on your device',
          '🚫 Pet Wash™ NEVER receives, stores, or has access to your biometric information',
          '✅ Only a cryptographic signature is sent to our servers for authentication',
          '🔐 Your passkey is protected by your device\'s Secure Enclave (iOS) or TPM (Windows)',
          '📱 Biometric data never leaves your device and is encrypted by Apple/Microsoft/Google'
        ],
        appleCompliance: '🍎 Apple Requirements',
        appleItems: [
          'Face ID/Touch ID data is processed by Apple\'s Secure Enclave',
          'Your biometric templates never leave your device',
          'Pet Wash™ complies with Apple\'s biometric data usage policies',
          'You can revoke access at any time in Settings → Face ID & Passcode'
        ],
        googleCompliance: '🤖 Google/Android Requirements',
        googleItems: [
          'Biometric authentication uses Android BiometricPrompt API',
          'Data is processed by your device\'s hardware security module',
          'Pet Wash™ complies with Google Play biometric policies',
          'You can manage permissions in Settings → Security → Biometrics'
        ],
        microsoftCompliance: '🪟 Microsoft Requirements',
        microsoftItems: [
          'Windows Hello uses TPM (Trusted Platform Module)',
          'Biometric data is isolated from the operating system',
          'Pet Wash™ complies with Microsoft identity platform policies',
          'Manage in Settings → Accounts → Sign-in options'
        ],
        consent1: 'I consent to using my device\'s biometric authentication (Face ID/Touch ID/Windows Hello) for secure sign-in to Pet Wash™',
        consent2: 'I understand that my biometric data is processed locally on my device and Pet Wash™ never receives or stores this sensitive information',
        consent3: 'I have read and agree to the',
        privacyPolicy: 'Privacy Policy',
        termsOfService: 'Terms of Service',
        biometricPolicy: 'Biometric Data Policy',
        and: 'and',
        gdprNote: '✅ GDPR & Israeli Privacy Law Compliance',
        gdprItems: [
          'You can revoke biometric authentication at any time',
          'Your data rights are protected under GDPR Article 9 (Special Categories)',
          'Biometric processing is based on your explicit consent',
          'Israeli Privacy Protection Law (Amendment 13, 2025) compliance'
        ],
        securityNote: '🔒 Security & Privacy',
        securityItems: [
          'Banking-level security with FIDO2/WebAuthn standards',
          'Resistant to phishing, credential stuffing, and password attacks',
          'Cryptographic keys are device-bound and non-exportable',
          'Meets SOC 2, ISO 27001, and PCI DSS compliance standards'
        ],
        cancel: 'Cancel',
        accept: 'Accept & Enable Passkey',
        mustAgree: 'You must accept all terms to enable biometric authentication'
      },
      faceid: {
        title: 'Enable Face ID Authentication',
        icon: Smartphone,
        description: 'Use Face ID for secure, password-free authentication to your Pet Wash™ account.',
        method: 'Face ID (TrueDepth Camera)',
      },
      touchid: {
        title: 'Enable Touch ID Authentication',
        icon: Fingerprint,
        description: 'Use Touch ID for secure, password-free authentication to your Pet Wash™ account.',
        method: 'Touch ID (Fingerprint Sensor)',
      },
      windowshello: {
        title: 'Enable Windows Hello',
        icon: Lock,
        description: 'Use Windows Hello for secure, password-free authentication to your Pet Wash™ account.',
        method: 'Windows Hello (Biometric/PIN)',
      }
    },
    he: {
      passkey: {
        title: 'הפעלת אימות Passkey',
        icon: Key,
        description: 'השתמש באימות הביומטרי של המכשיר שלך (Face ID, Touch ID או Windows Hello) לכניסה מאובטחת ללא סיסמה.',
        method: 'Passkey (WebAuthn Level 2)',
        whatIsIt: 'מה זה Passkey?',
        whatIsItDesc: 'Passkey הוא אישור קריפטוגרפי המאוחסן בצורה מאובטחת במכשיר שלך. הוא משתמש בנתונים הביומטריים שלך (טביעת אצבע, פנים או PIN) לאימות ללא העברת סיסמאות.',
        dataCollected: 'עיבוד נתונים ביומטריים',
        dataItems: [
          '🔒 הנתונים הביומטריים שלך (Face ID/Touch ID/Windows Hello) מעובדים מקומית במכשיר שלך',
          '🚫 Pet Wash™ לעולם לא מקבלת, מאחסנת או ניגשת למידע הביומטרי שלך',
          '✅ רק חתימה קריפטוגרפית נשלחת לשרתים שלנו לאימות',
          '🔐 ה-Passkey שלך מוגן על ידי Secure Enclave (iOS) או TPM (Windows) של המכשיר',
          '📱 נתונים ביומטריים לעולם לא עוזבים את המכשיר ומוצפנים על ידי Apple/Microsoft/Google'
        ],
        appleCompliance: '🍎 דרישות Apple',
        appleItems: [
          'נתוני Face ID/Touch ID מעובדים על ידי Secure Enclave של Apple',
          'התבניות הביומטריות שלך לעולם לא עוזבות את המכשיר',
          'Pet Wash™ עומדת במדיניות השימוש בנתונים ביומטריים של Apple',
          'ניתן לבטל גישה בכל עת בהגדרות → Face ID וקוד גישה'
        ],
        googleCompliance: '🤖 דרישות Google/Android',
        googleItems: [
          'אימות ביומטרי משתמש ב-Android BiometricPrompt API',
          'הנתונים מעובדים על ידי מודול האבטחה החומרתי של המכשיר',
          'Pet Wash™ עומדת במדיניות ביומטריה של Google Play',
          'ניתן לנהל הרשאות בהגדרות → אבטחה → ביומטריה'
        ],
        microsoftCompliance: '🪟 דרישות Microsoft',
        microsoftItems: [
          'Windows Hello משתמש ב-TPM (Trusted Platform Module)',
          'נתונים ביומטריים מבודדים ממערכת ההפעלה',
          'Pet Wash™ עומדת במדיניות פלטפורמת הזהות של Microsoft',
          'ניהול בהגדרות → חשבונות → אפשרויות כניסה'
        ],
        consent1: 'אני מסכים להשתמש באימות הביומטרי של המכשיר (Face ID/Touch ID/Windows Hello) לכניסה מאובטחת ל-Pet Wash™',
        consent2: 'אני מבין שהנתונים הביומטריים שלי מעובדים מקומית במכשיר ו-Pet Wash™ לעולם לא מקבלת או מאחסנת מידע רגיש זה',
        consent3: 'קראתי ואני מסכים ל',
        privacyPolicy: 'מדיניות הפרטיות',
        termsOfService: 'תנאי השימוש',
        biometricPolicy: 'מדיניות נתונים ביומטריים',
        and: 'ו',
        gdprNote: '✅ עמידה ב-GDPR וחוק הגנת הפרטיות הישראלי',
        gdprItems: [
          'ניתן לבטל אימות ביומטרי בכל עת',
          'זכויות הנתונים שלך מוגנות תחת GDPR סעיף 9 (קטגוריות מיוחדות)',
          'עיבוד ביומטרי מבוסס על הסכמה מפורשת שלך',
          'עמידה בחוק הגנת הפרטיות הישראלי (תיקון 13, 2025)'
        ],
        securityNote: '🔒 אבטחה ופרטיות',
        securityItems: [
          'אבטחה ברמת בנקאות עם תקני FIDO2/WebAuthn',
          'עמידות בפני פישינג, credential stuffing והתקפות סיסמה',
          'מפתחות קריפטוגרפיים קשורים למכשיר ולא ניתנים לייצוא',
          'עומד בתקני SOC 2, ISO 27001 ו-PCI DSS'
        ],
        cancel: 'ביטול',
        accept: 'אישור והפעלת Passkey',
        mustAgree: 'עליך לאשר את כל התנאים כדי להפעיל אימות ביומטרי'
      },
      faceid: {
        title: 'הפעלת אימות Face ID',
        icon: Smartphone,
        description: 'השתמש ב-Face ID לאימות מאובטח ללא סיסמה לחשבון Pet Wash™ שלך.',
        method: 'Face ID (מצלמת TrueDepth)',
      },
      touchid: {
        title: 'הפעלת אימות Touch ID',
        icon: Fingerprint,
        description: 'השתמש ב-Touch ID לאימות מאובטח ללא סיסמה לחשבון Pet Wash™ שלך.',
        method: 'Touch ID (חיישן טביעת אצבע)',
      },
      windowshello: {
        title: 'הפעלת Windows Hello',
        icon: Lock,
        description: 'השתמש ב-Windows Hello לאימות מאובטח ללא סיסמה לחשבון Pet Wash™ שלך.',
        method: 'Windows Hello (ביומטרי/PIN)',
      }
    }
  };

  const t = content[isHebrew ? 'he' : 'en'][type];
  const passkeyContent = content[isHebrew ? 'he' : 'en'].passkey;
  const IconComponent = t.icon;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={isHebrew ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <IconComponent className="w-7 h-7 text-blue-600" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-4">
            {t.description}
          </DialogDescription>
          <div className="mt-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {passkeyContent.method}
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* What is a Passkey */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              {passkeyContent.whatIsIt}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {passkeyContent.whatIsItDesc}
            </p>
          </div>

          {/* Biometric Data Processing */}
          <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-2 border-green-200 dark:border-green-800">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              {passkeyContent.dataCollected}
            </h3>
            <ul className="space-y-3">
              {passkeyContent.dataItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="mt-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform-Specific Compliance */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Apple */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <h4 className="font-semibold text-sm mb-3">{passkeyContent.appleCompliance}</h4>
              <ul className="space-y-2">
                {passkeyContent.appleItems.map((item, index) => (
                  <li key={index} className="text-xs text-gray-600 dark:text-gray-400">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Google/Android */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <h4 className="font-semibold text-sm mb-3">{passkeyContent.googleCompliance}</h4>
              <ul className="space-y-2">
                {passkeyContent.googleItems.map((item, index) => (
                  <li key={index} className="text-xs text-gray-600 dark:text-gray-400">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Microsoft */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <h4 className="font-semibold text-sm mb-3">{passkeyContent.microsoftCompliance}</h4>
              <ul className="space-y-2">
                {passkeyContent.microsoftItems.map((item, index) => (
                  <li key={index} className="text-xs text-gray-600 dark:text-gray-400">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* GDPR Compliance */}
          <div className="bg-amber-50 dark:bg-amber-950 p-5 rounded-lg border border-amber-200 dark:border-amber-800">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              {passkeyContent.gdprNote}
            </h3>
            <ul className="space-y-2">
              {passkeyContent.gdprItems.map((item, index) => (
                <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Security Note */}
          <div className="bg-purple-50 dark:bg-purple-950 p-5 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-600" />
              {passkeyContent.securityNote}
            </h3>
            <ul className="space-y-2">
              {passkeyContent.securityItems.map((item, index) => (
                <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-4 pt-4 border-t-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent-biometric"
                checked={biometricConsent}
                onCheckedChange={(checked) => setBiometricConsent(checked as boolean)}
                data-testid="checkbox-biometric-consent"
              />
              <label
                htmlFor="consent-biometric"
                className="text-sm font-medium leading-relaxed cursor-pointer select-none"
              >
                {passkeyContent.consent1}
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="consent-data-processing"
                checked={dataProcessingConsent}
                onCheckedChange={(checked) => setDataProcessingConsent(checked as boolean)}
                data-testid="checkbox-data-processing-consent"
              />
              <label
                htmlFor="consent-data-processing"
                className="text-sm font-medium leading-relaxed cursor-pointer select-none"
              >
                {passkeyContent.consent2}
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="consent-privacy-policy"
                checked={privacyPolicyConsent}
                onCheckedChange={(checked) => setPrivacyPolicyConsent(checked as boolean)}
                data-testid="checkbox-privacy-policy-consent"
              />
              <label
                htmlFor="consent-privacy-policy"
                className="text-sm font-medium leading-relaxed cursor-pointer select-none flex flex-wrap items-center gap-1"
              >
                <span>{passkeyContent.consent3}</span>
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {passkeyContent.privacyPolicy}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>{passkeyContent.and}</span>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {passkeyContent.termsOfService}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
            </div>
          </div>

          {!biometricConsent || !dataProcessingConsent || !privacyPolicyConsent ? (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {passkeyContent.mustAgree}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-biometric-consent-cancel"
          >
            {passkeyContent.cancel}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!biometricConsent || !dataProcessingConsent || !privacyPolicyConsent}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
            data-testid="button-biometric-consent-accept"
          >
            <Shield className="w-4 h-4 mr-2" />
            {passkeyContent.accept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
