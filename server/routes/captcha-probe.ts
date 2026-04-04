/**
 * /api/captcha-probe  —  reCAPTCHA Enterprise end-to-end test harness
 *
 * Endpoints
 *   GET  /api/captcha-probe        → self-contained HTML test page
 *   POST /api/captcha-probe/assess → runs the Enterprise assessment and returns
 *                                    the raw GCP response + verifyCaptcha result;
 *                                    never sends an SMS.
 *
 * Intended for owner-level diagnostics.  All /assess POSTs are rate-limited to
 * 10 per minute per IP by the caller (apiLimiter in routes.ts).
 */

import { Router, Request, Response } from 'express';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import { GoogleAuth } from 'google-auth-library';
import { logger } from '../lib/logger';

const router = Router();

// ── 1. HTML test page ─────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
  const siteKey =
    process.env.RECAPTCHA_SITE_KEY ||
    '';

  const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PetWash™ — reCAPTCHA Enterprise Probe</title>
<script src="https://www.google.com/recaptcha/enterprise.js?render=${siteKey}" async defer></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;padding:24px}
  h1{font-size:1.4rem;font-weight:700;margin-bottom:4px}
  .sub{font-size:.85rem;color:#64748b;margin-bottom:24px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px}
  .card h2{font-size:.9rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:12px}
  .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:9999px;font-size:.8rem;font-weight:600}
  .pass{background:#dcfce7;color:#166534}
  .fail{background:#fee2e2;color:#991b1b}
  .warn{background:#fef9c3;color:#854d0e}
  .row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9}
  .row:last-child{border-bottom:none}
  .label{font-size:.85rem;color:#64748b}
  .value{font-size:.85rem;font-weight:600;font-family:monospace;word-break:break-all;text-align:right;max-width:65%}
  pre{background:#0f172a;color:#e2e8f0;border-radius:8px;padding:16px;font-size:.78rem;overflow:auto;max-height:340px;line-height:1.5}
  button{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:.9rem;font-weight:600;cursor:pointer;width:100%}
  button:hover{background:#1d4ed8}
  button:disabled{background:#94a3b8;cursor:not-allowed}
  #status{margin-top:10px;font-size:.85rem;color:#64748b;text-align:center}
  .spinner{display:inline-block;width:14px;height:14px;border:2px solid #94a3b8;border-top-color:#2563eb;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .tag{font-size:.7rem;background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;margin-left:4px;font-weight:600}
</style>
</head>
<body>
<h1>🐾 PetWash™ — reCAPTCHA Enterprise Probe</h1>
<p class="sub">Live end-to-end test • generates a real browser token and validates it through the Enterprise API</p>

<div class="card" id="browser-card">
  <h2>Browser</h2>
  <div class="row"><span class="label">User-Agent</span><span class="value" id="ua">—</span></div>
  <div class="row"><span class="label">Browser</span><span class="value" id="browser-name">—</span></div>
  <div class="row"><span class="label">Engine</span><span class="value" id="engine">—</span></div>
  <div class="row"><span class="label">OS</span><span class="value" id="os">—</span></div>
  <div class="row"><span class="label">Domain</span><span class="value" id="domain">—</span></div>
</div>

<div class="card">
  <h2>reCAPTCHA Enterprise</h2>
  <div class="row"><span class="label">Site Key</span><span class="value" id="sitekey-display">—</span></div>
  <div class="row"><span class="label">Action</span><span class="value">phone_send_code</span></div>
  <div class="row"><span class="label">GCP Project</span><span class="value">signinpetwash (136197986889)</span></div>
</div>

<button id="runBtn" onclick="runProbe()">▶ Run Enterprise Assessment</button>
<div id="status"></div>

<div id="results" style="display:none;margin-top:16px">
  <div class="card">
    <h2>Token</h2>
    <div class="row"><span class="label">Generated</span><span class="value" id="token-ts">—</span></div>
    <div class="row"><span class="label">Length</span><span class="value" id="token-len">—</span></div>
    <div class="row"><span class="label">Prefix (first 40 chars)</span><span class="value" id="token-prefix">—</span></div>
  </div>

  <div class="card">
    <h2>Enterprise Assessment — Raw GCP Response</h2>
    <div class="row">
      <span class="label">HTTP Status</span>
      <span class="value" id="http-status">—</span>
    </div>
    <div class="row">
      <span class="label">Assessment Name</span>
      <span class="value" id="assess-name">—</span>
    </div>
    <div class="row">
      <span class="label">token_properties.valid</span>
      <span class="value" id="tok-valid">—</span>
    </div>
    <div class="row">
      <span class="label">token_properties.invalidReason</span>
      <span class="value" id="tok-reason">—</span>
    </div>
    <div class="row">
      <span class="label">riskAnalysis.score</span>
      <span class="value" id="risk-score">—</span>
    </div>
    <div class="row">
      <span class="label">riskAnalysis.reasons</span>
      <span class="value" id="risk-reasons">—</span>
    </div>
  </div>

  <div class="card">
    <h2>verifyCaptcha Server Decision</h2>
    <div class="row"><span class="label">valid</span><span class="value" id="sv-valid">—</span></div>
    <div class="row"><span class="label">score</span><span class="value" id="sv-score">—</span></div>
    <div class="row"><span class="label">source</span><span class="value" id="sv-source">—</span></div>
    <div class="row"><span class="label">reason</span><span class="value" id="sv-reason">—</span></div>
    <div class="row"><span class="label">Low-score blocking (< 0.3)</span><span class="value" id="sv-block">—</span></div>
    <div class="row"><span class="label">DNSNAME_MISMATCH</span><span class="value" id="dns-mismatch">—</span></div>
  </div>

  <div class="card">
    <h2>Full Raw JSON</h2>
    <pre id="raw-json">—</pre>
  </div>
</div>

<script>
// ── Browser detection ────────────────────────────────────────────────────────
const ua = navigator.userAgent;
document.getElementById('ua').textContent = ua.slice(0, 80) + (ua.length > 80 ? '…' : '');
document.getElementById('domain').textContent = location.hostname;

const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua);
const isFirefox = /Firefox/.test(ua);
const isEdge = /Edge/.test(ua);
const isIOS = /iPhone|iPad/.test(ua);
const isMac = /Macintosh/.test(ua);
const isAndroid = /Android/.test(ua);

const browserName =
  isEdge ? 'Microsoft Edge' :
  isChrome ? ('Chrome' + (/Chromium/.test(ua) ? ' (Chromium)' : '')) :
  isSafari ? ('Safari' + (isIOS ? ' (iOS)' : isMac ? ' (macOS)' : '')) :
  isFirefox ? 'Firefox' : 'Unknown';

const engine =
  /AppleWebKit/.test(ua) ? (isChrome ? 'Blink (V8)' : 'WebKit') :
  /Gecko/.test(ua) ? 'Gecko' : 'Unknown';

const os =
  isIOS ? 'iOS' :
  isAndroid ? 'Android' :
  isMac ? 'macOS' :
  /Windows/.test(ua) ? 'Windows' :
  /Linux/.test(ua) ? 'Linux' : 'Unknown';

document.getElementById('browser-name').textContent = browserName;
document.getElementById('engine').textContent = engine;
document.getElementById('os').textContent = os;

const siteKey = '${siteKey}';
document.getElementById('sitekey-display').textContent = siteKey.slice(0, 12) + '…';

// ── Run probe ────────────────────────────────────────────────────────────────
async function runProbe() {
  const btn = document.getElementById('runBtn');
  const status = document.getElementById('status');
  btn.disabled = true;

  status.innerHTML = '<span class="spinner"></span>Waiting for reCAPTCHA Enterprise to initialize…';

  try {
    const token = await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('reCAPTCHA ready() timed out after 10s')), 10000);
      grecaptcha.enterprise.ready(async () => {
        clearTimeout(deadline);
        try {
          const t = await grecaptcha.enterprise.execute(siteKey, { action: 'phone_send_code' });
          resolve(t);
        } catch (e) { reject(e); }
      });
    });

    const tokenTs = new Date().toISOString();
    document.getElementById('token-ts').textContent = tokenTs;
    document.getElementById('token-len').textContent = String(token).length + ' chars';
    document.getElementById('token-prefix').textContent = String(token).slice(0, 40) + '…';

    status.innerHTML = '<span class="spinner"></span>Sending token to /api/captcha-probe/assess…';

    const resp = await fetch('/api/captcha-probe/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Browser': browserName, 'X-Engine': engine, 'X-OS': os },
      body: JSON.stringify({ token, action: 'phone_send_code' }),
    });

    const data = await resp.json();

    // ── Render results ──────────────────────────────────────────────────────
    document.getElementById('results').style.display = 'block';

    document.getElementById('http-status').innerHTML = resp.status + ' ' +
      (resp.ok ? '<span class="badge pass">OK</span>' : '<span class="badge fail">ERROR</span>');

    const gcp = data.gcpRaw || {};
    document.getElementById('assess-name').textContent = gcp.name || '—';

    const tv = gcp?.tokenProperties?.valid;
    document.getElementById('tok-valid').innerHTML =
      tv === true ? '<span class="badge pass">true ✓</span>' :
      tv === false ? '<span class="badge fail">false ✗</span>' : '—';

    const reason = gcp?.tokenProperties?.invalidReason || '';
    document.getElementById('tok-reason').innerHTML =
      reason
        ? ('<span class="badge ' + (reason === 'DNSNAME_MISMATCH' ? 'fail' : 'warn') + '">' + reason + '</span>')
        : '<span class="badge pass">none ✓</span>';

    const score = gcp?.riskAnalysis?.score ?? gcp?.score;
    document.getElementById('risk-score').innerHTML =
      score !== undefined
        ? (score + ' <span class="badge ' + (score >= 0.7 ? 'pass' : score >= 0.3 ? 'warn' : 'fail') + '">' + (score >= 0.7 ? 'human' : score >= 0.3 ? 'uncertain' : 'bot') + '</span>')
        : '—';

    const reasons = gcp?.riskAnalysis?.reasons || [];
    document.getElementById('risk-reasons').textContent = reasons.length ? reasons.join(', ') : 'none';

    const sv = data.serverDecision || {};
    document.getElementById('sv-valid').innerHTML =
      sv.valid === true ? '<span class="badge pass">true ✓</span>' :
      sv.valid === false ? '<span class="badge fail">false ✗</span>' : '—';
    document.getElementById('sv-score').textContent = sv.score !== undefined ? sv.score : '—';
    document.getElementById('sv-source').textContent = sv.source || '—';
    document.getElementById('sv-reason').textContent = sv.reason || 'none';

    document.getElementById('sv-block').innerHTML =
      sv.reason === 'low_score'
        ? '<span class="badge fail">BLOCKED — score &lt; 0.3</span>'
        : '<span class="badge pass">Not triggered — score ≥ 0.3</span>';

    const dnsMismatch = reason === 'DNSNAME_MISMATCH';
    document.getElementById('dns-mismatch').innerHTML =
      dnsMismatch
        ? '<span class="badge fail">YES ✗ (domain not registered in reCAPTCHA console)</span>'
        : '<span class="badge pass">NO ✓ — domain matches petwash.co.il</span>';

    document.getElementById('raw-json').textContent = JSON.stringify(data, null, 2);

    status.innerHTML = '<span class="badge pass">✓ Assessment complete</span>';
  } catch (err) {
    status.innerHTML = '<span class="badge fail">Error: ' + (err.message || String(err)) + '</span>';
  } finally {
    btn.disabled = false;
  }
}
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── 2. Assess endpoint ────────────────────────────────────────────────────────

