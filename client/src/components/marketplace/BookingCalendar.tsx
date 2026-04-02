import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/apiConfig';
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookingCalendarProps {
  platform: string;
  providerId: number;
  onSlotSelected: (slotDetails: {
    slotId: number;
    lockToken: string;
    expiresAt: Date;
    startTime: Date;
    endTime: Date;
  }) => void;
  bookingMode: 'SINGLE_SLOT' | 'MULTI_SLOT';
}

interface AvailabilitySlot {
  id: number;
  providerId: number;
  platform: string;
  start: string;
  end: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  timezone: string;
}

export function BookingCalendar({ platform, providerId, onSlotSelected, bookingMode }: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const { toast } = useToast();

  const fromDate = selectedDate || new Date();
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + 7);

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; slots: AvailabilitySlot[]; count: number }>({
    queryKey: ['/api/bookings/availability', platform, providerId, fromDate.toISOString(), toDate.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        platform,
        providerId: providerId.toString(),
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      });
      const res = await fetch(getApiUrl(`/api/bookings/availability?${params}`), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch availability');
      return res.json();
    },
    enabled: !!selectedDate,
    retry: 1,
    retryDelay: 1000,
  });

  const effectiveSlots = data?.slots || [];

  // Reset selection when date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const handleSlotClick = (slot: AvailabilitySlot) => {
    if (slot.status !== 'AVAILABLE') {
      toast({
        title: "Slot Unavailable",
        description: "This time slot is already booked or held. Please select another time.",
        variant: "destructive",
      });
      return;
    }

    setSelectedSlot(slot);
    
    const startTime = new Date(slot.start);
    const endTime = new Date(slot.end);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute client-side hold

    onSlotSelected({
      slotId: slot.id,
      lockToken: `client_hold_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`,
      expiresAt,
      startTime,
      endTime,
    });

    toast({
      title: "Time Slot Selected ✓",
      description: `Reserved for 15 minutes: ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    });
  };

  const slotsForSelectedDate = effectiveSlots.filter(slot => {
    if (!selectedDate) return false;
    const slotDate = new Date(slot.start);
    return (
      slotDate.getDate() === selectedDate.getDate() &&
      slotDate.getMonth() === selectedDate.getMonth() &&
      slotDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Date</h3>
        <MobileDatePicker
          value={selectedDate}
          onChange={setSelectedDate}
          minDate={new Date()}
        />
      </div>

      {selectedDate && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Available Time Slots
          </h3>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <span className="ml-2 text-gray-600">Loading availability...</span>
            </div>
          )}

          {error && (
            <Card className="border-amber-200 bg-white dark:bg-amber-900/20">
              <CardContent className="p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  Could not load availability for this provider. Please try again.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetch()}
                  className="text-amber-700 border-amber-300"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && slotsForSelectedDate.length === 0 && (
            <Card className="border-yellow-200 bg-white dark:bg-yellow-900/20">
              <CardContent className="p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  No available slots for this date. Please select another day.
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && slotsForSelectedDate.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {slotsForSelectedDate.map((slot) => {
                const startTime = new Date(slot.start);
                const timeLabel = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isSelected = selectedSlot?.id === slot.id;
                const isAvailable = slot.status === 'AVAILABLE';

                return (
                  <Button
                    key={slot.id}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleSlotClick(slot)}
                    disabled={!isAvailable}
                    className={`${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : isAvailable
                        ? 'hover:border-purple-300'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    data-testid={`time-slot-${timeLabel}`}
                  >
                    {timeLabel}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedSlot && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✓ Selected: {new Date(selectedSlot.start).toLocaleDateString()} at {new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Reserved for 15 minutes - complete your booking to confirm
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BookingCalendar;
