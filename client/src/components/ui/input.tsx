import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  textDir?: 'ltr' | 'rtl' | 'auto';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', textDir, style, ...props }, ref) => {
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

    const getTextDirection = (): 'ltr' | 'rtl' | 'auto' => {
      if (textDir) return textDir;
      if (type === 'email' || type === 'url' || type === 'tel' || type === 'number') {
        return 'ltr';
      }
      return 'auto';
    };

    const getAutoComplete = (): string | undefined => {
      if (props.autoComplete) return props.autoComplete;
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
        autoCorrect={type === 'email' || type === 'url' || type === 'tel' ? 'off' : props.autoCorrect}
        autoCapitalize={type === 'email' || type === 'url' || type === 'password' ? 'none' : props.autoCapitalize}
        spellCheck={type === 'email' || type === 'url' || type === 'tel' || type === 'password' ? false : props.spellCheck}
        className={cn(
          "flex h-14 w-full rounded-2xl",
          "border-2 border-neutral-200/50 dark:border-neutral-700/50",
          "bg-white dark:bg-neutral-900",
          "px-5 py-4",
          "text-[16px] font-normal leading-relaxed tracking-wide",
          "text-neutral-900 dark:text-neutral-100",
          "placeholder:text-neutral-400/70 dark:placeholder:text-neutral-500/70",
          "placeholder:font-light placeholder:tracking-wide",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
          "focus-visible:border-primary/60 dark:focus-visible:border-primary/40",
          "focus-visible:shadow-lg focus-visible:shadow-primary/10",
          "transition-[border-color,box-shadow] duration-200 ease-out",
          "hover:border-neutral-300/70 dark:hover:border-neutral-600/70",
          "hover:shadow-md hover:shadow-neutral-200/20 dark:hover:shadow-neutral-800/20",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "disabled:bg-neutral-50/50 dark:disabled:bg-neutral-900/30",
          "disabled:border-neutral-200/30 dark:disabled:border-neutral-800/30",
          "touch-manipulation",
          "rtl:text-right ltr:text-left",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "file:text-neutral-700 dark:file:text-neutral-300",
          className
        )}
        style={{ WebkitTextFillColor: 'currentColor', ...style }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
