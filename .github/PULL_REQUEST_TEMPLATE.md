<!--
  ⛔ REVIEW REJECTION TRIGGERS — read before submitting ⛔

  This PR will be returned without review if any of the following apply:

  1. Any of the 6 sections below is missing or empty
  2. A problem is described as "fixed" or "done" without a ✅ PASSED acceptance criterion
  3. Section 5 (Remaining Risk) is blank, says "N/A" without proof, or is vague
  4. This PR touches more than one domain without a scoreboard reference for each domain

  These rules are defined in: docs/architecture/PR_REVIEW_STANDARD.md § Enforcement
-->

## 1. Technical Root Cause

> What was actually broken, and how was it proven? Link the truth map or scoreboard entry.
> Do not write "I noticed X" — write "X is proven by [evidence]".

<!-- Replace this comment with your root cause proof -->

---

## 2. Exact Code Change

> What files changed and why? List each file and the specific behaviour that changed.
> No vague descriptions ("improved handling"). Be precise ("removed lines 400–428, direct dispatchNotification call").

| File | What changed | Why |
|------|-------------|-----|
|  |  |  |

---

## 3. Acceptance Proof

> How was it verified? List each acceptance criterion with a ✅ PASSED or ⚠️ PENDING status.
> Pending items must explain what evidence is still required and by when.

- [ ] Criterion 1
- [ ] Criterion 2

> Telemetry tag(s) added (if applicable): `[TAG_NAME]`

---

## 4. Business Impact

> What user problem is now reduced?
> Be specific about the user journey affected (e.g. "provider receiving booking confirmation", "customer viewing booking history").

<!-- One paragraph, plain English, no jargon -->

---

## 5. Remaining Risk

> What risk still exists after this PR?
> If nothing is at risk, state that explicitly — do not leave this blank.

<!-- One paragraph. "None" is a valid answer only if you can prove it. -->

---

## 6. What Is Not Solved Yet

> What is the next required step?
> List what this PR deliberately did NOT change and why.

<!-- Unresolved items belong here, not in the code as TODOs -->

---

## Scoreboard Reference

> Which EXECUTION_SCOREBOARD.md entry does this PR close, advance, or open?

- Scoreboard item: <!-- e.g. PR 3 — Identity Truth Repair -->
- Status change: <!-- e.g. READ-SIDE DONE → FRONTEND WAVE 1 IN PROGRESS -->
- Next required action: <!-- e.g. Monitor [IDENTITY_SPLIT_WRITE] for 30 days -->

---

> **Standard:** `docs/architecture/PR_REVIEW_STANDARD.md`  
> Every PR on this platform must complete all six sections above before merge.  
> Incomplete sections block review — they are not optional.
