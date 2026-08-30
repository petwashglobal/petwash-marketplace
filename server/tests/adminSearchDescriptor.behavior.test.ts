/**
 * AdminSearchDescriptor — Program 50.
 */
import { describe, it, expect } from 'vitest';
import { describeAdminSearch } from '../services/marketplace/AdminSearchDescriptor';

describe('AdminSearchDescriptor', () => {
  it('empty → UNKNOWN with EMPTY_QUERY', () => {
    const out = describeAdminSearch('   ');
    expect(out.channel).toBe('UNKNOWN');
    expect(out.reasonCode).toBe('EMPTY_QUERY');
  });

  it('email → USER_EMAIL, lowercased', () => {
    const out = describeAdminSearch('SUPPORT@PetWash.co.il');
    expect(out.channel).toBe('USER_EMAIL');
    expect(out.normalized).toBe('support@petwash.co.il');
  });

  it('IL phone → USER_PHONE, spaces/dashes stripped', () => {
    const out = describeAdminSearch('+972 50-123-4567');
    expect(out.channel).toBe('USER_PHONE');
    expect(out.normalized).toBe('+972501234567');
  });

  it('booking id B-... → BOOKING, uppercased', () => {
    const out = describeAdminSearch('b-1abc23');
    expect(out.channel).toBe('BOOKING');
    expect(out.normalized).toBe('B-1ABC23');
  });

  it('job ref → JOB_REF', () => {
    expect(describeAdminSearch('JOB-42').channel).toBe('JOB_REF');
  });

  it('refund / shop / gift / thread / tx / provider all route to their channels', () => {
    expect(describeAdminSearch('R-9').channel).toBe('REFUND');
    expect(describeAdminSearch('S-99').channel).toBe('SHOP_ORDER');
    expect(describeAdminSearch('G-77').channel).toBe('GIFT');
    expect(describeAdminSearch('T-55').channel).toBe('THREAD');
    expect(describeAdminSearch('TX-1234').channel).toBe('TRANSACTION');
    expect(describeAdminSearch('PROV-77').channel).toBe('PROVIDER_ID');
  });

  it('anything else → FREE_TEXT (no pattern match, admin runner uses full-text search)', () => {
    const out = describeAdminSearch('Sarah Cohen');
    expect(out.channel).toBe('FREE_TEXT');
    expect(out.normalized).toBe('Sarah Cohen');
  });
});
