import { useState } from "react";
import { auth, db } from "../lib/firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { type Language } from "@/lib/i18n";

interface FirebaseDebugProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function FirebaseDebug({ language, onLanguageChange }: FirebaseDebugProps) {
  const [results, setResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("Test123456!");

  const addResult = (test: string, status: 'success' | 'error' | 'info', message: string, details?: any) => {
    setResults(prev => [...prev, { test, status, message, details, timestamp: new Date().toISOString() }]);
  };

  const runDiagnostics = async () => {
    setResults([]);
    setTesting(true);

    try {
      // Test 1: Firebase Config
      addResult('Firebase Config', 'info', 'Checking configuration...', {
        authDomain: auth.app.options.authDomain,
        apiKey: auth.app.options.apiKey?.substring(0, 20) + '...',
        projectId: auth.app.options.projectId,
      });

      // Test 2: Network Connectivity
      addResult('Network Test', 'info', 'Testing Google APIs connectivity...');
      try {
        const response = await fetch('https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: 'test' })
        });
        addResult('Network Test', response.ok ? 'success' : 'error', 
          `Google Identity API reachable (Status: ${response.status})`);
      } catch (error: any) {
        addResult('Network Test', 'error', 'Cannot reach Google Identity API', { 
          error: error.message,
          type: error.name 
        });
      }

      // Test 3: Current Origin
      const currentOrigin = window.location.origin;
      addResult('Current Origin', 'info', `Running from: ${currentOrigin}`, {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port
      });

      // Test 4: HTTPS Check
      const isHttps = window.location.protocol === 'https:';
      addResult('HTTPS Check', isHttps ? 'success' : 'error', 
        isHttps ? 'Using HTTPS ✓' : 'WARNING: Using HTTP - Firebase Auth requires HTTPS');

      // Test 5: Firestore Connection
      addResult('Firestore Test', 'info', 'Testing Firestore connectivity...');
      try {
        const testQuery = query(collection(db, 'users'), limit(1));
        await getDocs(testQuery);
        addResult('Firestore Test', 'success', 'Firestore connection successful');
      } catch (error: any) {
        addResult('Firestore Test', 'error', 'Firestore connection failed', {
          code: error.code,
          message: error.message
        });
      }

      // Test 6: Email/Password Auth
      if (email && password) {
        addResult('Auth Test', 'info', 'Testing email/password authentication...');
        try {
          await signInWithEmailAndPassword(auth, email, password);
          addResult('Auth Test', 'success', 'Email/password login successful!');
        } catch (error: any) {
          addResult('Auth Test', 'error', 'Email/password login failed', {
            code: error.code,
            message: error.message,
            stack: error.stack?.substring(0, 200)
          });
        }
      }

      // Test 7: App Check Status
      addResult('App Check', 'info', 'Checking App Check configuration...', {
        recaptchaKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY ? 'Configured' : 'Not configured'
      });

    } catch (error: any) {
      addResult('System Error', 'error', 'Diagnostic failed', {
        message: error.message,
        stack: error.stack
      });
    } finally {
      setTesting(false);
    }
  };

  const testGoogleLogin = async () => {
    setResults([]);
    setTesting(true);
    
    try {
      addResult('Google Login', 'info', 'Initiating Google Sign-In popup...');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      addResult('Google Login', 'success', 'Google login successful!', {
        email: result.user.email,
        uid: result.user.uid,
        providerId: result.providerId
      });
    } catch (error: any) {
      addResult('Google Login', 'error', 'Google login failed', {
        code: error.code,
        message: error.message,
        customData: error.customData
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header language={language} onLanguageChange={onLanguageChange || (() => {})} />
      
      <main className="container mx-auto px-4 py-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Firebase Auth Diagnostics</CardTitle>
            <CardDescription className="text-zinc-400">
              Test Firebase Authentication connectivity and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Test Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="test@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Test Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Password123!"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={runDiagnostics} 
                disabled={testing}
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Run Full Diagnostics
              </Button>
              <Button 
                onClick={testGoogleLogin} 
                disabled={testing}
                variant="outline"
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Test Google Login
              </Button>
            </div>

            {results.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-semibold text-white">Test Results:</h3>
                {results.map((result, idx) => (
                  <Alert key={idx} className={`border-zinc-700 ${
                    result.status === 'success' ? 'bg-green-950/20' :
                    result.status === 'error' ? 'bg-red-950/20' :
                    'bg-yellow-950/20'
                  }`}>
                    <div className="flex items-start gap-3">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="font-semibold text-white">{result.test}</div>
                        <AlertDescription className="text-zinc-300">
                          {result.message}
                        </AlertDescription>
                        {result.details && (
                          <pre className="mt-2 text-xs bg-zinc-800 p-2 rounded overflow-x-auto text-zinc-400">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                        <div className="text-xs text-zinc-500 mt-1">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            )}

            <Alert className="bg-blue-950/20 border-blue-900">
              <AlertDescription className="text-blue-200">
                <strong>Quick Fix Checklist:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Verify authorized domains in Firebase Console</li>
                  <li>Check App Check settings (reCAPTCHA v3)</li>
                  <li>Ensure HTTPS is enabled (automatic on Replit)</li>
                  <li>Check browser console for CORS errors</li>
                  <li>Verify API key and project ID match Firebase Console</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>

      <Footer language={language} />
    </div>
  );
}
