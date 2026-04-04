import { useState, useEffect, useRef } from 'react';
import { useQrMachineActivation } from '@/hooks/useQrMachineActivation';
import { parseQrString } from '@/lib/qrActivationApi';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import {
  QrCode,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Waves,
  Clock,
  CreditCard,
} from 'lucide-react';

function formatILS(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Step = 'scan' | 'ready' | 'running' | 'done' | 'error';

export default function QrActivatePage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'he' || i18n.language === 'ar';

  const {
    activationState,
    machineName,
    priceCents,
    currency,
    estimatedSeconds,
    startedAt,
    error,
    activate,
    start,
    complete,
    reset,
    canStart,
    isRunning,
    isCompleted,
  } = useQrMachineActivation();

  const [rawQr, setRawQr] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step: Step = isCompleted
    ? 'done'
    : isRunning
    ? 'running'
    : activationState === 'FAILED'
    ? 'error'
    : canStart
    ? 'ready'
    : 'scan';

  useEffect(() => {
    if (isRunning && startedAt) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, startedAt]);

  const isLoading =
    activationState === 'VERIFYING' ||
    activationState === 'ACTIVATING';

  async function handleActivate() {
    if (!rawQr.trim()) return;
    try {
      const payload = parseQrString(rawQr);
      await activate(payload);
    } catch (e: any) {
      alert(e?.message || 'Invalid QR');
    }
  }

  const remaining = estimatedSeconds ? Math.max(0, estimatedSeconds - elapsed) : null;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#C5A55A]/10 mb-4">
            <Waves className="w-8 h-8 text-[#C5A55A]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isRtl ? 'הפעלת עמדת שטיפה' : 'Start Wash Session'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isRtl
              ? 'סרוק את קוד ה-QR שעל המכשיר כדי להתחיל'
              : 'Scan the QR code on the machine to begin'}
          </p>
        </div>

        {/* Step: SCAN */}
        {step === 'scan' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="w-4 h-4 text-[#C5A55A]" />
                <span className="text-sm font-medium text-gray-700">
                  {isRtl ? 'הדבק נתוני QR' : 'Paste QR data'}
                </span>
              </div>
              <textarea
                value={rawQr}
                onChange={e => setRawQr(e.target.value)}
                placeholder={isRtl ? '{ "machineId": "K9000-IL-001", ... }' : '{ "machineId": "K9000-IL-001", ... }'}
                rows={5}
                className="w-full rounded-xl border border-gray-200 p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#C5A55A]/40 text-gray-800 bg-white"
              />
            </div>

            <Button
              onClick={handleActivate}
              disabled={isLoading || !rawQr.trim()}
              className="w-full h-12 bg-[#C5A55A] hover:bg-[#b0943d] text-white font-semibold rounded-xl text-base"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isRtl ? 'מאמת...' : 'Verifying...'}</>
              ) : (
                <><QrCode className="w-4 h-4 mr-2" />
                  {isRtl ? 'אמת קוד QR' : 'Verify QR Code'}</>
              )}
            </Button>
          </div>
        )}

        {/* Step: READY */}
        {step === 'ready' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#C5A55A]/30 bg-[#C5A55A]/5 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#C5A55A] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {machineName || (isRtl ? 'עמדה מאומתת' : 'Station verified')}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {isRtl ? 'המכשיר מוכן לשימוש' : 'Machine is ready for use'}
                  </p>
                </div>
              </div>
              {priceCents !== null && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#C5A55A]/20">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {isRtl ? 'לחיוב:' : 'Amount charged:'}
                  </span>
                  <span className="font-bold text-gray-900">{formatILS(priceCents)}</span>
                </div>
              )}
            </div>

            <Button
              onClick={start}
              disabled={isLoading}
              className="w-full h-12 bg-[#C5A55A] hover:bg-[#b0943d] text-white font-semibold rounded-xl text-base"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isRtl ? 'מפעיל...' : 'Starting...'}</>
              ) : (
                <><Play className="w-4 h-4 mr-2" />
                  {isRtl ? 'התחל שטיפה' : 'Start Wash'}</>
              )}
            </Button>

            <button
              onClick={reset}
              className="w-full text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              {isRtl ? 'סרוק מחדש' : 'Scan again'}
            </button>
          </div>
        )}

        {/* Step: RUNNING */}
        {step === 'running' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <Waves className="w-8 h-8 text-blue-500 animate-pulse" />
              </div>
              <p className="font-bold text-gray-900 text-lg">
                {isRtl ? 'השטיפה פעילה' : 'Wash in progress'}
              </p>
              {machineName && (
                <p className="text-sm text-gray-500 mt-1">{machineName}</p>
              )}
              {remaining !== null && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-xl font-bold text-blue-600">
                    {formatSeconds(remaining)}
                  </span>
                  <span className="text-sm text-gray-400">
                    {isRtl ? 'נותרו' : 'remaining'}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={complete}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-base"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isRtl ? 'סיום שטיפה' : 'Complete Wash'}
            </Button>
          </div>
        )}

        {/* Step: DONE */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-green-100 bg-green-50 p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="font-bold text-gray-900 text-lg">
                {isRtl ? 'השטיפה הושלמה!' : 'Wash complete!'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isRtl ? 'הכלב שלך נקי ורענן' : 'Your dog is clean and fresh'}
              </p>
              {priceCents !== null && (
                <p className="text-sm font-semibold text-gray-700 mt-3">
                  {isRtl ? `סה"כ חויב: ${formatILS(priceCents)}` : `Total charged: ${formatILS(priceCents)}`}
                </p>
              )}
            </div>
            <Button
              onClick={reset}
              variant="outline"
              className="w-full h-12 border-gray-200 text-gray-700 font-semibold rounded-xl text-base"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isRtl ? 'שטיפה נוספת' : 'Start another wash'}
            </Button>
          </div>
        )}

        {/* Step: ERROR */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">
                    {isRtl ? 'אירעה שגיאה' : 'Something went wrong'}
                  </p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
            <Button
              onClick={reset}
              className="w-full h-12 bg-[#C5A55A] hover:bg-[#b0943d] text-white font-semibold rounded-xl text-base"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isRtl ? 'נסה שוב' : 'Try again'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
