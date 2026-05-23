/**
 * SUMIT preflight check — pure decision logic.
 *
 * Given an invoice + its supplier + current SystemConfig + env-var
 * presence, decide whether a "Send to SUMIT" action is safe to fire.
 *
 * No DB calls. No HTTP. No side effects. The caller passes facts in;
 * we return a structured PreflightResult that the admin UI renders as
 * green/red badges and the dispatcher uses to short-circuit unsafe sends.
 *
 * Companion to docs/finance/sumit-activation-playbook-2026-05-23.md.
 * Implements the 7-point checklist:
 *   1. parent flag ff.supplier_invoice_control.enabled
 *   2. send flag ff.supplier_invoice_control.sumit_send.enabled
 *   3. activation mode != 'off'
 *   4. invoice status == 'ready_for_accountant'
 *   5. invoice risk level != 'red'
 *   6. supplier approved + classified (osek != 'unknown')
 *   7. no prior successful send for this invoice (idempotency)
 *
 * Plus environment-readiness checks per mode:
 *   - api mode → SUMIT_API_KEY + SUMIT_COMPANY_ID + SUMIT_WEBHOOK_SECRET
 *   - email mode → ACCOUNTANT_EMAIL + SENDGRID_API_KEY
 *   - csv_export mode → no env required
 */

export type SumitMode = 'off' | 'email' | 'api' | 'csv_export';

export type PreflightStatus = 'pass' | 'fail';

export interface PreflightCheckRow {
  name: string;
  /** Short Hebrew label for the admin UI ("חיווי קצר ל-UI"). */
  labelHe: string;
  status: PreflightStatus;
  /** Reason text shown when status is 'fail'. */
  detail?: string;
}

export interface PreflightFacts {
  /** Current values of the two feature flags. */
  parentFlag: boolean;
  sendFlag: boolean;
  /** Current SystemConfig 'sumit.mode' value. */
  mode: SumitMode;
  /** Invoice facts. */
  invoice: {
    id: number;
    status: string;
    riskLevel: 'green' | 'yellow' | 'red';
    sumitStatus: 'pending' | 'sent' | 'confirmed' | 'failed' | null;
    sumitDocumentId: string | null;
  } | null;
  /** Supplier facts. May be null when the invoice has no supplier_id. */
  supplier: {
    id: number;
    isApproved: boolean | null;
    osekClassification: 'unknown' | 'patur' | 'murshe' | 'chevra';
  } | null;
  /** Environment-variable presence (caller computes; we don't read env here). */
  env: {
    sumitApiKey: boolean;
    sumitCompanyId: boolean;
    sumitWebhookSecret: boolean;
    accountantEmail: boolean;
    sendgridApiKey: boolean;
  };
}

export interface PreflightResult {
  ready: boolean;
  checks: PreflightCheckRow[];
  /**
   * Caller-facing summary: a single short Hebrew string suitable for a
   * toast or banner when `ready` is false.
   */
  blockingReasonHe: string | null;
}

function pass(name: string, labelHe: string): PreflightCheckRow {
  return { name, labelHe, status: 'pass' };
}

function fail(name: string, labelHe: string, detail: string): PreflightCheckRow {
  return { name, labelHe, status: 'fail', detail };
}

