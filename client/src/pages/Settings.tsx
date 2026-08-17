import { useState, useEffect } from "react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useWhoami } from "@/auth/useWhoami";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/lib/languageStore";
import { getApiUrl } from "@/lib/apiConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PinKeypad } from "@/components/PinKeypad";
import {
  Fingerprint,
  Smartphone,
  Laptop,
  Shield,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  Plus,
  KeyRound,
  Bell,
  Wallet,
  Lock,
} from "lucide-react";
import { registerPasskey, getBiometricMethodName, isPasskeySupported } from "@/auth/passkey";
import { useLocation } from "wouter";
import { logger } from "@/lib/logger";
import { revokeDeviceTrust } from "@/lib/deviceTrust";
import { t } from "@/lib/i18n";
import { PetAvatarDisplay } from "@/components/PetAvatarDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface PasskeyDevice {
  credentialId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string;
  deviceType?: string;
}

// PIN Security Section Component - December 2025
//
// TRUTHFULNESS FIX (auth/identity sweep 2026-08-17). Before this pass the whole
// section lied:
//   - status was fetched from GET /api/pin-auth/status with no `?email=`, which
//     the server answered 400 to. The `if (response.ok)` guard swallowed it, so
//     `pinStatus` stayed null and EVERY user — including users with a PIN — was
//     shown "Not set".
//   - "Remove PIN" sent no body to an endpoint that required `{ email, pin }`.
//     It 400'd, and the handler had no `else`, so the button was a silent no-op.
//   - "Change PIN" re-ran setup instead of calling /change with the current PIN.
// Status is now server-authoritative, every leg reports its real outcome, and a
// failed status read renders "unavailable" instead of a comforting lie.
type PinStatus = {
  hasPin: boolean;
  pinLength: number | null;
  isLocked: boolean;
  lockoutMinutes: number | null;
};

type PinFlow = null | 'setup' | 'change-current' | 'change-new' | 'remove';

