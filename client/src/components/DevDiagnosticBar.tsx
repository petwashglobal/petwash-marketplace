import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface DiagnosticData {
  firebaseConfig: {
    authDomain: string;
    apiKey: string;
    projectId: string;
  };
  currentDomain: string;
  protocol: string;
  authStatus: 'authenticated' | 'unauthenticated' | 'loading';
  lastAuthError: string | null;
  lastAuthErrorCode: string | null;
  timestamp: string;
}

export function DevDiagnosticBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticData>({
    firebaseConfig: {
      authDomain: auth.app.options.authDomain || 'unknown',
      apiKey: (auth.app.options.apiKey || 'unknown').substring(0, 20) + '...',
      projectId: auth.app.options.projectId || 'unknown'
    },
    currentDomain: window.location.hostname,
    protocol: window.location.protocol,
    authStatus: 'loading',
    lastAuthError: null,
    lastAuthErrorCode: null,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setDiagnostics(prev => ({
        ...prev,
        authStatus: user ? 'authenticated' : 'unauthenticated',
        timestamp: new Date().toISOString()
      }));
    });

    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorString = args.join(' ');
      if (errorString.includes('Firebase') || errorString.includes('auth/')) {
        const errorCodeMatch = errorString.match(/auth\/([a-z-]+)/);
        setDiagnostics(prev => ({
          ...prev,
          lastAuthError: errorString,
          lastAuthErrorCode: errorCodeMatch ? errorCodeMatch[0] : null,
          timestamp: new Date().toISOString()
        }));
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      unsubscribe();
      console.error = originalConsoleError;
    };
  }, []);

  if (!import.meta.env.DEV) {
    return null;
  }

  const getStatusIcon = () => {
    if (diagnostics.authStatus === 'authenticated') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (diagnostics.lastAuthError) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (diagnostics.authStatus === 'authenticated') return 'bg-green-500/20 border-green-500/50';
    if (diagnostics.lastAuthError) return 'bg-red-500/20 border-red-500/50';
    return 'bg-yellow-500/20 border-yellow-500/50';
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[9999] border-t ${getStatusColor()} backdrop-blur-md`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs font-mono text-white hover:bg-black/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-semibold">🔧 DEV DIAGNOSTICS</span>
          <span className="text-gray-300">|</span>
          <span>Auth: {diagnostics.authStatus}</span>
          <span className="text-gray-300">|</span>
          <span>Domain: {diagnostics.currentDomain}</span>
          <span className="text-gray-300">|</span>
          <span>Protocol: {diagnostics.protocol}</span>
          {diagnostics.lastAuthErrorCode && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-red-400">Error: {diagnostics.lastAuthErrorCode}</span>
            </>
          )}
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-black/40 text-xs font-mono text-white border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-yellow-400">🔥 Firebase Config</h4>
              <div className="space-y-1">
                <div><span className="text-gray-400">Auth Domain:</span> {diagnostics.firebaseConfig.authDomain}</div>
                <div><span className="text-gray-400">API Key:</span> {diagnostics.firebaseConfig.apiKey}</div>
                <div><span className="text-gray-400">Project ID:</span> {diagnostics.firebaseConfig.projectId}</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-blue-400">🌐 Current Environment</h4>
              <div className="space-y-1">
                <div><span className="text-gray-400">Hostname:</span> {diagnostics.currentDomain}</div>
                <div><span className="text-gray-400">Protocol:</span> {diagnostics.protocol}</div>
                <div><span className="text-gray-400">Auth State:</span> {diagnostics.authStatus}</div>
                <div><span className="text-gray-400">Last Check:</span> {new Date(diagnostics.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>

            {diagnostics.lastAuthError && (
              <div className="md:col-span-2">
                <h4 className="font-semibold mb-2 text-red-400">❌ Last Auth Error</h4>
                <div className="bg-red-950/50 border border-red-800 rounded p-2 overflow-x-auto">
                  <pre className="text-red-200 text-xs whitespace-pre-wrap">
                    {diagnostics.lastAuthError}
                  </pre>
                </div>
              </div>
            )}

            <div className="md:col-span-2 pt-2 border-t border-white/10">
              <div className="flex gap-2 text-xs">
                <span className="text-gray-400">Quick Actions:</span>
                <a href="/firebase-debug" className="text-blue-400 hover:underline">Full Diagnostics</a>
                <span className="text-gray-400">|</span>
                <button 
                  onClick={() => window.location.reload()} 
                  className="text-blue-400 hover:underline"
                >
                  Reload Page
                </button>
                <span className="text-gray-400">|</span>
                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }} 
                  className="text-red-400 hover:underline"
                >
                  Clear Storage & Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
