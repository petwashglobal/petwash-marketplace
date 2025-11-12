import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // LUXURY 2025: Premium button design with glassmorphism and sophisticated styling
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl text-base font-semibold tracking-wide ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:from-primary/95 hover:to-primary/85 active:from-primary active:to-primary/95 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground hover:from-destructive/95 hover:to-destructive/85 active:from-destructive active:to-destructive/95 shadow-lg shadow-destructive/20",
        outline:
          "border-2 border-neutral-200/70 dark:border-neutral-700/70 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl hover:bg-white dark:hover:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 active:bg-neutral-50 dark:active:bg-neutral-800 shadow-md hover:shadow-lg",
        secondary:
          "bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 text-neutral-900 dark:text-neutral-100 hover:from-neutral-200 hover:to-neutral-100 dark:hover:from-neutral-700 dark:hover:to-neutral-800 active:from-neutral-300 active:to-neutral-200 dark:active:from-neutral-600 dark:active:to-neutral-700 shadow-md",
        ghost: "hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 hover:text-neutral-900 dark:hover:text-neutral-100 active:bg-neutral-200/80 dark:active:bg-neutral-700/80 backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-14 px-8 py-4",
        sm: "h-11 rounded-xl px-5 text-sm",
        lg: "h-16 rounded-2xl px-10 text-lg",
        icon: "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // iOS 2025: Haptic feedback simulation via vibration API
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Trigger haptic feedback on iOS devices
      if ('vibrate' in navigator && !props.disabled) {
        // Light tap feedback (10ms)
        navigator.vibrate(10);
      }
      
      // Call original onClick
      if (onClick) {
        onClick(e);
      }
    };
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
