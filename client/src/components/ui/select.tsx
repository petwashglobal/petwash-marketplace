import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      // LUXURY 2025: Premium glassmorphism design matching Input component
      "flex h-14 w-full items-center justify-between rounded-2xl",
      "border-2 border-neutral-200/50 dark:border-neutral-700/50",
      "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl",
      "px-5 py-4",
      // LUXURY 2025: Premium typography - sophisticated font styling
      "text-[16px] font-normal leading-relaxed tracking-wide",
      "text-neutral-900 dark:text-neutral-100",
      // LUXURY 2025: Elegant placeholder
      "[&>span]:text-neutral-900 dark:[&>span]:text-neutral-100",
      "[&>span]:line-clamp-1",
      // LUXURY 2025: Premium focus state with smooth glow
      "focus:outline-none",
      "focus:ring-2 focus:ring-primary/30 focus:ring-offset-2",
      "focus:border-primary/60 dark:focus:border-primary/40",
      "focus:bg-white dark:focus:bg-neutral-900",
      "focus:shadow-lg focus:shadow-primary/10",
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
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-5 w-5 opacity-50 transition-transform duration-300 data-[state=open]:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      // LUXURY 2025: Premium scroll button
      "flex cursor-default items-center justify-center py-2",
      "text-neutral-700 dark:text-neutral-300",
      "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50",
      "transition-colors duration-200",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      // LUXURY 2025: Premium scroll button
      "flex cursor-default items-center justify-center py-2",
      "text-neutral-700 dark:text-neutral-300",
      "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50",
      "transition-colors duration-200",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        // LUXURY 2025: Premium dropdown with glassmorphism
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-2xl",
        "border-2 border-neutral-200/50 dark:border-neutral-700/50",
        "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl",
        "shadow-2xl shadow-neutral-900/10 dark:shadow-neutral-950/30",
        // LUXURY 2025: Premium animations
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-2",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      // LUXURY 2025: Premium label typography
      "py-2 pl-10 pr-2 text-sm font-medium tracking-wide",
      "text-neutral-600 dark:text-neutral-400",
      className
    )}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      // LUXURY 2025: Premium item with smooth interactions
      "relative flex w-full cursor-pointer select-none items-center rounded-xl",
      "py-3 pl-10 pr-3",
      "text-[15px] font-normal leading-relaxed tracking-wide",
      "text-neutral-900 dark:text-neutral-100",
      "outline-none",
      // LUXURY 2025: Premium focus/hover states
      "focus:bg-neutral-100/80 dark:focus:bg-neutral-800/80",
      "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60",
      "active:bg-neutral-200/80 dark:active:bg-neutral-700/80",
      "transition-all duration-200 ease-out",
      // LUXURY 2025: Premium disabled state
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
      className
    )}
    {...props}
  >
    <span className="absolute left-3 flex h-5 w-5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-5 w-5 text-primary" strokeWidth={2.5} />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn(
      // LUXURY 2025: Premium separator
      "-mx-1 my-2 h-px bg-neutral-200/70 dark:bg-neutral-700/70",
      className
    )}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
