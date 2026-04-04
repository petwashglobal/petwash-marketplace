/**
 * ⁦Pet Wash™⁩ - Luxury Welcome & Consent Page
 * 
 * Premium onboarding experience for new user registration
 * Features Gmail API integration, corporate guidelines, and luxury design
 */

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/apiConfig';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { type Language, t } from '@/lib/i18n';
import { GmailOAuthButton } from '@/components/GmailOAuthButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Shield, 
  Mail, 
  CheckCircle2, 
  Building2,
  Users,
  Globe,
  Heart,
  PawPrint,
  Star,
  ArrowRight,
  ArrowLeft,
  Info
} from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';

interface WelcomeConsentProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function WelcomeConsent({ language, onLanguageChange }: WelcomeConsentProps) {
  const [, setLocation] = useLocation();
  const [consents, setConsents] = useState({
    termsOfService: false,
    privacyPolicy: false,
    corporateGuidelines: false,
    emailCommunication: true,
    gmailIntegration: false,
  });
  const [showCorporateGuidelines, setShowCorporateGuidelines] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);

  const allRequiredConsentsGiven = 
    consents.termsOfService && 
    consents.privacyPolicy && 
    consents.corporateGuidelines;

  const handleGmailSuccess = () => {
    setIsGmailConnected(true);
    setConsents(prev => ({ ...prev, gmailIntegration: true }));
  };

  const handleContinue = async () => {
    const consentPayload = {
      ...consents,
      timestamp: new Date().toISOString(),
      source: 'onboarding',
    };

    localStorage.setItem('petwash_consent_given', JSON.stringify(consentPayload));

    try {
      await fetch(getApiUrl('/api/consent/onboarding'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(consentPayload),
      });
    } catch (err) {
      // Continue even if backend save fails - localStorage is primary
    }

    setLocation('/dashboard');
  };

  return (
    <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
      <div className="min-h-screen luxury-bg-mesh">
        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center luxury-shadow-xl">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="luxury-heading-xl mb-4">
            {t('welcomeConsent.title', language)}
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {t('welcomeConsent.hero.subtitle', language)}
          </p>

          {/* Platform Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              <PawPrint className="w-4 h-4 mr-2" />
              ⁦K9000™⁩ Wash
            </Badge>
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              <Users className="w-4 h-4 mr-2" />
              ⁦Sitter Suite™⁩
            </Badge>
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              ⁦Walk My Pet™⁩
            </Badge>
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              ⁦PetTrek™⁩
            </Badge>
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              <Star className="w-4 h-4 mr-2" />
              Academy™
            </Badge>
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              Plush Lab™
            </Badge>
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              <Globe className="w-4 h-4 mr-2" />
              Club™
            </Badge>
            <Badge variant="outline" className="px-4 py-2 bg-white/80 dark:bg-white/80 backdrop-blur-sm border-2">
              Main Wash
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Gmail Integration */}
          <div className="luxury-glass-card luxury-shadow-xl p-8 relative overflow-hidden">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-lg blur-2xl opacity-10" />
            <div className="relative mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
                  <FaGoogle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="luxury-heading-md">
                    {t('welcomeConsent.buttons.connectGmail', language)}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {t('welcomeConsent.gmail.secureIntegration', language)}
                  </p>
                </div>
              </div>
            </div>
            <div className="relative space-y-6">
              <GmailOAuthButton
                language={language}
                onSuccess={handleGmailSuccess}
              />

              {isGmailConnected && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-2 border-green-200/60 dark:border-green-700/40 animate-in fade-in duration-500">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-100">
                        {t('welcomeConsent.gmail.connected', language)}
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {t('welcomeConsent.gmail.personalizedUpdates', language)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  {t('welcomeConsent.integration.benefits', language)}
                </h4>
                <ul className="space-y-2 text-sm">
                  {[
                    t('welcomeConsent.integration.notifications', language),
                    t('welcomeConsent.integration.status', language),
                    t('welcomeConsent.integration.invoices', language),
                    t('welcomeConsent.integration.alerts', language),
                  ].map((benefit, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Consent & Guidelines */}
          <div className="luxury-glass-card luxury-shadow-xl p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="luxury-heading-md">
                    {t('welcomeConsent.section.consent', language)}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {t('welcomeConsent.consent.confirmFollowing', language)}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              {/* Terms of Service */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                <Checkbox
                  id="terms"
                  checked={consents.termsOfService}
                  onCheckedChange={(checked) =>
                    setConsents(prev => ({ ...prev, termsOfService: checked as boolean }))
                  }
                  data-testid="checkbox-terms"
                />
                <div className="flex-1">
                  <label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                    {t('welcomeConsent.consent.termsAgreement', language)}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('welcomeConsent.consent.termsDescription', language)}
                  </p>
                </div>
              </div>

              {/* Privacy Policy */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                <Checkbox
                  id="privacy"
                  checked={consents.privacyPolicy}
                  onCheckedChange={(checked) =>
                    setConsents(prev => ({ ...prev, privacyPolicy: checked as boolean }))
                  }
                  data-testid="checkbox-privacy"
                />
                <div className="flex-1">
                  <label htmlFor="privacy" className="text-sm font-medium cursor-pointer">
                    {t('welcomeConsent.consent.privacyAgreement', language)}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('welcomeConsent.consent.privacyDescription', language)}
                  </p>
                </div>
              </div>

              {/* Corporate Guidelines */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-900/20 border-2">
                <Checkbox
                  id="guidelines"
                  checked={consents.corporateGuidelines}
                  onCheckedChange={(checked) =>
                    setConsents(prev => ({ ...prev, corporateGuidelines: checked as boolean }))
                  }
                  data-testid="checkbox-guidelines"
                />
                <div className="flex-1">
                  <label htmlFor="guidelines" className="text-sm font-medium cursor-pointer">
                    {t('welcomeConsent.consent.guidelinesAgreement', language)}
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    {t('welcomeConsent.consent.guidelinesDescription', language)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCorporateGuidelines(!showCorporateGuidelines)}
                    className="text-xs"
                    data-testid="button-view-guidelines"
                  >
                    <Info className="w-3 h-3 mr-1" />
                    {showCorporateGuidelines
                      ? t('welcomeConsent.buttons.close', language)
                      : t('welcomeConsent.buttons.readGuidelines', language)}
                  </Button>
                </div>
              </div>

              {/* Email Communication (Optional) */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30">
                <Checkbox
                  id="email"
                  checked={consents.emailCommunication}
                  onCheckedChange={(checked) =>
                    setConsents(prev => ({ ...prev, emailCommunication: checked as boolean }))
                  }
                  data-testid="checkbox-email"
                />
                <div className="flex-1">
                  <label htmlFor="email" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('welcomeConsent.consent.emailUpdates', language)}
                    <Badge variant="secondary" className="text-xs">
                      {t('welcomeConsent.status.optional', language)}
                    </Badge>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('welcomeConsent.consent.emailDisable', language)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Continue Button */}
              <Button
                onClick={handleContinue}
                disabled={!allRequiredConsentsGiven}
                className="luxury-btn-primary luxury-shadow-xl w-full h-14 text-lg font-medium"
                data-testid="button-continue"
              >
                {allRequiredConsentsGiven ? (
                  <>
                    {t('welcomeConsent.buttons.continue', language)}
                    {language === 'he'
                      ? <ArrowLeft className="w-5 h-5 ms-2" />
                      : <ArrowRight className="w-5 h-5 ms-2" />}
                  </>
                ) : (
                  <>
                    {t('welcomeConsent.buttons.confirmRequired', language)}
                  </>
                )}
              </Button>

              {!allRequiredConsentsGiven && (
                <p className="text-xs text-center text-muted-foreground">
                  * {t('welcomeConsent.requiredFields', language)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Corporate Guidelines Expandable Section */}
        {showCorporateGuidelines && (
          <div className="mt-8 luxury-glass-card luxury-shadow-xl p-8">
            <div className="mb-6">
              <h2 className="luxury-heading-md flex items-center gap-3 mb-2">
                <Globe className="w-6 h-6 text-purple-600" />
                {t('welcomeConsent.guidelines.title', language)}
              </h2>
              <p className="text-gray-600">
                {t('welcomeConsent.guidelines.description', language)}
              </p>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
              {/* Quick link to full documentation */}
              <div className="not-prose p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-700">
                <p className="text-sm mb-2">
                  {t('welcomeConsent.guidelines.fullDocAvailable', language)}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/docs/GLOBAL_CORPORATE_GUIDELINES.md" target="_blank">
                    <Building2 className="w-4 h-4 mr-2" />
                    {t('welcomeConsent.buttons.viewFullGuidelines', language)}
                  </a>
                </Button>
              </div>

              {/* Summary */}
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <Heart className="w-5 h-5 text-red-500" />
                  {t('welcomeConsent.mission.title', language)}
                </h3>
                <p>
                  {t('welcomeConsent.mission.description', language)}
                </p>
              </div>

              {/* Key Principles */}
              <div>
                <h3 className="text-xl font-bold">
                  {t('welcomeConsent.principles.title', language)}
                </h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>{t('welcomeConsent.principles.singleCompany', language)}</li>
                  <li>{t('welcomeConsent.principles.platforms', language)}</li>
                  <li>{t('welcomeConsent.principles.vat', language)}</li>
                  <li>{t('welcomeConsent.principles.escrow', language)}</li>
                  <li>{t('welcomeConsent.principles.payment', language)}</li>
                  <li>{t('welcomeConsent.principles.biometric', language)}</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </Layout>
  );
}
