import sgMail from '@sendgrid/mail';

// Load your secret key from Replit secrets
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Message details
const msg = {
  to: 'support@petwash.co.il', // Your email
  from: 'support@petwash.co.il', // Must be the verified sender in SendGrid
  subject: 'PetWash Email Test',
  text: 'Hi Nir, this is a test email from your SendGrid setup!',
  html: '<strong>Hi Nir, this is a test email from your SendGrid setup!</strong>',
};

// Send it
sgMail
  .send(msg)
  .then(() => console.log('✅ Email sent successfully! Check your inbox.'))
  .catch((err) => console.error('❌ Error:', err));