function PinSecuritySection({ language, firebaseUser }: { language: string; firebaseUser: any }) {
  const { toast } = useToast();
  const isHebrew = language === 'he';
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<PinFlow>(null);
  const [firstPin, setFirstPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authedFetch = async (path: string, init: RequestInit = {}) => {
    const token = await firebaseUser.getIdToken();
    return fetch(getApiUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        'Authorization': `Bearer ${token}`,
      },
    });
  };

  const showError = (message: string) => {
    toast({
      variant: 'destructive',
      title: isHebrew ? 'שגיאה' : 'Error',
      description: message,
    });
  };

  const genericError = isHebrew ? 'הפעולה נכשלה. נסה שוב.' : 'That did not work. Please try again.';

  // Fetch PIN status — SERVER is the source of truth for whether a PIN exists.
  const refreshStatus = async () => {
    if (!firebaseUser) return;
    try {
      const response = await authedFetch('/api/pin-auth/status');
      if (!response.ok) {
        // Do NOT fall through to "Not set" — that is a security status we did
        // not actually read. Say so.
        setStatusError(true);
        setPinStatus(null);
        return;
      }
      const data = await response.json();
      setStatusError(false);
      setPinStatus({
        hasPin: !!data.hasPin,
        pinLength: data.pinLength ?? null,
        isLocked: !!data.isLocked,
        lockoutMinutes: data.lockoutMinutes ?? null,
      });
    } catch (error) {
      logger.error('Error fetching PIN status:', error);
      setStatusError(true);
      setPinStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  const resetFlow = () => {
    setFlow(null);
    setFirstPin("");
    setCurrentPin("");
    setSetupStep('enter');
  };

  const submitSetup = async (pin: string) => {
    setIsSubmitting(true);
    try {
      const response = await authedFetch('/api/pin-auth/setup', {
        method: 'POST',
        body: JSON.stringify({
          pin,
          deviceId: localStorage.getItem('petwash_device_id') || `web-${Date.now()}`,
          deviceName: navigator.userAgent.substring(0, 50),
          deviceType: 'web',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        showError(data.error || genericError);
        setSetupStep('enter');
        setFirstPin("");
        return;
      }
      resetFlow();
      await refreshStatus();
      toast({
        title: isHebrew ? 'קוד PIN הוגדר בהצלחה' : 'PIN set successfully',
        description: isHebrew ? 'כעת תוכל להיכנס עם קוד PIN' : 'You can now sign in with your PIN',
      });
    } catch (error) {
      logger.error('Error setting PIN:', error);
      showError(genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitChange = async (newPin: string) => {
    setIsSubmitting(true);
    try {
      const response = await authedFetch('/api/pin-auth/change', {
        method: 'POST',
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        showError(data.error || genericError);
        resetFlow();
        return;
      }
      resetFlow();
      await refreshStatus();
      toast({
        title: isHebrew ? 'קוד ה-PIN עודכן' : 'PIN changed',
        description: isHebrew ? 'השתמש בקוד החדש בכניסה הבאה.' : 'Use your new PIN next time you sign in.',
      });
    } catch (error) {
      logger.error('Error changing PIN:', error);
      showError(genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRemove = async (pin: string) => {
    setIsSubmitting(true);
    try {
      const response = await authedFetch('/api/pin-auth/remove', {
        method: 'DELETE',
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        showError(data.error || genericError);
        resetFlow();
        return;
      }
      resetFlow();
      await refreshStatus();
      toast({
        title: isHebrew ? 'קוד PIN הוסר' : 'PIN removed',
        description: isHebrew ? 'קוד ה-PIN שלך הוסר בהצלחה' : 'Your PIN has been removed',
      });
    } catch (error) {
      logger.error('Error removing PIN:', error);
      showError(genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinEntered = (pin: string) => {
    if (flow === 'remove') {
      void submitRemove(pin);
      return;
    }
    if (flow === 'change-current') {
      setCurrentPin(pin);
      setFlow('change-new');
      setSetupStep('enter');
      return;
    }
    // setup + change-new share the enter → confirm pair
    if (setupStep === 'enter') {
      setFirstPin(pin);
      setSetupStep('confirm');
      return;
    }
    if (pin !== firstPin) {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'קודי PIN לא תואמים' : 'PINs do not match',
        description: isHebrew ? 'נסה שוב' : 'Please try again',
      });
      setSetupStep('enter');
      setFirstPin("");
      return;
    }
    if (flow === 'change-new') void submitChange(pin);
    else void submitSetup(pin);
  };

  const keypadTitle = () => {
    if (flow === 'remove') return isHebrew ? 'הזן את קוד ה-PIN הנוכחי כדי להסיר' : 'Enter your current PIN to remove it';
    if (flow === 'change-current') return isHebrew ? 'הזן את קוד ה-PIN הנוכחי' : 'Enter your current PIN';
    if (setupStep === 'enter') return isHebrew ? 'הזן קוד PIN חדש' : 'Enter new PIN';
    return isHebrew ? 'אשר את קוד ה-PIN' : 'Confirm your PIN';
  };

  if (loading) {
    return (
      <div className="luxury-dark-card rounded-2xl p-8 mt-6 luxury-animate-scale-in">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#b0841c]" />
        </div>
      </div>
    );
  }

  return (
    <div className="luxury-dark-card rounded-2xl p-8 mt-6 luxury-animate-scale-in luxury-delay-2">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[rgba(217, 184, 76,0.3)] to-[rgba(217, 184, 76,0.1)]">
            <KeyRound className="h-6 w-6 text-[#b0841c]" />
          </div>
          <div>
            <h2 className="luxury-dark-heading-lg text-lg">
              {isHebrew ? 'קוד PIN' : 'PIN Code'}
            </h2>
            <p className="luxury-dark-text-small mt-1">
              {isHebrew ? 'התחברות מהירה עם קוד PIN בן 4-6 ספרות' : 'Quick sign-in with 4-6 digit PIN'}
            </p>
          </div>
        </div>

        {statusError ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-600" data-testid="badge-pin-unavailable">
            {isHebrew ? 'הסטטוס לא זמין' : 'Status unavailable'}
          </Badge>
        ) : pinStatus?.hasPin ? (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-0" data-testid="badge-pin-enabled">
            {isHebrew ? 'מופעל' : 'Enabled'}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-[#E8E3D9] text-[#8A8078]" data-testid="badge-pin-not-set">
            {isHebrew ? 'לא מופעל' : 'Not set'}
          </Badge>
        )}
      </div>

      {flow ? (
        <div className="luxury-dark-surface p-6 rounded-2xl">
          <h3 className="luxury-dark-heading-sm text-center mb-4 text-[#1A1A1A]">
            {keypadTitle()}
          </h3>
          <p className="luxury-dark-text-small text-center mb-6">
            {isHebrew ? 'קוד בן 4-6 ספרות' : 'A 4-6 digit code'}
          </p>

          <PinKeypad
            onComplete={handlePinEntered}
            onCancel={resetFlow}
            language={language}
            loading={isSubmitting}
          />
        </div>
      ) : statusError ? (
        <div className="space-y-4">
          <p className="luxury-dark-text-body text-amber-700" data-testid="text-pin-status-error">
            {isHebrew
              ? 'לא הצלחנו לקרוא את מצב ה-PIN מהשרת, ולכן איננו מציגים מצב. נסה לרענן.'
              : 'We could not read your PIN status from the server, so we are not showing one. Please retry.'}
          </p>
          <Button
            onClick={() => { setLoading(true); void refreshStatus(); }}
            variant="outline"
            className="border-[#E8E3D9] text-[#1A1A1A] hover:bg-white"
            data-testid="button-retry-pin-status"
          >
            {isHebrew ? 'נסה שוב' : 'Retry'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {pinStatus?.hasPin ? (
            <>
              <p className="luxury-dark-text-body">
                {isHebrew
                  ? 'קוד ה-PIN שלך מוגדר ופעיל. תוכל להשתמש בו להתחברות מהירה.'
                  : 'Your PIN is set and active. You can use it for quick sign-in.'
                }
              </p>
              {pinStatus.isLocked && (
                <p className="luxury-dark-text-body text-red-600" data-testid="text-pin-locked">
                  {isHebrew
                    ? `הקוד נעול זמנית. נסה שוב בעוד ${pinStatus.lockoutMinutes ?? 15} דקות.`
                    : `Temporarily locked. Try again in ${pinStatus.lockoutMinutes ?? 15} minutes.`}
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => { setFlow('change-current'); setSetupStep('enter'); }}
                  variant="outline"
                  className="border-[#E8E3D9] text-[#1A1A1A] hover:bg-white"
                  data-testid="button-change-pin"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {isHebrew ? 'שנה קוד PIN' : 'Change PIN'}
                </Button>
                <Button
                  onClick={() => setFlow('remove')}
                  variant="outline"
                  disabled={isSubmitting}
                  className="text-red-400 hover:bg-red-500/10 border-red-500/30"
                  data-testid="button-remove-pin"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {isHebrew ? 'הסר PIN' : 'Remove PIN'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="luxury-dark-text-body">
                {isHebrew
                  ? 'הגדר קוד PIN להתחברות מהירה ומאובטחת לחשבונך.'
                  : 'Set up a PIN for quick and secure sign-in to your account.'
                }
              </p>
              <button
                onClick={() => { setFlow('setup'); setSetupStep('enter'); }}
                className="luxury-dark-btn-gold px-5 py-3 flex items-center gap-2"
                data-testid="button-setup-pin"
              >
                <Plus className="h-4 w-4" />
                {isHebrew ? 'הגדר קוד PIN' : 'Set up PIN'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Trusted-device ("remember this device") — SERVER-AUTHORITATIVE.
//
// Before this pass the card read localStorage (`getTrustedDeviceInfo`) and
// "Revoke trust" called `revokeDeviceTrust()`, which only deleted that
// localStorage key. The real credential is the HMAC-signed device-trust token
// used by /api/pin-auth/trusted-device-verify — it survived the "revoke" for
// its full 30 days, on every device. The card now asks the server whether the
// token it holds is actually valid, and revoke kills it server-side everywhere.
function TrustedDeviceSection({ language, firebaseUser }: { language: string; firebaseUser: any }) {
  const { toast } = useToast();
  const isHebrew = language === 'he';
  const [state, setState] = useState<{ trusted: boolean; daysRemaining?: number; deviceId?: string | null } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const load = async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(getApiUrl('/api/pin-auth/device-trust/status'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Device-Trust-Token': localStorage.getItem('petwash_device_trust_token') || '',
        },
      });
      if (!response.ok) {
        setUnavailable(true);
        setState(null);
        return;
      }
      const data = await response.json();
      setUnavailable(false);
      setState({ trusted: !!data.trusted, daysRemaining: data.daysRemaining, deviceId: data.deviceId });
      // If the server says this token is dead, stop keeping it around.
      if (!data.trusted) localStorage.removeItem('petwash_device_trust_token');
    } catch (error) {
      logger.error('Error reading device trust status:', error);
      setUnavailable(true);
      setState(null);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(getApiUrl('/api/pin-auth/device-trust/revoke'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: '{}',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        toast({
          variant: 'destructive',
          title: isHebrew ? 'שגיאה' : 'Error',
          description: data.error || (isHebrew ? 'לא הצלחנו לבטל את אמון המכשיר.' : 'We could not revoke device trust.'),
        });
        return;
      }
      // Server killed it everywhere; clear the local copies too.
      localStorage.removeItem('petwash_device_trust_token');
      revokeDeviceTrust();
      await load();
      toast({
        title: isHebrew ? 'אמון המכשיר בוטל' : 'Device trust revoked',
        description: isHebrew
          ? 'כל המכשירים המוכרים הוסרו. בכניסה הבאה תידרש התחברות מלאה.'
          : 'Every remembered device was removed. Full sign-in is required next time.',
      });
    } catch (error) {
      logger.error('Error revoking device trust:', error);
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה' : 'Error',
        description: isHebrew ? 'לא הצלחנו לבטל את אמון המכשיר.' : 'We could not revoke device trust.',
      });
    } finally {
      setRevoking(false);
    }
  };

  if (!state && !unavailable) return null;

  return (
    <div className="luxury-dark-card rounded-2xl p-6 mb-6 border border-emerald-500/20 luxury-animate-fade-in" data-testid="card-trusted-device">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
            <Shield className={`h-6 w-6 ${state?.trusted ? 'text-emerald-400' : 'text-[#8A8078]'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`luxury-dark-heading-sm ${state?.trusted ? 'text-emerald-400' : 'text-[#1A1A1A]'}`}>
              {unavailable
                ? (isHebrew ? 'מצב המכשיר לא זמין' : 'Device status unavailable')
                : state?.trusted
                  ? (isHebrew ? 'המכשיר הזה מוכר' : 'This device is remembered')
                  : (isHebrew ? 'המכשיר הזה אינו מוכר' : 'This device is not remembered')}
            </h3>
            <p className="luxury-dark-text-body mt-2 text-[#6A6460]" data-testid="text-trusted-device-detail">
              {unavailable
                ? (isHebrew
                    ? 'לא הצלחנו לאמת מול השרת, ולכן איננו מציגים מצב.'
                    : 'We could not confirm this with the server, so we are not showing a status.')
                : state?.trusted
                  ? (isHebrew
                      ? `כניסה מהירה עם PIN פעילה במכשיר הזה לעוד ${state.daysRemaining ?? 0} ימים.`
                      : `Quick PIN sign-in is active on this device for ${state.daysRemaining ?? 0} more days.`)
                  : (isHebrew
                      ? 'נדרשת התחברות מלאה במכשיר הזה.'
                      : 'Full sign-in is required on this device.')}
            </p>
          </div>
        </div>
        {state?.trusted && (
          <Button
            onClick={handleRevoke}
            variant="outline"
            size="sm"
            disabled={revoking}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0"
            data-testid="button-revoke-trust"
          >
            {revoking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
            {isHebrew ? 'בטל אמון' : 'Revoke trust'}
          </Button>
        )}
      </div>
    </div>
  );
}

function SettingsControlMap({ language }: { language: string }) {
  const isHebrew = language === 'he';
  const rows = [
    {
      icon: Shield,
      title: isHebrew ? 'אבטחת כניסה' : 'Sign-in security',
      text: isHebrew ? 'Passkey, PIN ומכשירים מוכרים מגנים על החשבון לפני Wallet ותשלומים.' : 'Passkey, PIN and trusted devices protect the account before Wallet and payments.',
    },
    {
      icon: Wallet,
      title: isHebrew ? 'Wallet והטבות' : 'Wallet & benefits',
      text: isHebrew ? 'אישורי Wallet קובעים אם נשלח כרטיס, הטבות, יתרות ותזכורות.' : 'Wallet consent controls pass delivery, benefits, balances and reminders.',
    },
    {
      icon: Bell,
      title: isHebrew ? 'התראות ושיווק' : 'Notifications & marketing',
      text: isHebrew ? 'SMS, אימייל ו-Push חייבים להיות ברורים, מתועדים וניתנים לביטול.' : 'SMS, email and push must be clear, logged and easy to opt out.',
    },
    {
      icon: Lock,
      title: isHebrew ? 'פרטיות ומחיקה' : 'Privacy & deletion',
      text: isHebrew ? 'ייצוא, הקפאה ומחיקה חייבים לשמור תיעוד חוקי בלי למחוק ראיות כספיות.' : 'Export, freeze and delete preserve required records without losing financial evidence.',
    },
  ];

  return (
    <section className="mb-8 rounded-2xl p-5 md:p-6 bg-white border border-[#e7dfcc] shadow-sm">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
        <div>
          <p className="text-[10px] tracking-[0.24em] uppercase font-bold" style={{ color: '#b0841c' }}>
            Settings Control Map
          </p>
          <h2 className="text-xl md:text-2xl font-semibold text-[#111118] tracking-[-0.03em] mt-1">
            {isHebrew ? 'כל הגדרה יודעת מה היא משנה' : 'Every setting knows its downstream effect'}
          </h2>
        </div>
        <p className="text-xs text-[#6A6460] max-w-md leading-relaxed">
          {isHebrew
            ? 'אין כפתורים עיוורים: אבטחה, Wallet, התראות ופרטיות קשורים לתיעוד ולבקרות.'
            : 'No blind buttons: security, Wallet, notifications and privacy connect to evidence and controls.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rows.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-[#ede7d8] bg-[#fffdf8] p-4">
            <Icon className="h-5 w-5 mb-3" style={{ color: '#b0841c' }} />
            <h3 className="text-sm font-bold text-[#111118]">{title}</h3>
            <p className="text-xs text-[#6A6460] leading-relaxed mt-2">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Settings() {
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const { role: serverRole, isLoading: whoamiLoading, whoami } = useWhoami();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Providers manage their settings inside ProviderOS — never the customer settings page
  useEffect(() => {
    if (!whoamiLoading && serverRole === 'provider') {
      navigate('/provider-os');
    }
  }, [whoamiLoading, serverRole, navigate]);

  const [devices, setDevices] = useState<PasskeyDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingDevice, setDeletingDevice] = useState<string | null>(null);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deletionStep, setDeletionStep] = useState<1 | 2>(1);
  const [deletionReason, setDeletionReason] = useState("");
  const [legalConsentChecked, setLegalConsentChecked] = useState(false);
  const [deletionProcessing, setDeletionProcessing] = useState(false);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

  // Fetch user's passkey devices
  useEffect(() => {
    const fetchDevices = async () => {
      if (!firebaseUser) return;

      try {
        setLoadingDevices(true);
        const token = await firebaseUser.getIdToken();
        
        const response = await fetch(getApiUrl('/api/auth/webauthn/devices'), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDevices(data.devices || []);
        } else {
          logger.error('Failed to fetch devices', { status: response.status });
        }
      } catch (error) {
        logger.error('Error fetching devices:', error);
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDevices();
  }, [firebaseUser]);

  // Handle device rename
  const handleRenameDevice = async (credentialId: string) => {
    if (!firebaseUser || !editName.trim()) return;

    try {
      const token = await firebaseUser.getIdToken();
      
      const response = await fetch(getApiUrl(`/api/auth/webauthn/devices/${credentialId}/rename`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          newName: editName.trim(),
        }),
      });

      if (response.ok) {
        setDevices(prev => 
          prev.map(d => 
            d.credentialId === credentialId 
              ? { ...d, deviceName: editName.trim() } 
              : d
          )
        );
        setEditingDevice(null);
        setEditName("");
        
        toast({
          title: t('settings.deviceNameUpdated', language),
          description: t('settings.changesSaved', language),
        });
      } else {
        throw new Error('Failed to rename device');
      }
    } catch (error) {
      logger.error('Error renaming device:', error);
      toast({
        variant: "destructive",
        title: t('settings.error', language),
        description: t('settings.failedUpdateDeviceName', language),
      });
    }
  };

  // Handle device deletion
  const handleDeleteDevice = async (credentialId: string) => {
    if (!firebaseUser) return;

    try {
      const token = await firebaseUser.getIdToken();
      
      const response = await fetch(getApiUrl(`/api/auth/webauthn/devices/${credentialId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setDevices(prev => prev.filter(d => d.credentialId !== credentialId));
        setDeletingDevice(null);
        
        toast({
          title: t('settings.deviceRemoved', language),
          description: t('settings.deviceRemovedSuccess', language),
        });
      } else {
        throw new Error('Failed to delete device');
      }
    } catch (error) {
      logger.error('Error deleting device:', error);
      toast({
        variant: "destructive",
        title: t('settings.error', language),
        description: t('settings.failedRemoveDevice', language),
      });
    }
  };

  // Handle adding a new passkey
  const handleAddPasskey = async () => {
    if (!firebaseUser) return;

    try {
      setAddingPasskey(true);
      const token = await firebaseUser.getIdToken();
      const deviceName = `${getBiometricMethodName()} - ${format(new Date(), 'MMM dd, yyyy')}`;
      
      const result = await registerPasskey(token, deviceName);

      if (result.success) {
        toast({
          title: t('settings.passkeyAddedSuccess', language),
        });

        // Refresh devices list
        const response = await fetch(getApiUrl('/api/auth/webauthn/devices'), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDevices(data.devices || []);
        }
      } else {
        toast({
          variant: "destructive",
          title: t('settings.error', language),
          description: result.error || t('settings.failedAddPasskey', language),
        });
      }
    } catch (error) {
      logger.error('Error adding passkey:', error);
    } finally {
      setAddingPasskey(false);
    }
  };

  // Sign out of every device. POST /api/auth/signout clears the server session
  // cookie AND calls revokeRefreshTokens(uid), so this really is global — the
  // security tab previously offered no way to reach it.
  const handleSignOutEverywhere = async () => {
    setSigningOutEverywhere(true);
    try {
      const response = await fetch(getApiUrl('/api/auth/signout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('signout failed');

      // Drop every local sign-in shortcut so this device cannot silently resume.
      localStorage.removeItem('petwash_device_trust_token');
      revokeDeviceTrust();

      const { auth } = await import('@/lib/firebase');
      await auth?.signOut().catch(() => {});

      toast({
        title: language === 'he' ? 'התנתקת מכל המכשירים' : 'Signed out everywhere',
        description: language === 'he'
          ? 'כל ההתחברויות הפעילות בוטלו.'
          : 'All active sessions were revoked.',
      });
      navigate('/signin');
    } catch (error) {
      logger.error('Error signing out everywhere:', error);
      toast({
        variant: 'destructive',
        title: t('settings.error', language),
        description: language === 'he'
          ? 'לא הצלחנו להתנתק מכל המכשירים. נסה שוב.'
          : 'We could not sign you out everywhere. Please try again.',
      });
    } finally {
      setSigningOutEverywhere(false);
    }
  };

  // Handle account deletion with GDPR compliance
  const handleDeleteAccount = async () => {
    if (!firebaseUser || !legalConsentChecked) return;

    setDeletionProcessing(true);
    try {
      const deletionResponse = await fetch(getApiUrl('/api/account-deletion/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reason: deletionReason || 'User requested account deletion',
          consentCheckbox: true,
          language: language === 'he' ? 'he' : 'en',
        }),
      });

      const deletionResult = await deletionResponse.json();

      if (!deletionResponse.ok) {
        throw new Error(deletionResult.error || 'Failed to submit deletion request');
      }

      logger.info('[Account Deletion] Legal record created:', deletionResult.requestId);

      const token = await firebaseUser.getIdToken();
      const response = await fetch(getApiUrl('/api/user/delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          deletionRequestId: deletionResult.requestId,
        }),
      });

      if (response.ok) {
        toast({
          title: t('settings.accountDeleted', language),
          description: language === 'he'
            ? `בקשת המחיקה נרשמה (${deletionResult.requestId}). החשבון יימחק לצמיתות תוך 90 יום.`
            : `Deletion request logged (${deletionResult.requestId}). Account will be permanently deleted within 90 days.`,
        });

        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete account');
      }
    } catch (error: any) {
      logger.error('Error deleting account:', error);
      toast({
        variant: "destructive",
        title: t('settings.error', language),
        description: error.message || t('settings.failedDeleteAccount', language),
      });
    } finally {
      setDeletionProcessing(false);
      setDeletingAccount(false);
      setDeletionStep(1);
      setConfirmEmail("");
      setConfirmText("");
      setDeletionReason("");
      setLegalConsentChecked(false);
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType?.includes('mobile') || deviceType?.includes('phone')) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Laptop className="h-5 w-5" />;
  };

  if (authLoading) {
    return (
      <div className="luxury-dark-mesh min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#b0841c]" />
      </div>
    );
  }

  if (!firebaseUser) {
    navigate('/signin');
    return null;
  }

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      <div className="luxury-dark-mesh min-h-screen">
        <div className="pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 luxury-animate-fade-in">
            <div className="flex items-center gap-6 mb-6">
              <div className="relative p-1 rounded-full bg-gradient-to-br from-[#735511] via-[#b0841c] to-[#d7c18a] luxury-animate-scale-in">
                <div className="bg-[#F0EBE0] rounded-full p-1">
                  <PetAvatarDisplay 
                    size="lg" 
                    showName={true}
                    animated={true}
                  />
                </div>
              </div>
              <div className="flex-1 luxury-animate-slide-up luxury-delay-1">
                <h1 className="luxury-dark-heading-xl text-2xl sm:text-3xl">
                  {t('settings.title', language)}
                </h1>
                <p className="mt-2 luxury-dark-text-body">
                  {t('settings.subtitle', language)}
                </p>
              </div>
            </div>
          </div>

          <SettingsControlMap language={language} />

          <Tabs defaultValue="security" className="w-full luxury-animate-slide-up luxury-delay-2">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-white border border-[#E8E3D9] rounded-xl">
              <TabsTrigger value="account" data-testid="tab-account" className="text-[#6A6460] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#735511] data-[state=active]:to-[#b0841c] data-[state=active]:text-white rounded-lg">
                {t('settings.account', language)}
              </TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security" className="text-[#6A6460] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#735511] data-[state=active]:to-[#b0841c] data-[state=active]:text-white rounded-lg">
                <Shield className="h-4 w-4 mr-2" />
                {t('settings.security', language)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <div className="luxury-dark-card rounded-2xl p-8 mb-6 luxury-animate-scale-in">
                <h2 className="luxury-dark-heading-lg text-lg mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-[rgba(217, 184, 76,0.3)] to-[rgba(217, 184, 76,0.1)]">
                    <Shield className="h-5 w-5 text-[#b0841c]" />
                  </div>
                  {t('settings.accountDetails', language)}
                </h2>
                <div className="space-y-6">
                  <div className="luxury-animate-fade-in luxury-delay-1">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="luxury-dark-text-small text-xs uppercase tracking-wider font-semibold">{t('settings.email', language)}</Label>
                      {whoami?.emailVerified ? (
                        <Badge
                          data-testid="badge-email-verified"
                          aria-label={language === 'he' ? 'אימייל מאומת' : 'Email verified'}
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {language === 'he' ? 'מאומת' : 'Verified'}
                        </Badge>
                      ) : (
                        <Badge
                          data-testid="badge-email-unverified"
                          aria-label={language === 'he' ? 'אימייל לא מאומת' : 'Email not verified'}
                          className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {language === 'he' ? 'לא מאומת' : 'Not verified'}
                        </Badge>
                      )}
                    </div>
                    <Input value={firebaseUser?.email || ''} disabled className="h-12 bg-white border-[#E8E3D9] text-[#1A1A1A]" />
                  </div>
                  <div className="luxury-animate-fade-in luxury-delay-2">
                    <Label className="luxury-dark-text-small text-xs uppercase tracking-wider font-semibold">{t('settings.name', language)}</Label>
                    <Input value={firebaseUser?.displayName || ''} disabled className="mt-2 h-12 bg-white border-[#E8E3D9] text-[#1A1A1A]" />
                  </div>
                  {whoami?.phone && (
                    <div className="luxury-animate-fade-in luxury-delay-2" data-testid="row-phone-verification">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="luxury-dark-text-small text-xs uppercase tracking-wider font-semibold">
                          {language === 'he' ? 'טלפון' : 'Phone'}
                        </Label>
                        {whoami?.phoneVerified ? (
                          <Badge
                            data-testid="badge-phone-verified"
                            aria-label={language === 'he' ? 'טלפון מאומת' : 'Phone verified'}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {language === 'he' ? 'מאומת' : 'Verified'}
                          </Badge>
                        ) : (
                          <Badge
                            data-testid="badge-phone-unverified"
                            aria-label={language === 'he' ? 'טלפון לא מאומת' : 'Phone not verified'}
                            className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {language === 'he' ? 'לא מאומת' : 'Not verified'}
                          </Badge>
                        )}
                      </div>
                      <Input value={whoami.phone} disabled className="h-12 bg-white border-[#E8E3D9] text-[#1A1A1A]" />
                    </div>
                  )}
                </div>
              </div>

              {/* DANGER ZONE - Account Deletion */}
              <div className="luxury-dark-card rounded-2xl p-8 border border-red-500/20 luxury-animate-scale-in luxury-delay-3">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10">
                    <AlertCircle className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h2 className="luxury-dark-heading-lg text-lg text-red-400 mb-2">
                      {t('settings.dangerZone', language)}
                    </h2>
                    <p className="luxury-dark-text-body text-sm text-red-600/70">
                      {t('settings.irreversibleActions', language)}
                    </p>
                  </div>
                </div>

                <div className="luxury-dark-surface rounded-xl p-6 border border-red-500/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="luxury-dark-heading-sm text-[#1A1A1A] mb-3 flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-red-500/15">
                          <Trash2 className="h-5 w-5 text-red-400" />
                        </div>
                        {t('settings.deleteAccount', language)}
                      </h3>
                      <p className="luxury-dark-text-body mb-4">
                        {t('settings.deleteDescPermanent', language)}
                      </p>
                      <ul className="luxury-dark-text-small space-y-2 pl-6 list-disc text-[#8A8078]">
                        <li>{t('settings.deleteWarning1', language)}</li>
                        <li>{t('settings.deleteWarning2', language)}</li>
                        <li>{t('settings.deleteWarning3', language)}</li>
                        <li>{t('settings.deleteWarning4', language)}</li>
                        <li>{t('settings.deleteWarning5', language)}</li>
                      </ul>
                    </div>
                    <Button
                      onClick={() => setDeletingAccount(true)}
                      variant="destructive"
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-[#1A1A1A]"
                      data-testid="button-delete-account"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('settings.deleteAccountButton', language)}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security">
              {/* Trusted device — server-verified, not localStorage */}
              <TrustedDeviceSection language={language} firebaseUser={firebaseUser} />

              <div className="luxury-dark-card rounded-2xl p-8 luxury-animate-scale-in luxury-delay-1">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-[rgba(217, 184, 76,0.3)] to-[rgba(217, 184, 76,0.1)]">
                      <Fingerprint className="h-6 w-6 text-[#b0841c]" />
                    </div>
                    <div>
                      <h2 className="luxury-dark-heading-lg text-lg">
                        {t('settings.passkeysDevices', language)}
                      </h2>
                      <p className="luxury-dark-text-small mt-1">
                        {t('settings.managePasskeyDevices', language)}
                      </p>
                    </div>
                  </div>
                  
                  {isPasskeySupported() && (
                    <button
                      onClick={handleAddPasskey}
                      disabled={addingPasskey}
                      className="luxury-dark-btn-gold px-4 py-2.5 flex items-center gap-2"
                      data-testid="button-add-passkey"
                    >
                      {addingPasskey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {t('settings.addPasskey', language)}
                    </button>
                  )}
                </div>

                {loadingDevices ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#b0841c]" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-16 luxury-dark-surface rounded-2xl luxury-animate-fade-in">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[rgba(217, 184, 76,0.2)] to-[rgba(217, 184, 76,0.05)] w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                      <Fingerprint className="h-10 w-10 text-[#b0841c]" />
                    </div>
                    <h3 className="luxury-dark-heading-sm mb-3">
                      {t('settings.noDevices', language)}
                    </h3>
                    <p className="luxury-dark-text-body mb-8">
                      {t('settings.addPasskeyQuick', language)}
                    </p>
                    {isPasskeySupported() && (
                      <button
                        onClick={handleAddPasskey}
                        disabled={addingPasskey}
                        className="luxury-dark-btn-gold px-5 py-3 flex items-center gap-2 mx-auto"
                        data-testid="button-add-first-passkey"
                      >
                        {addingPasskey ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('settings.adding', language)}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            {t('settings.addFirstPasskey', language)}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {devices.map((device, index) => (
                      <div
                        key={device.credentialId}
                          className={`luxury-dark-surface p-6 rounded-xl border border-[#E8E3D9] hover:border-[#b0841c]/30 transition-all luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
                        data-testid={`device-${device.credentialId}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-[rgba(176,132,28,0.2)] to-[rgba(176,132,28,0.08)] text-[#b0841c]">
                              {getDeviceIcon(device.deviceType)}
                            </div>
                            
                            <div className="flex-1">
                              {editingDevice === device.credentialId ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="max-w-xs h-10 bg-white border-[#E8E3D9] text-[#1A1A1A]"
                                    autoFocus
                                    data-testid="input-device-name"
                                  />
                                  <button
                                    onClick={() => handleRenameDevice(device.credentialId)}
                                    className="luxury-dark-btn-gold p-2"
                                    data-testid="button-save-device-name"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingDevice(null);
                                      setEditName("");
                                    }}
                                    className="text-[#8A8078] hover:text-[#1A1A1A]"
                                    data-testid="button-cancel-edit"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="luxury-dark-heading-sm text-[#1A1A1A]">
                                      {device.deviceName}
                                    </h3>
                                    <span className="luxury-dark-badge-gold text-[10px]">
                                      {t('settings.passkey', language)}
                                    </span>
                                  </div>
                                  <p className="luxury-dark-text-small text-xs">
                                    {t('settings.created', language)}{' '}
                                    {format(new Date(device.createdAt), 'MMM dd, yyyy')}
                                    {device.lastUsedAt && (
                                      <>
                                        {' • '}
                                        {t('settings.lastUsed', language)}{' '}
                                        {format(new Date(device.lastUsedAt), 'MMM dd, yyyy')}
                                      </>
                                    )}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                          {editingDevice !== device.credentialId && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingDevice(device.credentialId);
                                  setEditName(device.deviceName);
                                }}
                                className="text-[#8A8078] hover:text-[#1A1A1A] hover:bg-white"
                                data-testid="button-edit-device"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingDevice(device.credentialId)}
                                className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                                data-testid="button-delete-device"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isPasskeySupported() && (
                  <div className="mt-6 luxury-dark-surface p-6 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/15">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="luxury-dark-text-body text-amber-600/80">
                        {t('settings.browserNoPasskey', language)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* PIN Authentication Section - December 2025 */}
              <PinSecuritySection language={language} firebaseUser={firebaseUser} />

              {/* Sessions — global revocation was previously unreachable from Settings */}
              <div className="luxury-dark-card rounded-2xl p-8 mt-6 luxury-animate-scale-in luxury-delay-3" data-testid="card-sessions">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[rgba(217, 184, 76,0.3)] to-[rgba(217, 184, 76,0.1)]">
                    <Lock className="h-6 w-6 text-[#b0841c]" />
                  </div>
                  <div>
                    <h2 className="luxury-dark-heading-lg text-lg">
                      {language === 'he' ? 'התחברויות פעילות' : 'Active sessions'}
                    </h2>
                    <p className="luxury-dark-text-small mt-1">
                      {language === 'he'
                        ? 'ניתוק מכל המכשירים מבטל כל התחברות פעילה, בכל דפדפן ואפליקציה.'
                        : 'Signing out everywhere revokes every active session, in every browser and app.'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSignOutEverywhere}
                  disabled={signingOutEverywhere}
                  variant="outline"
                  className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                  data-testid="button-signout-everywhere"
                >
                  {signingOutEverywhere ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  {language === 'he' ? 'התנתק מכל המכשירים' : 'Sign out of all devices'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Device Confirmation Dialog */}
      <AlertDialog open={!!deletingDevice} onOpenChange={() => setDeletingDevice(null)}>
        <AlertDialogContent className="!bg-white !border-[#E8E3D9] rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-red-500/15">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <AlertDialogTitle className="luxury-dark-heading-lg text-[#1A1A1A]">
                {t('settings.removeDevice', language)}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="luxury-dark-text-body ml-14">
              {t('settings.removeDeviceDesc', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border border-[#E8E3D9] text-[#1A1A1A] hover:bg-white" data-testid="button-cancel-delete">
              {t('settings.cancel', language)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDevice && handleDeleteDevice(deletingDevice)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-[#1A1A1A]"
              data-testid="button-confirm-delete"
            >
              {t('settings.remove', language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MULTI-STEP Account Deletion Warning Dialog */}
      <AlertDialog open={deletingAccount} onOpenChange={(open) => {
        if (!open) {
          setDeletingAccount(false);
          setDeletionStep(1);
          setConfirmEmail("");
          setConfirmText("");
          setDeletionReason("");
          setLegalConsentChecked(false);
        }
      }}>
        <AlertDialogContent className="max-w-2xl !bg-white !border-red-500/20 rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-4 rounded-xl bg-red-500/15">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <AlertDialogTitle className="luxury-dark-heading-lg text-red-400">
                {deletionStep === 1 
                  ? t('settings.deleteWarning', language)
                  : t('settings.finalConfirmation', language)}
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          {deletionStep === 1 ? (
            <>
              <AlertDialogDescription className="space-y-4">
                <div className="luxury-dark-surface rounded-xl p-6 border border-red-500/20">
                  <p className="luxury-dark-heading-sm text-red-400 mb-2">
                    {t('settings.deleteAccountWarning', language)}
                  </p>
                  <p className="luxury-dark-text-body text-red-600/70">
                    {t('settings.followingDeleted', language)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {['personalDetails', 'washHistory', 'loyaltyVip', 'kycFiles', 'petPhotos', 'activeBenefits'].map((key, i) => (
                    <div key={key} className={`flex items-start gap-2 luxury-animate-fade-in luxury-delay-${i + 1}`}>
                      <div className="p-1 rounded-lg bg-red-500/15">
                        <X className="h-4 w-4 text-red-400" />
                      </div>
                      <span className="luxury-dark-text-small text-[#6A6460]">{t(`settings.${key}`, language)}</span>
                    </div>
                  ))}
                </div>

                <div className="luxury-dark-surface rounded-xl p-6 border border-amber-500/20">
                  <p className="luxury-dark-heading-sm text-amber-400 mb-3">
                    {t('settings.deletionTimeline', language)}
                  </p>
                  <ul className="luxury-dark-text-small text-amber-300/60 space-y-2">
                    <li>• {t('settings.immediateRevocation', language)}</li>
                    <li>• {t('settings.dataDeletion30Days', language)}</li>
                    <li>• {t('settings.noRecovery', language)}</li>
                  </ul>
                </div>

                <div className="pt-4">
                  <Label htmlFor="confirm-email" className="luxury-dark-heading-sm text-[#1A1A1A]">
                    {t('settings.confirmEmailContinue', language)}
                  </Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={firebaseUser?.email || ''}
                    className="mt-3 h-12 bg-white border-red-500/30 focus:border-red-500/50 text-[#1A1A1A] placeholder:text-[#AAAAAA]"
                    data-testid="input-confirm-email"
                  />
                  <p className="luxury-dark-text-small mt-2 text-[#AAAAAA]">
                    {t('settings.typeEmail', language)} {firebaseUser?.email}
                  </p>
                </div>
              </AlertDialogDescription>

              <AlertDialogFooter className="flex-col sm:flex-row gap-3">
                <AlertDialogCancel 
                  onClick={() => {
                    setDeletingAccount(false);
                    setDeletionStep(1);
                    setConfirmEmail("");
                  }}
                  className="bg-transparent border border-[#E8E3D9] text-[#1A1A1A] hover:bg-white"
                  data-testid="button-cancel-account-delete-step1"
                >
                  {t('settings.cancelKeepAccount', language)}
                </AlertDialogCancel>
                <button
                  onClick={() => setDeletionStep(2)}
                  disabled={confirmEmail !== firebaseUser?.email}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 text-[#1A1A1A] font-medium"
                  data-testid="button-proceed-step2"
                >
                  {t('settings.proceedDelete', language)}
                </button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogDescription className="space-y-6">
                <div className="luxury-dark-surface rounded-xl p-8 border border-red-500/30 text-center">
                  <p className="luxury-dark-heading-lg text-red-400 mb-4">
                    {t('settings.lastChance', language)}
                  </p>
                  <p className="luxury-dark-text-body text-red-600 font-semibold">
                    {t('settings.finalWarning', language)}
                  </p>
                </div>

                <div className="pt-2">
                  <Label htmlFor="deletion-reason" className="luxury-dark-heading-sm text-[#1A1A1A] mb-2 block">
                    {language === 'he' ? 'סיבת המחיקה (אופציונלי)' : 'Reason for deletion (optional)'}
                  </Label>
                  <Input
                    id="deletion-reason"
                    type="text"
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    placeholder={language === 'he' ? 'ספר/י לנו למה...' : 'Tell us why...'}
                      className="h-12 bg-white border-[#E8E3D9] focus:border-[#b0841c] text-[#1A1A1A] placeholder:text-[#AAAAAA]"
                    data-testid="input-deletion-reason"
                  />
                </div>

                <div className="pt-2">
                  <Label htmlFor="confirm-text" className="luxury-dark-heading-sm text-red-400">
                    {t('settings.typeTextExactly', language)}
                  </Label>
                  <p className="luxury-dark-heading-lg text-center my-4 p-4 luxury-dark-surface rounded-xl border border-[#E8E3D9] text-[#1A1A1A]">
                    DELETE MY ACCOUNT
                  </p>
                  <Input
                    id="confirm-text"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="mt-3 h-12 bg-white border-red-500/30 focus:border-red-500/50 text-[#1A1A1A] text-center font-semibold placeholder:text-[#AAAAAA]"
                    data-testid="input-confirm-delete-text"
                  />
                </div>

                <div className="luxury-dark-surface rounded-xl p-5 border border-amber-500/20">
                  <label className="flex items-start gap-3 cursor-pointer" data-testid="label-legal-consent">
                    <input
                      type="checkbox"
                      checked={legalConsentChecked}
                      onChange={(e) => setLegalConsentChecked(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-amber-500/40 accent-red-500"
                      data-testid="checkbox-legal-consent"
                    />
                    <span className="luxury-dark-text-small text-amber-800 leading-relaxed">
                      {language === 'he'
                        ? 'אני מאשר/ת בזאת כי אני מבקש/ת למחוק את חשבוני לצמיתות. אני מבין/ה שפעולה זו אינה ניתנת לביטול ושכל הנתונים האישיים שלי יימחקו בהתאם לחוק הגנת הפרטיות הישראלי 2025. PetWash™ תשמור רישומים חוקיים של בקשה זו למשך 90 יום.'
                        : 'I hereby confirm that I am requesting permanent deletion of my account. I understand this action is irreversible and all my personal data will be deleted in accordance with the Israeli Privacy Protection Law 2025. PetWash™ will retain legal records of this request for 90 days.'}
                    </span>
                  </label>
                </div>
              </AlertDialogDescription>

              <AlertDialogFooter className="flex-col sm:flex-row gap-3">
                <AlertDialogCancel 
                  onClick={() => {
                    setDeletionStep(1);
                    setConfirmText("");
                    setLegalConsentChecked(false);
                    setDeletionReason("");
                  }}
                  className="bg-transparent border border-[#E8E3D9] text-[#1A1A1A] hover:bg-white"
                  data-testid="button-back-step1"
                >
                  {t('settings.goBack', language)}
                </AlertDialogCancel>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== 'DELETE MY ACCOUNT' || !legalConsentChecked || deletionProcessing}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 disabled:opacity-50 text-[#1A1A1A] font-bold flex items-center gap-2"
                  data-testid="button-confirm-final-delete"
                >
                  {deletionProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deletionProcessing
                    ? (language === 'he' ? 'מעבד...' : 'Processing...')
                    : t('settings.deletePermanently', language)}
                </button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </Layout>
  );
}
