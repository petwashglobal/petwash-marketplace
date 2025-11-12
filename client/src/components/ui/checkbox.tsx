import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // LUXURY 2025: Premium checkbox with glassmorphism and sophisticated styling
      "peer h-6 w-6 shrink-0 rounded-lg",
      "border-2 border-neutral-300/70 dark:border-neutral-600/70",
      "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl",
      "ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
      "transition-all duration-300 ease-out",
      "hover:border-primary/50 dark:hover:border-primary/40",
      "hover:bg-white dark:hover:bg-neutral-900",
      "hover:shadow-md hover:shadow-primary/10",
      "active:scale-95",
      "disabled:cursor-not-allowed disabled:opacity-40",
      "disabled:bg-neutral-50/50 dark:disabled:bg-neutral-900/30",
      // LUXURY 2025: Premium checked state with gradient
      "data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-primary data-[state=checked]:to-primary/90",
      "data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
      "data-[state=checked]:shadow-lg data-[state=checked]:shadow-primary/20",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
