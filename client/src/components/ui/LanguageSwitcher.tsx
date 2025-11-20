import { useState, useRef, useEffect } from "react";
import { Globe2, Check } from "lucide-react";
import type { Language } from "@/lib/i18n";
import { isRTL, t } from "@/lib/i18n";

const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "en", label: "English" },
  { code: "he", label: "עברית" },
  { code: "ar", label: "العربية" },
  { code: "ru", label: "Русский" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

interface LanguageSwitcherProps {
  current: Language;
  onChange: (code: Language) => void;
}

export function LanguageSwitcher({ current, onChange }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = LANGUAGES.find(l => l.code === current) ?? LANGUAGES[0];

  const handleLanguageChange = (newLang: Language) => {
    onChange(newLang);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleClose = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const currentIndex = LANGUAGES.findIndex(l => l.code === current);
    if (currentIndex !== -1) {
      setFocusedIndex(currentIndex);
      menuItemRefs.current[currentIndex]?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = (prev + 1) % LANGUAGES.length;
          menuItemRefs.current[nextIndex]?.focus();
          return nextIndex;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const prevIndex = (prev - 1 + LANGUAGES.length) % LANGUAGES.length;
          menuItemRefs.current[prevIndex]?.focus();
          return prevIndex;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setFocusedIndex(current => {
          const focusedLang = LANGUAGES[current];
          if (focusedLang) {
            handleLanguageChange(focusedLang.code);
          }
          return current;
        });
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, current]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="language-dropdown"
        aria-label={`Current language: ${active.label}. Click or press Enter to open language menu.`}
        className="flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-black/30 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent"
        data-testid="language-switcher-button"
      >
        <Globe2 className="h-4 w-4" aria-hidden="true" />
        <span>{active.code.toUpperCase()}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
            aria-hidden="true"
          />
          
          <div 
            id="language-dropdown"
            role="menu"
            aria-label="Language selection. Use arrow keys to navigate, Enter to select, Escape to close."
            className="absolute right-0 mt-2 min-w-[160px] rounded-2xl bg-[#050814]/95 border border-white/10 shadow-xl shadow-black/40 backdrop-blur-xl p-1.5 z-50"
          >
            {LANGUAGES.map((lang, index) => (
              <button
                key={lang.code}
                ref={el => menuItemRefs.current[index] = el}
                type="button"
                role="menuitem"
                onClick={() => handleLanguageChange(lang.code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleLanguageChange(lang.code);
                  }
                }}
                aria-current={current === lang.code ? "true" : undefined}
                tabIndex={-1}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs text-zinc-100 hover:bg-white/8 transition-colors focus:outline-none focus:bg-white/8 focus:ring-2 focus:ring-purple-500/50"
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
                  <Check className="h-4 w-4 text-emerald-400" aria-label="Selected" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
