# Artifact Registry cleanup rule

Every deploy pushes a container image to:

```
me-west1-docker.pkg.dev/signinpetwash/petwash-api/backend
```

tagged with both `:<commit-sha>` and `:latest`. Old SHA-tagged images are **never**
deleted automatically, so the registry (and its GCP storage bill) grows with every deploy.

This directory holds the **cleanup rule** — Google Artifact Registry's native auto-delete
policy — so the registry stays bounded without anyone deleting images by hand.

## What the rule does ([cleanup-policy.json](cleanup-policy.json))

Evaluated together; **Keep always wins over Delete**:

| Policy | Effect |
|---|---|
| `keep-latest-tag` | Never delete the image tagged `latest` (the live one). |
| `keep-30-most-recent` | Always keep the 30 newest image versions (rollback window). |
| `delete-untagged-after-7d` | Delete orphaned, untagged image digests older than 7 days. |
| `delete-old-versions-after-60d` | Delete anything older than 60 days **that the two Keep rules above didn't protect**. |

Net effect: an image is deleted only if it is **both** older than 60 days **and** not among
the 30 most recent **and** not `latest`. For a team that deploys often, the live Cloud Run
image is always in the newest-30, so **serving/rollback images are protected**.

## ⚠️ Safety — read before applying

Cloud Run revisions pin a specific image **digest**. Deleting an image a live revision
points to causes an outage when that revision next restarts or scales. The Keep rules above
are designed to prevent that, but **you must dry-run first** and confirm nothing live is listed.

## How to apply (run in Cloud Shell)

**Step 1 — DRY RUN (deletes nothing, just lists what it *would* delete):**

```bash
gcloud artifacts repositories set-cleanup-policies petwash-api \
  --project=signinpetwash \
  --location=me-west1 \
  --policy=cleanup-policy.json \
  --dry-run
```

Then trigger an evaluation and read the would-delete list in the logs / repo details:

```bash
gcloud artifacts repositories describe petwash-api \
  --project=signinpetwash --location=me-west1
```

**Step 2 — go LIVE (only after the dry-run list looks safe):**

```bash
gcloud artifacts repositories set-cleanup-policies petwash-api \
  --project=signinpetwash \
  --location=me-west1 \
  --policy=cleanup-policy.json \
  --no-dry-run
```

The policy then runs automatically on Google's schedule — no cron, no manual deletes.

## Rollback

Remove the policies (registry reverts to keep-everything):

```bash
gcloud artifacts repositories delete-cleanup-policies petwash-api \
  --project=signinpetwash --location=me-west1 \
  --policynames=keep-latest-tag,keep-30-most-recent,delete-untagged-after-7d,delete-old-versions-after-60d
```

## Tuning

- More aggressive (free more space, smaller rollback window): lower `keepCount` to `15`,
  lower `delete-old-versions-after-60d` to `30d`.
- More conservative: raise `keepCount` to `50`, raise the delete window to `90d`.
