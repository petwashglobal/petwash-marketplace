import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // iOS 2025: Direction support for RTL languages
  textDir?: 'ltr' | 'rtl' | 'auto';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, textDir, ...props }, ref) => {
    // iOS 2025: Auto-detect text direction
    const getTextDirection = (): 'ltr' | 'rtl' | 'auto' => {
      if (textDir) return textDir;
      return 'auto'; // Browser handles RTL detection
    };

    return (
      <textarea
        dir={getTextDirection()}
        className={cn(
          // LUXURY 2025: Premium glassmorphism design
          "flex min-h-[140px] w-full rounded-2xl",
          "border-2 border-neutral-200/50 dark:border-neutral-700/50",
          "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl",
          "px-5 py-4",
          // LUXURY 2025: Premium typography - sophisticated font styling
          "text-[16px] font-normal leading-relaxed tracking-wide",
          "text-neutral-900 dark:text-neutral-100",
          // LUXURY 2025: Elegant placeholder
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
          // LUXURY 2025: Premium disabled state
          "disabled:cursor-not-allowed disabled:opacity-40",
          "disabled:bg-neutral-50/50 dark:disabled:bg-neutral-900/30",
          "disabled:border-neutral-200/30 dark:disabled:border-neutral-800/30",
          // iOS: Prevent double-tap zoom
          "touch-manipulation",
          // RTL support
          "rtl:text-right ltr:text-left",
          // iOS: Premium resize handle
          "resize-y",
          className
        )}
        ref={ref}
        // iOS 2025: Smart autocomplete for common fields
        autoComplete={props.autoComplete || (() => {
          const name = props.name?.toLowerCase() || '';
          if (name.includes('message') || name.includes('notes') || name.includes('comment')) {
            return 'off';
          }
          if (name.includes('address')) return 'street-address';
          return undefined;
        })()}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
