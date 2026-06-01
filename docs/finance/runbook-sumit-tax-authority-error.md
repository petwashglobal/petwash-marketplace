# Runbook — SUMIT Tax Authority Connection Errors

**Purpose:** What to do when SUMIT shows a "Tax Authority error" / "user not authorized" / "allocation number rejected" error while trying to issue PetWash Ltd. invoices.

**Audience:** CEO (Nir Hadad), accountant, future CTO agents.

**Last updated:** 2026-05-30 by CTO

---

## TL;DR

Most SUMIT ↔ Tax Authority errors are **regulatory paperwork gaps**, not code bugs. The fix is almost always:

1. Open Israel's digital authorization system at gov.il
2. Verify or extend the "מורשה-על" (Supreme Authorized Representative) authorization for PetWash Ltd. (ע.מ. 517145033) to the connecting user (Nir Hadad personal, ת.ז. 033554437)
3. Re-test the connection in SUMIT

No code change is needed for any of these. Do NOT escalate to CTO/engineer for this error class — escalate to **the tax accountant**.

---

## Common error patterns and what they mean

### Error: "המשתמש המחובר אל רשות המסים אינו רשאי לקבל מספר הקצאה עבור מספר העוסק"

**Translation:** The user connected to the tax authority is not authorized to receive an allocation number on behalf of the business.

**Meaning:** The SUMIT account holder (Nir Hadad personal) lacks the מורשה-על authorization scope for PetWash Ltd at the Tax Authority level.

**Fix:** See "Step-by-step fix" below.

### Error: "תוקף ההרשאה פג"

**Translation:** Authorization has expired.

**Meaning:** The מורשה-על authorization expired (default term: 1 year from grant).

**Fix:** Re-grant authorization via gov.il (same flow as initial). Optionally extend term to 1 year.

### Error: "החיבור נסגר"

**Translation:** The connection has been closed.

**Meaning:** Either the user or the Tax Authority terminated the connection. Common cause: re-issuance of digital certificate (חתימה אלקטרונית) invalidates prior authorizations.

**Fix:** Re-establish SUMIT ↔ TaxAuth connection in SUMIT first, then re-grant מורשה-על at gov.il.

### Error: "Tax ID mismatch"

**Translation:** SUMIT thinks PetWash Ltd has tax ID X, but Tax Authority records show Y.

**Meaning:** Data integrity issue — almost always operator typo in SUMIT business settings.

**Fix:** Open SUMIT → ניהול עסק (Business Management) → verify the company tax ID matches `517145033` exactly. NOT the registration number (registration is different from עוסק number).

---

## Step-by-step fix — Grant or renew מורשה-על authorization

**⚠️ READ BEFORE STARTING:** This is a fiduciary delegation that affects PetWash Ltd. tax compliance. **Always do this on a video call with the tax accountant.** 15-minute call beats hours of solo debugging.

### Prerequisites

