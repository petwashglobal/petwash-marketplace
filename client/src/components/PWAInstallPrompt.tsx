import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from 'react';
import { X, Share, Plus, Smartphone, Sparkles, Zap, Star, Download, ChevronDown, Chrome, Globe, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PromptType = 'ios-safari' | 'ios-chrome' | 'ios-inapp' | 'android-native' | 'android-manual' | 'desktop' | null;

function detectPlatform(): { promptType: PromptType; browserName: string } {
  const ua = navigator.userAgent;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;

  if (isStandalone) return { promptType: null, browserName: '' };

  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|WhatsApp|TikTok|Telegram/i.test(ua);

  if (isIOS) {
    if (isInAppBrowser) return { promptType: 'ios-inapp', browserName: 'Safari' };
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome/.test(ua);
    if (isSafari) return { promptType: 'ios-safari', browserName: 'Safari' };
    if (/CriOS/.test(ua)) return { promptType: 'ios-chrome', browserName: 'Chrome' };
    if (/FxiOS/.test(ua)) return { promptType: 'ios-chrome', browserName: 'Firefox' };
    if (/EdgiOS/.test(ua)) return { promptType: 'ios-chrome', browserName: 'Edge' };
    return { promptType: 'ios-chrome', browserName: ua.match(/Safari/) ? 'Safari' : 'browser' };
  }

  if (isAndroid) {
    if (isInAppBrowser) return { promptType: 'android-manual', browserName: 'Chrome' };
    return { promptType: 'android-native', browserName: 'Chrome' };
  }

  return { promptType: 'desktop', browserName: '' };
}

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<{ promptType: PromptType; browserName: string }>({ promptType: null, browserName: '' });
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

    const detected = detectPlatform();
    setPlatform(detected);

    if (!detected.promptType) return;

    if (detected.promptType === 'android-native') {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setTimeout(() => setShowPrompt(true), 2000);
      };
      window.addEventListener('beforeinstallprompt', handler);

      const fallbackTimer = setTimeout(() => {
        if (!deferredPrompt) {
          setPlatform({ promptType: 'android-manual', browserName: 'Chrome' });
          setShowPrompt(true);
        }
      }, 5000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(fallbackTimer);
      };
    }

    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showPrompt) return;
    const sparkleInterval = setInterval(() => {
      setStep(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(sparkleInterval);
  }, [showPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  const handleNativeInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  if (dismissed || !showPrompt || !platform.promptType) return null;

  const features = [
    { icon: Zap, en: 'Instant Access', he: 'גישה מיידית' },
    { icon: Star, en: 'Loyalty & Rewards', he: 'נאמנות ותגמולים' },
    { icon: Smartphone, en: 'Works Offline', he: 'עובד אופליין' },
  ];

  const renderHeader = () => (
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
        <Button onClick={handleDismiss} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
          <X className="w-4 h-4 text-white" />
        </Button>

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
  );

  const renderStepIndicator = () => (
    <div className="mt-5 flex items-center justify-center gap-1.5">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            step === i ? 'w-6 bg-blue-600' : 'w-1.5 bg-white'
          }`}
        />
      ))}
    </div>
  );

  const renderIOSSafariSteps = () => (
    <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        {isHebrew ? 'בשני צעדים פשוטים:' : 'Two Simple Steps:'}
      </h3>

      <div className="space-y-3">
        <div className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-500 ${
          step === 0 ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-gray-100 bg-white'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
            step === 0 ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-white'
          }`}>
            <span className={`text-sm font-bold ${step === 0 ? 'text-white' : 'text-gray-500'}`}>1</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                {isHebrew ? 'לחצו על' : 'Tap the'}
              </span>
              <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                <Share className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-bold">{isHebrew ? 'שיתוף' : 'Share'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isHebrew ? 'בתחתית המסך בספארי' : 'At the bottom of Safari'}
            </p>
          </div>
          {step === 0 && (
            <ChevronDown className="w-5 h-5 text-blue-500 flex-shrink-0" style={{ animation: 'floatUp 1.5s ease-in-out infinite' }} />
          )}
        </div>

        <div className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-500 ${
          step === 1 ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-gray-100 bg-white'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
            step === 1 ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-white'
          }`}>
            <span className={`text-sm font-bold ${step === 1 ? 'text-white' : 'text-gray-500'}`}>2</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                {isHebrew ? 'לחצו' : 'Tap'}
              </span>
              <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-bold">{isHebrew ? 'הוסף למסך הבית' : 'Add to Home Screen'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isHebrew ? 'מהתפריט שנפתח' : 'From the menu that appears'}
            </p>
          </div>
        </div>
      </div>

      {renderStepIndicator()}
    </div>
  );

  const renderIOSChromeMessage = () => (
    <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
      <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">
              {isHebrew ? `פתחו ב-Safari להתקנה` : `Open in Safari to install`}
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              {isHebrew
                ? `${platform.browserName} לא תומך בהתקנה ישירה. פתחו את הקישור ב-Safari כדי להוסיף את ⁦Pet Wash™⁩ למסך הבית שלכם.`
                : `${platform.browserName} doesn't support direct install on iPhone. Open this link in Safari to add ⁦Pet Wash™⁩ to your home screen.`
              }
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={() => {
          const currentUrl = window.location.href;
          window.open(`x-web-search://?${currentUrl}`, '_blank');
          handleDismiss();
        }}
        className="w-full py-3.5 text-sm text-white font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
      >
        <ExternalLink className="w-4 h-4" />
        {isHebrew ? 'העתיקו קישור' : 'Copy Link'}
      </Button>
    </div>
  );

  const renderInAppMessage = () => (
    <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <ExternalLink className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">
              {isHebrew ? 'פתחו בדפדפן' : 'Open in Browser'}
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              {isHebrew
                ? 'כדי להתקין את האפליקציה, לחצו על ⋯ למעלה ובחרו "פתח בדפדפן" או "פתח ב-Safari".'
                : 'To install the app, tap ⋯ at the top and choose "Open in Browser" or "Open in Safari".'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAndroidNativeButtons = () => (
    <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
      <div className="flex gap-3">
        <Button
          onClick={handleDismiss}
          className="flex-1 py-3.5 text-sm text-gray-600 font-semibold rounded-2xl border-2 border-gray-200 bg-white hover:bg-white transition-all"
        >
          {isHebrew ? 'לא עכשיו' : 'Not Now'}
        </Button>
        <Button
          onClick={handleNativeInstall}
          className="flex-1 py-3.5 text-sm text-white font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          {isHebrew ? 'התקנה' : 'Install'}
        </Button>
      </div>
    </div>
  );

  const renderAndroidManualSteps = () => (
    <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        {isHebrew ? 'בשני צעדים פשוטים:' : 'Two Simple Steps:'}
      </h3>

      <div className="space-y-3">
        <div className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-500 ${
          step === 0 ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-gray-100 bg-white'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
            step === 0 ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-white'
          }`}>
            <span className={`text-sm font-bold ${step === 0 ? 'text-white' : 'text-gray-500'}`}>1</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                {isHebrew ? 'לחצו על' : 'Tap the'}
              </span>
              <div className="inline-flex items-center gap-1 bg-white text-gray-700 px-2 py-0.5 rounded-md">
                <span className="text-base font-bold">⋮</span>
                <span className="text-xs font-bold">{isHebrew ? 'תפריט' : 'Menu'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isHebrew ? 'שלוש הנקודות למעלה' : 'Three dots at the top'}
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all duration-500 ${
          step === 1 ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : 'border-gray-100 bg-white'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
            step === 1 ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-white'
          }`}>
            <span className={`text-sm font-bold ${step === 1 ? 'text-white' : 'text-gray-500'}`}>2</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                {isHebrew ? 'בחרו' : 'Select'}
              </span>
              <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-bold">{isHebrew ? 'הוסף למסך הבית' : 'Add to Home Screen'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {isHebrew ? 'מהתפריט שנפתח' : 'From the menu that appears'}
            </p>
          </div>
        </div>
      </div>

      {renderStepIndicator()}
    </div>
  );

  const renderDesktopSteps = () => (
    <div className="px-6 py-5 bg-white" style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}>
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">
              {isHebrew ? 'התקינו כאפליקציה' : 'Install as App'}
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              {isHebrew
                ? 'חפשו את האייקון ⊕ בשורת הכתובת של הדפדפן, או לחצו על ⋮ תפריט ← "התקן אפליקציה".'
                : 'Look for the ⊕ icon in your browser\'s address bar, or click ⋮ Menu → "Install app".'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBody = () => {
    switch (platform.promptType) {
      case 'ios-safari': return renderIOSSafariSteps();
      case 'ios-chrome': return renderIOSChromeMessage();
      case 'ios-inapp': return renderInAppMessage();
      case 'android-native': return deferredPrompt ? renderAndroidNativeButtons() : renderAndroidManualSteps();
      case 'android-manual': return renderAndroidManualSteps();
      case 'desktop': return renderDesktopSteps();
      default: return null;
    }
  };

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
          {renderHeader()}
          {renderBody()}

          <div className="px-6 pb-5 bg-white">
            <Button
              onClick={handleDismiss}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-2"
            >
              {isHebrew ? 'לא עכשיו' : 'Not now'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
