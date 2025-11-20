import { useState } from "react";
import { Globe2, Check } from "lucide-react";

type Language = {
  code: string;
  label: string;
};

const LANGUAGES: Language[] = [
  { code: "en", label: "English" },
  { code: "he", label: "עברית" },
  { code: "ar", label: "العربية" },
  { code: "ru", label: "Русский" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

interface LanguageSwitcherProps {
  current: string;
  onChange: (code: string) => void;
}

export function LanguageSwitcher({ current, onChange }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const active = LANGUAGES.find(l => l.code === current) ?? LANGUAGES[0];

  return (
    <div className="relative">
      {/* Compact pill trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-black/30 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors"
        data-testid="language-switcher-button"
      >
        <Globe2 className="h-4 w-4" />
        <span>{active.code.toUpperCase()}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 min-w-[160px] rounded-2xl bg-[#050814]/95 border border-white/10 shadow-xl shadow-black/40 backdrop-blur-xl p-1.5 z-50">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onChange(lang.code);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs text-zinc-100 hover:bg-white/8 transition-colors"
                data-testid={`language-option-${lang.code}`}
              >
                <span className="flex flex-col text-left">
                  <span className="font-semibold tracking-wide">
                    {lang.label}
                  </span>
                  <span className="text-[10px] uppercase text-zinc-400">
                    {lang.code}
                  </span>
                </span>
                {current === lang.code && (
                  <Check className="h-4 w-4 text-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
