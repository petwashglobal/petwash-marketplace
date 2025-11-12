import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { MobileDatePicker, QuickDateButtons } from '@/components/ui/mobile-date-picker';
import { MobileInput } from '@/components/ui/mobile-input';
import { GooglePlacesAutocomplete, type PlaceDetails } from '@/components/ui/google-places-autocomplete';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Users, Mail, Phone, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Language } from '@/lib/i18n';

/**
 * 🌟 PREMIUM MEETING SCHEDULER 🌟
 * 
 * World-class calendar system for:
 * - Internal employees
 * - Partners and franchisees
 * - External customers
 * 
 * Features:
 * - Finger-friendly mobile interface
 * - Google Calendar integration
 * - Automatic address fill
 * - Smart time suggestions
 * - WhatsApp/Email notifications
 * - 7-star UX experience
 */

interface MeetingSchedulerProps {
  language: Language;
  meetingType?: 'internal' | 'partner' | 'customer';
  prefilledData?: Partial<MeetingFormData>;
}

interface MeetingFormData {
  title: string;
  date: Date;
  duration: number; // minutes
  location: string;
  locationDetails?: PlaceDetails;
  attendees: string[]; // email addresses
  description: string;
  phone?: string;
  meetingType: 'internal' | 'partner' | 'customer';
  notificationMethod: 'whatsapp' | 'email' | 'both';
}

