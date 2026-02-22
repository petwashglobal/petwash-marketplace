import crypto from 'crypto';
import { db } from '../db';
import { users, staffApplications } from '@shared/schema';
import { providerApplicants } from '@shared/schema-enterprise';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type MembershipClass = 'PWM' | 'PWP' | 'PWS';

const CLASS_CONFIG: Record<MembershipClass, { table: any; column: any; label: string }> = {
  PWM: { table: users, column: users.membershipNumber, label: 'Customer' },
  PWP: { table: providerApplicants, column: providerApplicants.membershipNumber, label: 'Provider' },
  PWS: { table: staffApplications, column: staffApplications.membershipNumber, label: 'Staff' },
};

function generateDigits(): string {
  const num = crypto.randomInt(1, 100000000);
  return String(num).padStart(8, '0');
}

async function isCollision(cls: MembershipClass, candidate: string): Promise<boolean> {
  const config = CLASS_CONFIG[cls];
  const rows = await db
    .select({ id: sql`1` })
    .from(config.table)
    .where(eq(config.column, candidate))
    .limit(1);
  return rows.length > 0;
}

export async function generateMembershipId(cls: MembershipClass, countryCode: string = 'IL'): Promise<string> {
  const cc = countryCode.toUpperCase().slice(0, 2);
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `PW-${cc}-${generateDigits()}`;
    if (!(await isCollision(cls, candidate))) {
      logger.info(`[MembershipService] Generated ${CLASS_CONFIG[cls].label} ID: ${candidate}`);
      return candidate;
    }
  }
  const fallback = `PW-${cc}-${Date.now().toString().slice(-8)}`;
  logger.warn(`[MembershipService] Collision fallback used: ${fallback}`);
  return fallback;
}

export async function assignCustomerMembership(userId: string, countryCode?: string): Promise<string> {
  const [existing] = await db
    .select({ membershipNumber: users.membershipNumber })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing?.membershipNumber) {
    return existing.membershipNumber;
  }

  const memberId = await generateMembershipId('PWM', countryCode);
  await db.update(users).set({ membershipNumber: memberId }).where(eq(users.id, userId));
  logger.info(`[MembershipService] Assigned ${memberId} to customer ${userId}`);
  return memberId;
}

export async function assignProviderMembership(applicantId: number, countryCode?: string): Promise<string> {
  const [existing] = await db
    .select({ membershipNumber: providerApplicants.membershipNumber })
    .from(providerApplicants)
    .where(eq(providerApplicants.id, applicantId))
    .limit(1);

  if (existing?.membershipNumber && existing.membershipNumber.startsWith('PW-')) {
    return existing.membershipNumber;
  }

  const memberId = await generateMembershipId('PWP', countryCode);
  await db.update(providerApplicants).set({ membershipNumber: memberId }).where(eq(providerApplicants.id, applicantId));
  logger.info(`[MembershipService] Assigned ${memberId} to provider applicant ${applicantId}`);
  return memberId;
}

export async function assignStaffMembership(applicationId: number, countryCode?: string): Promise<string> {
  const [existing] = await db
    .select({ membershipNumber: staffApplications.membershipNumber })
    .from(staffApplications)
    .where(eq(staffApplications.id, applicationId))
    .limit(1);

  if (existing?.membershipNumber) {
    return existing.membershipNumber;
  }

  const memberId = await generateMembershipId('PWS', countryCode);
  await db.update(staffApplications).set({ membershipNumber: memberId }).where(eq(staffApplications.id, applicationId));
  logger.info(`[MembershipService] Assigned ${memberId} to staff application ${applicationId}`);
  return memberId;
}

export function parseMembershipClass(id: string): MembershipClass | null {
  if (!id.startsWith('PW-')) {
    if (id.startsWith('PWM-')) return 'PWM';
    if (id.startsWith('PWP-')) return 'PWP';
    if (id.startsWith('PWS-')) return 'PWS';
    return null;
  }
  return 'PWM';
}
