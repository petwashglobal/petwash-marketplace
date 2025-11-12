import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  // iOS 2025: Direction support for RTL languages
  textDir?: 'ltr' | 'rtl' | 'auto';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', textDir, ...props }, ref) => {
    // iOS 2025: Smart keyboard type detection
    const getInputMode = (): React.HTMLAttributes<HTMLInputElement>['inputMode'] => {
      if (props.inputMode) return props.inputMode;
      
      switch (type) {
        case 'email': return 'email';
        case 'tel': return 'tel';
        case 'url': return 'url';
        case 'number': return 'numeric';
        case 'search': return 'search';
        default: return 'text';
      }
    };

    // iOS 2025: Auto-detect text direction based on input type
    const getTextDirection = (): 'ltr' | 'rtl' | 'auto' => {
      if (textDir) return textDir;
      
      // Force LTR for technical inputs
      if (type === 'email' || type === 'url' || type === 'tel' || type === 'number') {
        return 'ltr';
      }
      
      // Auto for text inputs (browser handles RTL detection)
      return 'auto';
    };

    // iOS 2025: Smart autocomplete
    const getAutoComplete = (): string | undefined => {
      if (props.autoComplete) return props.autoComplete;
      
      // Map common name patterns to autocomplete
      const name = props.name?.toLowerCase() || '';
      
      if (name.includes('email')) return 'email';
      if (name.includes('tel') || name.includes('phone')) return 'tel';
      if (name.includes('firstname') || name.includes('first-name') || name.includes('first_name')) return 'given-name';
      if (name.includes('lastname') || name.includes('last-name') || name.includes('last_name')) return 'family-name';
      if (name.includes('address')) return 'street-address';
      if (name.includes('city')) return 'address-level2';
      if (name.includes('country')) return 'country-name';
      if (name.includes('postal') || name.includes('zip')) return 'postal-code';
      if (type === 'password') return 'current-password';
      if (name.includes('newpassword') || name.includes('new-password')) return 'new-password';
      if (name.includes('otp') || name.includes('code')) return 'one-time-code';
      
      return undefined;
    };

    return (
      <input
        type={type}
        inputMode={getInputMode()}
        dir={getTextDirection()}
        autoComplete={getAutoComplete()}
        // iOS 2025: Prevent autocorrect/capitalize for technical fields
        autoCorrect={type === 'email' || type === 'url' || type === 'tel' ? 'off' : props.autoCorrect}
        autoCapitalize={type === 'email' || type === 'url' || type === 'password' ? 'none' : props.autoCapitalize}
        spellCheck={type === 'email' || type === 'url' || type === 'tel' || type === 'password' ? false : props.spellCheck}
        className={cn(
          // LUXURY 2025: Premium glassmorphism design
          "flex h-14 w-full rounded-2xl",
          "border-2 border-neutral-200/50 dark:border-neutral-700/50",
          "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl",
          "px-5 py-4",
          // LUXURY 2025: Premium typography - sophisticated font styling
          "text-[16px] font-normal leading-relaxed tracking-wide",
          "text-neutral-900 dark:text-neutral-100",
          // LUXURY 2025: Elegant placeholder with premium color
          "placeholder:text-neutral-400/70 dark:placeholder:text-neutral-500/70",
          "placeholder:font-light placeholder:tracking-wide",
          // LUXURY 2025: Premium focus state with smooth glow
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
          "focus-visible:border-primary/60 dark:focus-visible:border-primary/40",
          "focus-visible:bg-white dark:focus-visible:bg-neutral-900",
          "focus-visible:shadow-lg focus-visible:shadow-primary/10",
          // LUXURY 2025: Smooth premium transitions
          "transition-all duration-300 ease-out",
          // LUXURY 2025: Subtle hover state
          "hover:border-neutral-300/70 dark:hover:border-neutral-600/70",
          "hover:bg-white dark:hover:bg-neutral-900",
          "hover:shadow-md hover:shadow-neutral-200/20 dark:hover:shadow-neutral-800/20",
          // iOS 2025: Touch states with premium feel
          "active:scale-[0.995]",
          // LUXURY 2025: Premium disabled state
          "disabled:cursor-not-allowed disabled:opacity-40",
          "disabled:bg-neutral-50/50 dark:disabled:bg-neutral-900/30",
          "disabled:border-neutral-200/30 dark:disabled:border-neutral-800/30",
          // iOS: Prevent double-tap zoom
          "touch-manipulation",
          // RTL support with proper alignment
          "rtl:text-right ltr:text-left",
          // LUXURY 2025: File input premium styling
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "file:text-neutral-700 dark:file:text-neutral-300",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
