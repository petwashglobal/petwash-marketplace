# Reversible Safety-Net Console Guide — iPad Edition

**Audience:** CEO (Nir) on iPad Safari.
**Purpose:** Step-by-step click-by-click guidance to enable the three reversible safety nets identified in `docs/BACKUP_RETENTION_ARCHITECTURE.md` §7 and `docs/PHASE_1_INVENTORY_REPORT.md` §7.
**Status:** Guidance only. No infrastructure changed by this PR. The CEO chooses when (and whether) to perform the actions described.

---

## 0. Important — read this before you start

This guide covers three actions. **All three are reversible.** None of them lock anything. None of them apply a retention policy. None of them affect billing in a meaningful way (cost impact under $1 per month combined at current scale). None of them touch IAM permissions or who can access what.

The actions, in order:

1. **Action A:** Enable Object Versioning on each of the three backup buckets.
2. **Action B:** Verify Soft Delete is enabled (7-day window) on each of the three backup buckets. Likely already enabled by default — this is a check, not a change.
3. **Action C:** Enable Firestore Point-in-Time Recovery (PITR). Requires one paste into the browser-based Cloud Shell — see §C below for why this cannot be done with pure point-and-click in 2026.

### Things you must NEVER click during this exercise

These are unrelated to the three actions and are dangerous. **Do not click any of these** while you are in the console:

- **"Lock retention policy"** — anywhere. This is irreversible and waits for explicit accountant + privacy counsel signoff before it should be touched. Phase 3 work.
- **"Set retention policy"** — wait for the data classification signoff before touching this.
- **"Delete bucket"** — red button, obvious. Never click.
- **"Disable soft delete"** — the opposite of what we want.
- **"Delete database"** — Firestore page. Never click.
- **Storage class changer ("Move to Coldline / Archive")** — leave the storage class on whatever it is today. Phase 1 is not the time to move data tiers.
- **"Edit lifecycle rules"** — even though we want lifecycle rules eventually, this is Phase 2 work. Do not set any lifecycle rule today.

If you accidentally land on a screen with any of these buttons highlighted, scroll away and use the back button. None of them are involved in the three actions below.

---

## 1. Pre-flight checklist

Before you start the three actions, confirm:

- [ ] You are on iPad Safari, signed into the Google account that owns the `signinpetwash` GCP project. That is almost certainly `nir.h@petwash.co.il` per the SUPER_ADMIN_EMAILS env var in `cloudrun-service.yaml:160`. If you are signed into a different Google account in Safari, sign out and sign in with the right one first.
- [ ] iPad is in landscape orientation. The GCP console is more readable in landscape on iPad.
- [ ] You have at least 30 minutes uninterrupted. Each action takes 2 to 5 minutes. With reading the screens carefully, allow 30 minutes total for all three.
- [ ] You have this document open in a second tab (or printed) so you can reference it without losing your place in the console.
- [ ] You have water. The console is dry reading.

---

## 2. Action A — Enable Object Versioning on three buckets

**What this does:** Once Versioning is on, every time someone (or a script) overwrites or deletes an object in the bucket, GCS keeps the old version in a hidden "non-current" pool that you can still recover from. Without versioning, overwrites are unrecoverable.

**Why this is safe:** It is fully reversible — you can turn it off any time, and the existing versions remain accessible until lifecycle rules expire them. Cost impact is near zero for backup buckets because backup files are written with date-stamped filenames (each backup is a new file, not an overwrite), so very few "non-current versions" accumulate.

**How long it takes:** about 2 minutes per bucket, 6 minutes total.

### Step-by-step

**A.1. Open the GCP Console.**

- Go to: https://console.cloud.google.com
- Confirm the top blue bar shows the project as `signinpetwash`. If it shows a different project, tap the project name → search for `signinpetwash` → select it.

**A.2. Navigate to Cloud Storage Buckets.**

- Tap the hamburger menu (the three horizontal lines, top-left).
- In the menu, scroll down to the **Storage** section.
- Tap **Cloud Storage**.
- Tap **Buckets** in the submenu.

