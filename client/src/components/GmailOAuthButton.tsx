import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { FaGoogle } from 'react-icons/fa';
import { Mail, Loader2, CheckCircle2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { type Language, t } from '@/lib/i18n';

interface GmailOAuthButtonProps {
  language: Language;
  onSuccess?: (accessToken: string, user: any) => void;
  onError?: (error: Error) => void;
}

/**
 * LUXURY 2025: Premium Gmail OAuth Button
 * Shows beautiful Google permission screen asking for Gmail access
 * Perfect for iPhone - displays native Google consent UI
 */
export function GmailOAuthButton({ language, onSuccess, onError }: GmailOAuthButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleGmailOAuth = async () => {
    try {
      setLoading(true);
      logger.info('[Gmail OAuth] Starting Gmail authentication flow');

      // Create Google Auth Provider with Gmail-specific scopes
      const provider = new GoogleAuthProvider();
      
      // 🎯 REQUEST GMAIL PERMISSIONS - This triggers the beautiful consent screen!
      provider.addScope('https://www.googleapis.com/auth/gmail.readonly'); // Read emails
      provider.addScope('https://www.googleapis.com/auth/gmail.send'); // Send emails
      provider.addScope('https://www.googleapis.com/auth/gmail.compose'); // Compose emails
      provider.addScope('https://www.googleapis.com/auth/gmail.modify'); // Modify emails (labels, etc.)
      provider.addScope('https://www.googleapis.com/auth/userinfo.email'); // User email
      provider.addScope('https://www.googleapis.com/auth/userinfo.profile'); // User profile
      
      // Optional: Force account selection even if user is already signed in
      provider.setCustomParameters({
        prompt: 'consent', // Always show consent screen (the beautiful permission UI!)
        access_type: 'offline', // Get refresh token for long-term access
      });

      logger.info('[Gmail OAuth] Showing Google consent screen with Gmail permissions');

      // This will show the beautiful Google permission screen on iPhone! 🎉
      const result = await signInWithPopup(auth, provider);

      // Get the OAuth access token from Google
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      
      if (!accessToken) {
        throw new Error('Failed to get Gmail access token');
      }

      logger.info('[Gmail OAuth] Successfully obtained Gmail access token');

      const additionalInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalInfo?.isNewUser;

      // SECURITY: Get Firebase ID token for authentication
      const idToken = await result.user.getIdToken();
      
      // Save the Gmail access token to backend with authentication
      const response = await fetch('/api/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          accessToken,
          email: result.user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save Gmail connection');
      }

      logger.info('[Gmail OAuth] Gmail connection saved successfully');
      
      setConnected(true);

      // Show success message
      toast({
        title: t('gmail.connectedSuccess', language),
        description: t('gmail.canAccessNow', language),
        duration: 5000,
      });

      // Call success callback
      if (onSuccess) {
        onSuccess(accessToken, result.user);
      }

    } catch (error: any) {
      logger.error('[Gmail OAuth] Failed:', error);

      // Handle specific error cases
      let errorMessage = t('gmail.failedConnect', language);

      if (error.code === 'auth/popup-blocked') {
        errorMessage = t('gmail.popupBlocked', language);
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = t('gmail.connectionCancelled', language);
      }

      toast({
        variant: 'destructive',
        title: t('gmail.connectionError', language),
        description: errorMessage,
      });

      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* LUXURY 2025: Premium Gmail OAuth Button */}
      <Button
        onClick={handleGmailOAuth}
        disabled={loading || connected}
        className="
          group relative w-full h-14 overflow-hidden
          bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800
          hover:from-blue-700 hover:via-blue-800 hover:to-blue-900
          dark:from-blue-500 dark:via-blue-600 dark:to-blue-700
          border-2 border-blue-400/30 dark:border-blue-300/30
          shadow-xl shadow-blue-900/20 dark:shadow-blue-500/30
          transition-all duration-500 ease-out
          hover:shadow-2xl hover:shadow-blue-600/40
          hover:scale-[1.02]
          disabled:opacity-60 disabled:hover:scale-100
        "
        data-testid="button-gmail-oauth"
      >
        {/* Premium Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 rounded-lg blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
        
        {/* Button Content */}
        <div className="relative flex items-center justify-center gap-3 px-6">
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-semibold tracking-wide text-white">
                {t('gmail.connecting', language)}
              </span>
            </>
          ) : connected ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-300 animate-in zoom-in duration-300" />
              <span className="font-semibold tracking-wide text-white">
                {t('gmail.connected', language)}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <FaGoogle className="w-5 h-5 text-white" />
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold tracking-wide text-white">
                {t('gmail.signIn', language)}
              </span>
            </>
          )}
        </div>
      </Button>

      {/* LUXURY 2025: Premium Info Card */}
      <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-blue-200/60 dark:border-blue-700/40 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1.5 tracking-wide">
              {t('gmail.whatCanDo', language)}
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400">•</span>
                <span>{t('gmail.readEmails', language)}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400">•</span>
                <span>{t('gmail.sendEmails', language)}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400">•</span>
                <span>{t('gmail.organizeEmails', language)}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 dark:text-blue-400">•</span>
                <span>{t('gmail.continuousAccess', language)}</span>
              </li>
            </ul>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 font-medium tracking-wide">
              {t('gmail.neverDeleteModify', language)}
            </p>
          </div>
        </div>
      </div>

      {/* LUXURY 2025: Premium Security Badge */}
      {connected && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-green-600 dark:text-green-400 animate-in fade-in duration-500">
          <Shield className="w-4 h-4" />
          <span className="font-medium tracking-wide">
            {t('gmail.securedOAuth', language)}
          </span>
        </div>
      )}
    </div>
  );
}
