# PetWash — KILL COSTS runbook

**Project:** `signinpetwash` · **Region:** `me-west1` · created after the May 2026 spike
(₪240/mo → ₪1,747: Cloud Run ₪834, Secret Manager ₪639, Artifact Registry ₪201).
All commands run in **Cloud Shell** (console.cloud.google.com → terminal icon, top-right — free, no install).
Do them top to bottom. Numbers are the May breakdown.

---

## ⭐ STEP 0 — the real protection: a budget that EMAILS you (do this first)
Console → **Billing → Budgets & alerts → Create budget**.
- Amount: **₪400/month**. Alert thresholds: **50% / 90% / 100%**.
- Action: **email me** (nir.h@petwash.co.il). 
- 🔴 Do **NOT** tick "Disable billing when budget is exceeded" — that's what took the platform down. Alerts only.

This is the seatbelt that was missing. With it, a spike pings you the day it starts, not at month-end.

---

## STEP 1 — KILL the waste already sitting there

### Artifact Registry old images (₪201) — set a cleanup policy (set once, Google auto-deletes forever)
```bash
gcloud artifacts repositories set-cleanup-policies petwash-api \
  --location=me-west1 \
  --policy=ops/cost-control/artifact-registry-cleanup-policy.json
```
Keeps the most recent 5 images, deletes anything older than 7 days. (Clone the repo in Cloud Shell, or paste the JSON inline.)

### Secret Manager old versions (₪639) — destroy old versions, keep latest of each
```bash
for s in $(gcloud secrets list --format='value(name)'); do
  # keep the newest enabled version, destroy the rest
  vs=$(gcloud secrets versions list "$s" --filter='state=ENABLED' --sort-by='~createTime' --format='value(name)')
  echo "$vs" | tail -n +2 | while read v; do
    [ -n "$v" ] && gcloud secrets versions destroy "$v" --secret="$s" --quiet
  done
done
```
Destroys superseded secret versions (the churn that piled up to ₪639). Safe — the latest version of each secret stays active.

## STEP 2 — KILL services you don't need
### Google Maps / Places (₪43) — you already use FREE OpenStreetMap
Console → **APIs & Services → Enabled APIs** → Maps/Geocoding/Places → **Disable**.
(Or, to keep it but cap it: API → Quotas → set requests/day to ~100.)

### Gemini / Vertex AI (₪28) — advisory only, not core
Console → **APIs & Services** → "Generative Language API" + "Vertex AI API" → **Disable**.
(Also confirm `AI_CRONS_ENABLED` is NOT set on the Cloud Run service — it must stay unset/false.)

### The 3 extra projects (you have 4) — delete the unused ones
Console → project dropdown (top) → **Manage projects**. Keep **`signinpetwash`**. Delete the others
(especially "Default Gemini Project"). Deleting a project kills ALL cost in it — zero risk to your real one.

---

## STEP 3 — stop it regrowing (code side — being added separately)
- Auto-delete old Docker images (cleanup policy above = done).
- Deploy: skip re-creating unchanged secret versions; don't deploy on docs/asset-only changes.
- Batch deploys instead of deploy-on-every-merge.
- CI prints a clear "BILLING DISABLED" message instead of a confusing secret error.

---

## STEP 4 — only AFTER the above: re-enable billing, controlled
Console → **Billing → link billing account** to `signinpetwash`. With Step 0's budget in place and the
kills done, the next bill should be back to **~₪200/month**, capped.

## What I (the agent) can vs can't do — so you're never surprised again
- I CANNOT see your live bill, run these gcloud commands for you (they need YOUR console), or monitor spend 24/7.
- Protection = the budget alert (Step 0) + these caps/cleanups + the code guards. The SYSTEM protects you, not me watching.
