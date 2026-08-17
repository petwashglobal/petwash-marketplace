/**
 * PR-AUTH-SECURITY-9 §2 — Account > Security status panel.
 *
 * Every row reads server-truth via GET /api/security/status. NEVER infers
 * status from localStorage / sessionStorage. If a row is "not yet available"
 * server-side (trustedDevices, sessions), we render a labelled "Not yet
 * available" instead of guessing.
 *
 * React Query cacheTime is 0 so the panel refetches on every mount — a
 * user who just added a passkey / set a PIN sees the change immediately,
 * and a signed-out user's Back-button never surfaces stale account state.
 */

import { useQuery } from '@tanstack/react-query';
import { Shield, Mail, Smartphone, Key, Fingerprint, Lock, Cpu, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/apiConfig';

type SecurityStatus = {
  ok: boolean;
  generatedAt: string;
  email: { value: string | null; verified: boolean };
  mobile: { value: string | null; verified: boolean };
  password: { set: boolean };
  passkey: { count: number };
  pin: { set: boolean };
  trustedDevices: { available: boolean; count: number | null; reason?: string };
  mfa: { enrolled: boolean; count: number; factors: Array<any> };
  sessions: { available: boolean; count: number | null; reason?: string };
};

function StatusRow({
  icon: Icon,
  label,
  value,
  pill,
  testId,
}: {
  icon: any;
  label: string;
  value?: string | null;
  pill: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="flex items-center justify-between border-b border-black/5 py-3 last:border-b-0"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-5 w-5 text-[#b0841c] shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="font-medium text-[#1A1A1A] text-sm">{label}</div>
          {value ? <div className="text-xs text-[#6A6460] truncate max-w-[220px]">{value}</div> : null}
        </div>
      </div>
      <div className="shrink-0">{pill}</div>
    </div>
  );
}

function VerifiedPill({ ok, testId }: { ok: boolean; testId: string }) {
  return ok ? (
    <Badge className="bg-emerald-500/15 text-emerald-700 border-0" data-testid={testId}>Verified</Badge>
  ) : (
    <Badge variant="outline" className="border-amber-500/40 text-amber-700" data-testid={testId}>Not verified</Badge>
  );
}

function SetPill({ ok, testId, onLabel = 'Set', offLabel = 'Not set' }: { ok: boolean; testId: string; onLabel?: string; offLabel?: string }) {
  return ok ? (
    <Badge className="bg-emerald-500/15 text-emerald-700 border-0" data-testid={testId}>{onLabel}</Badge>
  ) : (
    <Badge variant="outline" className="border-[#E8E3D9] text-[#8A8078]" data-testid={testId}>{offLabel}</Badge>
  );
}

function CountPill({ n, testId }: { n: number; testId: string }) {
  return n > 0 ? (
    <Badge className="bg-emerald-500/15 text-emerald-700 border-0" data-testid={testId}>{n}</Badge>
  ) : (
    <Badge variant="outline" className="border-[#E8E3D9] text-[#8A8078]" data-testid={testId}>0</Badge>
  );
}

function NotAvailablePill({ testId }: { testId: string }) {
  return (
    <Badge variant="outline" className="border-[#E8E3D9] text-[#8A8078]" data-testid={testId}>
      Not yet available
    </Badge>
  );
}

export function SecurityStatusPanel({ language }: { language: string }) {
  const he = language === 'he';
  const { data, isLoading, isError } = useQuery<SecurityStatus>({
    queryKey: ['/api/security/status'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/security/status'), { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return res.json();
    },
    // PR-AUTH-SECURITY-9: read server truth on every mount. Any cached row
    // could be stale after a passkey add / PIN change / mobile verify.
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  return (
    <Card className="luxury-glass-card luxury-shadow-lg" data-testid="security-status-panel">
      <CardHeader>
        <CardTitle className="luxury-heading-sm flex items-center gap-2" data-testid="security-status-title">
          <Shield className="h-5 w-5" />
          {he ? 'סטטוס אבטחה' : 'Security status'}
        </CardTitle>
        <CardDescription className="luxury-text-small">
          {he ? 'הנתונים נטענים ישירות מהשרת — אין ניחושים מ-localStorage.' : 'Every row is read from the server — never inferred from local storage.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="security-status-loading">
            <Loader2 className="h-6 w-6 animate-spin text-[#b0841c]" />
          </div>
        ) : isError || !data?.ok ? (
          <div className="text-sm text-red-600 py-4" data-testid="security-status-error">
            {he ? 'לא ניתן לטעון את סטטוס האבטחה כרגע.' : 'Could not load security status right now.'}
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            <StatusRow
              icon={Mail}
              label={he ? 'אימייל' : 'Email'}
              value={data.email.value || undefined}
              pill={<VerifiedPill ok={data.email.verified} testId="pill-email" />}
              testId="row-email"
            />
            <StatusRow
              icon={Smartphone}
              label={he ? 'נייד' : 'Mobile'}
              value={data.mobile.value || undefined}
              pill={<VerifiedPill ok={data.mobile.verified} testId="pill-mobile" />}
              testId="row-mobile"
            />
            <StatusRow
              icon={Lock}
              label={he ? 'סיסמה' : 'Password'}
              pill={<SetPill ok={data.password.set} testId="pill-password" />}
              testId="row-password"
            />
            <StatusRow
              icon={Fingerprint}
              label={he ? 'Passkey / Face ID' : 'Passkey / Face ID'}
              pill={<CountPill n={data.passkey.count} testId="pill-passkey" />}
              testId="row-passkey"
            />
            <StatusRow
              icon={Key}
              label={he ? 'קוד PIN' : 'PIN'}
              pill={<SetPill ok={data.pin.set} testId="pill-pin" />}
              testId="row-pin"
            />
            <StatusRow
              icon={Cpu}
              label={he ? 'מכשירים מהימנים' : 'Trusted devices'}
              pill={
                data.trustedDevices.available
                  ? <CountPill n={data.trustedDevices.count || 0} testId="pill-trusted" />
                  : <NotAvailablePill testId="pill-trusted" />
              }
              testId="row-trusted"
            />
            <StatusRow
              icon={Shield}
              label={he ? 'אימות דו-שלבי (MFA)' : 'Two-step verification (MFA)'}
              pill={
                <SetPill
                  ok={data.mfa.enrolled}
                  testId="pill-mfa"
                  onLabel={he ? `מופעל (${data.mfa.count})` : `Enabled (${data.mfa.count})`}
                  offLabel={he ? 'לא מופעל' : 'Not enabled'}
                />
              }
              testId="row-mfa"
            />
            <StatusRow
              icon={Users}
              label={he ? 'הפעלות פעילות' : 'Active sessions'}
              pill={
                data.sessions.available
                  ? <CountPill n={data.sessions.count || 0} testId="pill-sessions" />
                  : <NotAvailablePill testId="pill-sessions" />
              }
              testId="row-sessions"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SecurityStatusPanel;
