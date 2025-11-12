import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, Smartphone, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { PasskeyEnforcementBanner } from '@/components/security/PasskeyEnforcementBanner';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RoleInfo {
  level: number;
  role: string;
  roleName: string;
  roleNameHe: string;
  department: string | null;
  accessLevel: number;
}

interface Passkey {
  id: string;
  credId: string;
  deviceName: string;
  deviceIcon: string;
  deviceType?: string;
  backedUp?: boolean;
  platform?: string;
  browserName?: string;
  browserVersion?: string;
  trustScore?: number;
  riskLevel?: string;
  createdAt?: number;
  lastUsedAt?: number;
  usageCount?: number;
  isRevoked?: boolean;
  transports?: string[];
}

export default function SecuritySettings() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);

  // Fetch user's role level
  const { data: roleInfo, isLoading: roleLoading } = useQuery<RoleInfo>({
    queryKey: ['/api/me/role'],
  });

  // Fetch passkeys
  const { data: passkeysData, isLoading: passkeysLoading } = useQuery<{
    ok: boolean;
    credentials: Passkey[];
  }>({
    queryKey: ['/api/webauthn/credentials'],
  });

  const passkeys = passkeysData?.credentials || [];
  const hasPasskey = passkeys.length > 0;
  const passkeyRequired = (roleInfo?.level || 0) >= 8;

  // Create passkey mutation
  const createPasskeyMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Get registration options
      const optionsRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        credentials: 'include',
      });

      if (!optionsRes.ok) {
        throw new Error('Failed to get registration options');
      }

      const { options, challengeKey } = await optionsRes.json();

      // Step 2: Create passkey with browser
      const { startRegistration } = await import('@simplewebauthn/browser');
      const attResp = await startRegistration(options);

      // Step 3: Verify and store
      const verifyRes = await apiRequest('POST', '/api/webauthn/register/verify', {
        response: attResp,
        challengeKey,
      });

      return verifyRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      toast({
        title: t('security.passkeyCreated'),
        description: t('security.passkeyCreatedDesc'),
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('security.passkeyFailed'),
        description: error instanceof Error ? error.message : t('security.passkeyFailedDesc'),
      });
    },
  });

  // Rename passkey mutation
  const renameMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      return apiRequest('PATCH', `/api/webauthn/credentials/${id}/rename`, { newName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      setEditingId(null);
      setNewName('');
      toast({
        title: t('devices.deviceRenamed'),
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Failed to rename device',
      });
    },
  });

  // Revoke passkey mutation
  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/webauthn/credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      setRevokeId(null);
      toast({
        title: t('security.passkeyRevoked'),
      });
    },
    onError: (error: any) => {
      if (error?.code === 'LAST_DEVICE') {
        toast({
          variant: 'destructive',
          title: t('devices.cannotRemoveLast'),
          description: t('devices.cannotRemoveLastDesc'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to revoke passkey',
        });
      }
      setRevokeId(null);
    },
  });

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return t('devices.justNow');
    const date = new Date(timestamp);
    return date.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');
  };

  const getTrustBadge = (trustScore?: number, riskLevel?: string) => {
    if (trustScore === undefined) return null;

    const level = riskLevel || (trustScore >= 75 ? 'high' : trustScore >= 50 ? 'medium' : 'low');
    const colors = {
      low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };

    return (
      <Badge className={colors[level as keyof typeof colors]} data-testid={`trust-badge-${level}`}>
        {t(`devices.${level}Trust`)} ({trustScore})
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header language={language} onLanguageChange={() => {}} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="page-title">
            <Shield className="inline-block mr-2 h-8 w-8" />
            {t('security.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400" data-testid="page-subtitle">
            {t('security.subtitle')}
          </p>
        </div>

        {roleLoading ? (
          <Skeleton className="h-24 mb-6" />
        ) : (
          <PasskeyEnforcementBanner
            required={passkeyRequired}
            hasPasskey={hasPasskey}
            onCreate={() => createPasskeyMutation.mutate()}
            language={language}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle data-testid="passkeys-title">{t('security.yourPasskeys')}</CardTitle>
            <CardDescription>{t('devices.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {passkeysLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : passkeys.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-state">
                <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t('security.noPasskeys')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('security.noPasskeysDesc')}
                </p>
                <Button
                  onClick={() => createPasskeyMutation.mutate()}
                  disabled={createPasskeyMutation.isPending}
                  data-testid="add-first-passkey-button"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {createPasskeyMutation.isPending ? t('security.creating') : t('security.addPasskey')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {passkeys.map((passkey) => (
                  <Card key={passkey.id} className="border-2" data-testid={`passkey-${passkey.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="text-3xl">{passkey.deviceIcon}</div>
                          <div className="flex-1">
                            {editingId === passkey.id ? (
                              <div className="flex items-center gap-2 mb-2">
                                <Input
                                  value={newName}
                                  onChange={(e) => setNewName(e.target.value)}
                                  className="max-w-xs"
                                  data-testid={`rename-input-${passkey.id}`}
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    renameMutation.mutate({ id: passkey.id, newName })
                                  }
                                  disabled={!newName.trim() || renameMutation.isPending}
                                  data-testid={`save-rename-${passkey.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingId(null);
                                    setNewName('');
                                  }}
                                  data-testid={`cancel-rename-${passkey.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-1" data-testid={`device-name-${passkey.id}`}>
                                {passkey.deviceName}
                              </h4>
                            )}
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              {passkey.platform && (
                                <p data-testid={`device-platform-${passkey.id}`}>
                                  {t('devices.platform')}: {passkey.platform}
                                </p>
                              )}
                              {passkey.browserName && (
                                <p data-testid={`device-browser-${passkey.id}`}>
                                  {t('devices.browser')}: {passkey.browserName}
                                </p>
                              )}
                              <p data-testid={`device-created-${passkey.id}`}>
                                {t('devices.registeredOn')}: {formatDate(passkey.createdAt)}
                              </p>
                              {passkey.lastUsedAt && (
                                <p data-testid={`device-last-used-${passkey.id}`}>
                                  {t('devices.lastUsed')}: {formatDate(passkey.lastUsedAt)}
                                </p>
                              )}
                            </div>
                            <div className="mt-2">{getTrustBadge(passkey.trustScore, passkey.riskLevel)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {editingId !== passkey.id && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(passkey.id);
                                  setNewName(passkey.deviceName);
                                }}
                                data-testid={`edit-button-${passkey.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRevokeId(passkey.id)}
                                data-testid={`revoke-button-${passkey.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  onClick={() => createPasskeyMutation.mutate()}
                  disabled={createPasskeyMutation.isPending}
                  className="w-full"
                  data-testid="add-another-passkey-button"
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  {createPasskeyMutation.isPending ? t('security.creating') : t('security.addPasskey')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revoke confirmation dialog */}
        <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
          <AlertDialogContent data-testid="revoke-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('devices.removeDevice')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('devices.removeDeviceDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="revoke-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => revokeId && revokeMutation.mutate(revokeId)}
                className="bg-red-600 hover:bg-red-700"
                data-testid="revoke-confirm"
              >
                {revokeMutation.isPending ? t('devices.removing') : t('devices.remove')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>

      <Footer language={language} />
    </div>
  );
}
