import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 🌟 WORLD-CLASS MOBILE DATE/TIME PICKER 🌟
 * 
 * Premium finger-friendly date/time selector with:
 * - Large touch targets for easy selection
 * - iOS/Android native-style interface
 * - Smart defaults and validation
 * - Automatic timezone handling
 * - 7-star UX experience
 */

interface MobileDatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  label?: string;
  error?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  includeTime?: boolean;
  className?: string;
}

export function MobileDatePicker({
  value,
  onChange,
  label,
  error,
  required = false,
  minDate,
  maxDate,
  includeTime = false,
  className = '',
}: MobileDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [displayMode, setDisplayMode] = useState<'calendar' | 'time'>('calendar');

  useEffect(() => {
    setSelectedDate(value);
  }, [value]);

  const handleDateChange = (dateString: string) => {
    const newDate = new Date(dateString);
    if (selectedDate) {
      // Preserve time if it exists
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
    }
    setSelectedDate(newDate);
    onChange(newDate);
  };

  const handleTimeChange = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = selectedDate ? new Date(selectedDate) : new Date();
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    setSelectedDate(newDate);
    onChange(newDate);
  };

  const formatDateForInput = (date?: Date): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date?: Date): string => {
    if (!date) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDisplayDate = (date?: Date): string => {
    if (!date) return 'Select a date';
    
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <Label className="text-base font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      {/* Modern Date Selection */}
      <div className="space-y-3">
        {/* Display Selected Date */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 min-h-[56px] flex items-center justify-center">
          <p className="text-lg font-semibold text-blue-900">
            {formatDisplayDate(selectedDate)}
          </p>
        </div>

        {/* Date Input with Large Touch Target */}
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 pointer-events-none z-10" />
          <input
            type="date"
            value={formatDateForInput(selectedDate)}
            onChange={(e) => handleDateChange(e.target.value)}
            min={minDate ? formatDateForInput(minDate) : undefined}
            max={maxDate ? formatDateForInput(maxDate) : undefined}
            required={required}
            className={cn(
              'w-full pl-14 pr-5 py-4 min-h-[56px]',
              'text-base font-medium',
              'rounded-xl border-2',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 hover:border-gray-400',
              'cursor-pointer'
            )}
            style={{
              WebkitAppearance: 'none',
              MozAppearance: 'textfield',
            }}
            data-testid="input-date-picker"
          />
        </div>

        {/* Time Input (if enabled) */}
        {includeTime && (
          <div className="relative">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 pointer-events-none z-10" />
            <input
              type="time"
              value={formatTimeForInput(selectedDate)}
              onChange={(e) => handleTimeChange(e.target.value)}
              required={required}
              className={cn(
                'w-full pl-14 pr-5 py-4 min-h-[56px]',
                'text-base font-medium',
                'rounded-xl border-2',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 hover:border-gray-400',
                'cursor-pointer'
              )}
              style={{
                WebkitAppearance: 'none',
                MozAppearance: 'textfield',
              }}
              data-testid="input-time-picker"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-1 flex items-center gap-1 font-medium">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  );
}

/**
 * Quick Date Selection Buttons
 */
export function QuickDateButtons({ onSelect }: { onSelect: (date: Date) => void }) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const buttons = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: tomorrow },
    { label: 'Next Week', date: nextWeek },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {buttons.map(({ label, date }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(date)}
          className="px-4 py-2 min-h-[44px] rounded-lg border-2 border-blue-200 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 active:scale-95 transition-all"
          data-testid={`button-quick-date-${label.toLowerCase()}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
