/**
 * NotificationComposer — CEO PROGRAM 33 composition.
 *
 * Pure evaluator that COMPOSES a send-ready notification bundle
 * from the primitives:
 *   • NotificationPriorityService — deliver / defer / drop verdict.
 *   • DeepLinkResolver — canonical deep link.
 *   • TranslationSlugCatalog — headline + body slugs the UI translates.
 *
 * The composer never invents user-facing text — it only picks slug
 * codes. Renderer (client / email template) is responsible for the
 * translation table.
 */
import {
  evaluateNotification,
  type NotificationKind,
  type UserNotificationPreferences,
  type DeliveryDecision,
} from './NotificationPriorityService';
import { resolveDeepLink } from './DeepLinkResolver';
import type { JourneyPriority } from '@shared/marketplace/journeyState';

export interface NotificationComposeInput {
  kind: NotificationKind;
  journeyPriority: JourneyPriority;
  entityRef: { kind: string; id: string };
  preferences: UserNotificationPreferences;
  now?: Date;
  lastDeliveredAt?: string;
}

export interface ComposedNotification {
  verdict: 'DELIVER' | 'DEFER' | 'DROP';
  headlineCode: string;                     // stable slug
  bodyCode: string;                         // stable slug (may equal headline)
  channels?: string[];                      // present when verdict === 'DELIVER'
  deferUntil?: string;                      // ISO, present when verdict === 'DEFER'
  reasonCode?: string;                      // present when verdict !== 'DELIVER'
  deepLink: string;                         // always present — the payload MUST carry a deep link
  punchThroughQuietHours?: boolean;
}

const HEADLINE_FOR: Record<NotificationKind, string> = {
  BOOKING_REQUEST_NEW:      'NOTIFY_BOOKING_REQUEST_NEW',
  BOOKING_ACCEPTED:         'NOTIFY_BOOKING_ACCEPTED',
  BOOKING_CHANGE_PROPOSED:  'NOTIFY_BOOKING_CHANGE_PROPOSED',
  BOOKING_CANCELLED:        'NOTIFY_BOOKING_CANCELLED',
  BOOKING_STARTING_SOON:    'NOTIFY_BOOKING_STARTING_SOON',
  PAYMENT_REQUIRED:         'NOTIFY_PAYMENT_REQUIRED',
  PAYMENT_UNCERTAIN:        'NOTIFY_PAYMENT_UNCERTAIN',
  REFUND_STATUS_CHANGED:    'NOTIFY_REFUND_STATUS_CHANGED',
  MESSAGE_NEW:              'NOTIFY_MESSAGE_NEW',
  DOCUMENT_READY:           'NOTIFY_DOCUMENT_READY',
  PROVIDER_KYC_MISSING:     'NOTIFY_PROVIDER_KYC_MISSING',
  PET_KYA_STALE:            'NOTIFY_PET_KYA_STALE',
  INCIDENT_UPDATE:          'NOTIFY_INCIDENT_UPDATE',
  SAFETY_ALERT:             'NOTIFY_SAFETY_ALERT',
  MARKETING_OFFER:          'NOTIFY_MARKETING_OFFER',
  PRESTIGE_MILESTONE:       'NOTIFY_PRESTIGE_MILESTONE',
  K9000_SESSION_UPDATE:     'NOTIFY_K9000_SESSION_UPDATE',
  WALLET_TOPUP_STATUS:      'NOTIFY_WALLET_TOPUP_STATUS',
};

export function composeNotification(input: NotificationComposeInput): ComposedNotification {
  const decision: DeliveryDecision = evaluateNotification({
    kind: input.kind,
    journeyPriority: input.journeyPriority,
    entityRef: input.entityRef,
    preferences: input.preferences,
    now: input.now,
    lastDeliveredAt: input.lastDeliveredAt,
  });
  const headlineCode = HEADLINE_FOR[input.kind];
  const bodyCode = `${headlineCode}_BODY`;
  const deepLink = resolveDeepLink(input.kind, input.entityRef);

  if (decision.verdict === 'DELIVER') {
    return {
      verdict: 'DELIVER',
      headlineCode,
      bodyCode,
      channels: decision.channels,
      deepLink,
      punchThroughQuietHours: decision.punchThroughQuietHours,
    };
  }
  if (decision.verdict === 'DEFER') {
    return {
      verdict: 'DEFER',
      headlineCode,
      bodyCode,
      deferUntil: decision.deferUntil,
      reasonCode: decision.reasonCode,
      deepLink,
    };
  }
  return {
    verdict: 'DROP',
    headlineCode,
    bodyCode,
    reasonCode: decision.reasonCode,
    deepLink,
  };
}
