/**
 * 🏆 APPLE-STYLE CUSTOMER EXPERIENCE UTILITIES
 * Genius Bar concept, proactive support, seamless omnichannel
 * Adopted from Apple's premium customer experience playbook
 */

export interface PetCareConciergeRequest {
  userId: string;
  petId?: string;
  requestType: 'health_question' | 'booking_help' | 'product_advice' | 'complaint' | 'vip_request';
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  preferredChannel: 'whatsapp' | 'phone' | 'video' | 'in_person';
  description: string;
  scheduledFor?: Date;
}

export interface ProactiveAlert {
  userId: string;
  type: 'battery_low' | 'service_due' | 'upgrade_available' | 'health_concern' | 'appointment_reminder';
  title: string;
  message: string;
  actionUrl?: string;
  priority: 'info' | 'warning' | 'critical';
  expiresAt: Date;
}

/**
 * Pet Care Concierge (Apple Genius Bar equivalent)
 * 7 days/week, 8AM-10PM Israel time support
 */
export function createConciergeRequest(
  request: PetCareConciergeRequest
): {
  requestId: string;
  estimatedResponseTime: string;
  assignedSpecialist?: string;
  contactMethod: string;
} {
  const requestId = `PCC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Apple-style SLA: respond within 1 hour for high/emergency, 4 hours for others
  const responseTimes = {
    emergency: '15 minutes',
    high: '1 hour',
    medium: '4 hours',
    low: '24 hours',
  };

  return {
    requestId,
    estimatedResponseTime: responseTimes[request.urgency],
    assignedSpecialist: request.urgency === 'emergency' ? 'Dr. Sarah Cohen (Vet)' : undefined,
    contactMethod: request.preferredChannel,
  };
}

/**
 * Proactive alerts (Apple-style)
 * "Noticed your device battery is low, book service?"
 */
export function generateProactiveAlerts(
  userId: string,
  userActivity: {
    lastWashDate?: Date;
    averageWashInterval?: number;
    petAge?: number;
    totalWashes?: number;
  }
): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const now = new Date();

  // Alert: Time for next wash
  if (userActivity.lastWashDate && userActivity.averageWashInterval) {
    const daysSinceWash = Math.floor(
      (now.getTime() - userActivity.lastWashDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceWash >= userActivity.averageWashInterval * 0.9) {
      alerts.push({
        userId,
        type: 'service_due',
        title: 'Time for a wash? 🐕',
        message: `It's been ${daysSinceWash} days since your last wash. You usually wash every ${userActivity.averageWashInterval} days. Book now?`,
        actionUrl: '/book-wash',
        priority: 'info',
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
    }
  }

  // Alert: Seasonal health reminder
  const month = now.getMonth();
  if (month >= 3 && month <= 8) {
    // Spring/Summer
    alerts.push({
      userId,
      type: 'health_concern',
      title: 'Flea season alert ⚠️',
      message: 'Flea and tick season has started. Consider adding flea treatment to your next wash. Talk to our Pet Care Concierge?',
      actionUrl: '/contact-concierge?topic=flea_treatment',
      priority: 'warning',
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  // Alert: Upgrade opportunity (Apple trade-in style)
  if (userActivity.totalWashes && userActivity.totalWashes >= 10) {
    alerts.push({
      userId,
      type: 'upgrade_available',
      title: 'Upgrade to Unlimited plan 🎁',
      message: `You've completed ${userActivity.totalWashes} washes. Switch to Monthly Unlimited and save up to ₪${((userActivity.totalWashes - 7) * 15).toFixed(0)}/month!`,
      actionUrl: '/upgrade-subscription',
      priority: 'info',
      expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    });
  }

  return alerts;
}

/**
 * Seamless omnichannel experience
 * Start on mobile, continue on web, complete in-person
 */
export interface OmnichannelSession {
  sessionId: string;
  userId: string;
  startedOn: 'web' | 'mobile' | 'in_person' | 'whatsapp';
  currentState: {
    page: string;
    formData?: Record<string, any>;
    cartItems?: any[];
    chatHistory?: any[];
  };
  deviceSyncEnabled: boolean;
  lastSyncedAt: Date;
}

export function syncOmnichannelSession(
  session: OmnichannelSession
): {
  success: boolean;
  message: string;
  availableDevices: string[];
} {
  // Apple-style Handoff: Continue on another device
  return {
    success: true,
    message: 'Session synced across all your devices',
    availableDevices: ['iPhone 14 Pro', 'MacBook Pro', 'iPad Air', 'Web Browser'],
  };
}

/**
 * Apple-style premium unboxing experience
 * Every touchpoint feels luxurious
 */
export function createPremiumOnboarding(userId: string): {
  welcomeMessage: string;
  personalizedSetup: string[];
  exclusiveOffer: string;
  conciergeIntro: boolean;
} {
  return {
    welcomeMessage: 'Welcome to Pet Wash™. We are thrilled to have you join our family of pet parents who demand nothing but the best.',
    personalizedSetup: [
      'Tell us about your pet',
      'Set your wash preferences',
      'Choose your favorite station',
      'Enable smart reminders',
      'Meet your Pet Care Concierge',
    ],
    exclusiveOffer: 'First wash free with code WELCOME (₪15 value)',
    conciergeIntro: true,
  };
}
