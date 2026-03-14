import { ArrowRight, ArrowLeft } from 'lucide-react';
import logoPath from '@assets/logo.png';

interface MobileFormShellProps {
  title: string;
  titleHe?: string;
  subtitle?: string;
  subtitleHe?: string;
  emoji?: string;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function MobileFormShell({
  title, titleHe, subtitle, subtitleHe, emoji,
  step, totalSteps, onBack, children, footer,
}: MobileFormShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" dir="ltr">
      <div
        className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-4 pt-safe-top pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center active:bg-white/15 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <img src={logoPath} alt="PetWash" className="h-7 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              {emoji && <span className="text-lg">{emoji}</span>}
              <h1 className="text-base font-bold truncate">{title}</h1>
            </div>
            {titleHe && <p className="text-xs text-[#C6A35B] truncate" dir="rtl">{titleHe}</p>}
          </div>
          {step && totalSteps && (
            <div className="shrink-0 bg-[#C6A35B]/15 rounded-full px-3 py-1">
              <span className="text-[#C6A35B] text-xs font-bold">{step}/{totalSteps}</span>
            </div>
          )}
        </div>
        {step && totalSteps && (
          <div className="max-w-lg mx-auto mt-2 w-full bg-white/10 rounded-full h-1">
            <div
              className="bg-gradient-to-r from-[#C6A35B] to-[#E7C978] h-1 rounded-full transition-all duration-500"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        )}
      </div>

      {(subtitle || subtitleHe) && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          {subtitle && <p className="text-white/50 text-sm">{subtitle}</p>}
          {subtitleHe && <p className="text-[#C6A35B]/70 text-sm mt-0.5" dir="rtl">{subtitleHe}</p>}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-4">
        {children}
      </div>

      {footer && (
        <div
          className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 px-4 py-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-lg mx-auto">{footer}</div>
        </div>
      )}
    </div>
  );
}

export function MobileSection({ title, titleHe, children }: { title?: string; titleHe?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5 space-y-4">
      {(title || titleHe) && (
        <div className="border-b border-white/8 pb-3 mb-1">
          {title && <h3 className="text-sm font-bold text-[#C6A35B] uppercase tracking-wider">{title}</h3>}
          {titleHe && <p className="text-xs text-white/40 mt-0.5" dir="rtl">{titleHe}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function MobileField({
  label, labelHe, error, required, children,
}: { label: string; labelHe?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <label className="text-sm font-semibold text-white/80">{label}</label>
        {labelHe && <span className="text-xs text-white/30" dir="rtl">{labelHe}</span>}
        {required && <span className="text-red-400 text-xs ml-0.5">*</span>}
      </div>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export function MobileInput({
  type = 'text', value, onChange, placeholder, inputMode, autoComplete, maxLength, min, max, rows, disabled,
}: {
  type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string; maxLength?: number; min?: string; max?: string; rows?: number; disabled?: boolean;
}) {
  const base =
    'w-full bg-black/40 border border-white/12 rounded-xl px-4 py-3.5 text-white text-base placeholder:text-white/30 focus:outline-none focus:border-[#C6A35B]/60 focus:ring-1 focus:ring-[#C6A35B]/30 transition-colors appearance-none disabled:opacity-50';
  if (rows) {
    return (
      <textarea
        className={`${base} resize-none`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
    );
  }
  return (
    <input
      className={base}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete}
      maxLength={maxLength}
      min={min}
      max={max}
      disabled={disabled}
    />
  );
}

export function MobileSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        className="w-full appearance-none bg-black/40 border border-white/12 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#C6A35B]/60 focus:ring-1 focus:ring-[#C6A35B]/30 transition-colors pr-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <ArrowRight className="w-4 h-4 text-white/30 rotate-90" />
      </div>
    </div>
  );
}

export function MobilePrimaryButton({
  onClick, disabled, loading, children,
}: { onClick?: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode }) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full bg-gradient-to-r from-[#C6A35B] to-[#E7C978] text-black font-bold text-base py-4 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-[#C6A35B]/20"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          Please wait…
        </span>
      ) : children}
    </button>
  );
}

export function MobileSuccessScreen({
  emoji, title, titleHe, message, messageHe, refId, refLabel, onDone,
}: {
  emoji: string; title: string; titleHe?: string; message: string; messageHe?: string;
  refId?: string; refLabel?: string; onDone?: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6 animate-bounce">{emoji}</div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      {titleHe && <p className="text-[#C6A35B] text-lg mb-4" dir="rtl">{titleHe}</p>}
      <p className="text-white/60 text-base mb-3">{message}</p>
      {messageHe && <p className="text-white/40 text-sm" dir="rtl">{messageHe}</p>}
      {refId && (
        <div className="mt-6 bg-white/[0.05] border border-white/10 rounded-2xl px-6 py-4">
          <p className="text-white/40 text-xs mb-1">{refLabel || 'Reference ID'}</p>
          <p className="text-[#E7C978] text-lg font-bold font-mono">{refId}</p>
        </div>
      )}
      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="mt-8 bg-gradient-to-r from-[#C6A35B] to-[#E7C978] text-black font-bold px-10 py-4 rounded-2xl text-base"
        >
          Done
        </button>
      )}
    </div>
  );
}
