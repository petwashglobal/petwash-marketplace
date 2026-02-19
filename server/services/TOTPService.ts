import crypto from 'crypto';
import { db } from '../db';
import { mfaEnrollments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
const TOTP_ISSUER = 'PetWash';
const TOTP_WINDOW = 1;

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  while (bits.length % 5 !== 0) bits += '0';
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const idx = parseInt(bits.substring(i, i + 5), 2);
    result += alphabet[idx];
  }
  return result;
}

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = encoded.replace(/[= ]/g, '').toUpperCase();
  let bits = '';
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateHOTP(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  const hmac = crypto.createHmac(TOTP_ALGORITHM, secret);
  hmac.update(counterBuf);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

function generateTOTP(secret: Buffer, timeStep: number = TOTP_PERIOD): string {
  const counter = BigInt(Math.floor(Date.now() / 1000 / timeStep));
  return generateHOTP(secret, counter);
}

function verifyTOTP(secret: Buffer, token: string, window: number = TOTP_WINDOW): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    const counter = BigInt(Math.floor(now / TOTP_PERIOD) + i);
    const expected = generateHOTP(secret, counter);
    if (constantTimeEq(expected, token)) {
      return true;
    }
  }
  return false;
}

function constantTimeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export class TOTPService {
  generateSecret(): { secret: string; base32: string } {
    const secretBytes = crypto.randomBytes(20);
    const base32 = base32Encode(secretBytes);
    return { secret: secretBytes.toString('hex'), base32 };
  }

  generateQRUri(email: string, base32Secret: string): string {
    const label = encodeURIComponent(`${TOTP_ISSUER}:${email}`);
    const params = new URLSearchParams({
      secret: base32Secret,
      issuer: TOTP_ISSUER,
      algorithm: TOTP_ALGORITHM.toUpperCase(),
      digits: TOTP_DIGITS.toString(),
      period: TOTP_PERIOD.toString(),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  verifyCode(base32Secret: string, code: string): boolean {
    try {
      const secretBytes = base32Decode(base32Secret);
      return verifyTOTP(secretBytes, code.trim());
    } catch (error) {
      logger.error('[TOTP] Verification error:', error);
      return false;
    }
  }

  async enrollUser(args: {
    userId: string;
    userEmail: string;
    method: 'totp' | 'sms' | 'email';
    phone?: string;
  }): Promise<{
    ok: boolean;
    enrollmentId?: number;
    totpSecret?: string;
    totpUri?: string;
    error?: string;
  }> {
    const { userId, userEmail, method } = args;

    try {
      const existing = await db
        .select()
        .from(mfaEnrollments)
        .where(
          and(
            eq(mfaEnrollments.userId, userId),
            eq(mfaEnrollments.method, method),
            eq(mfaEnrollments.isActive, true)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        if (method === 'totp' && !existing[0].totpVerified) {
          return {
            ok: true,
            enrollmentId: existing[0].id,
            totpSecret: existing[0].totpSecret || undefined,
            totpUri: existing[0].totpSecret
              ? this.generateQRUri(userEmail, existing[0].totpSecret)
              : undefined,
          };
        }
        return { ok: false, error: 'already_enrolled' };
      }

      let totpSecret: string | undefined;
      let totpUri: string | undefined;

      if (method === 'totp') {
        const { base32 } = this.generateSecret();
        totpSecret = base32;
        totpUri = this.generateQRUri(userEmail, base32);
      }

      const [enrollment] = await db
        .insert(mfaEnrollments)
        .values({
          userId,
          userEmail: userEmail.toLowerCase(),
          method,
          totpSecret: totpSecret || null,
          totpVerified: method !== 'totp',
          smsPhone: args.phone || null,
          emailAddress: method === 'email' ? userEmail : null,
          isActive: true,
        })
        .returning({ id: mfaEnrollments.id });

      logger.info('[TOTP] MFA enrolled', { userId, method, enrollmentId: enrollment.id });

      return {
        ok: true,
        enrollmentId: enrollment.id,
        totpSecret: method === 'totp' ? totpSecret : undefined,
        totpUri: method === 'totp' ? totpUri : undefined,
      };
    } catch (error) {
      logger.error('[TOTP] Enrollment error:', error);
      return { ok: false, error: 'enrollment_failed' };
    }
  }

  async verifyEnrollment(userId: string, code: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const [enrollment] = await db
        .select()
        .from(mfaEnrollments)
        .where(
          and(
            eq(mfaEnrollments.userId, userId),
            eq(mfaEnrollments.method, 'totp'),
            eq(mfaEnrollments.isActive, true),
            eq(mfaEnrollments.totpVerified, false)
          )
        )
        .limit(1);

      if (!enrollment || !enrollment.totpSecret) {
        return { ok: false, error: 'no_pending_enrollment' };
      }

      const valid = this.verifyCode(enrollment.totpSecret, code);
      if (!valid) {
        return { ok: false, error: 'invalid_code' };
      }

      await db
        .update(mfaEnrollments)
        .set({ totpVerified: true, lastUsedAt: new Date() })
        .where(eq(mfaEnrollments.id, enrollment.id));

      logger.info('[TOTP] Enrollment verified', { userId, enrollmentId: enrollment.id });

      return { ok: true };
    } catch (error) {
      logger.error('[TOTP] Verify enrollment error:', error);
      return { ok: false, error: 'verification_failed' };
    }
  }

  async verifyUserMfa(userId: string, code: string, method?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const enrollments = await db
        .select()
        .from(mfaEnrollments)
        .where(
          and(
            eq(mfaEnrollments.userId, userId),
            eq(mfaEnrollments.isActive, true)
          )
        );

      if (enrollments.length === 0) {
        return { ok: false, error: 'no_mfa_enrolled' };
      }

      for (const enrollment of enrollments) {
        if (method && enrollment.method !== method) continue;

        if (enrollment.method === 'totp' && enrollment.totpSecret && enrollment.totpVerified) {
          if (this.verifyCode(enrollment.totpSecret, code)) {
            await db
              .update(mfaEnrollments)
              .set({ lastUsedAt: new Date() })
              .where(eq(mfaEnrollments.id, enrollment.id));
            return { ok: true };
          }
        }
      }

      return { ok: false, error: 'invalid_code' };
    } catch (error) {
      logger.error('[TOTP] Verify MFA error:', error);
      return { ok: false, error: 'verification_failed' };
    }
  }

  async getUserEnrollments(userId: string): Promise<Array<{
    id: number;
    method: string;
    isActive: boolean;
    verified: boolean;
    enrolledAt: Date;
    lastUsedAt: Date | null;
  }>> {
    const enrollments = await db
      .select()
      .from(mfaEnrollments)
      .where(eq(mfaEnrollments.userId, userId));

    return enrollments.map(e => ({
      id: e.id,
      method: e.method,
      isActive: e.isActive,
      verified: e.method === 'totp' ? (e.totpVerified ?? false) : true,
      enrolledAt: e.enrolledAt,
      lastUsedAt: e.lastUsedAt,
    }));
  }

  async removeEnrollment(userId: string, enrollmentId: number): Promise<{ ok: boolean; error?: string }> {
    try {
      const [enrollment] = await db
        .select()
        .from(mfaEnrollments)
        .where(
          and(
            eq(mfaEnrollments.id, enrollmentId),
            eq(mfaEnrollments.userId, userId)
          )
        )
        .limit(1);

      if (!enrollment) {
        return { ok: false, error: 'not_found' };
      }

      await db
        .update(mfaEnrollments)
        .set({ isActive: false })
        .where(eq(mfaEnrollments.id, enrollmentId));

      logger.info('[TOTP] MFA enrollment deactivated', { userId, enrollmentId });
      return { ok: true };
    } catch (error) {
      logger.error('[TOTP] Remove enrollment error:', error);
      return { ok: false, error: 'removal_failed' };
    }
  }
}

export const totpService = new TOTPService();
