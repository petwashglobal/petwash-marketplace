# Billing kill-switch

The automatic cost circuit-breaker. When actual Google Cloud spend crosses the
**"PetWash cap"** budget (₪300/mo), this function **disables billing** on the
`signinpetwash` project — stopping every paid service. Pre-launch this means the
site goes dark instead of ever running up a surprise bill. Nir re-enables billing
to bring it back.

It pairs with the budget **alert** (the email) Nir sets in the console: the alert
*warns*, this function *acts*.

## How it works

```
Cloud Billing budget "PetWash cap"  ──(spend crosses 100%)──▶  Pub/Sub topic
    "billing-killswitch"  ──▶  this Cloud Function  ──▶  Cloud Billing API: billing OFF
```

The 50% / 90% early-warning notifications publish to the same topic; the function
ignores them and acts only when `costAmount > budgetAmount`.

## Safety: dry-run first

`KILLSWITCH_MODE` controls behaviour:

- **`dry-run`** (default) — logs and alerts what it *would* do, but never touches
  billing. Deploy in this mode, send a test message, confirm the logs, then arm.
- **`armed`** — actually disables billing when the cap is exceeded.

Deploy / re-deploy from the **Actions → "Deploy billing kill-switch"** workflow
(or on push to `main` under this folder). Choose `mode` when running it manually.

## Two one-time steps only Nir can do

Disabling billing is a privileged act, so two grants need **billing-account admin**
(Nir), not the deploy service account:

1. **Grant the function's service account billing control.** The deploy workflow
   prints the exact service-account email and command at the end of its run:
   ```
   gcloud billing accounts add-iam-policy-binding <BILLING_ACCOUNT_ID> \
     --member=serviceAccount:<FUNCTION_SA> --role=roles/billing.projectManager
   ```
2. **Connect the budget to the topic.** In the Cloud Console:
   `Billing → Budgets & alerts → PetWash cap → Edit → Manage notifications →`
   tick **"Connect a Pub/Sub topic to this budget"** → select **`billing-killswitch`**.

Then run the workflow once more with **`mode: armed`**. Verify a dry-run cycle
first if you want to see the pipeline light up without any risk.

## Optional

Set `ALERT_WEBHOOK_URL` (an env var on the function) to also POST a plain-text
alert to Slack/Discord/webhook when it fires or would fire.

## Reversing a fired kill-switch

If billing was disabled: Cloud Console → **Billing** → the project → **re-link the
billing account**. Services resume shortly after. Nothing is deleted — billing is
simply detached and re-attached.
