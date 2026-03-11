import { useState, useEffect } from "react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
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
} from "lucide-react";
import { registerPasskey, getBiometricMethodName, isPasskeySupported } from "@/auth/passkey";
import { useLocation } from "wouter";
import { logger } from "@/lib/logger";
import { getTrustedDeviceInfo, revokeDeviceTrust, getTrustDaysRemaining } from "@/lib/deviceTrust";
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
function PinSecuritySection({ language, firebaseUser }: { language: string; firebaseUser: any }) {
  const { toast } = useToast();
  const [pinStatus, setPinStatus] = useState<{ hasPin: boolean; deviceName?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showChange, setShowChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch PIN status
  useEffect(() => {
    const fetchPinStatus = async () => {
      if (!firebaseUser) return;
      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch(getApiUrl('/api/pin-auth/status'), {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setPinStatus(data);
        }
      } catch (error) {
        logger.error('Error fetching PIN status:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPinStatus();
  }, [firebaseUser]);

  // Handle PIN setup
  const handleSetupPin = async () => {
    if (!firebaseUser || newPin.length < 4) return;
    
    setIsSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(getApiUrl('/api/pin-auth/setup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin: newPin,
          deviceId: `web-${Date.now()}`,
          deviceName: navigator.userAgent.substring(0, 50),
        }),
      });

      if (response.ok) {
        setPinStatus({ hasPin: true });
        setShowSetup(false);
        setNewPin("");
        setConfirmPin("");
        setSetupStep('enter');
        toast({
          title: language === 'he' ? 'קוד PIN הוגדר בהצלחה' : 'PIN set successfully',
          description: language === 'he' ? 'כעת תוכל להיכנס עם קוד PIN' : 'You can now sign in with your PIN',
        });
      } else {
        const data = await response.json();
        toast({
          variant: "destructive",
          title: language === 'he' ? 'שגיאה' : 'Error',
          description: data.error || 'Failed to set PIN',
        });
      }
    } catch (error) {
      logger.error('Error setting PIN:', error);
      toast({
        variant: "destructive",
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: language === 'he' ? 'לא ניתן להגדיר קוד PIN' : 'Failed to set PIN',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle PIN removal
  const handleRemovePin = async () => {
    if (!firebaseUser) return;
    
    setIsSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(getApiUrl('/api/pin-auth/remove'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setPinStatus({ hasPin: false });
        toast({
          title: language === 'he' ? 'קוד PIN הוסר' : 'PIN removed',
          description: language === 'he' ? 'קוד ה-PIN שלך הוסר בהצלחה' : 'Your PIN has been removed',
        });
      }
    } catch (error) {
      logger.error('Error removing PIN:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinEntered = (pin: string) => {
    if (setupStep === 'enter') {
      setNewPin(pin);
      setSetupStep('confirm');
    } else {
      setConfirmPin(pin);
      if (pin === newPin) {
        handleSetupPin();
      } else {
        toast({
          variant: "destructive",
          title: language === 'he' ? 'קודי PIN לא תואמים' : 'PINs do not match',
          description: language === 'he' ? 'נסה שוב' : 'Please try again',
        });
        setSetupStep('enter');
        setNewPin("");
        setConfirmPin("");
      }
    }
  };

  if (loading) {
    return (
      <div className="luxury-dark-card rounded-2xl p-8 mt-6 luxury-animate-scale-in">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#C9A96E]" />
        </div>
      </div>
    );
  }

  return (
    <div className="luxury-dark-card rounded-2xl p-8 mt-6 luxury-animate-scale-in luxury-delay-2">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[rgba(201,169,110,0.3)] to-[rgba(201,169,110,0.1)]">
            <KeyRound className="h-6 w-6 text-[#C9A96E]" />
          </div>
          <div>
            <h2 className="luxury-dark-heading-lg text-lg">
              {language === 'he' ? 'קוד PIN' : 'PIN Code'}
            </h2>
            <p className="luxury-dark-text-small mt-1">
              {language === 'he' ? 'התחברות מהירה עם קוד PIN בן 4-6 ספרות' : 'Quick sign-in with 4-6 digit PIN'}
            </p>
          </div>
        </div>
        
        {pinStatus?.hasPin ? (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-0">
            {language === 'he' ? 'מופעל' : 'Enabled'}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-[#E8E3D9] text-[#8A8078]">
            {language === 'he' ? 'לא מופעל' : 'Not set'}
          </Badge>
        )}
      </div>

      {showSetup ? (
        <div className="luxury-dark-surface p-6 rounded-2xl">
          <h3 className="luxury-dark-heading-sm text-center mb-4 text-[#1A1A1A]">
            {setupStep === 'enter' 
              ? (language === 'he' ? 'הזן קוד PIN חדש' : 'Enter new PIN')
              : (language === 'he' ? 'אשר את קוד ה-PIN' : 'Confirm your PIN')
            }
          </h3>
          <p className="luxury-dark-text-small text-center mb-6">
            {language === 'he' ? 'בחר קוד בן 4-6 ספרות' : 'Choose a 4-6 digit code'}
          </p>
          
          <PinKeypad 
            onComplete={handlePinEntered}
            onCancel={() => {
              setShowSetup(false);
              setNewPin("");
              setConfirmPin("");
              setSetupStep('enter');
            }}
            language={language}
            loading={isSubmitting}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {pinStatus?.hasPin ? (
            <>
              <p className="luxury-dark-text-body">
                {language === 'he' 
                  ? 'קוד ה-PIN שלך מוגדר ופעיל. תוכל להשתמש בו להתחברות מהירה.'
                  : 'Your PIN is set and active. You can use it for quick sign-in.'
                }
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowSetup(true)}
                  variant="outline"
                  className="border-[#E8E3D9] text-[#1A1A1A] hover:bg-[#F7F4EE]"
                  data-testid="button-change-pin"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {language === 'he' ? 'שנה קוד PIN' : 'Change PIN'}
                </Button>
                <Button
                  onClick={handleRemovePin}
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
                  {language === 'he' ? 'הסר PIN' : 'Remove PIN'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="luxury-dark-text-body">
                {language === 'he' 
                  ? 'הגדר קוד PIN להתחברות מהירה ומאובטחת לחשבונך.'
                  : 'Set up a PIN for quick and secure sign-in to your account.'
                }
              </p>
              <button
                onClick={() => setShowSetup(true)}
                className="luxury-dark-btn-gold px-5 py-3 flex items-center gap-2"
                data-testid="button-setup-pin"
              >
                <Plus className="h-4 w-4" />
                {language === 'he' ? 'הגדר קוד PIN' : 'Set up PIN'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

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
  const [trustedDevice, setTrustedDevice] = useState(getTrustedDeviceInfo());

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

  // Handle revoking device trust
  const handleRevokeTrust = () => {
    revokeDeviceTrust();
    setTrustedDevice(null);
    toast({
      title: t('settings.trustRevoked', language),
      description: t('settings.signInNextVisit', language),
    });
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
        <Loader2 className="h-8 w-8 animate-spin text-[#C9A96E]" />
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
              <div className="relative p-1 rounded-full bg-gradient-to-br from-[#C9A96E] via-[#d4af37] to-[#C9A96E] luxury-animate-scale-in">
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

          <Tabs defaultValue="security" className="w-full luxury-animate-slide-up luxury-delay-2">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-[#F7F4EE] border border-[#E8E3D9] rounded-xl">
              <TabsTrigger value="account" data-testid="tab-account" className="text-[#6A6460] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#C9A96E] data-[state=active]:to-[#d4af37] data-[state=active]:text-white rounded-lg">
                {t('settings.account', language)}
              </TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security" className="text-[#6A6460] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#C9A96E] data-[state=active]:to-[#d4af37] data-[state=active]:text-white rounded-lg">
                <Shield className="h-4 w-4 mr-2" />
                {t('settings.security', language)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <div className="luxury-dark-card rounded-2xl p-8 mb-6 luxury-animate-scale-in">
                <h2 className="luxury-dark-heading-lg text-lg mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-[rgba(201,169,110,0.3)] to-[rgba(201,169,110,0.1)]">
                    <Shield className="h-5 w-5 text-[#C9A96E]" />
                  </div>
                  {t('settings.accountDetails', language)}
                </h2>
                <div className="space-y-6">
                  <div className="luxury-animate-fade-in luxury-delay-1">
                    <Label className="luxury-dark-text-small text-xs uppercase tracking-wider font-semibold">{t('settings.email', language)}</Label>
                    <Input value={firebaseUser?.email || ''} disabled className="mt-2 h-12 bg-[#F7F4EE] border-[#E8E3D9] text-[#1A1A1A]" />
                  </div>
                  <div className="luxury-animate-fade-in luxury-delay-2">
                    <Label className="luxury-dark-text-small text-xs uppercase tracking-wider font-semibold">{t('settings.name', language)}</Label>
                    <Input value={firebaseUser?.displayName || ''} disabled className="mt-2 h-12 bg-[#F7F4EE] border-[#E8E3D9] text-[#1A1A1A]" />
                  </div>
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
                    <p className="luxury-dark-text-body text-sm text-red-300/60">
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
              {/* Trusted Device Status - Inline Quick View */}
              {trustedDevice && (
                <div className="luxury-dark-card rounded-2xl p-6 mb-6 border border-emerald-500/20 luxury-animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
                        <Shield className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="luxury-dark-heading-sm text-emerald-400">
                          {t('settings.trustedDeviceActive', language)}
                        </h3>
                        <p className="luxury-dark-text-body text-emerald-300/60 mt-2">
                          {t('settings.trustedDeviceDescFull', language).replace('{days}', getTrustDaysRemaining().toString())}
                        </p>
                        <div className="mt-3 space-y-2 luxury-dark-text-small text-emerald-400/60">
                          <div className="flex items-center gap-2">
                            <Laptop className="h-4 w-4" />
                            <span>{trustedDevice.deviceInfo.browser} on {trustedDevice.deviceInfo.os}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4" />
                            <span>{trustedDevice.deviceInfo.screenResolution}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleRevokeTrust}
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      data-testid="button-revoke-trust"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('settings.revokeTrust', language)}
                    </Button>
                  </div>
                </div>
              )}

              <div className="luxury-dark-card rounded-2xl p-8 luxury-animate-scale-in luxury-delay-1">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-[rgba(201,169,110,0.3)] to-[rgba(201,169,110,0.1)]">
                      <Fingerprint className="h-6 w-6 text-[#C9A96E]" />
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
                    <Loader2 className="h-8 w-8 animate-spin text-[#C9A96E]" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-16 luxury-dark-surface rounded-2xl luxury-animate-fade-in">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[rgba(201,169,110,0.2)] to-[rgba(201,169,110,0.05)] w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                      <Fingerprint className="h-10 w-10 text-[#C9A96E]" />
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
                        className={`luxury-dark-surface p-6 rounded-xl border border-[#E8E3D9] hover:border-[#D4AF37]/30 transition-all luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
                        data-testid={`device-${device.credentialId}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-[rgba(201,169,110,0.2)] to-[rgba(201,169,110,0.08)] text-[#C9A96E]">
                              {getDeviceIcon(device.deviceType)}
                            </div>
                            
                            <div className="flex-1">
                              {editingDevice === device.credentialId ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="max-w-xs h-10 bg-[#F7F4EE] border-[#E8E3D9] text-[#1A1A1A]"
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
                                className="text-[#8A8078] hover:text-[#1A1A1A] hover:bg-[#F7F4EE]"
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
                      <p className="luxury-dark-text-body text-amber-300/70">
                        {t('settings.browserNoPasskey', language)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* PIN Authentication Section - December 2025 */}
              <PinSecuritySection language={language} firebaseUser={firebaseUser} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Device Confirmation Dialog */}
      <AlertDialog open={!!deletingDevice} onOpenChange={() => setDeletingDevice(null)}>
        <AlertDialogContent className="!bg-[#12121a] !border-[#E8E3D9] rounded-2xl">
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
            <AlertDialogCancel className="bg-transparent border border-[#E8E3D9] text-[#1A1A1A] hover:bg-[#F7F4EE]" data-testid="button-cancel-delete">
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
        <AlertDialogContent className="max-w-2xl !bg-[#12121a] !border-red-500/20 rounded-2xl">
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
                  <p className="luxury-dark-text-body text-red-300/60">
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
                    className="mt-3 h-12 bg-[#F7F4EE] border-red-500/30 focus:border-red-500/50 text-[#1A1A1A] placeholder:text-[#AAAAAA]"
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
                  className="bg-transparent border border-[#E8E3D9] text-[#1A1A1A] hover:bg-[#F7F4EE]"
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
                  <p className="luxury-dark-text-body text-red-300/70 font-semibold">
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
                    className="h-12 bg-[#F7F4EE] border-[#E8E3D9] focus:border-[#D4AF37] text-[#1A1A1A] placeholder:text-[#AAAAAA]"
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
                    className="mt-3 h-12 bg-[#F7F4EE] border-red-500/30 focus:border-red-500/50 text-[#1A1A1A] text-center font-semibold placeholder:text-[#AAAAAA]"
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
                    <span className="luxury-dark-text-small text-amber-200/80 leading-relaxed">
                      {language === 'he'
                        ? 'אני מאשר/ת בזאת כי אני מבקש/ת למחוק את חשבוני לצמיתות. אני מבין/ה שפעולה זו אינה ניתנת לביטול ושכל הנתונים האישיים שלי יימחקו בהתאם לחוק הגנת הפרטיות הישראלי 2025. Pet Wash™ תשמור רישומים חוקיים של בקשה זו למשך 90 יום.'
                        : 'I hereby confirm that I am requesting permanent deletion of my account. I understand this action is irreversible and all my personal data will be deleted in accordance with the Israeli Privacy Protection Law 2025. Pet Wash™ will retain legal records of this request for 90 days.'}
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
                  className="bg-transparent border border-[#E8E3D9] text-[#1A1A1A] hover:bg-[#F7F4EE]"
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
