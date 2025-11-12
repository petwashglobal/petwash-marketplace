import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface HealthCheckResult {
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
}

interface FirebaseConfig {
  recaptchaSiteKey: string;
  appCheckSiteKey: string;
  appCheckEnabled: boolean;
  authDomain: string;
  projectId: string;
  environment: string;
}

export default function AuthHealthCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [healthResults, setHealthResults] = useState<HealthCheckResult[]>([]);
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(null);

  const runHealthCheck = async () => {
    setIsChecking(true);
    const results: HealthCheckResult[] = [];
    const timestamp = new Date().toISOString();

    try {
      // 1. Check Firebase Config
      try {
        const config = (window as any).__PW_FIREBASE_CONFIG__;
        if (config) {
          setFirebaseConfig(config);
          results.push({
            status: 'success',
            message: 'Firebase Configuration Loaded',
            details: config,
            timestamp
          });
        } else {
          results.push({
            status: 'warning',
            message: 'Firebase Configuration Not Found',
            details: 'window.__PW_FIREBASE_CONFIG__ is undefined',
            timestamp
          });
        }
      } catch (error) {
        results.push({
          status: 'error',
          message: 'Firebase Config Check Failed',
          details: error,
          timestamp
        });
      }

      // 2. Check Auth Health Endpoint
      try {
        const healthResponse = await fetch('/api/auth/health', {
          method: 'GET',
          credentials: 'include'
        });

        if (healthResponse.ok) {
          const healthData = await healthResponse.text();
          results.push({
            status: 'success',
            message: 'Auth Health Endpoint OK',
            details: healthData,
            timestamp
          });
        } else {
          results.push({
            status: 'error',
            message: `Auth Health Endpoint Failed (${healthResponse.status})`,
            details: await healthResponse.text(),
            timestamp
          });
        }
      } catch (error) {
        results.push({
          status: 'error',
          message: 'Auth Health Endpoint Unreachable',
          details: error,
          timestamp
        });
      }

      // 3. Check Current User Session
      try {
        const meResponse = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include'
        });

        if (meResponse.ok) {
          const meData = await meResponse.json();
          if (meData.ok && meData.user) {
            results.push({
              status: 'success',
              message: 'Session Valid - User Authenticated',
              details: {
                email: meData.user.email,
                role: meData.user.role,
                isActive: meData.user.isActive
              },
              timestamp
            });
          } else {
            results.push({
              status: 'warning',
              message: 'Session Check: No Active User',
              details: meData,
              timestamp
            });
          }
        } else {
          results.push({
            status: 'error',
            message: `Session Check Failed (${meResponse.status})`,
            details: await meResponse.text(),
            timestamp
          });
        }
      } catch (error) {
        results.push({
          status: 'error',
          message: 'Session Check Unreachable',
          details: error,
          timestamp
        });
      }

      // 4. Check Session Cookie
      try {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const pwSessionCookie = cookies.find(c => c.startsWith('pw_session='));
        
        if (pwSessionCookie) {
          results.push({
            status: 'success',
            message: 'Session Cookie Present',
            details: 'pw_session cookie is set',
            timestamp
          });
        } else {
          results.push({
            status: 'warning',
            message: 'Session Cookie Not Found',
            details: 'pw_session cookie is missing (may be httpOnly)',
            timestamp
          });
        }
      } catch (error) {
        results.push({
          status: 'error',
          message: 'Cookie Check Failed',
          details: error,
          timestamp
        });
      }

      // 5. Check WebAuthn Support
      try {
        const webAuthnSupported = window.PublicKeyCredential !== undefined;
        
        if (webAuthnSupported) {
          results.push({
            status: 'success',
            message: 'WebAuthn/Passkey Supported',
            details: 'Browser supports biometric authentication',
            timestamp
          });
        } else {
          results.push({
            status: 'warning',
            message: 'WebAuthn Not Supported',
            details: 'Browser does not support passkeys',
            timestamp
          });
        }
      } catch (error) {
        results.push({
          status: 'error',
          message: 'WebAuthn Check Failed',
          details: error,
          timestamp
        });
      }

    } catch (error) {
      results.push({
        status: 'error',
        message: 'Health Check Failed',
        details: error,
        timestamp
      });
    }

    setHealthResults(results);
    setIsChecking(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-300">OK</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Error</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Warning</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Health Check Card */}
      <Card className="border-2 border-emerald-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                Authentication Health Check
              </CardTitle>
              <CardDescription>
                Test Firebase Auth, Session Cookies, and Configuration
              </CardDescription>
            </div>
            <Button
              onClick={runHealthCheck}
              disabled={isChecking}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Check
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {healthResults.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {healthResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{result.message}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    {result.details && (
                      <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                        {typeof result.details === 'string'
                          ? result.details
                          : JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(result.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}

        {healthResults.length === 0 && (
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium">No health check run yet</p>
              <p className="text-sm">Click "Run Check" to test authentication system</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Firebase Config Viewer */}
      {firebaseConfig && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Live Firebase Configuration
            </CardTitle>
            <CardDescription>
              Runtime configuration loaded from window.__PW_FIREBASE_CONFIG__
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-600">reCAPTCHA Site Key:</span>
                  <Badge variant={firebaseConfig.recaptchaSiteKey.includes('✅') ? 'default' : 'destructive'}>
                    {firebaseConfig.recaptchaSiteKey}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-600">App Check Site Key:</span>
                  <Badge variant="outline">
                    {firebaseConfig.appCheckSiteKey}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-600">App Check Enabled:</span>
                  <Badge variant={firebaseConfig.appCheckEnabled ? 'default' : 'outline'}>
                    {firebaseConfig.appCheckEnabled ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-600">Auth Domain:</span>
                  <span className="text-sm text-gray-900 font-mono">{firebaseConfig.authDomain}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-600">Project ID:</span>
                  <span className="text-sm text-gray-900 font-mono">{firebaseConfig.projectId}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-600">Environment:</span>
                  <Badge variant={firebaseConfig.environment === 'production' ? 'default' : 'outline'}>
                    {firebaseConfig.environment}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> This configuration is loaded at runtime from the Firebase initialization.
                Changes to environment variables require a server restart.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
