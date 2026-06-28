# Credit and Revalue

## When to use

Use this reference when adding funds to a card, checking a card's balance, or moving revalue between cards. Credit and revalue are two separate stores of value. Credit is the standard spending balance used at machines. Revalue is a separate store used for machine refunds and cashback, available only on cards created with `CardCreditAttributes.RevalueCashBit: true`.

## How to do it

### Add credit to a card

`POST /v1/cards/{CardUniqueIdentifier}/credit/add`

Use the `CardUniqueIdentifier` string (not the numeric `CardID`) in the path.

```json
{
  "CreditAmount": 10.00
}
```

### Check credit balance

`GET /v1/cards/{CardUniqueIdentifier}/credit`

No request body. Returns a simple object: `{"value": 0.0100}`.

### Add revalue to a card

`POST /v1/cards/{CardUniqueIdentifier}/revalue/add`

The card must have been created with `CardCreditAttributes.RevalueCashBit: true`. Otherwise this returns 400 "This Card is not defined as Revalue".

```json
{
  "RevalueAmount": 5.00
}
```

### Check revalue balance

`GET /v1/cards/{CardUniqueIdentifier}/revalue`

No request body. Returns `{"value": 0.0200}`. Same `RevalueCashBit` requirement as add revalue.

### Transfer revalue between cards

`POST /v1/cards/{FromCardUniqueIdentifier}/revalue/send/{ToCardUniqueIdentifier}`

Both card identifiers go in the path. The amount and remarks are **query parameters**, not a JSON body:

- `CardCredit` — the amount of revalue to transfer
- `CreditChangeRemarks` — remarks for the transfer (required; omitting it returns 400 "remarks required")

```
POST /v1/cards/FROM-CARD/revalue/send/TO-CARD?CardCredit=5.00&CreditChangeRemarks=Refund%20transfer
```

Send the request with a body length set (an empty body is fine), so a `Content-Length` header is present. Both the source card and the destination card must have `RevalueCashBit: true`.

### Credit vs revalue: which to use

| Scenario | Use |
| --- | --- |
| Adding spending funds to a card | Credit (`/credit/add`) |
| Machine refund or cashback | Revalue (`/revalue/add`) |
| Moving refund balance between cards | Revalue send (`/revalue/send/{To}`) |
| Checking what a card can spend | Credit (`/credit`) |

## Traps to avoid

- **Revalue on a card without RevalueCashBit.** If `RevalueCashBit` is `null` or `false`, all revalue endpoints return 400 "This Card is not defined as Revalue". There is no fix; the card must be recreated. To test revalue, use a card you created with `RevalueCashBit: true`; a card created without it always fails the revalue calls.
- **Confusing credit and revalue.** Credit is the spending balance; revalue is a separate machine-refund store. Adding one does not add the other. Developers sometimes try to use revalue as a general top-up; redirect them to the credit endpoint.
- **Wrong transfer path or parameter location.** The transfer endpoint is `/revalue/send/{ToCardUniqueIdentifier}` (not `/revalue/transfer`), and it takes `CardCredit` and `CreditChangeRemarks` as query parameters, not a JSON body. Passing the target card or amount in the body will not work.
- **Missing the transfer remarks.** `CreditChangeRemarks` is required. Without it the call returns 400 "remarks required".
- **POST with no body length.** Include a body (an empty body is fine) so a `Content-Length` header is set on the request.
- **Wrong identifier in the URL.** Credit and revalue endpoints use `CardUniqueIdentifier` in the path, not the numeric `CardID`.