**Checkpoint:** You should now see a list of buckets including `petwash-code-backups`, `petwash-firestore-backups`, and `petwash-secure-messages`. If you do not see all three, stop and message back — that itself is a finding.

**A.3. For each of the three buckets, do this:**

Start with `petwash-firestore-backups` (the biggest one — daily Firestore exports).

1. Tap the bucket name `petwash-firestore-backups`.
2. You will land on the bucket's **Objects** tab (showing the files inside). Do not tap anything in this tab.
3. Tap the **PROTECTION** tab near the top of the page. On iPad you may need to scroll the tabs horizontally to find it. The tabs typically read: OBJECTS | CONFIGURATION | PERMISSIONS | PROTECTION | LIFECYCLE | OBSERVABILITY. Tap PROTECTION.
4. On the Protection tab, scroll down to find the section labelled **Object versioning**. It will show one of two states:
   - **"Off"** — needs to be turned on. Continue.
   - **"On"** — already enabled. Skip to the next bucket.
5. If Off: tap the status text or the small pencil-edit icon next to "Object versioning". A dialog will open titled something like **"Turn on object versioning"**.
6. In that dialog, leave any lifecycle-related fields BLANK (do not configure lifecycle rules right now — that is later work). Just toggle versioning on.
7. Tap **CONFIRM** or **SAVE**.

**Checkpoint:** the Protection tab now shows **Object versioning: On**. There may also be a small green toast notification at the top saying "Object versioning enabled on bucket petwash-firestore-backups".

**A.4. Repeat A.3 for the other two buckets.**

- Tap the back arrow (or the breadcrumb that says "Buckets" near the top) to return to the bucket list.
- Tap `petwash-code-backups`. Run through the same Protection → Object versioning → On flow.
- Tap the back arrow. Tap `petwash-secure-messages`. Same flow.

**A.5. Confirm all three.**

Return to the buckets list. There is no per-bucket versioning indicator in the bucket list view on iPad, so you have to tap into each bucket's Protection tab one more time to confirm "Object versioning: On" for all three.

### What you should send back to me after Action A

A single line per bucket like this — paste into chat:

```
petwash-code-backups: Object versioning ON (was OFF)
petwash-firestore-backups: Object versioning ON (already was)
petwash-secure-messages: Object versioning ON (was OFF)
```

I will append this to the Phase 1 inventory report.

---

## 3. Action B — Verify Soft Delete is enabled (7-day window) on three buckets

**What this does:** Soft Delete is a GCS-native safety net introduced in late 2023. When an object is "deleted" from a bucket (whether by a user, a script, or an accidental console action), it stays recoverable for the soft-delete retention period before truly being purged. This is **different from Object Versioning** — versioning protects against overwrites; soft delete protects against deletions.

**Why this is safe:** Since late 2023, GCS enables Soft Delete BY DEFAULT at 7 days on all new buckets. Your three buckets were likely created before that default existed, so they may need to be turned on manually. Either way, this is fully reversible.

**How long it takes:** about 1 minute per bucket, 3 minutes total.

**Cost impact:** soft-deleted objects are billed at the bucket's normal storage rate during the 7-day retention. For your backup buckets with low deletion rate, this is negligible (cents per month at most).

### Step-by-step

**B.1. From the Protection tab of each bucket (where you just enabled Versioning), look for the "Soft delete policy" section.**

The Soft delete policy section is right above or below Object versioning on the Protection tab.

The section will show one of three states:

- **"7 days"** — already at the recommended default. Leave alone. Confirmed.
- **"Disabled"** or **"0 days"** — needs to be turned on. Continue.
- **A number other than 7** — already enabled but with a different retention. The 7-day default is fine. If it is shorter than 7, change to 7. If it is longer, leave alone (longer is more conservative).

**B.2. If it shows "Disabled" or 0 days, change it:**

