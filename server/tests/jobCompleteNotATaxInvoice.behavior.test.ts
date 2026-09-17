/**
 * POST /api/orchestrator/job-complete (provider "Finish job") emailed the
 * customer an HTML "חשבונית מס / Tax Invoice": made-up PWI number, VAT on the
 * whole amount, a footer claiming legal compliance, never issued by SUMIT, on
 * an amount the provider typed, with the provider's text pasted raw into HTML.
 * It also told the provider their net was 85% of what the client paid.
 * Now: a job summary that says it is not a tax invoice, one-money-model
 * numbers (fee = paid × 15/115, provider keeps the rest), escaped fields.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const sent: Array<{ to: string; subject: string; html: string }> = [];
const drive: string[] = [];
const sheet: any[][] = [];

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../emailService', () => ({
  EmailService: { send: vi.fn(async (m: any) => { sent.push({ to: m.to, subject: m.subject, html: m.html }); return true; }) },
}));
vi.mock('./../services/CalendarIntegrationService', () => ({ calendarIntegrationService: {} }));
vi.mock('../services/CalendarIntegrationService', () => ({ calendarIntegrationService: {} }));
vi.mock('../services/googleDriveBackupService', () => ({
  GoogleDriveBackupService: class {
    async backupDocument(_n: string, c: string) { drive.push(c); return 'doc1'; }
    async uploadFile(_n: string, c: any) { drive.push(String(c)); return 'doc1'; }
  },
}));
vi.mock('../services/googleSheetsIntegration', () => ({
  GoogleSheetsService: { appendToSheet: vi.fn(async (_t: string, r: any[]) => { sheet.push(r); }) },
}));

import { petWashOrchestrator } from '../services/PetWashOperationsOrchestrator';

beforeEach(() => { sent.length = 0; drive.length = 0; sheet.length = 0; });

const run = (over: Record<string, any> = {}) => petWashOrchestrator.handleJobCompletion({
  bookingRef: 'BK-1', platform: 'Sitter Suite', serviceType: 'Sitting',
  customerName: 'Dana', customerEmail: 'dana@example.com',
  providerName: 'Michal', providerEmail: 'michal@example.com',
  amountILS: 115, ...over,
} as any);

describe('job-complete sends a summary, not a tax invoice', () => {
  it('the customer email is not a tax invoice and says so', async () => {
    const r = await run();
    const mail = sent.find((m) => m.to === 'dana@example.com')!;
    expect(mail).toBeTruthy();
    expect(mail.subject).not.toContain('חשבונית מס');
    expect(mail.subject).not.toMatch(/Tax Invoice/i);
    expect(mail.html).not.toContain('חשבונית מס כחוק');
    expect(mail.html).not.toMatch(/legally compliant Israeli VAT tax invoice/i);
    expect(mail.html).toContain('This is not a tax invoice');
    expect(r.invoiceNumber).toBe('JOB-BK-1');
    expect(r.invoiceNumber).not.toMatch(/^PWI-/);
  });

  it('₪115 paid → fee ₪15, provider ₪100 (not 85%)', async () => {
    await run();
    const cust = sent.find((m) => m.to === 'dana@example.com')!.html;
    expect(cust).toContain('₪15.00');
    expect(cust).toContain('₪100.00');
    const prov = sent.find((m) => m.to === 'michal@example.com')!.html;
    expect(prov).toContain('₪100.00');
    expect(prov).not.toContain('₪97.75');
    expect(prov).not.toContain('₪17.25');
    expect(sheet[0]).toContain('15.00');
    expect(sheet[0]).toContain('2.29');
  });

  it('provider-typed text is escaped', async () => {
    await run({ customerName: '<img src=x onerror=alert(1)>', providerName: '<b>x</b>', serviceType: '<script>s</script>' });
    for (const m of sent) {
      expect(m.html).not.toContain('<img src=x');
      expect(m.html).not.toContain('<script>s');
      expect(m.html).not.toContain('<b>x</b>');
    }
  });
});