router.post('/assess', async (req: Request, res: Response) => {
  const started = Date.now();
  const { token, action = 'phone_send_code' } = req.body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token required' });
  }

  const browserHeader = req.headers['x-browser'] as string || 'unknown';
  const engineHeader  = req.headers['x-engine']  as string || 'unknown';
  const osHeader      = req.headers['x-os']       as string || 'unknown';

  logger.info('[captcha-probe] Assessment requested', {
    browser: browserHeader, engine: engineHeader, os: osHeader,
    action, tokenPrefix: token.slice(0, 20),
  });

  // ── 2a. Call Enterprise API directly to get raw GCP response ─────────────
  let gcpRaw: any = null;
  let gcpStatus = 0;
  let gcpError: string | null = null;

  try {
    const siteKey =
      (process.env.RECAPTCHA_SITE_KEY || '').trim();

    const projectId = (process.env.RECAPTCHA_GCP_PROJECT_ID || '').trim() || 'signinpetwash';

    const saCandidates = [
      process.env.RECAPTCHA_SERVICE_ACCOUNT_JSON,
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    ].filter(Boolean) as string[];

    let accessToken: string | null = null;
    for (const raw of saCandidates) {
      if (!raw.trim().startsWith('{')) continue;
      try {
        const auth = new GoogleAuth({
          credentials: JSON.parse(raw.trim()),
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient();
        const tr = await (client as any).getAccessToken();
        accessToken = tr?.token || tr || null;
        if (accessToken) break;
      } catch { /* try next */ }
    }

    if (!accessToken) throw new Error('No SA credentials available');

    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments`;
    const body = JSON.stringify({ event: { token, siteKey, expectedAction: action } });

    const gcpResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body,
    });
    gcpStatus = gcpResp.status;
    gcpRaw = await gcpResp.json();
  } catch (err: any) {
    gcpError = err.message;
    logger.error('[captcha-probe] Direct GCP call failed', { error: err.message });
  }

  // ── 2b. Run through the same verifyCaptchaToken() used by send-code ───────
  const serverDecision = await verifyCaptchaToken(token, action);

  const elapsed = Date.now() - started;

  logger.info('[captcha-probe] Result', {
    gcpStatus, gcpError,
    tokenValid: gcpRaw?.tokenProperties?.valid,
    invalidReason: gcpRaw?.tokenProperties?.invalidReason || 'none',
    score: gcpRaw?.riskAnalysis?.score ?? gcpRaw?.score,
    serverValid: serverDecision.valid,
    serverScore: serverDecision.score,
    serverSource: serverDecision.source,
    serverReason: serverDecision.reason,
    browser: browserHeader, engine: engineHeader, os: osHeader,
    elapsedMs: elapsed,
  });

  return res.json({
    probe: 'petwash-captcha-enterprise-v1',
    timestamp: new Date().toISOString(),
    elapsedMs: elapsed,
    browser: { name: browserHeader, engine: engineHeader, os: osHeader },
    gcpHttpStatus: gcpStatus,
    gcpError,
    gcpRaw,
    serverDecision,
    summary: {
      tokenValid:      gcpRaw?.tokenProperties?.valid ?? null,
      invalidReason:   gcpRaw?.tokenProperties?.invalidReason || null,
      score:           gcpRaw?.riskAnalysis?.score ?? gcpRaw?.score ?? null,
      dnsMismatch:     gcpRaw?.tokenProperties?.invalidReason === 'DNSNAME_MISMATCH',
      serverAllowed:   serverDecision.valid,
      lowScoreBlocked: serverDecision.reason === 'low_score',
    },
  });
});

export default router;