1. Tap the status or the pencil-edit icon next to "Soft delete policy".
2. A dialog opens. You will see a slider or numeric input for "Retention duration in days".
3. Set it to **7 days**.
4. Do NOT set it to 90 days — that would significantly increase storage costs. Stick to 7.
5. Tap CONFIRM or SAVE.

**Checkpoint:** the Protection tab now shows **Soft delete policy: 7 days**. Green toast at the top.

**B.3. Repeat for all three buckets.**

Same as Action A.4 — back to bucket list, tap into the next bucket, Protection tab, verify or enable.

### What you should send back to me after Action B

```
petwash-code-backups: Soft delete 7 days (was OFF)
petwash-firestore-backups: Soft delete 7 days (already was)
petwash-secure-messages: Soft delete 7 days (was OFF)
```

---

## 4. Action C — Enable Firestore PITR

**What this does:** Point-in-Time Recovery (PITR) makes Firestore retain enough log data to "rewind" the database to any moment within the last 7 days. Once enabled, if anyone accidentally deletes a Firestore document or corrupts a collection within the last 7 days, you can recover it surgically without restoring the entire daily JSON export.

**Why this is reversible:** PITR can be disabled at any time. Cost while enabled: free for the first 7 days within the retention window (standard Firestore storage rate beyond that — but since the window IS 7 days, in practice it is just free).

**The complication for iPad-only use:** As of May 2026, Google's Cloud Console does NOT have a "click to enable PITR" toggle for existing Firestore databases. The only ways to enable it are: (1) a one-line `gcloud` command, or (2) a Terraform / API call. Neither is point-and-click.

**The iPad-friendly path:** Use **Cloud Shell** — a browser-based Linux shell that runs inside the GCP Console. You do not install anything on your iPad. You do not connect to anything. You open a button on the console, wait 30 seconds for it to load, paste one command, press Return, done.

**If you would rather not use Cloud Shell at all:** Skip this action for now and delegate it to an engineer (they can run the one-line command from their laptop in 5 seconds). PITR is valuable but not as urgent as Actions A and B. Mark this as "deferred to engineer" and proceed.

### Step-by-step (Cloud Shell path)

**C.1. From the GCP Console (anywhere — same `signinpetwash` project as before), tap the small `>_` (terminal) icon in the top-right corner of the page.**

This icon is between the help "?" icon and the notifications bell. It is small. You may need to enlarge the page first by pinching outward on the iPad.

A panel will slide up from the bottom or right. It says **"Welcome to Cloud Shell"** the first time, then a black terminal-style window appears.

**First-time only:** Cloud Shell takes 30 to 90 seconds to provision a personal VM the first time you open it. Subsequent opens are 5 seconds. There is no cost — Cloud Shell is free.

**C.2. Wait until the prompt looks like this:**

```
nir@cloudshell:~ (signinpetwash)$
```

If the project shown in the parentheses is NOT `signinpetwash`, type this and press Return first:

```
gcloud config set project signinpetwash
```

**C.3. Paste this exact command and press Return:**

```
gcloud firestore databases update --database='(default)' --enable-pitr --project=signinpetwash
```

The command will return a confirmation that looks like a few lines of YAML/JSON ending with `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED`.

**Checkpoint:** read the output. Look for the string `POINT_IN_TIME_RECOVERY_ENABLED`. If you see it, PITR is now on.

If you see an error message instead, copy the entire error and paste it into chat to me. Common errors:
- "Database does not exist" — the database ID is wrong. You may have a non-default database.
- "Permission denied" — your account does not have firestore.databases.update permission. You would need to grant yourself the Firestore Admin role (or have an engineer do it).
- "Billing not enabled" — unlikely since the project runs Cloud Run, but possible.

**C.4. Verify the change:**

Paste this command and press Return:

```
gcloud firestore databases describe --database='(default)' --project=signinpetwash --format="value(pointInTimeRecoveryEnablement,locationId)"
```

Output should be:

```
POINT_IN_TIME_RECOVERY_ENABLED  <region>
```

