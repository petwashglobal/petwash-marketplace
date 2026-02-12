import { logger } from '../lib/logger';
import {
  GoogleSheetsService,
  logRegistration,
} from './googleSheetsIntegration';
import { googleDriveBackupService } from './googleDriveBackupService';

export type BookingEventType =
  | 'created'
  | 'provider_accepted'
  | 'provider_declined'
  | 'meet_greet_scheduled'
  | 'meet_greet_completed'
  | 'payment_held'
  | 'service_started'
  | 'service_completed'
  | 'owner_confirmed'
  | 'cancelled'
  | 'refund_processed'
  | 'photo_update';

export interface BookingEventPayload {
  requestId: string;
  providerType: string;
  serviceType: string;
  ownerId: string;
  providerId: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  providerName?: string;
  petName?: string;
  petType?: string;
  startDate: string;
  endDate: string;
  totalDays?: number;
  totalCents: number;
  subtotalCents: number;
  serviceFeeCents: number;
  currency: string;
  status: string;
  location?: string;
  message?: string;
}

interface DualTimestamps {
  customerRequestedAt: string;
  providerRespondedAt?: string;
  paymentHeldAt?: string;
  serviceStartedAt?: string;
  serviceCompletedAt?: string;
  ownerConfirmedAt?: string;
  paymentReleasedAt?: string;
  cancelledAt?: string;
}

const PLATFORM_SHEET_MAP: Record<string, string> = {
  sitter: 'sitter',
  walker: 'walker',
  trainer: 'academy',
  driver: 'pettrek',
  k9000: 'k9000',
};

function getSheetLogFn(providerType: string) {
  const key = PLATFORM_SHEET_MAP[providerType] || 'sitter';
  switch (key) {
    case 'sitter': return GoogleSheetsService.logSitterBooking;
    case 'walker': return GoogleSheetsService.logWalkerBooking;
    case 'pettrek': return GoogleSheetsService.logPetTrekBooking;
    case 'academy': return GoogleSheetsService.logAcademyBooking;
    case 'k9000': return GoogleSheetsService.logK9000Booking;
    default: return GoogleSheetsService.logSitterBooking;
  }
}

function buildSheetPayload(event: BookingEventType, booking: BookingEventPayload): Record<string, any> {
  const base = {
    bookingId: booking.requestId,
    customerName: booking.ownerName || booking.ownerId,
    email: booking.ownerEmail || '',
    phone: booking.ownerPhone || '',
    status: `${booking.status} (${event})`,
  };

  const type = PLATFORM_SHEET_MAP[booking.providerType] || 'sitter';

  switch (type) {
    case 'sitter':
      return {
        ...base,
        petName: booking.petName || '',
        petType: booking.petType || 'dog',
        sitterName: booking.providerName || booking.providerId,
        startDate: booking.startDate,
        endDate: booking.endDate,
        durationDays: booking.totalDays || 1,
        totalAmount: booking.totalCents / 100,
      };
    case 'walker':
      return {
        ...base,
        dogName: booking.petName || '',
        breed: booking.petType || '',
        walkerName: booking.providerName || booking.providerId,
        walkDate: booking.startDate,
        durationMins: 60,
        location: booking.location || '',
        amount: booking.totalCents / 100,
      };
    case 'pettrek':
      return {
        tripId: booking.requestId,
        customerName: base.customerName,
        email: base.email,
        phone: base.phone,
        petName: booking.petName || '',
        petType: booking.petType || 'dog',
        pickupLocation: booking.location || '',
        dropoffLocation: '',
        driverName: booking.providerName || booking.providerId,
        tripDate: booking.startDate,
        amount: booking.totalCents / 100,
        status: base.status,
      };
    case 'academy':
      return {
        ...base,
        petName: booking.petName || '',
        petAge: 0,
        trainerName: booking.providerName || booking.providerId,
        sessionType: booking.serviceType,
        sessionDate: booking.startDate,
        durationMins: 60,
        amount: booking.totalCents / 100,
      };
    default:
      return base;
  }
}

export async function logBookingEvent(
  event: BookingEventType,
  booking: BookingEventPayload,
  timestamps: DualTimestamps,
  metadata?: Record<string, any>
): Promise<void> {
  const eventTimestamp = new Date().toISOString();

  try {
    const sheetPayload = buildSheetPayload(event, booking);
    const logFn = getSheetLogFn(booking.providerType);
    await logFn(sheetPayload as any);

    logger.info('[BookingEventLogger] Logged to Google Sheets', {
      event,
      requestId: booking.requestId,
      providerType: booking.providerType,
      timestamp: eventTimestamp,
    });
  } catch (sheetsError: any) {
    logger.warn('[BookingEventLogger] Google Sheets logging failed (queued for retry)', {
      event,
      requestId: booking.requestId,
      error: sheetsError.message,
    });
  }

  const criticalEvents: BookingEventType[] = [
    'created', 'provider_accepted', 'payment_held',
    'service_completed', 'owner_confirmed', 'cancelled',
  ];

  if (criticalEvents.includes(event)) {
    try {
      await googleDriveBackupService.backupJSON(
        {
          event,
          booking,
          timestamps,
          metadata,
          loggedAt: eventTimestamp,
        },
        `booking-${booking.requestId}-${event}`,
        true
      );

      logger.info('[BookingEventLogger] Backed up to Google Drive', {
        event,
        requestId: booking.requestId,
      });
    } catch (driveError: any) {
      logger.warn('[BookingEventLogger] Google Drive backup failed (non-blocking)', {
        event,
        requestId: booking.requestId,
        error: driveError.message,
      });
    }
  }

  logger.info('[BookingEventLogger] Event recorded', {
    event,
    requestId: booking.requestId,
    providerType: booking.providerType,
    status: booking.status,
    dualTimestamps: {
      customerRequestedAt: timestamps.customerRequestedAt,
      providerRespondedAt: timestamps.providerRespondedAt || null,
      ownerConfirmedAt: timestamps.ownerConfirmedAt || null,
    },
    eventTimestamp,
  });
}

export async function logNewUserRegistration(user: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  registrationSource: string;
  profilePhotoUrl?: string;
  language?: string;
}): Promise<void> {
  try {
    await logRegistration({
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      country: user.country || 'IL',
      registrationSource: user.registrationSource || 'web',
      profilePhotoUrl: user.profilePhotoUrl || '',
      language: user.language || 'he',
    });

    logger.info('[BookingEventLogger] New user logged to Google Sheets', {
      userId: user.userId,
      email: user.email,
    });
  } catch (sheetsError: any) {
    logger.warn('[BookingEventLogger] User registration Sheets logging failed', {
      error: sheetsError.message,
    });
  }

  try {
    await googleDriveBackupService.backupJSON(
      {
        event: 'user_registration',
        user,
        registeredAt: new Date().toISOString(),
      },
      `user-registration-${user.userId}`,
      true
    );

    logger.info('[BookingEventLogger] New user backed up to Google Drive', {
      userId: user.userId,
    });
  } catch (driveError: any) {
    logger.warn('[BookingEventLogger] User Drive backup failed (non-blocking)', {
      error: driveError.message,
    });
  }
}

export default {
  logBookingEvent,
  logNewUserRegistration,
};
