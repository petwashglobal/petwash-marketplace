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
import { Shield, FileText, Info, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { getApiUrl } from '@/lib/apiConfig';

interface WalletConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  passType: 'vip' | 'business' | 'voucher';
  platform: 'apple' | 'google';
}

export function WalletConsentDialog({ 
  isOpen, 
  onClose, 
  onAccept, 
  passType,
  platform 
}: WalletConsentDialogProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [consentChecked, setConsentChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  const handleAccept = async () => {
    if (!consentChecked || !privacyChecked) return;
    
    // Log consent to backend
    try {
      await fetch(getApiUrl('/api/consent/wallet'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          passType,
          platform,
          timestamp: new Date().toISOString(),
          consented: true
        })
      });
    } catch (error) {
      console.error('Failed to log wallet consent:', error);
    }

    onAccept();
    handleClose();
  };

  const handleClose = () => {
    setConsentChecked(false);
    setPrivacyChecked(false);
    onClose();
  };

  const platformName = platform === 'apple' ? 'Apple Wallet' : 'Google Wallet';

  const content = {
    en: {
      title: `Add to ${platformName}`,
      description: `Before adding your ${passType === 'vip' ? 'VIP loyalty card' : passType === 'business' ? 'digital business card' : 'e-voucher'} to ${platformName}, please review and accept the following:`,
      dataTitle: 'Data Stored in Your Wallet Pass',
      dataItems: {
        vip: [
          'Your name and VIP membership tier',
          'Loyalty points balance and discount percentage',
          'Member since date',
          'QR code for station authentication',
          'Pass expiration and update timestamps'
        ],
        business: [
          'Your name and title',
          'Company name (⁦Pet Wash™⁩)',
          'Contact email',
          'QR code with contact information',
          'Company logo and branding'
        ],
        voucher: [
          'Voucher value and code',
          'Redemption status',
          'Expiration date',
          'Terms and conditions',
          'QR code for redemption'
        ]
      },
      platformNote: platform === 'apple' 
        ? '🍎 This pass will be stored securely in your Apple Wallet. Apple may process this data according to their privacy policy.'
        : '🤖 This pass will be stored in your Google Wallet. Google may process this data according to their privacy policy.',
      consent1: 'I consent to ⁦Pet Wash™⁩ generating and storing the above data in my digital wallet pass',
      consent2: 'I have read and agree to the',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      and: 'and',
      securityNote: '🔒 Your data is encrypted with 256-bit AES encryption and protected by cryptographic signatures.',
      gdprNote: '✅ You can delete this pass at any time from your wallet. Your data rights are protected under GDPR and Israeli Privacy Law.',
      cancel: 'Cancel',
      accept: 'Accept & Download',
      mustAgree: 'You must accept both terms to continue'
    },
    he: {
      title: `הוספה ל-${platformName}`,
      description: `לפני הוספת ${passType === 'vip' ? 'כרטיס הנאמנות VIP' : passType === 'business' ? 'כרטיס הביקור הדיגיטלי' : 'השובר האלקטרוני'} שלך ל-${platformName}, אנא עיין ואשר את הדברים הבאים:`,
      dataTitle: 'נתונים המאוחסנים בכרטיס הארנק שלך',
      dataItems: {
        vip: [
          'שמך ורמת החברות VIP שלך',
          'יתרת נקודות הנאמנות ואחוז ההנחה',
          'תאריך הצטרפות כחבר',
          'קוד QR לאימות בתחנות',
          'תאריכי תפוגה ועדכון של הכרטיס'
        ],
        business: [
          'שמך ותפקידך',
          'שם החברה (⁦Pet Wash™⁩)',
          'אימייל ליצירת קשר',
          'קוד QR עם פרטי התקשרות',
          'לוגו ומיתוג החברה'
        ],
        voucher: [
          'ערך השובר והקוד',
          'סטטוס המימוש',
          'תאריך תפוגה',
          'תנאים והגבלות',
          'קוד QR למימוש'
        ]
      },
      platformNote: platform === 'apple'
        ? '🍎 כרטיס זה יאוחסן בצורה מאובטחת ב-Apple Wallet שלך. Apple עשויה לעבד נתונים אלה בהתאם למדיניות הפרטיות שלהם.'
        : '🤖 כרטיס זה יאוחסן ב-Google Wallet שלך. Google עשויה לעבד נתונים אלה בהתאם למדיניות הפרטיות שלהם.',
      consent1: 'אני מסכים ל-⁦Pet Wash™⁩ ליצור ולאחסן את הנתונים לעיל בכרטיס הארנק הדיגיטלי שלי',
      consent2: 'קראתי ואני מסכים ל',
      privacyPolicy: 'מדיניות הפרטיות',
      termsOfService: 'תנאי השימוש',
      and: 'ו',
      securityNote: '🔒 הנתונים שלך מוצפנים בהצפנת AES 256-bit ומוגנים בחתימות קריפטוגרפיות.',
      gdprNote: '✅ ניתן למחוק כרטיס זה בכל עת מהארנק שלך. זכויות הנתונים שלך מוגנות תחת GDPR וחוק הגנת הפרטיות הישראלי.',
      cancel: 'ביטול',
      accept: 'אישור והורדה',
      mustAgree: 'עליך לאשר את שני התנאים כדי להמשיך'
    }
  };

  const t = content[isHebrew ? 'he' : 'en'];
  const dataItems = t.dataItems[passType];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isHebrew ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Shield className="w-6 h-6 text-blue-600" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-4">
            {t.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Data Items */}
          <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              {t.dataTitle}
            </h3>
            <ul className="space-y-2">
              {dataItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform Note */}
          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm">{t.platformNote}</p>
          </div>

          {/* Security & GDPR Notes */}
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>{t.securityNote}</p>
            <p>{t.gdprNote}</p>
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent-data"
                checked={consentChecked}
                onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                data-testid="checkbox-wallet-consent-data"
              />
              <label
                htmlFor="consent-data"
                className="text-sm font-medium leading-relaxed cursor-pointer select-none"
              >
                {t.consent1}
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="consent-privacy"
                checked={privacyChecked}
                onCheckedChange={(checked) => setPrivacyChecked(checked as boolean)}
                data-testid="checkbox-wallet-consent-privacy"
              />
              <label
                htmlFor="consent-privacy"
                className="text-sm font-medium leading-relaxed cursor-pointer select-none flex flex-wrap items-center gap-1"
              >
                <span>{t.consent2}</span>
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.privacyPolicy}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>{t.and}</span>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.termsOfService}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
            </div>
          </div>

          {!consentChecked || !privacyChecked ? (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              {t.mustAgree}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-wallet-consent-cancel"
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!consentChecked || !privacyChecked}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            data-testid="button-wallet-consent-accept"
          >
            <FileText className="w-4 h-4 mr-2" />
            {t.accept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
