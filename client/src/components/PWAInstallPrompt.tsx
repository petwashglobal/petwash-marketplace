import { useState, useEffect } from 'react';
import { X, Share, Plus, Smartphone, Sparkles, Zap, Star, Download, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  const { language } = useLanguage();
  const isHebrew = language === 'he';

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
      setTimeout(() => setShowAndroidPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!showIOSPrompt && !showAndroidPrompt) return;
    const sparkleInterval = setInterval(() => {
      setStep(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(sparkleInterval);
  }, [showIOSPrompt, showAndroidPrompt]);

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

  const features = [
    { icon: Zap, en: 'Instant Access', he: 'גישה מיידית' },
    { icon: Star, en: 'Loyalty & Rewards', he: 'נאמנות ותגמולים' },
    { icon: Smartphone, en: 'Works Offline', he: 'עובד אופליין' },
  ];

  if (showIOSPrompt) {
    return (
      <>
        <div
          className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
          style={{ animation: 'fadeInBackdrop 0.4s ease-out' }}
          onClick={handleDismiss}
        />

        <div
          className="fixed bottom-0 inset-x-0 z-[9999] p-4"
          style={{ animation: 'slideInPanel 0.5s cubic-bezier(0.32, 0.72, 0, 1)' }}
        >
          <div className="max-w-md mx-auto overflow-hidden rounded-3xl shadow-2xl bg-white">

            <div className="relative overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 30%, #3182ce 60%, #2c5282 100%)',
                }}
              />
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite',
                }}
              />
              <div className="absolute top-3 right-3 opacity-10">
                <Sparkles className="w-24 h-24 text-white" style={{ animation: 'goldPulse 3s ease-in-out infinite' }} />
              </div>
              <div className="absolute bottom-2 left-4 opacity-10">
                <Star className="w-16 h-16 text-white" style={{ animation: 'goldPulse 3s ease-in-out infinite 1s' }} />
              </div>

              <div className="relative px-6 pt-6 pb-5">
                <button onClick={handleDismiss} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>

                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-lg p-1.5 flex items-center justify-center" style={{ animation: 'scaleIn 0.5s ease-out 0.3s both' }}>
                      <img
                        src="/brand/petwash-logo-official.png"
                        alt="Pet Wash™"
                        className="w-full h-full rounded-xl object-contain"
                      />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white flex items-center justify-center" style={{ animation: 'scaleIn 0.4s ease-out 0.6s both' }}>
                      <Download className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div style={{ animation: 'fadeUp 0.5s ease-out 0.4s both' }}>
                    <h2 className="text-xl font-bold text-white">
                      {isHebrew ? 'התקינו את ⁦Pet Wash™⁩' : 'Get ⁦Pet Wash™⁩ App'}
                    </h2>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {isHebrew ? 'חוויית מובייל מושלמת' : 'Premium Mobile Experience'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2" style={{ animation: 'fadeUp 0.5s ease-out 0.6s both' }}>
                  {features.map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-white/10 backdrop-blur rounded-xl px-2 py-2.5 text-center border border-white/10"
                        style={{ animation: `fadeUp 0.4s ease-out ${0.7 + i * 0.1}s both` }}
                      >
                        <Icon className="w-4 h-4 text-white/80 mx-auto mb-1" />
                        <span className="text-[10px] font-medium text-white/90 block leading-tight">
                          {isHebrew ? f.he : f.en}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                {isHebrew ? 'בשני צעדים פשוטים:' : 'Two Simple Steps:'}
              </h3>

              <div className="space-y-3">
                <div
                  className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-500 ${
                    step === 0 ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    step === 0 ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-gray-200'
                  }`}>
                    <span className={`text-sm font-bold ${step === 0 ? 'text-white' : 'text-gray-500'}`}>1</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {isHebrew ? 'לחצו על' : 'Tap the'}
                      </span>
                      <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                        <Share className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{isHebrew ? 'שיתוף' : 'Share'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isHebrew ? 'בתחתית המסך בספארי' : 'At the bottom of Safari'}
                    </p>
                  </div>
                  {step === 0 && (
                    <ChevronDown className="w-5 h-5 text-blue-500" style={{ animation: 'floatUp 1.5s ease-in-out infinite' }} />
                  )}
                </div>

                <div
                  className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-500 ${
                    step === 1 ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    step === 1 ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-gray-200'
                  }`}>
                    <span className={`text-sm font-bold ${step === 1 ? 'text-white' : 'text-gray-500'}`}>2</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {isHebrew ? 'לחצו' : 'Tap'}
                      </span>
                      <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{isHebrew ? 'הוסף למסך הבית' : 'Add to Home Screen'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isHebrew ? 'מהתפריט שנפתח' : 'From the menu that appears'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      step === i ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="px-6 pb-5 bg-white">
              <button
                onClick={handleDismiss}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-2"
              >
                {isHebrew ? 'לא עכשיו' : 'Not now'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (showAndroidPrompt) {
    return (
      <>
        <div
          className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
          style={{ animation: 'fadeInBackdrop 0.4s ease-out' }}
          onClick={handleDismiss}
        />

        <div
          className="fixed bottom-0 inset-x-0 z-[9999] p-4"
          style={{ animation: 'slideInPanel 0.5s cubic-bezier(0.32, 0.72, 0, 1)' }}
        >
          <div className="max-w-md mx-auto overflow-hidden rounded-3xl shadow-2xl bg-white">

            <div className="relative overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 30%, #3182ce 60%, #2c5282 100%)',
                }}
              />
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite',
                }}
              />
              <div className="absolute top-3 right-3 opacity-10">
                <Sparkles className="w-24 h-24 text-white" style={{ animation: 'goldPulse 3s ease-in-out infinite' }} />
              </div>

              <div className="relative px-6 pt-6 pb-5">
                <button onClick={handleDismiss} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>

                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-lg p-1.5 flex items-center justify-center" style={{ animation: 'scaleIn 0.5s ease-out 0.3s both' }}>
                      <img
                        src="/brand/petwash-logo-official.png"
                        alt="Pet Wash™"
                        className="w-full h-full rounded-xl object-contain"
                      />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white flex items-center justify-center" style={{ animation: 'scaleIn 0.4s ease-out 0.6s both' }}>
                      <Download className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div style={{ animation: 'fadeUp 0.5s ease-out 0.4s both' }}>
                    <h2 className="text-xl font-bold text-white">
                      {isHebrew ? 'התקינו את ⁦Pet Wash™⁩' : 'Install ⁦Pet Wash™⁩'}
                    </h2>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {isHebrew ? 'גישה מהירה ממסך הבית' : 'Quick access from your home screen'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2" style={{ animation: 'fadeUp 0.5s ease-out 0.6s both' }}>
                  {features.map((f, i) => {
                    const Icon = f.icon;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-white/10 backdrop-blur rounded-xl px-2 py-2.5 text-center border border-white/10"
                        style={{ animation: `fadeUp 0.4s ease-out ${0.7 + i * 0.1}s both` }}
                      >
                        <Icon className="w-4 h-4 text-white/80 mx-auto mb-1" />
                        <span className="text-[10px] font-medium text-white/90 block leading-tight">
                          {isHebrew ? f.he : f.en}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
              <div className="flex gap-3">
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-3.5 text-sm text-gray-600 font-semibold rounded-2xl border-2 border-gray-200 bg-white hover:bg-gray-50 transition-all"
                >
                  {isHebrew ? 'לא עכשיו' : 'Not Now'}
                </button>
                <button
                  onClick={handleAndroidInstall}
                  className="flex-1 py-3.5 text-sm text-white font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isHebrew ? 'התקנה' : 'Install'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
