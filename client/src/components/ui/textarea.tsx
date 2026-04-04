import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  textDir?: 'ltr' | 'rtl' | 'auto';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, textDir, style, ...props }, ref) => {
    const getTextDirection = (): 'ltr' | 'rtl' | 'auto' => {
      if (textDir) return textDir;
      return 'auto';
    };

    return (
      <textarea
        dir={getTextDirection()}
        className={cn(
          "flex min-h-[140px] w-full rounded-2xl",
          "border-2 border-neutral-200/50 dark:border-neutral-700/50",
          "bg-white dark:bg-white",
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
          "disabled:bg-white/50 dark:disabled:bg-neutral-900/30",
          "disabled:border-neutral-200/30 dark:disabled:border-neutral-800/30",
          "touch-manipulation",
          "rtl:text-right ltr:text-left",
          "resize-y",
          className
        )}
        style={{ WebkitTextFillColor: 'currentColor', ...style }}
        ref={ref}
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