| Item | Notes |
|---|---|
| Digital certificate (חתימה אלקטרונית) | Smart card or USB token issued during company registration. Must be valid (not expired). |
| Tax ID — personal | `033554437` (Nir Hadad) |
| Tax ID — business | `517145033` (PetWash Ltd / פט וואש בע"מ) |
| Operating hours | Sunday–Thursday, 08:15–15:45 Israel time. Outside these hours, gov.il digital auth services are mostly degraded. |
| Browser | Chrome or Edge on Mac/Windows. Safari is sometimes flaky on the gov.il digital cert flow. |

### Steps

1. **Call the accountant first.** Confirm:
   - The scope to grant (default: "חשבוניות ישראל" only — Israel Invoices allocation number receipt)
   - The authorization term (default: 1 year)
   - Any audit-trail documentation needed on the accountant's end

2. **Open Israel's Digital Authorization System:**
   - URL: https://www.gov.il/he/service/authorize-certification-perform-digital-operations
   - Click **"לכניסה למערכת"** (Enter system)

3. **Authenticate with digital certificate.** The browser will prompt for the cert PIN.

4. **Navigate to "ניהול הרשאות"** (Authorization Management).

5. **Register PetWash Ltd. (skip if already registered):**
   - Add the business: ע.מ. `517145033`
   - Verify business name appears as: `פט וואש בע"מ`
   - Confirm Nir Hadad is the מורשה-על (or initial registrant)

6. **Grant authorization to self:**
   - Authorizing party: PetWash Ltd. (517145033)
   - Authorized party: Nir Hadad personal (033554437)
   - Scope: **חשבוניות ישראל** (Israel Invoices)
   - Sub-scope: **קבלת מספר הקצאה** (allocation number receipt)
   - Term: 1 year (or per accountant guidance)

7. **Save and confirm** the authorization appears in the active list.

8. **Wait 5–10 minutes** for Tax Authority systems to propagate the authorization.

9. **Re-test in SUMIT:**
   - Open: https://app.sumit.co.il/accounting/shaamstatus/?companyid=1455151432
   - Click **"בדיקת החיבור לטובת קבלת מספר הקצאה לחשבוניות"**
   - Expected result: success message (NO error)

10. **Document for audit trail:**
    - Screenshot the active authorization in gov.il
    - Save in `docs/finance/sumit-auth-grants/2026-MM-DD-grant.png` (private, do not commit)
    - Email confirmation to accountant for their records

---

## What NOT to do

- **Do not click through the gov.il system alone for the first time.** Use the accountant call.
- **Do not grant blanket authorization** ("all services" / "כל השירותים"). Grant only what SUMIT needs today. Each additional scope is a separate fiduciary risk.
- **Do not let anyone else use your digital certificate.** It's tied to your personal ת.ז. and constitutes legal signature.
- **Do not engineer around the error.** This is a regulatory paperwork gap. No code change can substitute for proper מורשה-על registration.
- **Do not commit screenshots of digital certificates, PIN entry, or authorization tokens.** These belong in the company's private accountant folder, not in this repo.

---

## When to escalate to engineering (rare)

Engineering escalation is appropriate **only if all of these are true**:

- מורשה-על authorization at gov.il is confirmed active for the connecting user + business
- SUMIT connection status shows **פעיל** (active)
- More than 30 minutes have passed since the authorization was granted
- The "test connection" button in SUMIT still returns an error
- The error message references something other than authorization (e.g., "API timeout," "invalid token format")

In that case, contact SUMIT support directly:
- Phone: see SUMIT account dashboard
- Email: include screenshot of the gov.il authorization + SUMIT connection screen

Only escalate to PetWash CTO/engineering if SUMIT explicitly says the error is on PetWash's side (their docs reference our `SUMIT_API_KEY` or `SUMIT_WEBHOOK_SECRET` env vars).

---

## Reference

- Active authorization SUMIT screen (CEO eyes only):
  `app.sumit.co.il/accounting/shaamstatus/?companyid=1455151432`
- gov.il authorization system:
  https://www.gov.il/he/service/authorize-certification-perform-digital-operations
- Tax Authority phone (English option available):
  `*4954` from Israel, or `02-5656400` from abroad
- PetWash Ltd company details:
  - Legal name (HE): `פט וואש בע"מ`
  - Legal name (EN): `PET WASH LTD`
  - Company tax ID: `517145033`
  - See `server/email/brand-identity.ts` for canonical reference

## Related docs

- `docs/finance/sumit-readiness-check-2026-05-23.md` §7-10 — current connection state
- `docs/finance/sumit-activation-playbook-2026-05-23.md` — full SUMIT activation sequence
- `docs/SUMIT_SUPPORT_EMAIL.md` — open questions for SUMIT support
- `.claude/skills/petwash-platform/SKILL.md` §0.7 — partner / scalable deployment positioning
