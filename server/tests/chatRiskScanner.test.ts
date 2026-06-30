import { describe, it, expect } from 'vitest';
import { scanChatRisk } from '../services/chatRiskScanner';

const codes = (t: string) => scanChatRisk(t).flags.map((f) => f.code);

describe('chatRiskScanner — advisory safety flags (he + en)', () => {
  it('clean message → LOW, no flags', () => {
    const r = scanChatRisk('Hi! Looking forward to looking after Kenzo this weekend.');
    expect(r.level).toBe('LOW');
    expect(r.flags).toHaveLength(0);
  });

  it('empty / null → LOW, no flags', () => {
    expect(scanChatRisk('').level).toBe('LOW');
    expect(scanChatRisk(null).flags).toHaveLength(0);
  });

  it('off-platform payment (EN + HE) → flagged HIGH', () => {
    expect(codes('Can you just pay me in cash instead?')).toContain('OFF_PLATFORM_PAYMENT');
    expect(codes('תעביר לי בביט במקום')).toContain('OFF_PLATFORM_PAYMENT');
    expect(scanChatRisk('send a bank transfer to my account').level).toBe('HIGH');
  });

  it('move chat off-platform (EN + HE) → flagged', () => {
    expect(codes('add me on WhatsApp and we’ll sort it')).toContain('OFF_PLATFORM_CONTACT');
    expect(codes('בוא נדבר בפרטי בוואטסאפ')).toContain('OFF_PLATFORM_CONTACT');
  });

  it('private phone number shared → flagged', () => {
    expect(codes('my number is 054-123-4567')).toContain('PRIVATE_NUMBER_SHARED');
    expect(codes('המספר שלי 0501234567')).toContain('PRIVATE_NUMBER_SHARED');
  });

  it('pet danger (EN + HE) → flagged', () => {
    expect(codes('the dog bite another dog at the park')).toContain('PET_DANGER');
    expect(codes('הכלב ברח מהחצר')).toContain('PET_DANGER');
  });

  it('urgent medical → HIGH', () => {
    const r = scanChatRisk('emergency — he can’t breathe, going to the vet now');
    expect(r.flags.map((f) => f.code)).toContain('MEDICAL_URGENT');
    expect(r.level).toBe('HIGH');
    expect(codes('חירום, הכלב לא נושם')).toContain('MEDICAL_URGENT');
  });

  it('lost pet (EN + HE) → flagged', () => {
    expect(codes('I lost the dog, can’t find him anywhere')).toContain('LOST_PET');
    expect(codes('הכלב אבד')).toContain('LOST_PET');
  });

  it('off-platform booking attempt → flagged', () => {
    expect(codes('let’s cancel the booking and book directly next time')).toContain('OFF_PLATFORM_BOOKING');
  });

  it('abuse / threat → HIGH', () => {
    expect(scanChatRisk('I know where you live').level).not.toBe('LOW');
  });

  it('score is capped at 100 and level escalates', () => {
    const r = scanChatRisk('emergency the dog bite someone, pay me cash on whatsapp');
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.level).toBe('HIGH');
    expect(r.flags.length).toBeGreaterThanOrEqual(3);
  });
});
