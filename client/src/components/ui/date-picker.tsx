import { useState } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Language } from '@/lib/i18n';

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  language?: Language;
  testId?: string;
}

export function DatePicker({ 
  value, 
  onChange, 
  placeholder = "Pick a date",
  minDate,
  maxDate,
  disabled = false,
  className,
  language = 'en',
  testId
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dateValue = value ? new Date(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "w-full justify-start text-left font-normal h-12",
            "bg-white dark:bg-gray-900",
            "border border-gray-200 dark:border-gray-700",
            "shadow-sm hover:shadow-md",
            "hover:bg-gray-50 dark:hover:bg-gray-800",
            "hover:border-gray-300 dark:hover:border-gray-600",
            "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "transition-all duration-200",
            "rounded-xl",
            !value && "text-gray-400 dark:text-gray-500",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <CalendarIcon className="mr-2.5 h-4 w-4 text-gray-500 dark:text-gray-400 transition-colors" />
          {value ? (
            <span className="text-gray-900 dark:text-gray-100 font-medium tracking-tight">
              {format(dateValue!, "PPP")}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 font-normal">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "w-auto p-0",
          "bg-white dark:bg-gray-900",
          "border border-gray-200 dark:border-gray-700",
          "rounded-2xl shadow-lg"
        )}
        align="start"
        sideOffset={4}
      >
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
          initialFocus
          className="rounded-2xl"
        />
      </PopoverContent>
    </Popover>
  )
}
