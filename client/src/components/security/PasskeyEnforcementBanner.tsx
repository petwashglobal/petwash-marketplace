import { AlertCircle, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

interface PasskeyEnforcementBannerProps {
  required: boolean;
  hasPasskey: boolean;
  onCreate: () => void;
  language?: 'en' | 'he';
}

export function PasskeyEnforcementBanner({
  required,
  hasPasskey,
  onCreate,
  language = 'en',
}: PasskeyEnforcementBannerProps) {
  if (hasPasskey) {
    return null;
  }

  const isRTL = language === 'he';

  return (
    <Alert
      className={`mb-6 ${
        required
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
          : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
      }`}
      data-testid="passkey-enforcement-banner"
    >
      <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {required ? (
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
        ) : (
          <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        )}
        <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
          <AlertTitle
            className={`mb-1 font-semibold ${
              required ? 'text-red-900 dark:text-red-100' : 'text-yellow-900 dark:text-yellow-100'
            }`}
            data-testid="banner-title"
          >
            {t('security.noPasskeyWarning', language)}
            {required && (
              <span
                className="ml-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white"
                data-testid="required-badge"
              >
                {t('security.passkeyRequired', language)}
              </span>
            )}
          </AlertTitle>
          <AlertDescription
            className={`mb-3 ${
              required ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'
            }`}
            data-testid="banner-description"
          >
            {required
              ? t('security.passkeyEnforcementDesc', language)
              : t('security.noPasskeyWarningDesc', language)}
          </AlertDescription>
          <Button
            onClick={onCreate}
            size="sm"
            className={`${
              required
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
                : 'bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800'
            } text-white`}
            data-testid="create-passkey-button"
          >
            <Shield className="mr-2 h-4 w-4" />
            {t('security.createPasskey', language)}
          </Button>
        </div>
      </div>
    </Alert>
  );
}
