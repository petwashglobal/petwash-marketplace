import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-5", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-3 pb-4 relative items-center",
        caption_label: "text-base font-semibold text-gray-900 dark:text-white tracking-tight",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 p-0",
          "bg-white dark:bg-gray-800",
          "border border-gray-200 dark:border-gray-700",
          "hover:bg-gray-50 dark:hover:bg-gray-700",
          "transition-colors duration-200",
          "rounded-lg"
        ),
        nav_button_previous: "absolute left-2",
        nav_button_next: "absolute right-2",
        table: "w-full border-collapse space-y-1 mt-2",
        head_row: "flex gap-1",
        head_cell: cn(
          "text-gray-500 dark:text-gray-400",
          "rounded-lg w-11 h-9",
          "font-semibold text-xs uppercase tracking-wider",
          "flex items-center justify-center"
        ),
        row: "flex w-full mt-1 gap-1",
        cell: cn(
          "h-11 w-11 text-center text-sm p-0 relative",
          "focus-within:relative focus-within:z-20",
          "transition-all duration-300"
        ),
        day: cn(
          "h-10 w-10 p-0 font-medium rounded-lg",
          "hover:bg-gray-100 dark:hover:bg-gray-700",
          "focus:bg-gray-100 dark:focus:bg-gray-700",
          "transition-colors duration-200",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-blue-500 dark:bg-blue-600",
          "text-white font-semibold",
          "hover:bg-blue-600 dark:hover:bg-blue-700",
          "focus:bg-blue-600 dark:focus:bg-blue-700"
        ),
        day_today: cn(
          "bg-gray-100 dark:bg-gray-800",
          "text-blue-600 dark:text-blue-400",
          "font-bold"
        ),
        day_outside: cn(
          "day-outside text-gray-300 dark:text-gray-600",
          "aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800",
          "aria-selected:text-gray-400"
        ),
        day_disabled: "text-gray-300 dark:text-gray-600 opacity-50 cursor-not-allowed",
        day_range_middle: cn(
          "aria-selected:bg-blue-50 dark:aria-selected:bg-blue-900",
          "aria-selected:text-blue-600 dark:aria-selected:text-blue-300"
        ),
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-5 w-5 transition-transform duration-200", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-5 w-5 transition-transform duration-200", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
