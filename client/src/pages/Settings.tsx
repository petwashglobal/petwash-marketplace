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
      <div className="luxury-glass-card luxury-shadow-lg p-8 mt-6 luxury-animate-scale-in">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#000000] dark:text-[#FFFFFF]" />
        </div>
      </div>
    );
  }

  return (
    <div className="luxury-glass-card luxury-shadow-lg p-8 mt-6 luxury-animate-scale-in luxury-delay-2">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-gradient-to-br from-[#000000] to-[#333333] shadow-lg">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="luxury-heading-md">
              {language === 'he' ? 'קוד PIN' : 'PIN Code'}
            </h2>
            <p className="luxury-text-small mt-1">
              {language === 'he' ? 'התחברות מהירה עם קוד PIN בן 4-6 ספרות' : 'Quick sign-in with 4-6 digit PIN'}
            </p>
          </div>
        </div>
        
        {pinStatus?.hasPin ? (
          <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            {language === 'he' ? 'מופעל' : 'Enabled'}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-gray-300 text-gray-500">
            {language === 'he' ? 'לא מופעל' : 'Not set'}
          </Badge>
        )}
      </div>

      {showSetup ? (
        <div className="luxury-glass-minimal p-6 rounded-2xl">
          <h3 className="luxury-heading-sm text-center mb-4">
            {setupStep === 'enter' 
              ? (language === 'he' ? 'הזן קוד PIN חדש' : 'Enter new PIN')
              : (language === 'he' ? 'אשר את קוד ה-PIN' : 'Confirm your PIN')
            }
          </h3>
          <p className="luxury-text-small text-center mb-6 text-gray-600">
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
              <p className="luxury-text-body text-gray-600">
                {language === 'he' 
                  ? 'קוד ה-PIN שלך מוגדר ופעיל. תוכל להשתמש בו להתחברות מהירה.'
                  : 'Your PIN is set and active. You can use it for quick sign-in.'
                }
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowSetup(true)}
                  variant="outline"
                  className="luxury-glass-minimal"
                  data-testid="button-change-pin"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {language === 'he' ? 'שנה קוד PIN' : 'Change PIN'}
                </Button>
                <Button
                  onClick={handleRemovePin}
                  variant="outline"
                  disabled={isSubmitting}
                  className="text-red-600 hover:bg-red-50 border-red-300"
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
              <p className="luxury-text-body text-gray-600">
                {language === 'he' 
                  ? 'הגדר קוד PIN להתחברות מהירה ומאובטחת לחשבונך.'
                  : 'Set up a PIN for quick and secure sign-in to your account.'
                }
              </p>
              <Button
                onClick={() => setShowSetup(true)}
                className="luxury-btn-primary bg-gradient-to-r from-[#000000] to-[#333333] hover:from-[#333333] hover:to-[#555555]"
                data-testid="button-setup-pin"
              >
                <Plus className="h-4 w-4 mr-2" />
                {language === 'he' ? 'הגדר קוד PIN' : 'Set up PIN'}
              </Button>
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
      
      const response = await fetch(`/api/auth/webauthn/devices/${credentialId}/rename`, {
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
      
      const response = await fetch(`/api/auth/webauthn/devices/${credentialId}`, {
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
    if (!firebaseUser) return;

    try {
      const token = await firebaseUser.getIdToken();
      
      const response = await fetch(getApiUrl('/api/user/delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: firebaseUser.uid,
        }),
      });

      if (response.ok) {
        toast({
          title: t('settings.accountDeleted', language),
          description: t('settings.accountDeletedDesc', language),
        });

        // Sign out and redirect
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
      setDeletingAccount(false);
      setDeletionStep(1);
      setConfirmEmail("");
      setConfirmText("");
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!firebaseUser) {
    navigate('/signin');
    return null;
  }

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      <div className="min-h-screen luxury-bg-mesh">
        <div className="pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 luxury-animate-fade-in">
            <div className="flex items-center gap-6 mb-6">
              {/* Pet Avatar Display with Gradient Border */}
              <div className="relative p-1 rounded-full bg-gradient-to-br from-[#667eea] via-[#764ba2] to-[#667eea] luxury-animate-scale-in">
                <div className="bg-white rounded-full p-1">
                  <PetAvatarDisplay 
                    size="lg" 
                    showName={true}
                    animated={true}
                  />
                </div>
              </div>
              <div className="flex-1 luxury-animate-slide-up luxury-delay-1">
                <h1 className="luxury-heading-lg">
                  {t('settings.title', language)}
                </h1>
                <p className="mt-2 luxury-text-body">
                  {t('settings.subtitle', language)}
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="security" className="w-full luxury-animate-slide-up luxury-delay-2">
            <TabsList className="grid w-full grid-cols-2 mb-8 luxury-glass-minimal border-none">
              <TabsTrigger value="account" data-testid="tab-account" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white">
                {t('settings.account', language)}
              </TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667eea] data-[state=active]:to-[#764ba2] data-[state=active]:text-white">
                <Shield className="h-4 w-4 mr-2" />
                {t('settings.security', language)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <div className="luxury-glass-card luxury-shadow-lg p-8 mb-6 luxury-animate-scale-in">
                <h2 className="luxury-heading-md mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  {t('settings.accountDetails', language)}
                </h2>
                <div className="space-y-6">
                  <div className="luxury-animate-fade-in luxury-delay-1">
                    <Label className="luxury-text-small font-semibold">{t('settings.email', language)}</Label>
                    <Input value={firebaseUser?.email || ''} disabled className="luxury-glass-minimal border-none mt-2" />
                  </div>
                  <div className="luxury-animate-fade-in luxury-delay-2">
                    <Label className="luxury-text-small font-semibold">{t('settings.name', language)}</Label>
                    <Input value={firebaseUser?.displayName || ''} disabled className="luxury-glass-minimal border-none mt-2" />
                  </div>
                </div>
              </div>

              {/* DANGER ZONE - Account Deletion */}
              <div className="luxury-glass-card luxury-shadow-lg p-8 border-2 border-red-400 bg-gradient-to-br from-red-50/90 to-red-100/90 backdrop-blur-xl luxury-animate-scale-in luxury-delay-3">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="luxury-heading-md text-red-900 mb-2">
                      {t('settings.dangerZone', language)}
                    </h2>
                    <p className="luxury-text-small text-red-800">
                      {t('settings.irreversibleActions', language)}
                    </p>
                  </div>
                </div>

                <div className="luxury-glass-card p-6 border-2 border-red-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="luxury-heading-sm text-gray-900 mb-3 flex items-center gap-2">
                        <div className="p-2 rounded-full bg-red-100">
                          <Trash2 className="h-5 w-5 text-red-600" />
                        </div>
                        {t('settings.deleteAccount', language)}
                      </h3>
                      <p className="luxury-text-body mb-4">
                        {t('settings.deleteDescPermanent', language)}
                      </p>
                      <ul className="luxury-text-small space-y-2 pl-6 list-disc">
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
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all"
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
                <div className="luxury-glass-card luxury-shadow-md p-6 mb-6 bg-gradient-to-r from-green-50/90 to-green-100/90 border-green-300 backdrop-blur-xl luxury-animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="luxury-heading-sm text-green-900">
                          {t('settings.trustedDeviceActive', language)}
                        </h3>
                        <p className="luxury-text-body text-green-700 mt-2">
                          {t('settings.trustedDeviceDescFull', language).replace('{days}', getTrustDaysRemaining().toString())}
                        </p>
                        <div className="mt-3 space-y-2 luxury-text-small text-green-600">
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
                      className="luxury-glass-minimal border-red-300 text-red-700 hover:bg-red-50"
                      data-testid="button-revoke-trust"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('settings.revokeTrust', language)}
                    </Button>
                  </div>
                </div>
              )}

              <div className="luxury-glass-card luxury-shadow-lg p-8 luxury-animate-scale-in luxury-delay-1">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-lg">
                      <Fingerprint className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="luxury-heading-md">
                        {t('settings.passkeysDevices', language)}
                      </h2>
                      <p className="luxury-text-small mt-1">
                        {t('settings.managePasskeyDevices', language)}
                      </p>
                    </div>
                  </div>
                  
                  {isPasskeySupported() && (
                    <button
                      onClick={handleAddPasskey}
                      disabled={addingPasskey}
                      className="luxury-btn-primary"
                      data-testid="button-add-passkey"
                    >
                      {addingPasskey ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      {t('settings.addPasskey', language)}
                    </button>
                  )}
                </div>

                {loadingDevices ? (
                  <div className="flex justify-center py-12">
                    <div className="luxury-spinner"></div>
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-16 luxury-glass-minimal rounded-2xl luxury-animate-fade-in">
                    <div className="p-4 rounded-full bg-gradient-to-br from-[#667eea]/10 to-[#764ba2]/10 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                      <Fingerprint className="h-10 w-10 luxury-text-gradient" />
                    </div>
                    <h3 className="luxury-heading-sm mb-3">
                      {t('settings.noDevices', language)}
                    </h3>
                    <p className="luxury-text-body mb-8">
                      {t('settings.addPasskeyQuick', language)}
                    </p>
                    {isPasskeySupported() && (
                      <button
                        onClick={handleAddPasskey}
                        disabled={addingPasskey}
                        className="luxury-btn-primary"
                        data-testid="button-add-first-passkey"
                      >
                        {addingPasskey ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {t('settings.adding', language)}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
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
                        className={`luxury-glass-minimal p-6 rounded-2xl luxury-hover-lift luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}
                        data-testid={`device-${device.credentialId}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-3 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-md">
                              {getDeviceIcon(device.deviceType)}
                            </div>
                            
                            <div className="flex-1">
                              {editingDevice === device.credentialId ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="luxury-glass-minimal border-none max-w-xs"
                                    autoFocus
                                    data-testid="input-device-name"
                                  />
                                  <button
                                    onClick={() => handleRenameDevice(device.credentialId)}
                                    className="luxury-btn-primary p-2"
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
                                    className="luxury-glass-minimal"
                                    data-testid="button-cancel-edit"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="luxury-heading-sm">
                                      {device.deviceName}
                                    </h3>
                                    <span className="luxury-badge text-xs">
                                      {t('settings.passkey', language)}
                                    </span>
                                  </div>
                                  <p className="luxury-text-small">
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
                                className="luxury-glass-minimal"
                                data-testid="button-edit-device"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingDevice(device.credentialId)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                  <div className="mt-6 luxury-glass-minimal p-6 border border-amber-300 rounded-2xl flex items-start gap-3">
                    <div className="p-2 rounded-full bg-gradient-to-br from-amber-500 to-amber-600">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="luxury-text-body text-amber-800">
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
        <AlertDialogContent className="luxury-glass-card luxury-shadow-xl border-none">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                <Trash2 className="h-6 w-6 text-white" />
              </div>
              <AlertDialogTitle className="luxury-heading-md">
                {t('settings.removeDevice', language)}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="luxury-text-body ml-14">
              {t('settings.removeDeviceDesc', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="luxury-btn-secondary" data-testid="button-cancel-delete">
              {t('settings.cancel', language)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDevice && handleDeleteDevice(deletingDevice)}
              className="luxury-btn-primary bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
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
        }
      }}>
        <AlertDialogContent className="max-w-2xl luxury-glass-card luxury-shadow-xl border-2 border-red-300">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                <AlertCircle className="h-7 w-7 text-white" />
              </div>
              <AlertDialogTitle className="luxury-heading-lg text-red-900">
                {deletionStep === 1 
                  ? t('settings.deleteWarning', language)
                  : t('settings.finalConfirmation', language)}
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          {deletionStep === 1 ? (
            <>
              <AlertDialogDescription className="space-y-4">
                <div className="luxury-glass-card p-6 border-2 border-red-300 bg-gradient-to-br from-red-50/90 to-red-100/90 backdrop-blur-xl">
                  <p className="luxury-heading-sm text-red-900 mb-2">
                    {t('settings.deleteAccountWarning', language)}
                  </p>
                  <p className="luxury-text-body text-red-800">
                    {t('settings.followingDeleted', language)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2 luxury-animate-fade-in luxury-delay-1">
                    <div className="p-1 rounded-full bg-red-100">
                      <X className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="luxury-text-small">{t('settings.personalDetails', language)}</span>
                  </div>
                  <div className="flex items-start gap-2 luxury-animate-fade-in luxury-delay-2">
                    <div className="p-1 rounded-full bg-red-100">
                      <X className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="luxury-text-small">{t('settings.washHistory', language)}</span>
                  </div>
                  <div className="flex items-start gap-2 luxury-animate-fade-in luxury-delay-3">
                    <div className="p-1 rounded-full bg-red-100">
                      <X className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="luxury-text-small">{t('settings.loyaltyVip', language)}</span>
                  </div>
                  <div className="flex items-start gap-2 luxury-animate-fade-in luxury-delay-4">
                    <div className="p-1 rounded-full bg-red-100">
                      <X className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="luxury-text-small">{t('settings.kycFiles', language)}</span>
                  </div>
                  <div className="flex items-start gap-2 luxury-animate-fade-in luxury-delay-5">
                    <div className="p-1 rounded-full bg-red-100">
                      <X className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="luxury-text-small">{t('settings.petPhotos', language)}</span>
                  </div>
                  <div className="flex items-start gap-2 luxury-animate-fade-in luxury-delay-6">
                    <div className="p-1 rounded-full bg-red-100">
                      <X className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="luxury-text-small">{t('settings.activeBenefits', language)}</span>
                  </div>
                </div>

                <div className="luxury-glass-card p-6 border-2 border-amber-300 bg-gradient-to-br from-amber-50/90 to-amber-100/90 backdrop-blur-xl">
                  <p className="luxury-heading-sm text-amber-900 mb-3">
                    {t('settings.deletionTimeline', language)}
                  </p>
                  <ul className="luxury-text-small text-amber-800 space-y-2">
                    <li>• {t('settings.immediateRevocation', language)}</li>
                    <li>• {t('settings.dataDeletion30Days', language)}</li>
                    <li>• {t('settings.noRecovery', language)}</li>
                  </ul>
                </div>

                <div className="pt-4">
                  <Label htmlFor="confirm-email" className="luxury-heading-sm">
                    {t('settings.confirmEmailContinue', language)}
                  </Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={firebaseUser?.email || ''}
                    className="luxury-glass-minimal border-2 border-red-300 focus:border-red-500 mt-3"
                    data-testid="input-confirm-email"
                  />
                  <p className="luxury-text-small mt-2">
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
                  className="luxury-btn-secondary"
                  data-testid="button-cancel-account-delete-step1"
                >
                  {t('settings.cancelKeepAccount', language)}
                </AlertDialogCancel>
                <button
                  onClick={() => setDeletionStep(2)}
                  disabled={confirmEmail !== firebaseUser?.email}
                  className="luxury-btn-primary bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50"
                  data-testid="button-proceed-step2"
                >
                  {t('settings.proceedDelete', language)}
                </button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogDescription className="space-y-6">
                <div className="luxury-glass-card p-8 border-3 border-red-500 bg-gradient-to-br from-red-100/90 to-red-200/90 backdrop-blur-xl text-center">
                  <p className="luxury-heading-lg text-red-900 mb-4">
                    {t('settings.lastChance', language)}
                  </p>
                  <p className="luxury-text-body text-red-800 font-semibold">
                    {t('settings.finalWarning', language)}
                  </p>
                </div>

                <div className="pt-4">
                  <Label htmlFor="confirm-text" className="luxury-heading-sm text-red-900">
                    {t('settings.typeTextExactly', language)}
                  </Label>
                  <p className="luxury-heading-md text-center my-4 p-4 luxury-glass-minimal border-2 border-gray-400">
                    DELETE MY ACCOUNT
                  </p>
                  <Input
                    id="confirm-text"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="luxury-glass-minimal mt-3 border-2 border-red-400 focus:border-red-600 text-center font-semibold"
                    data-testid="input-confirm-delete-text"
                  />
                </div>
              </AlertDialogDescription>

              <AlertDialogFooter className="flex-col sm:flex-row gap-3">
                <AlertDialogCancel 
                  onClick={() => {
                    setDeletionStep(1);
                    setConfirmText("");
                  }}
                  className="luxury-btn-secondary"
                  data-testid="button-back-step1"
                >
                  {t('settings.goBack', language)}
                </AlertDialogCancel>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== 'DELETE MY ACCOUNT'}
                  className="luxury-btn-primary bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 disabled:opacity-50 font-bold"
                  data-testid="button-confirm-final-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('settings.deletePermanently', language)}
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
