import { Router, Request, Response } from 'express';
import { EmailService } from '../emailService';
import { sendSanitizedError } from '../lib/sanitizeErrorResponse';
import { readFileSync } from 'fs';

const router = Router();

router.post('/send-platform-report', async (req: Request, res: Response) => {
  try {
    const report = readFileSync('/tmp/platform_status_report.txt', 'utf-8');
    
    await EmailService.send({
      to: 'Support@PetWash.co.il',
      subject: '🐾 ⁦PetWash™⁩ Platform - Final Status Report (Oct 25, 2025)',
      text: report,
      html: `
        <div style="font-family: 'Courier New', monospace; background: #f5f5f5; padding: 20px;">
          <h1 style="color: #4F46E5;">🐾 ⁦PetWash™⁩ Platform Status Report</h1>
          <pre style="background: white; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${report}</pre>
        </div>
      `
    });
    
    res.json({ success: true, message: 'Report sent to Support@PetWash.co.il' });
  } catch (error: any) {
    sendSanitizedError(res, error, 'SEND_REPORT_FAILED', { logContext: { op: 'send-report' } });
  }
});

export default router;
