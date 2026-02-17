import { useQuery } from '@tanstack/react-query';
import { Shield, CheckCircle2, XCircle, Loader2, Lock, KeyRound, Link2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SecurityCheck {
  name: string;
  status: 'active' | 'inactive' | 'checking';
  description: string;
  lastChecked?: string;
}

interface SecurityStatusResponse {
  biometricAccess: SecurityCheck;
  keypadAccess: SecurityCheck;
  doubleSpendPrevention: SecurityCheck;
  remoteEmergencyStop: SecurityCheck;
  overallStatus: 'secure' | 'warning' | 'critical';
}

export default function SecurityStatus() {
  const { data: securityStatus, isLoading } = useQuery<SecurityStatusResponse>({
    queryKey: ['/api/security/status'],
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'inactive':
        return <XCircle className="w-6 h-6 text-yellow-500" />;
      case 'checking':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getCheckIcon = (name: string) => {
    switch (name) {
      case 'Biometric Access':
        return <Lock className="w-5 h-5" />;
      case 'Keypad Access':
        return <KeyRound className="w-5 h-5" />;
      case 'Double-Spend Prevention':
        return <Shield className="w-5 h-5" />;
      case 'Remote Emergency Stop':
        return <Link2 className="w-5 h-5" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="luxury-text-body">Checking security systems...</p>
        </div>
      </div>
    );
  }

  const checks = securityStatus ? [
    { ...securityStatus.biometricAccess, icon: 'biometric' },
    { ...securityStatus.keypadAccess, icon: 'keypad' },
    { ...securityStatus.doubleSpendPrevention, icon: 'shield' },
    { ...securityStatus.remoteEmergencyStop, icon: 'emergency' },
  ] : [];

  const allActive = checks.every(check => check.status === 'active');

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 pt-8">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-indigo-500 to-purple-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative luxury-glass-card p-8 rounded-full luxury-shadow-xl">
              {allActive ? (
                <div className="relative">
                  <Shield className="w-24 h-24 luxury-text-gradient" strokeWidth={1.5} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-green-500 drop-shadow-lg" strokeWidth={3} />
                  </div>
                </div>
              ) : (
                <Shield className="w-24 h-24 text-yellow-500" strokeWidth={1.5} />
              )}
            </div>
          </div>

          <h1 className="luxury-heading-xl mb-3">
            ⁦Pet Wash™⁩ Shield
          </h1>
          <p className="luxury-text-body mb-2">
            Enterprise Security Status
          </p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${allActive ? 'luxury-badge-success' : 'luxury-badge-warning'}`}>
            <div className={`w-2 h-2 rounded-full ${allActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`}></div>
            <span className="text-sm font-medium">
              {allActive ? 'All Systems Operational' : 'Monitoring Active'}
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 mb-8">
          {checks.map((check, index) => (
            <Card
              key={index}
              className="luxury-glass-card luxury-shadow-lg luxury-hover-lift"
              data-testid={`security-check-${check.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    check.status === 'active' 
                      ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30' 
                      : 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30'
                  }`}>
                    <span className={check.status === 'active' ? 'text-green-500' : 'text-yellow-500'}>
                      {getCheckIcon(check.name)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="luxury-heading-sm">
                        {check.name}
                      </h3>
                      {getStatusIcon(check.status)}
                    </div>
                    <p className="luxury-text-body mb-2">
                      {check.description}
                    </p>
                    {check.lastChecked && (
                      <p className="luxury-text-small">
                        Last checked: {new Date(check.lastChecked).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="luxury-glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 luxury-text-gradient" />
              Security Features
            </CardTitle>
            <CardDescription>
              Active protection systems for ⁦Pet Wash™⁩ Ltd
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <span>WebAuthn/Passkey Authentication</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <span>SHA-256 Blockchain Ledger</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <span>Fraud Detection (7 Signals)</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <span>K9000 IoT Monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <span>Israeli Privacy Law 2025</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <span>7-Year Log Retention</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8 luxury-text-small">
          <p>⁦Pet Wash™⁩ Ltd (517145033) • Enterprise-Grade Security • ISO 27001 Compliant</p>
        </div>
      </div>
    </div>
  );
}
