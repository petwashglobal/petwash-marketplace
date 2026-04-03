/**
 * Shared intelligence types — used by both server and client.
 * Source of truth for journey state, user intelligence, and realtime events.
 */

export type JourneyState =
  | 'visitor'
  | 'browsing'
  | 'authenticated'
  | 'ready_to_book'
  | 'booked';

export const JOURNEY_ORDER: JourneyState[] = [
  'visitor',
  'browsing',
  'authenticated',
  'ready_to_book',
  'booked',
];

export const JOURNEY_LABELS: Record<JourneyState, { he: string; en: string }> = {
  visitor:        { he: 'מבקר',         en: 'Visitor' },
  browsing:       { he: 'מחפש שירות',   en: 'Browsing' },
  authenticated:  { he: 'מחובר',        en: 'Signed In' },
  ready_to_book:  { he: 'מוכן להזמנה', en: 'Ready to Book' },
  booked:         { he: 'הוזמן',        en: 'Booked' },
};

export interface UserIntelligenceProfile {
  userId: string;
  userType: 'customer' | 'provider';
  trustScore: number;
  behaviorScore: number;
  riskLevel: number;
  bookingHistoryCount: number;
  cancellationRate: number;
  noShowCount: number;
  repeatUsageCount: number;
  recentActivityDaysAgo: number | null;
  preferences: Record<string, unknown>;
  lastComputedAt: string | null;
  journeyState?: JourneyState;
}

export interface JourneyStateResponse {
  journeyState: JourneyState;
}

export interface ProviderArrivingPayload {
  eta?: string;
}

// ── Realtime WebSocket protocol ───────────────────────────────────────────────

/** Client → Server messages */
export type WsClientMessage =
  | { type: 'START_SEARCH'; service: string; location?: { lat: number; lng: number } }
  | { type: 'CANCEL' }
  | { type: 'SUBSCRIBE_BOOKING'; requestId: string }
  | { type: 'UNSUBSCRIBE_BOOKING'; requestId: string }
  | { type: 'SUBSCRIBE_ADMIN' };

/** Server → Client messages */
export type WsServerMessage =
  | { type: 'SEARCHING'; service: string }
  | { type: 'MATCH_FOUND'; payload: object }
  | { type: 'NO_MATCH' }
  | { type: 'SUBSCRIBED'; requestId: string }
  | { type: 'PROVIDER_ACCEPTED'; requestId: string; providerId: string; ownerId: string; newStatus: string; serviceType: string; timestamp: string }
  | { type: 'PROVIDER_ARRIVING'; requestId: string; providerId: string; ownerId: string; eta: string | null; serviceType: string; timestamp: string }
  | { type: 'MATCHING_STARTED'; serviceType: string; totalCandidates: number; timestamp: string };

/** EventBus event types (server-internal) */
export interface RealtimeMarketplaceEvent {
  eventType: 'matching.started' | 'provider.accepted' | 'provider.arriving';
  timestamp: string;
  platform?: string;
  userId?: string;
  data?: Record<string, unknown>;
}
