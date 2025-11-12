const sgMail = require('@sendgrid/mail');
const fs = require('fs');

// Set API key
const API_KEY = process.env.SENDGRID_API_KEY;
if (!API_KEY) {
  console.log('❌ SENDGRID_API_KEY not found in environment');
  process.exit(1);
}

console.log('✅ SendGrid API key found');
sgMail.setApiKey(API_KEY);

// Read report
const report = fs.readFileSync('./PLATFORM_STATUS_REPORT_OCT25_2025.txt', 'utf-8');
console.log('✅ Report loaded (' + report.length + ' bytes)');

// Create HTML email
const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: Arial, sans-serif; }
    .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 16px 16px 0 0; }
    .header h1 { margin: 0; font-size: 32px; }
    .content { padding: 40px; }
    .report { font-family: 'Courier New', monospace; font-size: 13px; white-space: pre-wrap; background: #f8f9fa; padding: 20px; border-radius: 8px; overflow-x: auto; }
    .footer { background: #f1f5f9; padding: 30px; text-align: center; border-radius: 0 0 16px 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 Pet Wash™ Platform</h1>
      <p>Final Production Status Report</p>
      <p style="font-size: 14px;">October 25, 2025 • 09:36 AM Israel Time</p>
    </div>
    <div class="content">
      <h2>Executive Summary</h2>
      <p>The Pet Wash™ platform is <strong>LIVE and OPERATIONAL</strong> on production domain <strong>petwash.co.il</strong> with all critical authentication fixes successfully deployed.</p>
      <h3>✅ Critical Fixes Completed</h3>
      <ul>
        <li>Safari/iOS Authentication Fixed - Cookie SameSite changed to 'lax'</li>
        <li>Firebase OAuth Configured - petwash.co.il authorized</li>
        <li>System Cache Cleared - 44MB freed</li>
      </ul>
      <h3>📋 Full Technical Report</h3>
      <div class="report">${report}</div>
    </div>
    <div class="footer">
      <p><strong>🐾 Pet Wash Ltd</strong></p>
      <p>Production: <a href="https://petwash.co.il">petwash.co.il</a></p>
      <p>Support: support@petwash.co.il | +972549833355</p>
    </div>
  </div>
</body>
</html>
`;

const msg = {
  to: 'support@petwash.co.il',
  from: 'noreply@petwash.co.il',
  replyTo: 'support@petwash.co.il',
  subject: '🐾 Pet Wash™ Platform - Final Status Report (Oct 25, 2025)',
  text: report,
  html: html
};

console.log('📧 Sending email to support@petwash.co.il...');

sgMail.send(msg)
  .then(() => {
    console.log('✅ ✅ ✅ EMAIL SENT SUCCESSFULLY to support@petwash.co.il ✅ ✅ ✅');
    console.log('📬 Check your inbox at support@petwash.co.il');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Email failed:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
    process.exit(1);
  });
