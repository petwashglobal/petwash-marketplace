import { useState, useEffect } from "react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/lib/languageStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
        
        const response = await fetch('/api/auth/webauthn/devices', {
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
        const response = await fetch('/api/auth/webauthn/devices', {
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
      
      const response = await fetch('/api/user/delete', {
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
          window.location.href = '/';
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
    <div className="min-h-screen bg-white">
      <Header language={language} onLanguageChange={setLanguage} />
      
      <div className="pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center gap-6 mb-6">
              {/* Pet Avatar Display */}
              <PetAvatarDisplay 
                size="lg" 
                showName={true}
                animated={true}
              />
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">
                  {t('settings.title', language)}
                </h1>
                <p className="mt-2 text-gray-600">
                  {t('settings.subtitle', language)}
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="security" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="account" data-testid="tab-account">
                {t('settings.account', language)}
              </TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security">
                <Shield className="h-4 w-4 mr-2" />
                {t('settings.security', language)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <Card className="p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">
                  {t('settings.accountDetails', language)}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>{t('settings.email', language)}</Label>
                    <Input value={firebaseUser?.email || ''} disabled />
                  </div>
                  <div>
                    <Label>{t('settings.name', language)}</Label>
                    <Input value={firebaseUser?.displayName || ''} disabled />
                  </div>
                </div>
              </Card>

              {/* DANGER ZONE - Account Deletion */}
              <Card className="p-6 border-2 border-red-200 bg-red-50">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600 mt-1" />
                  <div>
                    <h2 className="text-xl font-bold text-red-900 mb-2">
                      {t('settings.dangerZone', language)}
                    </h2>
                    <p className="text-sm text-red-800">
                      {t('settings.irreversibleActions', language)}
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border-2 border-red-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-red-600" />
                        {t('settings.deleteAccount', language)}
                      </h3>
                      <p className="text-sm text-gray-700 mb-2">
                        {t('settings.deleteDescPermanent', language)}
                      </p>
                      <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
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
                      className="bg-red-600 hover:bg-red-700 text-white"
                      data-testid="button-delete-account"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('settings.deleteAccountButton', language)}
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              {/* Trusted Device Status - Inline Quick View */}
              {trustedDevice && (
                <Card className="p-4 mb-4 bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-green-900">
                          {t('settings.trustedDeviceActive', language)}
                        </h3>
                        <p className="text-sm text-green-700 mt-1">
                          {t('settings.trustedDeviceDescFull', language).replace('{days}', getTrustDaysRemaining().toString())}
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-green-600">
                          <div className="flex items-center gap-2">
                            <Laptop className="h-3 w-3" />
                            <span>{trustedDevice.deviceInfo.browser} on {trustedDevice.deviceInfo.os}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-3 w-3" />
                            <span>{trustedDevice.deviceInfo.screenResolution}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleRevokeTrust}
                      variant="outline"
                      size="sm"
                      className="bg-white hover:bg-red-50 border-red-300 text-red-700"
                      data-testid="button-revoke-trust"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('settings.revokeTrust', language)}
                    </Button>
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t('settings.passkeysDevices', language)}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {t('settings.managePasskeyDevices', language)}
                    </p>
                  </div>
                  
                  {isPasskeySupported() && (
                    <Button
                      onClick={handleAddPasskey}
                      disabled={addingPasskey}
                      className="bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-white hover:opacity-90"
                      data-testid="button-add-passkey"
                    >
                      {addingPasskey ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      {t('settings.addPasskey', language)}
                    </Button>
                  )}
                </div>

                {loadingDevices ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Fingerprint className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {t('settings.noDevices', language)}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {t('settings.addPasskeyQuick', language)}
                    </p>
                    {isPasskeySupported() && (
                      <Button
                        onClick={handleAddPasskey}
                        disabled={addingPasskey}
                        className="bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-white"
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
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {devices.map((device) => (
                      <div
                        key={device.credentialId}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        data-testid={`device-${device.credentialId}`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="p-2 bg-blue-100 rounded-full">
                            {getDeviceIcon(device.deviceType)}
                          </div>
                          
                          <div className="flex-1">
                            {editingDevice === device.credentialId ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="max-w-xs"
                                  autoFocus
                                  data-testid="input-device-name"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRenameDevice(device.credentialId)}
                                  data-testid="button-save-device-name"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingDevice(null);
                                    setEditName("");
                                  }}
                                  data-testid="button-cancel-edit"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-gray-900">
                                    {device.deviceName}
                                  </h3>
                                  <Badge variant="outline" className="text-xs">
                                    {t('settings.passkey', language)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500">
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
                    ))}
                  </div>
                )}

                {!isPasskeySupported() && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-800">
                        {t('settings.browserNoPasskey', language)}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Device Confirmation Dialog */}
      <AlertDialog open={!!deletingDevice} onOpenChange={() => setDeletingDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.removeDevice', language)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.removeDeviceDesc', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t('settings.cancel', language)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDevice && handleDeleteDevice(deletingDevice)}
              className="bg-red-600 hover:bg-red-700"
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
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-2xl text-red-900">
                {deletionStep === 1 
                  ? t('settings.deleteWarning', language)
                  : t('settings.finalConfirmation', language)}
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          {deletionStep === 1 ? (
            <>
              <AlertDialogDescription className="space-y-4 text-base">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-900 mb-2">
                    {t('settings.deleteAccountWarning', language)}
                  </p>
                  <p className="text-red-800">
                    {t('settings.followingDeleted', language)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-red-600 mt-0.5" />
                    <span>{t('settings.personalDetails', language)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-red-600 mt-0.5" />
                    <span>{t('settings.washHistory', language)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-red-600 mt-0.5" />
                    <span>{t('settings.loyaltyVip', language)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-red-600 mt-0.5" />
                    <span>{t('settings.kycFiles', language)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-red-600 mt-0.5" />
                    <span>{t('settings.petPhotos', language)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X className="h-5 w-5 text-red-600 mt-0.5" />
                    <span>{t('settings.activeBenefits', language)}</span>
                  </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                  <p className="font-semibold text-amber-900 mb-2">
                    {t('settings.deletionTimeline', language)}
                  </p>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• {t('settings.immediateRevocation', language)}</li>
                    <li>• {t('settings.dataDeletion30Days', language)}</li>
                    <li>• {t('settings.noRecovery', language)}</li>
                  </ul>
                </div>

                <div className="pt-4">
                  <Label htmlFor="confirm-email" className="text-base font-semibold">
                    {t('settings.confirmEmailContinue', language)}
                  </Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={firebaseUser?.email || ''}
                    className="mt-2 border-2 border-gray-300 focus:border-red-500"
                    data-testid="input-confirm-email"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('settings.typeEmail', language)} {firebaseUser?.email}
                  </p>
                </div>
              </AlertDialogDescription>

              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel 
                  onClick={() => {
                    setDeletingAccount(false);
                    setDeletionStep(1);
                    setConfirmEmail("");
                  }}
                  data-testid="button-cancel-account-delete-step1"
                >
                  {t('settings.cancelKeepAccount', language)}
                </AlertDialogCancel>
                <Button
                  onClick={() => setDeletionStep(2)}
                  disabled={confirmEmail !== firebaseUser?.email}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  data-testid="button-proceed-step2"
                >
                  {t('settings.proceedDelete', language)}
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogDescription className="space-y-4 text-base">
                <div className="bg-red-100 border-3 border-red-500 rounded-lg p-6 text-center">
                  <p className="text-2xl font-bold text-red-900 mb-3">
                    {t('settings.lastChance', language)}
                  </p>
                  <p className="text-red-800 font-semibold">
                    {t('settings.finalWarning', language)}
                  </p>
                </div>

                <div className="pt-4">
                  <Label htmlFor="confirm-text" className="text-base font-semibold text-red-900">
                    {t('settings.typeTextExactly', language)}
                  </Label>
                  <p className="text-lg font-bold text-center my-3 p-3 bg-gray-100 rounded border-2 border-gray-300">
                    DELETE MY ACCOUNT
                  </p>
                  <Input
                    id="confirm-text"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="mt-2 border-2 border-red-400 focus:border-red-600 text-center font-semibold"
                    data-testid="input-confirm-delete-text"
                  />
                </div>
              </AlertDialogDescription>

              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel 
                  onClick={() => {
                    setDeletionStep(1);
                    setConfirmText("");
                  }}
                  data-testid="button-back-step1"
                >
                  {t('settings.goBack', language)}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== 'DELETE MY ACCOUNT'}
                  className="bg-red-700 hover:bg-red-800 text-white disabled:opacity-50 font-bold"
                  data-testid="button-confirm-final-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('settings.deletePermanently', language)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <Footer language={language} />
    </div>
  );
}
