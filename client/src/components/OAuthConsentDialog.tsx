import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, Eye, Mail, User, MapPin } from "lucide-react";
import { type Language, t } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface OAuthConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  provider: string;
  userEmail?: string;
  language: Language;
}

export function OAuthConsentDialog({ 
  isOpen, 
  onClose, 
  onAccept, 
  provider, 
  userEmail,
  language 
}: OAuthConsentDialogProps) {
  
  const providerNames: Record<string, string> = {
    google: "Gmail",
    yahoo: "Yahoo",
    microsoft: "Microsoft",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok"
  };

  const scopesGranted = [
    {
      icon: User,
      title: t('oauth.scopeProfileTitle', language),
      description: t('oauth.scopeProfileDesc', language)
    },
    {
      icon: Mail,
      title: t('oauth.scopeEmailTitle', language),
      description: t('oauth.scopeEmailDesc', language)
    },
    {
      icon: Eye,
      title: t('oauth.scopeAccessTitle', language),
      description: t('oauth.scopeAccessDesc', language)
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden" dir={language === "he" || language === "ar" ? "rtl" : "ltr"}>
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/brand/petwash-logo-official.png" 
              alt="Pet Wash™" 
              className="h-12"
            />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-white text-2xl font-bold">
              {t('oauth.oneMoment', language)}
            </DialogTitle>
            <DialogDescription className="text-center text-blue-100 text-base mt-2">
              {providerNames[provider] || provider} {t('oauth.signInRequest', language)}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* User info if available */}
          {userEmail && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                {userEmail[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userEmail}</p>
                <p className="text-xs text-gray-500">{providerNames[provider] || provider} Account</p>
              </div>
            </div>
          )}

          {/* Consent message */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              {t('oauth.accessTo', language)}
            </h3>
            <div className="space-y-3">
              {scopesGranted.map((scope, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{scope.title}</p>
                    <p className="text-xs text-gray-600">{scope.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Privacy notice */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Shield className="w-4 h-4" />
              <span>
                {t('oauth.dataSecured', language)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {t('oauth.byContinuing', language)}
              <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                {t('oauth.privacyPolicy', language)}
              </a>
              {" "}
              {t('oauth.and', language)}
              {" "}
              <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                {t('oauth.termsOfService', language)}
              </a>
              .
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-gray-50 flex-row gap-3 sm:justify-between">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            data-testid="button-deny-consent"
          >
            {t('oauth.cancel', language)}
          </Button>
          <Button
            onClick={onAccept}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            data-testid="button-accept-consent"
          >
            {t('oauth.allowContinue', language)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