**Important — note the region.** The `<region>` shown is where your Firestore database lives. If it is `me-west1` you are in Israel and matched with Cloud Run. If it is `nam5` (multi-region US) or `eur3` (multi-region EU), the Firestore data is NOT in Israel — that is a separate finding to discuss with privacy counsel, but it is NOT something we can fix today (changing a Firestore database region requires a full migration). Note the region and continue.

**C.5. Close Cloud Shell when done.**

Tap the small X or "Close terminal" link in the top-right of the Cloud Shell pane.

### What you should send back to me after Action C

```
Firestore PITR: ENABLED (or "deferred to engineer")
Firestore region: <whatever the describe command returned>
```

---

## 5. After all three actions — quick summary

You should now have:

- Object Versioning ON for all three backup buckets.
- Soft Delete at 7-day retention for all three backup buckets.
- Firestore PITR ON (or "deferred to engineer" if you chose to skip Action C).

What you have NOT done (intentionally):

- No Bucket Lock — that comes after legal signoff.
- No retention policy on the buckets — that comes after legal signoff.
- No lifecycle rules — that comes in Phase 2.
- No IAM grant changes — Phase 3 or later.
- No service account changes — Phase 3 or later.
- No billing tier upgrade on Neon — that is a separate decision after the Phase 1 cost-volume measurement.

**Cost impact of what you just did:** estimated under $1 per month combined at current data volumes. Object Versioning bills at storage rate for non-current versions (low for date-named backup files). Soft Delete bills at storage rate for soft-deleted objects (low for backup buckets with low delete rate). Firestore PITR is free for the 7-day retention window.

---

## 6. What can go wrong and how to recover

**You enabled Object Versioning but it was already on.** No harm done. The toggle is idempotent.

**You set Soft Delete to a different number of days by mistake.** No harm done immediately. Edit again, set to 7. If you set it very high (e.g., 90 days) the cost increases — change it back within a day before any real impact.

**You accidentally tapped "Lock retention policy".** This is the irreversible button you must never tap. If somehow you tap it AND confirm AND it succeeds — STOP and message me immediately. Do NOT proceed with anything else in the console. A locked retention policy is the only thing in this entire guide that cannot be undone.

**Cloud Shell shows an error you do not understand.** Copy the entire error text (long-press in Cloud Shell → Select All → Copy) and paste it into chat to me. Do not retry blindly.

**You navigated to the wrong project.** Tap the project name in the top bar, search for `signinpetwash`, select. Start the action again.

**The iPad logged you out mid-action.** Sign back in. Resume from the last action you completed. The actions are idempotent — re-running them on a bucket that is already configured has no effect.

---

## 7. What this guide does NOT cover (Phase 2 or later)

- Switching the Firestore "roll-your-own JSON export" to GCP managed exports.
- Adding the missing `legal_holds` and `backup_logs` collections to the Firestore export list.
- Writing an independent Postgres `pg_dump` Cloud Run Job.
- Adding GCS lifecycle rules to transition old backups to Coldline / Archive.
- Setting GCS retention policies (precursor to Bucket Lock).
- Enabling Bucket Lock itself (irreversible — needs legal signoff).
- Adding database-level triggers to enforce audit-table immutability.
- Postgres role separation (app-runtime role vs migration role).
- Setting up the Google Workspace Shared Drives architecture.
- Setting up Google Vault retention rules.
- Adding 2-step OTP on destructive admin routes.

All of the above are documented in `docs/BACKUP_RETENTION_ARCHITECTURE.md` and `docs/PHASE_1_INVENTORY_REPORT.md` for their respective phases.

---

## 8. After you complete the actions

Paste a short confirmation back to me in chat — one block, in the format shown in §2.A, §3.B, and §4.C above. I will:

1. Append a "measured state" subsection to `docs/PHASE_1_INVENTORY_REPORT.md` recording what you found.
2. Wait for your explicit greenlight before scoping any Phase 2 PR.

No further infrastructure changes will happen until you explicitly trigger them.

---

**End of guide.**
