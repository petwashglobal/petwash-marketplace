import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Trash2, Loader2, ShieldCheck, Info } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { type Language, t } from "@/lib/i18n";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { apiRequest } from "@/lib/queryClient";

interface PasskeyDevice {
  id: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string;
}

interface MyDevicesProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function MyDevices({ language, onLanguageChange }: MyDevicesProps) {
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch user's passkeys
  const { data: devicesData, isLoading } = useQuery<{ ok: boolean; credentials: PasskeyDevice[] }>({
    queryKey: ['/api/webauthn/credentials'],
    enabled: !!user,
  });

  const devices: PasskeyDevice[] = devicesData?.credentials || [];

  // Delete passkey mutation
  const deleteMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      setDeletingId(credentialId);
      const response = await fetch(`/api/webauthn/credentials/${credentialId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete passkey');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      toast({
        title: t('myDevices.removedSuccess', language),
        description: t('myDevices.deviceRemoved', language),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('myDevices.error', language),
        description: error.message || t('myDevices.failedToRemove', language),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const getDeviceIcon = (device: PasskeyDevice) => {
    if (device.deviceType === 'multiDevice' || device.backedUp) {
      return <ShieldCheck className="w-8 h-8 text-green-600" />;
    }
    return <Smartphone className="w-8 h-8 text-blue-600" />;
  };

  const getDeviceLabel = (device: PasskeyDevice) => {
    if (device.deviceType === 'multiDevice' || device.backedUp) {
      return t('myDevices.syncedDevice', language);
    }
    return t('myDevices.thisDeviceOnly', language);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <Header language={language} onLanguageChange={onLanguageChange} />

      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {t('myDevices.title', language)}
            </CardTitle>
            <CardDescription>
              {t('myDevices.subtitle', language)}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Info Alert */}
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900">
                {t('myDevices.alertInfo', language)}
              </AlertDescription>
            </Alert>

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {/* No Devices */}
            {!isLoading && devices.length === 0 && (
              <div className="text-center py-12">
                <Smartphone className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('myDevices.noDevices', language)}
                </h3>
                <p className="text-gray-600">
                  {t('myDevices.registerInfo', language)}
                </p>
              </div>
            )}

            {/* Device List */}
            {!isLoading && devices.length > 0 && (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {getDeviceIcon(device)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900">
                          {getDeviceLabel(device)}
                        </h4>
                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                          <div>
                            {t('myDevices.registered', language)}
                            {formatDate(device.createdAt)}
                          </div>
                          <div>
                            {t('myDevices.lastUsed', language)}
                            {formatDate(device.lastUsedAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(device.id)}
                      disabled={deletingId === device.id}
                      className="flex items-center gap-2"
                      data-testid={`button-delete-device-${device.id}`}
                    >
                      {deletingId === device.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('myDevices.removing', language)}
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          {t('myDevices.remove', language)}
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer language={language} />
    </div>
  );
}
