import { Router, Request, Response } from 'express';
import { EmailService } from '../services/emailService';
import { readFileSync } from 'fs';

const router = Router();

router.post('/api/send-platform-report', async (req: Request, res: Response) => {
  try {
    const report = readFileSync('/tmp/platform_status_report.txt', 'utf-8');
    
    await EmailService.send({
      to: 'Support@PetWash.co.il',
      subject: '🐾 Pet Wash™ Platform - Final Status Report (Oct 25, 2025)',
      text: report,
      html: `
        <div style="font-family: 'Courier New', monospace; background: #f5f5f5; padding: 20px;">
          <h1 style="color: #4F46E5;">🐾 Pet Wash™ Platform Status Report</h1>
          <pre style="background: white; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${report}</pre>
        </div>
      `
    });
    
    res.json({ success: true, message: 'Report sent to Support@PetWash.co.il' });
  } catch (error: any) {
    console.error('Failed to send report:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
