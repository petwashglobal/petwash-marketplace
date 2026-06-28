# Approve or Decline a Refund

## When to use

Use these endpoints as the final step of the refund workflow, after a refund has been requested and documentation uploaded. Call `POST /v1/payment/refund-approve` to process the refund back to the customer, or `POST /v1/payment/refund-decline` to reject the case. Only one of these should be called per `RefundID`; they are mutually exclusive.

## How to do it

**Approve a refund**

`POST /v1/payment/refund-approve`

```json
{
  "RefundID": "<refund_id>"
}
```

In the current sandbox this endpoint may not complete the approval flow. See Traps below.

**Decline a refund**

`POST /v1/payment/refund-decline`

```json
{
  "RefundID": "<refund_id>",
  "Reason": "Duplicate request"
}
```

This endpoint can return a success-looking status with a logical-failure body when permissions are insufficient or the refund cannot be resolved. Always check the response body.

## Traps to avoid

- **Approve and Decline are mutually exclusive.** Once `refund-approve` is called for a `RefundID`, calling `refund-decline` for the same ID fails, and vice versa. Decide the outcome before calling either.
- **Approve requires documentation first.** If `POST /v1/payment/upload-refund` was not called successfully before `refund-approve`, the approve call fails.
- **Approve may not complete in the sandbox.** Even with a valid `RefundID` and the `refund` scope, the approval flow may not return a success response in the sandbox. This reflects the sandbox setup rather than your request. Contact your Nayax representative if you need the approval flow working end to end.
- **Read the decline result from the body.** A response body of `{"Status":"failed"}` means the decline did not go through. Do not treat a success-looking status from this endpoint as confirmation of success.
- **Missing permissions affect both endpoints.** The `refund` scope must be on the token. Without it, these calls do not complete successfully, so verify the scope before integrating.
- **The RefundID comes from the request step.** There is no way to supply a `RefundID` without first calling `POST /v1/payment/refund-request`. If approve or decline fails with an invalid-ID error, verify the request step succeeded and that the `RefundID` was captured from its response body.
