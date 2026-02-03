import { useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Language } from '@/lib/i18n';

interface TimePickerProps {
  value?: string;
  onChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  language?: Language;
  testId?: string;
  minTime?: string;
  maxTime?: string;
  interval?: number;
}

const generateTimeSlots = (interval: number = 30, minTime?: string, maxTime?: string) => {
  const slots: string[] = [];
  const minHour = minTime ? parseInt(minTime.split(':')[0]) : 6;
  const maxHour = maxTime ? parseInt(maxTime.split(':')[0]) : 22;
  
  for (let hour = minHour; hour <= maxHour; hour++) {
    for (let min = 0; min < 60; min += interval) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push(timeStr);
    }
  }
  return slots;
};

const formatTime = (time: string, language: Language = 'en'): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const isHebrew = language === 'he';
  
  if (isHebrew) {
    return `${hours}:${minutes}`;
  }
  
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export function TimePicker({ 
  value, 
  onChange, 
  placeholder,
  disabled = false,
  className,
  language = 'en',
  testId,
  minTime = '06:00',
  maxTime = '22:00',
  interval = 30
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isHebrew = language === 'he';
  const slots = generateTimeSlots(interval, minTime, maxTime);
  
  const defaultPlaceholder = isHebrew ? 'בחר שעה' : 'Select time';

  const handleSelect = (time: string) => {
    onChange(time);
    setIsOpen(false);
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
            "focus:ring-2 focus:ring-purple-500 focus:border-purple-500",
            "transition-all duration-200",
            "rounded-xl",
            !value && "text-gray-400 dark:text-gray-500",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <Clock className="mr-2.5 h-4 w-4 text-purple-600 dark:text-purple-400 transition-colors" />
          {value ? (
            <span className="text-gray-900 dark:text-gray-100 font-medium tracking-tight">
              {formatTime(value, language)}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 font-normal">
              {placeholder || defaultPlaceholder}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "w-48 p-0",
          "bg-white dark:bg-gray-900",
          "border border-gray-200 dark:border-gray-700",
          "rounded-2xl shadow-lg max-h-64 overflow-hidden"
        )}
        align="start"
        sideOffset={4}
      >
        <div className="overflow-y-auto max-h-64 p-2">
          <div className="grid grid-cols-2 gap-1">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => handleSelect(slot)}
                className={cn(
                  "px-3 py-2.5 text-sm rounded-lg transition-all",
                  "hover:bg-purple-100 dark:hover:bg-purple-900/30",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500",
                  "min-h-[44px] touch-manipulation",
                  value === slot 
                    ? "bg-purple-500 text-white font-medium" 
                    : "text-gray-700 dark:text-gray-300"
                )}
              >
                {formatTime(slot, language)}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
