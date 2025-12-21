/**
 * PIN Keypad Component - December 2025 Edition
 * Modern, accessible numeric keypad for PIN entry
 * Follows Apple/Google design standards
 */

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Delete, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinKeypadProps {
  pinLength?: 4 | 5 | 6;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  error?: string;
  loading?: boolean;
  showPin?: boolean;
  className?: string;
  language?: 'en' | 'he';
}

const translations = {
  en: {
    enterPin: 'Enter PIN',
    createPin: 'Create PIN',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    showPin: 'Show PIN',
    hidePin: 'Hide PIN',
  },
  he: {
    enterPin: 'הזן קוד PIN',
    createPin: 'צור קוד PIN',
    cancel: 'ביטול',
    delete: 'מחק',
    confirm: 'אישור',
    showPin: 'הצג PIN',
    hidePin: 'הסתר PIN',
  },
};

export function PinKeypad({
  pinLength = 6,
  onComplete,
  onCancel,
  title,
  subtitle,
  error,
  loading = false,
  showPin: initialShowPin = false,
  className,
  language = 'en',
}: PinKeypadProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(initialShowPin);
  const t = translations[language];

  const handleDigit = useCallback((digit: string) => {
    if (pin.length < pinLength && !loading) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === pinLength) {
        onComplete(newPin);
      }
    }
  }, [pin, pinLength, loading, onComplete]);

  const handleDelete = useCallback(() => {
    if (!loading) {
      setPin(prev => prev.slice(0, -1));
    }
  }, [loading]);

  const handleClear = useCallback(() => {
    if (!loading) {
      setPin('');
    }
  }, [loading]);

  useEffect(() => {
    if (error) {
      setPin('');
    }
  }, [error]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      
      if (/^\d$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete, onCancel, loading]);

  const renderPinDots = () => (
    <div className="flex justify-center gap-3 mb-6">
      {Array.from({ length: pinLength }).map((_, i) => (
        <div
          key={i}
          data-testid={`pin-dot-${i}`}
          className={cn(
            'w-4 h-4 rounded-full border-2 transition-all duration-200',
            i < pin.length
              ? 'bg-[#D4AF37] border-[#D4AF37] scale-110'
              : 'bg-transparent border-gray-300 dark:border-gray-600'
          )}
        >
          {showPin && i < pin.length && (
            <span className="flex items-center justify-center text-xs font-bold text-white">
              {pin[i]}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  const keypadDigits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'delete'],
  ];

  return (
    <div className={cn('flex flex-col items-center p-6', className)}>
      {title && (
        <h2 
          className="text-2xl font-serif font-bold text-gray-900 dark:text-white mb-2"
          data-testid="pin-title"
        >
          {title}
        </h2>
      )}
      
      {subtitle && (
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-center" data-testid="pin-subtitle">
          {subtitle}
        </p>
      )}

      {error && (
        <div 
          className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg mb-4 text-sm"
          data-testid="pin-error"
        >
          {error}
        </div>
      )}

      {renderPinDots()}

      <button
        onClick={() => setShowPin(!showPin)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#D4AF37] mb-4 transition-colors"
        data-testid="toggle-pin-visibility"
      >
        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
        {showPin ? t.hidePin : t.showPin}
      </button>

      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {keypadDigits.flat().map((key, index) => {
          if (key === '') {
            return <div key={index} className="w-20 h-16" />;
          }
          
          if (key === 'delete') {
            return (
              <Button
                key={index}
                variant="ghost"
                className="w-20 h-16 text-xl rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleDelete}
                disabled={loading || pin.length === 0}
                data-testid="pin-delete"
                aria-label={t.delete}
              >
                <Delete size={24} />
              </Button>
            );
          }

          return (
            <Button
              key={index}
              variant="ghost"
              className={cn(
                'w-20 h-16 text-2xl font-semibold rounded-xl transition-all',
                'hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]',
                'active:scale-95 active:bg-[#D4AF37]/20'
              )}
              onClick={() => handleDigit(key)}
              disabled={loading}
              data-testid={`pin-key-${key}`}
            >
              {key}
            </Button>
          );
        })}
      </div>

      {onCancel && (
        <Button
          variant="ghost"
          className="mt-6 text-gray-500 hover:text-gray-700"
          onClick={onCancel}
          disabled={loading}
          data-testid="pin-cancel"
        >
          {t.cancel}
        </Button>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export function PinSetupFlow({
  onSuccess,
  onCancel,
  email,
  language = 'en',
}: {
  onSuccess: () => void;
  onCancel?: () => void;
  email: string;
  language?: 'en' | 'he';
}) {
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const translations = {
    en: {
      createTitle: 'Create Your PIN',
      createSubtitle: 'Choose a 6-digit PIN for quick access',
      confirmTitle: 'Confirm Your PIN',
      confirmSubtitle: 'Enter the same PIN again to confirm',
      pinMismatch: 'PINs do not match. Please try again.',
      setupSuccess: 'PIN created successfully!',
      setupError: 'Failed to create PIN. Please try again.',
    },
    he: {
      createTitle: 'צור קוד PIN',
      createSubtitle: 'בחר קוד PIN בן 6 ספרות לגישה מהירה',
      confirmTitle: 'אשר את קוד ה-PIN',
      confirmSubtitle: 'הזן את אותו קוד PIN שוב לאישור',
      pinMismatch: 'הקודים אינם תואמים. נסה שוב.',
      setupSuccess: 'קוד ה-PIN נוצר בהצלחה!',
      setupError: 'יצירת ה-PIN נכשלה. נסה שוב.',
    },
  };

  const t = translations[language];

  const handleFirstPin = (pin: string) => {
    setFirstPin(pin);
    setStep('confirm');
    setError('');
  };

  const handleConfirmPin = async (confirmPin: string) => {
    if (confirmPin !== firstPin) {
      setError(t.pinMismatch);
      setStep('create');
      setFirstPin('');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/pin-auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pin: confirmPin, 
          email,
          deviceType: 'web',
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || t.setupError);
        setStep('create');
        setFirstPin('');
      }
    } catch (err) {
      setError(t.setupError);
      setStep('create');
      setFirstPin('');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'create') {
    return (
      <PinKeypad
        title={t.createTitle}
        subtitle={t.createSubtitle}
        onComplete={handleFirstPin}
        onCancel={onCancel}
        error={error}
        loading={loading}
        language={language}
      />
    );
  }

  return (
    <PinKeypad
      title={t.confirmTitle}
      subtitle={t.confirmSubtitle}
      onComplete={handleConfirmPin}
      onCancel={() => {
        setStep('create');
        setFirstPin('');
      }}
      error={error}
      loading={loading}
      language={language}
    />
  );
}

export function PinLoginFlow({
  onSuccess,
  onCancel,
  email,
  language = 'en',
}: {
  onSuccess: (user: any) => void;
  onCancel?: () => void;
  email: string;
  language?: 'en' | 'he';
}) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const translations = {
    en: {
      title: 'Enter Your PIN',
      subtitle: 'Enter your 6-digit PIN to login',
      loginError: 'Failed to verify PIN. Please try again.',
    },
    he: {
      title: 'הזן את קוד ה-PIN',
      subtitle: 'הזן את קוד ה-PIN בן 6 הספרות להתחברות',
      loginError: 'אימות ה-PIN נכשל. נסה שוב.',
    },
  };

  const t = translations[language];

  const handlePin = async (pin: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/pin-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, email }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.user);
      } else {
        setError(data.error || t.loginError);
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }
      }
    } catch (err) {
      setError(t.loginError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PinKeypad
      title={t.title}
      subtitle={attemptsRemaining !== null 
        ? `${t.subtitle} (${attemptsRemaining} attempts left)`
        : t.subtitle}
      onComplete={handlePin}
      onCancel={onCancel}
      error={error}
      loading={loading}
      language={language}
    />
  );
}

export default PinKeypad;
