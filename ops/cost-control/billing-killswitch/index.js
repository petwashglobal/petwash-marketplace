/**
 * PetWash billing kill-switch (CEO 2026-08-02).
 *
 * The last line of defence against a runaway Google bill. It is triggered by the
 * Cloud Billing *budget* (the "PetWash cap" the CEO created) via a Pub/Sub topic.
 * When actual spend crosses 100% of the cap, this function DISABLES billing on the
 * project — which stops every paid service. Pre-launch that means the site goes
 * dark rather than ever running up a surprise bill. Nir re-enables billing to
 * bring it back.
 *
 * SAFETY: two modes, controlled by KILLSWITCH_MODE:
 *   - 'dry-run' (default): logs + alerts what it WOULD do, but does NOT touch
 *     billing. Deploy in this mode first and confirm the pipeline works.
 *   - 'armed': actually disables billing when the cap is exceeded.
 *
 * It only ever acts when costAmount > budgetAmount. The 50% / 90% early-warning
 * notifications from the same budget also arrive here and are ignored.
 *
 * The runtime service account MUST have "Project Billing Manager"
 * (roles/billing.projectManager) or it cannot disable billing — that grant needs
 * billing-account admin and is done once by Nir (see README.md).
 */

const functions = require('@google-cloud/functions-framework');
const { CloudBillingClient } = require('@google-cloud/billing');

const billing = new CloudBillingClient();

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'signinpetwash';
const PROJECT_NAME = `projects/${PROJECT_ID}`;
const MODE = (process.env.KILLSWITCH_MODE || 'dry-run').toLowerCase();
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || '';

functions.cloudEvent('stopBilling', async (cloudEvent) => {
  const encoded = cloudEvent && cloudEvent.data && cloudEvent.data.message && cloudEvent.data.message.data;
  let payload = {};
  try {
    payload = encoded ? JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) : {};
  } catch (e) {
    console.error('[killswitch] could not parse budget message:', e.message);
    return;
  }

  const costAmount = Number(payload.costAmount || 0);
  const budgetAmount = Number(payload.budgetAmount || 0);
  const currency = payload.currencyCode || 'ILS';
  const name = payload.budgetDisplayName || 'budget';

  // Act ONLY when real spend has passed the cap. Ignore the 50%/90% early alerts
  // (they publish to the same topic) and any message with no usable budget number.
  if (budgetAmount <= 0 || !(costAmount > budgetAmount)) {
    console.log(`[killswitch] OK — ${costAmount}/${budgetAmount} ${currency} (${name}); no action.`);
    return;
  }

  const line = `spend ${costAmount} ${currency} exceeded cap ${budgetAmount} (${name})`;

  const enabled = await isBillingEnabled();
  if (!enabled) {
    console.log(`[killswitch] ${line} — billing already disabled; nothing to do.`);
    await notify(`ℹ️ PetWash: ${line}. Billing is already OFF.`);
    return;
  }

  if (MODE !== 'armed') {
    console.warn(`[killswitch] DRY-RUN — ${line}. WOULD disable billing now. Set KILLSWITCH_MODE=armed to enable.`);
    await notify(`⚠️ PetWash DRY-RUN: ${line}. Kill-switch WOULD cut billing (site offline) — but it is not armed yet.`);
    return;
  }

  console.error(`[killswitch] ARMED — ${line}. Disabling billing → project goes offline.`);
  const result = await disableBilling();
  console.error(`[killswitch] ${result}`);
  await notify(`🛑 PetWash KILL-SWITCH FIRED: ${line}. Billing DISABLED — site is offline until you re-enable billing in Google Cloud.`);
});

async function isBillingEnabled() {
  try {
    const [info] = await billing.getProjectBillingInfo({ name: PROJECT_NAME });
    return !!info.billingEnabled;
  } catch (e) {
    // Fail toward action: if we can't read state in armed mode, assume it's on so
    // we still attempt the disable rather than silently doing nothing.
    console.error('[killswitch] getProjectBillingInfo failed:', e.message);
    return true;
  }
}

async function disableBilling() {
  try {
    // An empty billingAccountName DETACHES the billing account = billing off.
    await billing.updateProjectBillingInfo({
      name: PROJECT_NAME,
      projectBillingInfo: { billingAccountName: '' },
    });
    return 'billing disabled successfully';
  } catch (e) {
    console.error('[killswitch] updateProjectBillingInfo failed:', e.message);
    return `FAILED to disable billing (does the function SA have roles/billing.projectManager?): ${e.message}`;
  }
}

async function notify(text) {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error('[killswitch] notify failed:', e.message);
  }
}
