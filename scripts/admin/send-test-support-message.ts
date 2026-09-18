/**
 * Live delivery test — "does a PetWash support message actually reach a person?"
 *
 * Sends ONE real message through the production notification path
 * (server/lib/notificationDispatcher.ts — the same code POST /api/inbox/admin/send-user
 * uses) to an address and phone you name, then reports per channel what happened.
 * Nothing is mocked: the Firestore inbox document is written to the real user,
 * the email leaves through SendGrid from SENDGRID_FROM_EMAIL, the SMS leaves
 * through Twilio.
 *
 * Run from the Actions tab: ".github/workflows/diagnose-chat-delivery.yml".
 *
 * Env (the workflow loads these from GCP Secret Manager):
 *   TARGET_EMAIL   — required; must be a PetWash account for the in-app inbox channel
 *   TARGET_PHONE   — optional, E.164 (+61…); only used when CHANNELS includes sms
 *   CHANNELS       — csv of inbox,email,sms,push (default inbox,email)
 *   LOCALE         — he | en (default en)
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL,
 *   TWILIO_* as in production, DATABASE_URL (contact lookup fallback only)
 *
 * Exit 0 only when every requested channel reports delivered. Exit 1 otherwise,
 * with the dispatcher's own error strings — no guessing.
 */
import { writeFileSync } from 'node:fs';

type Channel = 'inbox' | 'email' | 'sms' | 'push';
const ALL: Channel[] = ['inbox', 'email', 'sms', 'push'];

function parseChannels(raw: string | undefined): Channel[] {
  const list = (raw || 'inbox,email')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as Channel[];
  const bad = list.filter((c) => !ALL.includes(c));
  if (bad.length) throw new Error(`Unknown channel(s): ${bad.join(', ')} — use ${ALL.join(',')}`);
  return list.length ? list : ['inbox', 'email'];
}

function mask(s: string | undefined): string {
  if (!s) return '(none)';
  if (s.includes('@')) {
    const [u, d] = s.split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  return `${s.slice(0, 4)}****${s.slice(-2)}`;
}

async function main() {
  const email = (process.env.TARGET_EMAIL || '').trim();
  const phone = (process.env.TARGET_PHONE || '').trim() || undefined;
  const channels = parseChannels(process.env.CHANNELS);
  const locale = (process.env.LOCALE === 'he' ? 'he' : 'en') as 'he' | 'en';
  if (!email) throw new Error('TARGET_EMAIL is required');
  if (channels.includes('sms') && !phone) throw new Error('CHANNELS includes sms but TARGET_PHONE is empty');
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error(`TARGET_PHONE must be E.164 (e.g. +61419773360), got ${mask(phone)}`);

  const { auth } = await import('../../server/lib/firebase-admin');
  const { dispatchNotification } = await import('../../server/lib/notificationDispatcher');

  // The in-app inbox needs a real account; email/SMS do not.
  let uid: string;
  let accountEmail: string | undefined = email;
  try {
    const account = await auth.getUserByEmail(email);
    uid = account.uid;
    accountEmail = account.email || email;
    console.log(`Account found for ${mask(email)} → uid ${uid.slice(0, 6)}…`);
  } catch {
    if (channels.includes('inbox')) {
      throw new Error(
        `No PetWash account for ${mask(email)}. The in-app inbox channel needs one. ` +
        `Either sign that address up at https://petwash.co.il first, or run with CHANNELS=email,sms.`,
      );
    }
    uid = `diag-no-account-${Date.now()}`;
    console.log(`No account for ${mask(email)} — sending email/SMS only.`);
  }

  const stamp = new Date().toISOString();
  const title = locale === 'he' ? 'בדיקת הודעה מהתמיכה של PetWash™' : 'PetWash™ support delivery test';
  const bodyHtml = locale === 'he'
    ? `<p>שלום! זו הודעת בדיקה מצוות התמיכה של PetWash™.</p><p>אם אתם רואים אותה, ערוץ ההודעות עובד. נשלח ב-${stamp}.</p>`
    : `<p>Hello! This is a test message from PetWash™ support.</p><p>If you can read this, the messaging channel works. Sent ${stamp}.</p>`;

  console.log(`Dispatching via [${channels.join(', ')}] → email ${mask(accountEmail)}, phone ${mask(phone)}`);
  const result = await dispatchNotification({
    uid,
    email: accountEmail,
    phone,
    locale,
    type: 'system',
    title,
    bodyHtml,
    ctaText: locale === 'he' ? 'פתיחת תיבת ההודעות' : 'Open your inbox',
    ctaUrl: 'https://petwash.co.il/inbox',
    channels,
    meta: {},
  });

  const rows: Array<[Channel, boolean | undefined, string]> = [
    ['inbox', channels.includes('inbox') ? !result.errors.some((e) => e.startsWith('Inbox write failed')) : undefined, `Firestore users/${uid.slice(0, 6)}…/inbox/${result.inboxId}`],
    ['email', channels.includes('email') ? result.emailSent : undefined, `to ${mask(accountEmail)} from ${process.env.SENDGRID_FROM_EMAIL || '(SENDGRID_FROM_EMAIL unset)'}`],
    ['sms', channels.includes('sms') ? result.smsSent : undefined, `to ${mask(phone)} via Twilio`],
    ['push', channels.includes('push') ? !!result.pushSent : undefined, 'FCM to registered devices'],
  ];

  const lines: string[] = ['## 📨 Chat / support delivery test', '', `Sent ${stamp} · channels: \`${channels.join(', ')}\``, '', '| Channel | Result | Detail |', '|---|---|---|'];
  let failed = false;
  for (const [ch, ok, detail] of rows) {
    if (ok === undefined) { lines.push(`| ${ch} | — not requested | |`); continue; }
    if (!ok) failed = true;
    lines.push(`| ${ch} | ${ok ? '✅ delivered' : '❌ NOT delivered'} | ${detail} |`);
  }
  if (result.errors.length) {
    lines.push('', '**Dispatcher errors (verbatim):**', '');
    for (const e of result.errors) lines.push(`- ${e}`);
  }
  lines.push('', failed
    ? '❌ At least one requested channel did not deliver. The error strings above are the dispatcher\'s own — fix the named secret or provider, then re-run.'
    : '✅ Every requested channel delivered. Check the inbox / phone now; the in-app copy is under Messages → Inbox at https://petwash.co.il/inbox.');

  const text = lines.join('\n');
  console.log('\n' + text);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n', { flag: 'a' });
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`::error::${err?.message || err}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## 📨 Chat / support delivery test\n\n❌ ${err?.message || err}\n`, { flag: 'a' });
  }
  process.exit(1);
});
