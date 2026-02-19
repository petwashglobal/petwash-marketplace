import { useMemo } from 'react';
import PhoneInputLib, {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumber,
} from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import type { Language } from '@/lib/i18n';

const DEFAULT_APPROVED = [
  "IL",
  "AU",
  "US",
  "GB",
  "FR",
  "DE",
  "ES",
  "IT",
  "NL",
  "BE",
  "CH",
  "AT",
  "SE",
  "NO",
  "DK",
  "IE",
  "PT",
  "GR",
  "PL",
  "CZ",
  "HU",
  "RO",
  "BG",
  "LT",
  "LV",
  "EE",
  "FI",
  "CA",
  "HR",
  "SK",
  "SI",
  "NZ",
  "ZA",
  "SG",
  "HK",
  "JP",
  "KR",
  "IN",
  "BR",
  "MX",
  "AR",
  "CL",
  "CO",
  "PE",
  "AE",
  "SA",
  "QA",
  "KW",
  "BH",
  "OM",
  "TR",
  "RU",
  "UA",
  "TH",
  "VN",
  "PH",
  "MY",
  "ID",
  "CN",
  "TW",
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  language?: Language | string;
  error?: string;
  defaultCountryCode?: string;
  defaultCountry?: string;
  approvedCountries?: string[];
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  language,
  error,
  defaultCountry = "IL",
  approvedCountries = DEFAULT_APPROVED,
  disabled = false,
}: PhoneInputProps) {
  const allowed = useMemo(() => {
    const supported = new Set(getCountries());
    return approvedCountries.filter((c) => supported.has(c as any));
  }, [approvedCountries]);

  const safeDefault = useMemo(() => {
    return allowed.includes(defaultCountry) ? defaultCountry : (allowed[0] || "IL");
  }, [allowed, defaultCountry]);

  const isValid = useMemo(() => {
    if (!value) return true;
    try {
      return isValidPhoneNumber(value);
    } catch {
      return false;
    }
  }, [value]);

  const helper = useMemo(() => {
    if (!value) {
      const code = getCountryCallingCode(safeDefault as any);
      return language === 'he'
        ? `דוגמה: +${code}...`
        : `Example: +${code}...`;
    }
    if (isValid) {
      const pn = parsePhoneNumber(value);
      const cc = pn?.country || safeDefault;
      const code = pn?.countryCallingCode || getCountryCallingCode(safeDefault as any);
      return `E.164: ${value} (${cc} +${code})`;
    }
    return language === 'he' ? 'אנא הזן מספר תקין' : 'Please enter a valid number';
  }, [value, isValid, safeDefault, language]);

  return (
    <div className="space-y-1">
      <div className="intl-phone-wrapper rounded-xl border border-black/10 bg-white px-3 py-2">
        <PhoneInputLib
          international
          withCountryCallingCode
          countrySelectProps={{
            "aria-label": "Country",
          }}
          defaultCountry={safeDefault as any}
          countries={allowed as any}
          value={value || undefined}
          onChange={(v: string | undefined) => onChange(v || "")}
          onBlur={onBlur}
          placeholder={language === 'he' ? 'הזן מספר נייד' : 'Enter mobile number'}
          disabled={disabled}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      <p className={`text-xs ${isValid ? 'opacity-70' : 'text-red-600'}`}>
        {helper}
      </p>
    </div>
  );
}

export function IntlPhoneField(props: PhoneInputProps) {
  return <PhoneInput {...props} />;
}

export function isValidE164(phone: string): boolean {
  if (!phone || !phone.startsWith('+')) return false;
  try {
    return isValidPhoneNumber(phone);
  } catch {
    return false;
  }
}

export function validatePhoneE164(phoneE164: string) {
  const phone = (phoneE164 || "").trim();
  if (!phone.startsWith("+")) throw new Error("PHONE_MUST_BE_E164");
  if (!isValidPhoneNumber(phone)) throw new Error("INVALID_PHONE");
  const pn = parsePhoneNumber(phone);
  return {
    phoneE164: pn?.number || phone,
    phoneCountry: pn?.country || null,
    phoneCallingCode: pn?.countryCallingCode || null,
    nationalNumber: pn?.nationalNumber || null,
  };
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
