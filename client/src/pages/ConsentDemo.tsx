import { useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { type Language, t } from '@/lib/i18n';
import { PremiumGoogleOAuthConsent } from '@/components/PremiumGoogleOAuthConsent';
import { iOSPermissionsGuide } from '@/components/iOSPermissionsGuide';
import { Shield, Smartphone, Mail } from 'lucide-react';

interface ConsentDemoProps {
  language: Language;
}

export default function ConsentDemo({ language }: ConsentDemoProps) {
  const [showGoogleConsent, setShowGoogleConsent] = useState(false);
  const [showiOSPermissions, setShowiOSPermissions] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Header language={language} />
      
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('consent.title', language)}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t('consent.subtitle', language)}
          </p>
        </div>

        {/* Demo Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Google OAuth Consent */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border-2 border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('consent.googleOAuth', language)}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('consent.gmailContacts', language)}
                </p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              {t('consent.googleDesc', language)}
            </p>

            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t('consent.readSendEmail', language)}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t('consent.manageContacts', language)}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t('consent.createCalendar', language)}</span>
              </li>
            </ul>

            <Button
              onClick={() => setShowGoogleConsent(true)}
              className="w-full h-12 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold"
              data-testid="button-show-google-consent"
            >
              {t('consent.viewDemo', language)}
            </Button>
          </div>

          {/* iOS Permissions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border-2 border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('consent.iosPermissions', language)}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('consent.locationCamera', language)}
                </p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              {t('consent.iosDesc', language)}
            </p>

            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t('consent.locationAndCamera', language)}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t('consent.faceIDNotifications', language)}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{t('consent.localNetwork', language)}</span>
              </li>
            </ul>

            <Button
              onClick={() => setShowiOSPermissions(true)}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold"
              data-testid="button-show-ios-permissions"
            >
              {t('consent.viewDemo', language)}
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-2xl p-8 border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('consent.keyFeatures', language)}
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎨</span>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {t('consent.professionalDesign', language)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('consent.designDesc', language)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {t('consent.gdprCompliant', language)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('consent.gdprDesc', language)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {t('consent.multilingualSupport', language)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('consent.multilingualDesc', language)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {t('consent.mobileFirst', language)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('consent.mobileDesc', language)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer language={language} />

      {/* Consent Modals */}
      {showGoogleConsent && (
        <PremiumGoogleOAuthConsent
          language={language}
          userEmail="demo@petwash.co.il"
          onContinue={async () => {
            setShowGoogleConsent(false);
            alert(t('consent.demoAlert', language));
          }}
          onCancel={() => setShowGoogleConsent(false)}
        />
      )}

      {showiOSPermissions && (
        <iOSPermissionsGuide
          language={language}
          onClose={() => setShowiOSPermissions(false)}
        />
      )}
    </div>
  );
}
