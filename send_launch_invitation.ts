import sgMail from '@sendgrid/mail';
import { generateLaunchInvitationEmail } from './server/emails/launchInvitation';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY not found');
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

async function sendLaunchInvitation() {
  const recipientName = 'Tom Hane';
  const recipientEmail = 'tomstuk7@gmail.com';
  const petName = 'Libby';

  console.log(`\n🎉 Sending Pet Wash™ Launch Invitation...\n`);
  console.log(`👤 Recipient: ${recipientName}`);
  console.log(`🐾 Pet: ${petName}`);
  console.log(`📧 Email: ${recipientEmail}\n`);

  const { subject, html } = generateLaunchInvitationEmail(recipientName, petName);

  const msg = {
    to: recipientEmail,
    cc: 'nirhadad1@gmail.com', // CC Nir
    from: {
      email: 'support@petwash.co.il',
      name: 'Pet Wash™ Team'
    },
    subject: subject,
    html: html,
  };

  try {
    const response = await sgMail.send(msg);
    console.log('✅ Email sent successfully!');
    console.log(`📬 Status: ${response[0].statusCode}`);
    console.log(`\n🌟 Tom and Libby will receive their 7-star metallic invitation shortly!\n`);
  } catch (error: any) {
    console.error('❌ Error sending email:');
    if (error.response) {
      console.error('Status:', error.response.statusCode);
      console.error('Body:', error.response.body);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

sendLaunchInvitation();
