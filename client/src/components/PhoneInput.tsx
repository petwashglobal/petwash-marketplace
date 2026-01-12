import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Language } from '@/lib/i18n';

interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

const countryCodes: CountryCode[] = [
  { code: '+972', country: 'Israel', flag: '🇮🇱' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+30', country: 'Greece', flag: '🇬🇷' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+420', country: 'Czech Republic', flag: '🇨🇿' },
  { code: '+36', country: 'Hungary', flag: '🇭🇺' },
  { code: '+40', country: 'Romania', flag: '🇷🇴' },
  { code: '+359', country: 'Bulgaria', flag: '🇧🇬' },
  { code: '+385', country: 'Croatia', flag: '🇭🇷' },
  { code: '+421', country: 'Slovakia', flag: '🇸🇰' },
  { code: '+386', country: 'Slovenia', flag: '🇸🇮' },
  { code: '+372', country: 'Estonia', flag: '🇪🇪' },
  { code: '+371', country: 'Latvia', flag: '🇱🇻' },
  { code: '+370', country: 'Lithuania', flag: '🇱🇹' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+51', country: 'Peru', flag: '🇵🇪' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭' },
  { code: '+968', country: 'Oman', flag: '🇴🇲' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+886', country: 'Taiwan', flag: '🇹🇼' },
];

function parsePhoneValue(fullNumber: string, defaultCode: string): { code: string; number: string } {
  if (!fullNumber) {
    return { code: defaultCode, number: '' };
  }
  
  const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);
  for (const cc of sortedCodes) {
    if (fullNumber.startsWith(cc.code)) {
      return { code: cc.code, number: fullNumber.slice(cc.code.length) };
    }
  }
  
  const match = fullNumber.match(/^\+(\d{1,4})/);
  if (match) {
    return { code: '+' + match[1], number: fullNumber.slice(match[0].length) };
  }
  
  return { code: defaultCode, number: fullNumber.replace(/^\+/, '') };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  language: Language;
  error?: string;
  defaultCountryCode?: string;
}

export function PhoneInput({ value, onChange, onBlur, language, error, defaultCountryCode = '+972' }: PhoneInputProps) {
  const parsed = useMemo(() => parsePhoneValue(value, defaultCountryCode), [value, defaultCountryCode]);
  
  const [selectedCode, setSelectedCode] = useState(parsed.code);
  const [localNumber, setLocalNumber] = useState(parsed.number);

  useEffect(() => {
    const newParsed = parsePhoneValue(value, defaultCountryCode);
    setSelectedCode(newParsed.code);
    setLocalNumber(newParsed.number);
  }, [value, defaultCountryCode]);

  const handleCodeChange = (newCode: string) => {
    setSelectedCode(newCode);
    if (localNumber) {
      onChange(newCode + localNumber);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^\d]/g, '');
    setLocalNumber(cleaned);
    if (cleaned) {
      onChange(selectedCode + cleaned);
    } else {
      onChange('');
    }
  };

  const placeholder = language === 'he' ? '501234567' : '501234567';
  const helpText = language === 'he' 
    ? 'בחר קידומת מדינה והזן מספר טלפון'
    : 'Select country code and enter phone number';

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Select value={selectedCode} onValueChange={handleCodeChange}>
          <SelectTrigger className="w-[140px]" data-testid="select-country-code">
            <SelectValue placeholder={defaultCountryCode} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {countryCodes.map((cc) => (
              <SelectItem key={cc.code} value={cc.code}>
                <span className="flex items-center gap-2">
                  <span>{cc.flag}</span>
                  <span>{cc.code}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          inputMode="tel"
          placeholder={placeholder}
          value={localNumber}
          onChange={handleNumberChange}
          onBlur={onBlur}
          aria-describedby="phoneHelp"
          aria-invalid={!!error}
          data-testid="input-phone"
          className={`flex-1 ${error ? 'border-red-500' : ''}`}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
      <p id="phoneHelp" className="text-xs text-gray-500">{helpText}</p>
    </div>
  );
}

export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  return e164Regex.test(phone);
}

export function normalizeToE164(phone: string, defaultCountryCode: string = '972'): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.includes('+')) {
    const firstPlus = cleaned.indexOf('+');
    if (firstPlus === 0) {
      cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
    } else {
      cleaned = cleaned.replace(/\+/g, '');
    }
  }
  
  if (cleaned.startsWith('0')) {
    cleaned = '+' + defaultCountryCode + cleaned.slice(1);
  }
  
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + defaultCountryCode + cleaned;
  }
  
  return cleaned;
}
