---
name: nayax-lynx-refunds
description: >-
  Use this skill when a developer is integrating Nayax Lynx API refund workflows, including requesting a refund on a transaction, uploading refund evidence or documentation, approving a refund, or declining a refund. Triggers on keywords such as: refund, refund request, refund approval, refund decline, refund documentation, refund evidence, RefundID, refund-approve, refund-decline, refund-request, upload-refund, cancel transaction, reverse payment, chargeback evidence. Also use when a developer encounters responses where the HTTP status does not match the result body, or permission errors on refund endpoints in the Lynx sandbox environment.
---

The Lynx refund workflow has three stages: request a refund on a transaction, upload supporting documentation, then approve or decline. On these endpoints the HTTP status code can look successful even when the operation did not complete, so the rules below matter as much as the paths.

**Audience:** developers building integrations on the Nayax Lynx API.

## Authentication

Every request uses a bearer token in the `Authorization` header:

`Authorization: Bearer <user-token>`

Get the token from the Nayax dashboard: your name menu, then **Account Settings**, then **Security and Login**, scroll to **User Tokens**, and click **Show Token**. Lynx user tokens do not expire, so treat one as a long-lived secret: keep it in an environment variable rather than in source or a prompt, give an AI agent only the token it needs, and revoke it in Nayax Core if it may have been exposed. See [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) for full guidance on using tokens with AI agents.

Refund endpoints additionally require a `refund` permission scope that is not on a standard sandbox token. Contact your Nayax representative to have the scope added before testing.

## Base URL

Sandbox base: `https://qa-lynx.nayax.com/operational`. Every path in this skill is relative to that base, so `/v1/payment/refund-request` resolves to `https://qa-lynx.nayax.com/operational/v1/payment/refund-request`. For production, replace the host with `lynx.nayax.com`.

## Workflow routing

| Trying to… | Endpoint | Reference |
| --- | --- | --- |
| Request a refund on a transaction | `POST /v1/payment/refund-request` | <references/request-refund.md> |
| Upload refund documentation or evidence | `POST /v1/payment/upload-refund` | <references/request-refund.md> |
| Approve a refund | `POST /v1/payment/refund-approve` | <references/approve-decline.md> |
| Decline a refund | `POST /v1/payment/refund-decline` | <references/approve-decline.md> |

## Critical rules

- **Confirm results from the response body, not the status code.** On these endpoints a success-looking status can accompany a failure body, so always inspect the body:
  - `refund-decline` can return a logical-failure body such as `{"Result":"Refund update failed. Please try again later or contact support.","Status":"failed"}`; a success status here does not mean the decline went through.
  - `refund-request` returns a `RefundID` in the body on success; treat any response without a `RefundID` as a failure.
  - `refund-approve` may not complete in the sandbox environment; confirm end-to-end approval with your Nayax representative.
- **The upload endpoint is `POST /v1/payment/upload-refund`.** There is no `/v1/payment/refund-documentation` path. The upload requires `FileData` (base64-encoded file content); an empty body returns a 400 "FileData is empty" wrapped in the gateway error.
- **The `refund-request` body uses specific field names.** Send `RefundAmount`, `RefundEmailList`, `RefundReason`, `TransactionId`, `SiteId`, and `MachineAuTime`. A bare `Reason` field is not the correct name.
- **Upload documentation before approving.** The approve step expects evidence to be attached to the refund. Upload successfully first.
- **Approve and Decline are mutually exclusive.** Once a refund is approved it cannot be declined, and once declined it cannot be approved. Do not call both for the same `RefundID`.
- **A full refund cannot be completed in the sandbox today.** There is no real transaction to refund (`TransactionId: 0` is not a valid transaction), and the approval flow does not complete in the sandbox. Use these endpoints to validate request shape and error handling, not to drive a successful refund end to end.

## Key documentation

- [Request a refund](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/refunds/request-refunds) — Opening a refund case and obtaining a RefundID
- [Upload refund document](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/refunds/upload-refund-document) — Attaching evidence with FileData
- [Approve or decline a refund](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/refunds/approve-or-decline-a-refund) — Closing a refund case
- [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) — How to obtain and safely use bearer tokens
