import { Input } from '@/components/ui/input';
import type { Language } from '@/lib/i18n';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  language: Language;
  error?: string;
}

export function PhoneInput({ value, onChange, onBlur, language, error }: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-numeric characters except leading +
    let cleaned = e.target.value.replace(/[^\d+]/g, '');
    // Ensure only one + at the beginning
    if (cleaned.includes('+')) {
      const parts = cleaned.split('+');
      cleaned = '+' + parts.filter(p => p).join('');
    }
    onChange(cleaned);
  };

  const placeholder = language === 'he' ? '+972501234567' : '+972501234567';
  const helpText = language === 'he' 
    ? 'הזן מספר בפורמט בינלאומי (E.164)'
    : 'Enter number in international format (E.164)';

  return (
    <div className="space-y-1">
      <Input
        type="tel"
        inputMode="tel"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        pattern="^\+?[1-9]\d{7,14}$"
        aria-describedby="phoneHelp"
        aria-invalid={!!error}
        data-testid="input-phone"
        className={error ? 'border-red-500' : ''}
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
      <p id="phoneHelp" className="text-xs text-gray-500">{helpText}</p>
    </div>
  );
}

// Utility function to validate E.164 format
export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  return e164Regex.test(phone);
}

// Utility function to normalize phone to E.164 (enhanced version)
export function normalizeToE164(phone: string, defaultCountryCode: string = '972'): string {
  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove any + signs that aren't at the beginning
  if (cleaned.includes('+')) {
    const firstPlus = cleaned.indexOf('+');
    if (firstPlus === 0) {
      cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
    } else {
      cleaned = cleaned.replace(/\+/g, '');
    }
  }
  
  // If starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    cleaned = '+' + defaultCountryCode + cleaned.slice(1);
  }
  
  // If doesn't start with +, add it with country code
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + defaultCountryCode + cleaned;
  }
  
  return cleaned;
}