export function MeetingScheduler({ language, meetingType = 'customer', prefilledData }: MeetingSchedulerProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<MeetingFormData>>({
    meetingType,
    notificationMethod: 'whatsapp',
    duration: 30,
    attendees: [],
    ...prefilledData,
  });
  const [attendeeEmail, setAttendeeEmail] = useState('');

  const texts = {
    en: {
      title: 'Schedule a Meeting',
      subtitle: 'Book a time that works for everyone',
      meetingTitle: 'Meeting Title',
      meetingTitlePlaceholder: 'e.g., Franchise Discussion, Station Maintenance',
      date: 'Date & Time',
      duration: 'Duration',
      location: 'Meeting Location',
      attendees: 'Attendees',
      addAttendee: 'Add Attendee',
      description: 'Description',
      descriptionPlaceholder: 'Add any additional details or agenda...',
      phone: 'Contact Phone',
      phonePlaceholder: '+972-XX-XXX-XXXX',
      notificationMethod: 'Send Notifications Via',
      whatsapp: 'WhatsApp',
      email: 'Email',
      both: 'Both',
      schedule: 'Schedule Meeting',
      cancel: 'Cancel',
      successTitle: '✅ Meeting Scheduled!',
      successDesc: 'All attendees will receive a notification',
      errorTitle: 'Error Scheduling Meeting',
    },
    he: {
      title: 'תזמון פגישה',
      subtitle: 'בחר זמן שמתאים לכולם',
      meetingTitle: 'שם הפגישה',
      meetingTitlePlaceholder: 'לדוגמה: דיון זיכיון, תחזוקת תחנה',
      date: 'תאריך ושעה',
      duration: 'משך הפגישה',
      location: 'מיקום הפגישה',
      attendees: 'משתתפים',
      addAttendee: 'הוסף משתתף',
      description: 'תיאור',
      descriptionPlaceholder: 'הוסף פרטים נוספים או סדר יום...',
      phone: 'טלפון ליצירת קשר',
      phonePlaceholder: '050-XXX-XXXX',
      notificationMethod: 'שלח התראות דרך',
      whatsapp: 'וואטסאפ',
      email: 'אימייל',
      both: 'שניהם',
      schedule: 'תזמן פגישה',
      cancel: 'ביטול',
      successTitle: '✅ הפגישה נקבעה!',
      successDesc: 'כל המשתתפים יקבלו התראה',
      errorTitle: 'שגיאה בתזמון הפגישה',
    },
  };

  const t = texts[language === 'he' ? 'he' : 'en'];

  const scheduleMeeting = useMutation({
    mutationFn: async (data: MeetingFormData) => {
      return await apiRequest('/api/meetings/schedule', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: t.successTitle,
        description: t.successDesc,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      // Reset form
      setFormData({
        meetingType,
        notificationMethod: 'whatsapp',
        duration: 30,
        attendees: [],
      });
    },
    onError: (error: any) => {
      toast({
        title: t.errorTitle,
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.date || !formData.location) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    scheduleMeeting.mutate(formData as MeetingFormData);
  };

  const handleAddAttendee = () => {
    if (attendeeEmail && attendeeEmail.includes('@')) {
      setFormData({
        ...formData,
        attendees: [...(formData.attendees || []), attendeeEmail],
      });
      setAttendeeEmail('');
    }
  };

  const handleRemoveAttendee = (email: string) => {
    setFormData({
      ...formData,
      attendees: (formData.attendees || []).filter((e) => e !== email),
    });
  };

  const durationOptions = [15, 30, 45, 60, 90, 120];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Card className="p-6 sm:p-8 shadow-xl border-2">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Meeting Title */}
          <MobileInput
            label={t.meetingTitle}
            value={formData.title || ''}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t.meetingTitlePlaceholder}
            icon={<MessageSquare className="w-5 h-5" />}
            required
            data-testid="input-meeting-title"
          />

          {/* Date & Time */}
          <div>
            <MobileDatePicker
              label={t.date}
              value={formData.date}
              onChange={(date) => setFormData({ ...formData, date })}
              includeTime
              minDate={new Date()}
              required
            />
            <div className="mt-3">
              <QuickDateButtons
                onSelect={(date) => setFormData({ ...formData, date })}
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-base font-medium text-gray-700">
              {t.duration} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {durationOptions.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setFormData({ ...formData, duration: minutes })}
                  className={`
                    min-h-[56px] rounded-xl border-2 font-semibold transition-all
                    ${formData.duration === minutes
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }
                  `}
                  data-testid={`button-duration-${minutes}`}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

          {/* Location with Google Places Autocomplete */}
          <GooglePlacesAutocomplete
            label={t.location}
            value={formData.location || ''}
            onChange={(value, details) => {
              setFormData({
                ...formData,
                location: value,
                locationDetails: details,
              });
            }}
            placeholder="Start typing the address..."
            country={['il', 'us', 'ca', 'gb', 'au']}
            required
          />

          {/* Attendees */}
          <div className="space-y-3">
            <label className="text-base font-medium text-gray-700">{t.attendees}</label>
            <div className="flex gap-2">
              <MobileInput
                type="email"
                value={attendeeEmail}
                onChange={(e) => setAttendeeEmail(e.target.value)}
                placeholder="email@example.com"
                icon={<Mail className="w-5 h-5" />}
                className="flex-1"
                data-testid="input-attendee-email"
              />
              <Button
                type="button"
                onClick={handleAddAttendee}
                className="min-h-[56px] px-6 bg-blue-600 hover:bg-blue-700"
                data-testid="button-add-attendee"
              >
                +
              </Button>
            </div>
            {(formData.attendees || []).length > 0 && (
              <div className="space-y-2">
                {formData.attendees?.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <span className="text-sm font-medium text-blue-900">{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(email)}
                      className="text-red-600 hover:text-red-700"
                      data-testid={`button-remove-attendee-${email}`}
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phone */}
          <MobileInput
            label={t.phone}
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder={t.phonePlaceholder}
            icon={<Phone className="w-5 h-5" />}
            data-testid="input-meeting-phone"
          />

          {/* Description */}
          <div className="space-y-2">
            <label className="text-base font-medium text-gray-700">{t.description}</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t.descriptionPlaceholder}
              rows={4}
              className="w-full px-5 py-4 text-base rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all"
              data-testid="textarea-meeting-description"
            />
          </div>

          {/* Notification Method */}
          <div className="space-y-3">
            <label className="text-base font-medium text-gray-700">{t.notificationMethod}</label>
            <div className="grid grid-cols-3 gap-3">
              {(['whatsapp', 'email', 'both'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setFormData({ ...formData, notificationMethod: method })}
                  className={`
                    min-h-[56px] rounded-xl border-2 font-semibold transition-all
                    ${formData.notificationMethod === method
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                    }
                  `}
                  data-testid={`button-notification-${method}`}
                >
                  {t[method]}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={scheduleMeeting.isPending}
            className="w-full min-h-[64px] text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
            data-testid="button-schedule-meeting"
          >
            {scheduleMeeting.isPending ? (
              <>⏳ {language === 'he' ? 'מתזמן...' : 'Scheduling...'}</>
            ) : (
              <>
                <CheckCircle className="w-6 h-6 mr-2" />
                {t.schedule}
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
