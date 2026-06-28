# Request Refund and Upload Documentation

## When to use

Use these two endpoints together at the start of every refund workflow. Call `POST /v1/payment/refund-request` to open a refund case on a transaction and obtain a `RefundID`. Then call `POST /v1/payment/upload-refund` to attach supporting evidence before the refund can be approved.

## How to do it

**Step 1 — Request the refund**

`POST /v1/payment/refund-request`

```json
{
  "RefundAmount": 10.00,
  "RefundEmailList": "",
  "RefundReason": "Customer request",
  "TransactionId": "<transaction_id>",
  "SiteId": "<site_id>",
  "MachineAuTime": "<timestamp>"
}
```

Use these exact field names. On success the response body contains a `RefundID`; save it for the Upload, Approve, and Decline calls.

In the sandbox there is no real transaction to refund, so this call will not return a `RefundID`. Treat any response without a `RefundID` as a failure and read the body rather than relying on the status code.

**Step 2 — Upload refund documentation**

`POST /v1/payment/upload-refund`

```json
{
  "FileName": "evidence.pdf",
  "FileData": "<base64-encoded file content>",
  "TransactionId": "<transaction_id>",
  "SiteId": "<site_id>",
  "MachineAuTime": "<timestamp>"
}
```

The path is `upload-refund`, not `refund-documentation`. `FileData` must contain the base64-encoded file content. An empty body returns a 400 "FileData is empty" (wrapped in the gateway error). On success the response confirms the file was stored.

**Step 3 — Proceed to approve or decline**

See `references/approve-decline.md`.

## Traps to avoid

- **Confirm success from the body, not the status code.** These endpoints can return a success-looking status alongside a failure body. Look for a `RefundID` (request) or a `"Status":"failed"` (failure) in the body rather than relying on the status code.
- **Wrong upload path.** The documentation upload is `POST /v1/payment/upload-refund`. There is no `/v1/payment/refund-documentation` endpoint.
- **Wrong request field names.** Use `RefundAmount`, `RefundEmailList`, `RefundReason`, `TransactionId`, `SiteId`, `MachineAuTime`. A bare `Reason` is not recognized.
- **Missing FileData on upload.** `FileData` (base64) is required. An empty body or a missing `FileData` returns "FileData is empty". There is no URL-based upload path.
- **The refund scope is required.** Without the `refund` scope the request and decline endpoints do not complete successfully. Contact your Nayax representative to have the scope added.
- **Store the RefundID immediately.** The `RefundID` from the request step links all later calls. If lost, you would have to look it up through a separate transaction query.
