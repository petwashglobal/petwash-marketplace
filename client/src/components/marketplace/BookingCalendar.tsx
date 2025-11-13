/**
 * BOOKING CALENDAR COMPONENT
 * 
 * iOS-Style Availability Calendar with 5-Minute Payment Locks
 * 
 * Features:
 * - Horizontal scrolling day strip
 * - Time slot grid for selected day
 * - Automatic lock acquisition on selection
 * - Visual lock countdown
 * - Platform-specific booking modes
 */

import { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';

interface TimeSlot {
  id: number;
  providerId: number;
  platform: string;
  start: string; // ISO
  end: string;   // ISO
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  timezone: string;
}

interface BookingCalendarProps {
  platform: string;
  providerId: number;
  onSlotSelected?: (slotId: number, lockToken: string, expiresAt: Date) => void;
  bookingMode?: 'SINGLE_SLOT' | 'MULTI_DAY' | 'ARRIVAL_WINDOW';
  minDate?: Date;
  maxDate?: Date;
}

export function BookingCalendar({
  platform,
  providerId,
  onSlotSelected,
  bookingMode = 'SINGLE_SLOT',
  minDate = new Date(),
  maxDate = addDays(new Date(), 90), // 3 months ahead
}: BookingCalendarProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(minDate);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(minDate, { weekStartsOn: 0 }));
  
  const dayStripRef = useRef<HTMLDivElement>(null);

  // Fetch available slots for selected date range
  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['/api/bookings/availability', platform, providerId, selectedDate],
    enabled: !!platform && !!providerId,
  });

  const slots: TimeSlot[] = slotsData?.slots || [];

  // Filter slots for selected date
  const slotsForSelectedDate = slots.filter((slot) => {
    const slotDate = new Date(slot.start);
    return isSameDay(slotDate, selectedDate);
  });

  // Lock acquisition mutation
  const lockMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const response = await apiRequest('/api/bookings/lock', {
        method: 'POST',
        body: JSON.stringify({ slotId }),
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.success) {
        setLockToken(data.lockToken);
        setLockExpiresAt(new Date(data.expiresAt));
        setSecondsLeft(data.secondsLeft);

        toast({
          title: 'Time Slot Reserved ✅',
          description: `You have ${Math.floor(data.secondsLeft / 60)} minutes to complete payment`,
        });

        // Notify parent
        if (onSlotSelected) {
          onSlotSelected(selectedSlotId!, data.lockToken, new Date(data.expiresAt));
        }

        // Invalidate availability query to refresh UI
        queryClient.invalidateQueries({ queryKey: ['/api/bookings/availability'] });
      } else {
        toast({
          variant: 'destructive',
          title: 'Slot Unavailable',
          description: data.message || 'This time slot was just reserved by another user',
        });
        setSelectedSlotId(null);
      }
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Lock Failed',
        description: 'Unable to reserve time slot. Please try again.',
      });
      setSelectedSlotId(null);
    },
  });

  // Release lock mutation
  const releaseMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest('/api/bookings/release', {
        method: 'POST',
        body: JSON.stringify({ lockToken: token }),
      });
      return response;
    },
    onSuccess: () => {
      setLockToken(null);
      setLockExpiresAt(null);
      setSecondsLeft(0);
      setSelectedSlotId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/availability'] });
    },
  });

  // Countdown timer effect
  useEffect(() => {
    if (!lockExpiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const remaining = Math.floor((lockExpiresAt.getTime() - now.getTime()) / 1000);

      if (remaining <= 0) {
        // Lock expired
        setLockToken(null);
        setLockExpiresAt(null);
        setSecondsLeft(0);
        setSelectedSlotId(null);
        toast({
          variant: 'destructive',
          title: 'Time Expired',
          description: 'Your reservation has expired. Please select again.',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/bookings/availability'] });
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockExpiresAt, toast]);

  // Handle slot selection
  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.status === 'BOOKED') {
      toast({
        variant: 'destructive',
        title: 'Slot Unavailable',
        description: 'This time slot is already booked',
      });
      return;
    }

    if (slot.status === 'HELD' && slot.id !== selectedSlotId) {
      toast({
        variant: 'destructive',
        title: 'Slot Held',
        description: 'This time slot is currently reserved by another user',
      });
      return;
    }

    // If already selected and locked, don't relock
    if (slot.id === selectedSlotId && lockToken) {
      return;
    }

    setSelectedSlotId(slot.id);
    lockMutation.mutate(slot.id);
  };

  // Handle release
  const handleRelease = () => {
    if (lockToken) {
      releaseMutation.mutate(lockToken);
    }
  };

  // Generate day strip (7 days)
  const dayStrip = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Navigate week
  const goToPrevWeek = () => {
    const newWeekStart = addDays(weekStart, -7);
    if (newWeekStart >= minDate) {
      setWeekStart(newWeekStart);
    }
  };

  const goToNextWeek = () => {
    const newWeekStart = addDays(weekStart, 7);
    if (newWeekStart <= maxDate) {
      setWeekStart(newWeekStart);
    }
  };

  // Format time slot
  const formatTimeSlot = (slot: TimeSlot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  // Format countdown
  const formatCountdown = () => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-6">
      {/* Lock Status Banner */}
      {lockToken && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                Time Slot Reserved
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Complete payment within <span className="font-mono font-bold">{formatCountdown()}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRelease}
            className="text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
            data-testid="button-release-lock"
          >
            Release
          </Button>
        </div>
      )}

      {/* Day Strip */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevWeek}
            disabled={weekStart <= minDate}
            className="shrink-0"
            data-testid="button-prev-week"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div
            ref={dayStripRef}
            className="flex-1 flex gap-2 overflow-x-auto scroll-smooth hide-scrollbar"
          >
            {dayStrip.map((date, idx) => {
              const isSelected = isSameDay(date, selectedDate);
              const isDateToday = isToday(date);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'flex-shrink-0 flex flex-col items-center justify-center',
                    'w-16 h-20 rounded-xl transition-all',
                    'border-2',
                    isSelected
                      ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500',
                    isDateToday && !isSelected && 'border-blue-500'
                  )}
                  data-testid={`button-day-${format(date, 'yyyy-MM-dd')}`}
                >
                  <span className="text-xs font-medium uppercase">
                    {format(date, 'EEE')}
                  </span>
                  <span className="text-2xl font-bold mt-1">
                    {format(date, 'd')}
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextWeek}
            disabled={addDays(weekStart, 7) > maxDate}
            className="shrink-0"
            data-testid="button-next-week"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Time Slots Grid */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg" data-testid="text-selected-date">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : slotsForSelectedDate.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400" data-testid="text-no-slots">
            No available time slots for this date
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {slotsForSelectedDate.map((slot) => {
              const isSelected = slot.id === selectedSlotId;
              const isAvailable = slot.status === 'AVAILABLE';
              const isHeld = slot.status === 'HELD';
              const isBooked = slot.status === 'BOOKED';

              return (
                <button
                  key={slot.id}
                  onClick={() => handleSlotClick(slot)}
                  disabled={isBooked || (isHeld && !isSelected) || lockMutation.isPending}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all',
                    'flex flex-col items-center justify-center gap-2',
                    'min-h-[100px]',
                    isSelected && lockToken
                      ? 'bg-green-50 dark:bg-green-950 border-green-500 dark:border-green-500'
                      : isAvailable
                      ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white'
                      : isHeld
                      ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700 cursor-not-allowed opacity-50'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 cursor-not-allowed opacity-50'
                  )}
                  data-testid={`button-slot-${slot.id}`}
                >
                  {isSelected && lockToken ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : isBooked ? (
                    <Lock className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}

                  <span className="font-semibold text-sm text-center">
                    {formatTimeSlot(slot)}
                  </span>

                  {isSelected && lockToken && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-mono">
                      {formatCountdown()}
                    </span>
                  )}

                  {lockMutation.isPending && isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-xl">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
