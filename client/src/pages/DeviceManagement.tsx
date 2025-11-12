import { useState, useEffect } from "react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/lib/languageStore";
import { t, isRTL } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone,
  Laptop,
  Monitor,
  Shield,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  Plus,
  Info,
} from "lucide-react";
import { registerPasskey, getBiometricMethodName, isPasskeySupported } from "@/auth/passkey";
import { useLocation } from "wouter";
import { logger } from "@/lib/logger";
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
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Device {
  id: string;
  credId: string;
  deviceName: string;
  deviceIcon: string;
  platform: string;
  browserName: string;
  browserVersion: string;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: { _seconds: number; _nanoseconds: number } | string;
  lastUsedAt: { _seconds: number; _nanoseconds: number } | string;
  usageCount: number;
  backedUp: boolean;
  isRevoked: boolean;
}

export default function DeviceManagement() {
  const { user: firebaseUser, loading: authLoading } = useFirebaseAuth();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingDevice, setDeletingDevice] = useState<string | null>(null);
  const [addingPasskey, setAddingPasskey] = useState(false);

  const isHebrew = language === 'he';
  const rtl = isRTL(language);

  // Fetch user's devices
  useEffect(() => {
    const fetchDevices = async () => {
      if (!firebaseUser) return;

      try {
        setLoadingDevices(true);
        
        const response = await fetch('/api/webauthn/credentials', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setDevices((data.credentials || []).filter((d: Device) => !d.isRevoked));
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
  const handleRenameDevice = async (credId: string) => {
    if (!firebaseUser || !editName.trim()) return;

    try {
      const response = await fetch(`/api/webauthn/credentials/${credId}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          newName: editName.trim(),
        }),
      });

      if (response.ok) {
        setDevices(prev => 
          prev.map(d => 
            d.credId === credId 
              ? { ...d, deviceName: editName.trim() } 
              : d
          )
        );
        setEditingDevice(null);
        setEditName("");
        
        toast({
          title: t('devices.deviceRenamed', language),
          description: isHebrew ? 'השינוי נשמר בהצלחה' : 'Changes saved successfully',
        });
      } else {
        throw new Error('Failed to rename device');
      }
    } catch (error) {
      logger.error('Error renaming device:', error);
      toast({
        variant: "destructive",
        title: t('common.error', language),
        description: isHebrew ? 'נכשל לעדכן שם המכשיר' : 'Failed to update device name',
      });
    }
  };

  // Handle device deletion
  const handleDeleteDevice = async (credId: string) => {
    if (!firebaseUser) return;

    try {
      const response = await fetch(`/api/webauthn/credentials/${credId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setDevices(prev => prev.filter(d => d.credId !== credId));
        setDeletingDevice(null);
        
        toast({
          title: t('devices.deviceRemoved', language),
          description: isHebrew ? 'המכשיר הוסר בהצלחה' : 'Device removed successfully',
        });
      } else {
        const errorData = await response.json();
        if (errorData.code === 'LAST_DEVICE') {
          toast({
            variant: "destructive",
            title: t('devices.cannotRemoveLast', language),
            description: t('devices.cannotRemoveLastDesc', language),
          });
        } else {
          throw new Error('Failed to delete device');
        }
      }
    } catch (error) {
      logger.error('Error deleting device:', error);
      toast({
        variant: "destructive",
        title: t('common.error', language),
        description: isHebrew ? 'נכשל להסיר מכשיר' : 'Failed to remove device',
      });
    }
  };

  // Handle adding a new passkey
  const handleAddPasskey = async () => {
    if (!firebaseUser) return;

    try {
      setAddingPasskey(true);
      const token = await firebaseUser.getIdToken();
      const deviceName = `${getBiometricMethodName()} - ${new Date().toLocaleDateString()}`;
      
      const result = await registerPasskey(token, deviceName);

      if (result.success) {
        toast({
          title: isHebrew ? 'Passkey נוסף בהצלחה' : 'Passkey added successfully',
        });

        // Refresh devices list
        const response = await fetch('/api/webauthn/credentials', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setDevices((data.credentials || []).filter((d: Device) => !d.isRevoked));
        }
      } else {
        toast({
          variant: "destructive",
          title: t('common.error', language),
          description: result.error || (isHebrew ? 'נכשל להוסיף Passkey' : 'Failed to add passkey'),
        });
      }
    } catch (error) {
      logger.error('Error adding passkey:', error);
    } finally {
      setAddingPasskey(false);
    }
  };

  const getDeviceIcon = (device: Device) => {
    if (device.deviceIcon) return device.deviceIcon;
    
    const platform = device.platform?.toLowerCase() || '';
    if (platform.includes('ios') || platform.includes('iphone') || platform.includes('ipad')) return '📱';
    if (platform.includes('android')) return '🤖';
    if (platform.includes('mac')) return '💻';
    if (platform.includes('windows')) return '🖥️';
    return '🔐';
  };

  const getTrustScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getTrustScoreLabel = (score: number): string => {
    if (score >= 80) return t('devices.highTrust', language);
    if (score >= 50) return t('devices.mediumTrust', language);
    return t('devices.lowTrust', language);
  };

  const formatTimestamp = (timestamp: { _seconds: number } | string): string => {
    if (!timestamp) return isHebrew ? 'לא ידוע' : 'Unknown';
    
    const date = typeof timestamp === 'string' 
      ? new Date(timestamp) 
      : new Date(timestamp._seconds * 1000);
    
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return date.toLocaleDateString();
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50" dir={rtl ? 'rtl' : 'ltr'}>
      <Header language={language} onLanguageChange={setLanguage} />
      
      <div className="pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              {t('devices.title', language)}
            </h1>
            <p className="mt-2 text-gray-600">
              {t('devices.subtitle', language)}
            </p>
          </motion.div>

          {/* Add New Device Button */}
          {isPasskeySupported() && devices.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <Button
                onClick={handleAddPasskey}
                disabled={addingPasskey}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                data-testid="button-add-device"
              >
                {addingPasskey ? (
                  <Loader2 className={`h-4 w-4 animate-spin ${rtl ? 'ml-2' : 'mr-2'}`} />
                ) : (
                  <Plus className={`h-4 w-4 ${rtl ? 'ml-2' : 'mr-2'}`} />
                )}
                {t('devices.addDevice', language)}
              </Button>
            </motion.div>
          )}

          {/* Devices Grid */}
          {loadingDevices ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : devices.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="p-12 text-center bg-white shadow-xl">
                <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <Shield className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {t('devices.noDevices', language)}
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {t('devices.noDevicesDesc', language)}
                </p>
                {isPasskeySupported() && (
                  <Button
                    onClick={handleAddPasskey}
                    disabled={addingPasskey}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                    data-testid="button-add-first-device"
                  >
                    {addingPasskey ? (
                      <>
                        <Loader2 className={`h-5 w-5 animate-spin ${rtl ? 'ml-2' : 'mr-2'}`} />
                        {isHebrew ? 'מוסיף...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        <Plus className={`h-5 w-5 ${rtl ? 'ml-2' : 'mr-2'}`} />
                        {t('devices.addFirstDevice', language)}
                      </>
                    )}
                  </Button>
                )}
              </Card>
            </motion.div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence>
                {devices.map((device, index) => (
                  <motion.div
                    key={device.credId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.1 }}
                    data-testid={`device-card-${device.credId}`}
                  >
                    <Card className="p-6 hover:shadow-xl transition-all duration-300 bg-white border-2 hover:border-blue-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">
                            {getDeviceIcon(device)}
                          </div>
                          <div className="flex-1">
                            {editingDevice === device.credId ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-8 text-sm"
                                  autoFocus
                                  data-testid="input-rename-device"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRenameDevice(device.credId)}
                                  className="h-8 w-8 p-0"
                                  data-testid="button-save-rename"
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingDevice(null);
                                    setEditName("");
                                  }}
                                  className="h-8 w-8 p-0"
                                  data-testid="button-cancel-rename"
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <h3 className="font-semibold text-gray-900 text-lg">
                                  {device.deviceName}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  {device.platform} • {device.browserName}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        {editingDevice !== device.credId && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingDevice(device.credId);
                                setEditName(device.deviceName);
                              }}
                              className="h-8 w-8 p-0"
                              data-testid="button-edit-device"
                            >
                              <Edit2 className="h-4 w-4 text-gray-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingDevice(device.credId)}
                              className="h-8 w-8 p-0 hover:bg-red-50"
                              data-testid="button-delete-device"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Trust Score Badge */}
                      <div className="mb-4">
                        <Badge
                          className={`${getTrustScoreColor(device.trustScore)} px-3 py-1 text-sm font-medium border`}
                          data-testid="badge-trust-score"
                        >
                          {t('devices.trustScore', language)}: {device.trustScore}% • {getTrustScoreLabel(device.trustScore)}
                        </Badge>
                      </div>

                      {/* Device Info */}
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>{t('devices.registeredOn', language)}:</span>
                          <span className="font-medium text-gray-900">
                            {formatTimestamp(device.createdAt)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('devices.lastUsed', language)}:</span>
                          <span className="font-medium text-gray-900">
                            {formatTimestamp(device.lastUsedAt)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{isHebrew ? 'פעמי שימוש' : 'Usage'}:</span>
                          <span className="font-medium text-gray-900">
                            {device.usageCount} {isHebrew ? 'פעמים' : 'times'}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Security Tip */}
          {devices.length === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8"
            >
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">
                      {t('devices.securityTip', language)}
                    </h4>
                    <p className="text-sm text-blue-800">
                      {t('devices.backupDevice', language)}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingDevice} onOpenChange={() => setDeletingDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('devices.removeDevice', language)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('devices.removeDeviceDesc', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t('common.cancel', language)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDevice && handleDeleteDevice(deletingDevice)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {t('devices.remove', language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer language={language} />
    </div>
  );
}