export function runPreflight(facts: PreflightFacts): PreflightResult {
  const checks: PreflightCheckRow[] = [];

  // 1. Parent flag.
  checks.push(
    facts.parentFlag
      ? pass('parent_flag', 'דגל-ראשי פעיל')
      : fail('parent_flag', 'דגל-ראשי כבוי', 'ff.supplier_invoice_control.enabled = false'),
  );

  // 2. Send flag.
  checks.push(
    facts.sendFlag
      ? pass('send_flag', 'דגל שליחה פעיל')
      : fail('send_flag', 'דגל שליחה כבוי', 'ff.supplier_invoice_control.sumit_send.enabled = false'),
  );

  // 3. Activation mode.
  checks.push(
    facts.mode !== 'off'
      ? pass('activation_mode', `מצב פעיל: ${facts.mode}`)
      : fail('activation_mode', 'מצב פעיל: off', 'SystemConfig sumit.mode = off'),
  );

  // 4. Invoice exists + status.
  if (!facts.invoice) {
    checks.push(fail('invoice_exists', 'חשבונית קיימת', 'invoice not found'));
  } else {
    checks.push(
      facts.invoice.status === 'ready_for_accountant'
        ? pass('invoice_status', 'חשבונית מאושרת לרו״ח')
        : fail(
            'invoice_status',
            'חשבונית לא במצב המתאים',
            `invoice.status = ${facts.invoice.status} (expected ready_for_accountant)`,
          ),
    );

    // 5. Risk level.
    checks.push(
      facts.invoice.riskLevel !== 'red'
        ? pass('invoice_risk', 'סיכון מתחת לאדום')
        : fail('invoice_risk', 'סיכון אדום', 'invoice.riskLevel = red (manual override required)'),
    );

    // 7. Idempotency — no prior successful send.
    const alreadySent =
      facts.invoice.sumitStatus === 'sent' || facts.invoice.sumitStatus === 'confirmed';
    checks.push(
      !alreadySent
        ? pass('idempotency', 'טרם נשלח')
        : fail(
            'idempotency',
            'כבר נשלח ל-SUMIT',
            `invoice.sumitStatus = ${facts.invoice.sumitStatus} doc=${facts.invoice.sumitDocumentId ?? ''}`,
          ),
    );
  }

  // 6. Supplier approved + classified.
  if (!facts.supplier) {
    checks.push(fail('supplier_present', 'ספק משויך', 'invoice has no supplierId'));
  } else {
    checks.push(
      facts.supplier.isApproved === true
        ? pass('supplier_approved', 'ספק מאושר')
        : fail('supplier_approved', 'ספק לא מאושר', 'supplier.isApproved = false/null'),
    );
    checks.push(
      facts.supplier.osekClassification !== 'unknown'
        ? pass('supplier_classified', `סיווג ספק: ${facts.supplier.osekClassification}`)
        : fail('supplier_classified', 'ספק לא מסווג', 'supplier.osekClassification = unknown'),
    );
  }

  // Mode-specific env-readiness.
  if (facts.mode === 'api') {
    checks.push(
      facts.env.sumitApiKey ? pass('env_api_key', 'SUMIT_API_KEY מוגדר')
        : fail('env_api_key', 'SUMIT_API_KEY חסר', 'process.env.SUMIT_API_KEY not set'),
    );
    checks.push(
      facts.env.sumitCompanyId ? pass('env_company_id', 'SUMIT_COMPANY_ID מוגדר')
        : fail('env_company_id', 'SUMIT_COMPANY_ID חסר', 'process.env.SUMIT_COMPANY_ID not set'),
    );
    checks.push(
      facts.env.sumitWebhookSecret ? pass('env_webhook_secret', 'SUMIT_WEBHOOK_SECRET מוגדר')
        : fail('env_webhook_secret', 'SUMIT_WEBHOOK_SECRET חסר', 'process.env.SUMIT_WEBHOOK_SECRET not set'),
    );
  } else if (facts.mode === 'email') {
    checks.push(
      facts.env.accountantEmail ? pass('env_accountant_email', 'ACCOUNTANT_EMAIL מוגדר')
        : fail('env_accountant_email', 'ACCOUNTANT_EMAIL חסר', 'process.env.ACCOUNTANT_EMAIL not set'),
    );
    checks.push(
      facts.env.sendgridApiKey ? pass('env_sendgrid', 'SENDGRID_API_KEY מוגדר')
        : fail('env_sendgrid', 'SENDGRID_API_KEY חסר', 'process.env.SENDGRID_API_KEY not set'),
    );
  }
  // csv_export mode requires no env beyond the firebase storage already present.

  const firstFail = checks.find((c) => c.status === 'fail');
  return {
    ready: firstFail == null,
    checks,
    blockingReasonHe: firstFail ? firstFail.labelHe : null,
  };
}
