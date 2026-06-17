/**
 * Per-service provider approval gate (DB-backed wrapper around the pure ladder
 * in shared/provider-service-levels.ts).
 *
 * `assertServiceApproved(providerId, serviceType, level)` is the single check
 * booking / payout paths call before letting a provider act. Safe by default:
 * no row, paused, suspended, rejected, expired, or needs-reconfirmation → BLOCKED.
 */
import { db } from '../db';
import { and, eq } from 'drizzle-orm';
import { providerServices } from '@shared/schema-provider-services';
import {
  isServiceApprovedFor,
  type ServiceLevel,
  type ServiceApprovalResult,
  type ServiceRowLike,
} from '@shared/provider-service-levels';

export type { ServiceLevel, ServiceApprovalResult };
export { isServiceApprovedFor };

/** DB-backed check used by routes. */
export async function assertServiceApproved(
  providerId: string,
  serviceType: string,
  level: ServiceLevel,
): Promise<ServiceApprovalResult> {
  const [row] = await db
    .select()
    .from(providerServices)
    .where(and(eq(providerServices.providerId, providerId), eq(providerServices.serviceType, serviceType)))
    .limit(1);
  return isServiceApprovedFor(row as ServiceRowLike | undefined, level);
}
