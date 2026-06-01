import { describe, expect, it } from 'vitest';
import { scanContentForBypassRisks } from '../../scripts/guards/operating-control-bypass-scanner';

describe('operating-control bypass scanner', () => {
  it('flags direct money and compliance mutations in legacy route code', () => {
    const findings = scanContentForBypassRisks(`
      router.post('/admin/provider/:id/activate', async () => {
        await db.execute(sql\`UPDATE provider_profiles SET provider_status = 'active' WHERE id = \${id}\`);
      });

      router.post('/admin/refunds/:id/approve', async () => {
        await db.execute(sql\`UPDATE refund_requests SET status='approved' WHERE id=\${id}\`);
      });

      await db.execute(sql\`UPDATE payout_batches SET status='paid' WHERE id=\${batchId}\`);
      await SumitDispatcher.send({ idempotencyKey });
    `, 'server/routes/legacy-money.ts');

    expect(findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining([
      'DIRECT_PROVIDER_ACTIVE',
      'DIRECT_REFUND_APPROVAL',
      'DIRECT_PAYMENT_PAID',
      'DIRECT_SUMIT_SEND',
    ]));
    expect(findings.some((finding) => finding.gatewayMentionedInFile)).toBe(false);
  });

  it('marks files that mention the fail-closed gateway for reviewer context', () => {
    const findings = scanContentForBypassRisks(`
      import { assertOperatingControl } from '../lib/petwashOperatingControlGateway';

      if (!assertOperatingControl(req, res, defaults)) return;
      await db.execute(sql\`UPDATE supplier_invoices SET status='approved' WHERE id=\${id}\`);
    `, 'server/routes/supplier-invoices.ts');

    expect(findings.map((finding) => finding.ruleId)).toContain('DIRECT_APPROVAL_STATUS');
    expect(findings.every((finding) => finding.gatewayMentionedInFile)).toBe(true);
  });

  it('ignores comments so old audit notes do not create false positives', () => {
    const findings = scanContentForBypassRisks(`
      // await db.execute(sql\`UPDATE payout_batches SET status='paid'\`);
      /* status='approved' appears in an audit paragraph */
      const safe = 'no mutation here';
    `, 'server/routes/comment-only.ts');

    expect(findings).toEqual([]);
  });
});
