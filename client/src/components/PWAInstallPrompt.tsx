import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        setDismissed(true);
        return;
      }
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    if (isStandalone) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isIOS && isSafari) {
      const timer = setTimeout(() => setShowIOSPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleDismiss = () => {
    setShowIOSPrompt(false);
    setShowAndroidPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowAndroidPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (dismissed || (!showIOSPrompt && !showAndroidPrompt)) return null;

  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 animate-in slide-in-from-bottom duration-500">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md mx-auto overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-900">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-sm">Install Pet Wash™ App</span>
            </div>
            <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-white p-5">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/brand/petwash-logo-official.png"
                alt="Pet Wash™"
                className="w-14 h-14 rounded-xl shadow-sm border border-gray-100"
              />
              <div>
                <h3 className="font-bold text-gray-900 text-base">Pet Wash™</h3>
                <p className="text-xs text-gray-500">Premium Pet Care</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white border border-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-600">1</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-700">
                  <span>Tap</span>
                  <Share className="w-4 h-4 text-blue-600 mx-0.5" />
                  <span className="font-medium">Share</span>
                  <span>at the bottom</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white border border-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-600">2</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-700">
                  <span>Tap</span>
                  <PlusSquare className="w-4 h-4 text-blue-600 mx-0.5" />
                  <span className="font-medium">Add to Home Screen</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showAndroidPrompt) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 animate-in slide-in-from-bottom duration-500">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md mx-auto overflow-hidden">
          <div className="bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/brand/petwash-logo-official.png"
                  alt="Pet Wash™"
                  className="w-12 h-12 rounded-xl shadow-sm border border-gray-100"
                />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Install Pet Wash™</h3>
                  <p className="text-xs text-gray-500">Fast access from your home screen</p>
                </div>
              </div>
              <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 text-sm text-gray-600 font-medium rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                Not Now
              </button>
              <button
                onClick={handleAndroidInstall}
                className="flex-1 py-2.5 text-sm text-white font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
