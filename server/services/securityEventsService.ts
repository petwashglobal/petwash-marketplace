import { db } from "../db";
import { securityEvents } from "@shared/schema";
import { logger } from "../lib/logger";

export async function logSecurityEvent(data: {
  userId?: string;
  eventType: string;
  ip?: string;
  userAgent?: string;
  riskScore?: number;
  metadata?: any;
}): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      userId: data.userId || null,
      eventType: data.eventType,
      ip: data.ip || null,
      userAgent: data.userAgent || null,
      riskScore: data.riskScore ?? 0,
      metadata: data.metadata || null,
    });
    logger.info(`[SecurityEvents] ${data.eventType} for user=${data.userId || 'anonymous'}`, { eventType: data.eventType, riskScore: data.riskScore });
  } catch (err: any) {
    logger.error(`[SecurityEvents] Failed to log event: ${err.message}`);
  }
}

export async function logMfaEvent(userId: string, action: 'mfa_enroll' | 'mfa_fail' | 'mfa_success', ip?: string, userAgent?: string, metadata?: any): Promise<void> {
  const riskScore = action === 'mfa_fail' ? 50 : 0;
  await logSecurityEvent({ userId, eventType: action, ip, userAgent, riskScore, metadata });
}

export async function logLoginAnomaly(userId: string, ip: string, userAgent: string, reason: string, riskScore: number): Promise<void> {
  await logSecurityEvent({ userId, eventType: 'login_anomaly', ip, userAgent, riskScore, metadata: { reason } });
}

export async function logKycVelocity(userId: string, metadata: any): Promise<void> {
  await logSecurityEvent({ userId, eventType: 'kyc_velocity', riskScore: 70, metadata });
}

export async function logRateLimitEvent(ip: string, endpoint: string, userAgent?: string): Promise<void> {
  await logSecurityEvent({ eventType: 'rate_limited', ip, userAgent, riskScore: 30, metadata: { endpoint } });
}

export async function logTokenReuse(userId: string, ip: string, userAgent: string): Promise<void> {
  await logSecurityEvent({ userId, eventType: 'token_reuse', ip, userAgent, riskScore: 80 });
}
