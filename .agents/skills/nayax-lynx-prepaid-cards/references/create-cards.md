# Create Cards

## When to use

Use this reference when creating a new prepaid or virtual card via the Lynx API, or when updating an existing card's status or details. There are two creation endpoints: `POST /v1/cards` for simpler virtual cards and `POST /v2/cards` for full-featured prepaid cards with credit limit configuration. Use v2 when you need to configure daily/monthly credit limits or reload amounts at creation time.

## How to do it

### Create a virtual card (v1)

`POST /v1/cards`

Minimum required fields:

```json
{
  "CardTypeID": 33,
  "CardPhysicalType": 2,
  "CardUniqueIdentifier": "YOUR-UNIQUE-STRING-HERE",
  "Status": 1,
  "CountryID": 225
}
```

`CountryID` must be `225` (Nayax's value for the United States), not the ISO numeric value `840`.

Include `CardCreditAttributes` with `RevalueCashBit: true` if you want to use revalue endpoints later:

```json
{
  "CardTypeID": 33,
  "CardPhysicalType": 2,
  "CardUniqueIdentifier": "YOUR-UNIQUE-STRING-HERE",
  "Status": 1,
  "CountryID": 225,
  "CardCreditAttributes": {
    "RevalueCashBit": true
  }
}
```

### Create a prepaid card (v2)

`POST /v2/cards`

The v2 endpoint requires both a `CardCreditAttributes` block and a `CardDateRules` block; omitting either causes the request to fail. The physical type field is `PhysicalTypeID` (not `CardPhysicalType`) and uses a different value.

```json
{
  "CardTypeID": 33,
  "PhysicalTypeID": 30000528,
  "CardUniqueIdentifier": "YOUR-UNIQUE-STRING-HERE",
  "Status": 1,
  "CountryID": 225,
  "CardDateRules": {
    "ActivationDate": "2026-01-01T00:00:00Z",
    "ExpirationDate": "2028-12-31T00:00:00Z"
  },
  "CardCreditAttributes": {
    "CreditAmountDailyLimit": 100.00,
    "CreditAmountMonthlyLimit": 500.00,
    "CreditAmountMonthlyReload": 500.00,
    "RevalueCashBit": true
  }
}
```

Set `RevalueCashBit: true` here if the card will ever need revalue operations. There is no way to enable this flag after card creation.

### Update card status

`POST /v1/cards/{CardUniqueIdentifier}/status/{CardStatus}`

Both the unique identifier and the new status go in the path. There is no request body. For example, to set a card active:

```
POST /v1/cards/YOUR-UNIQUE-STRING-HERE/status/1
```

This is a `POST`, not a `PUT`. Always pass a valid `CardStatus` value; out-of-range values may not behave as expected.

### Update card details (v2)

`PUT /v2/cards/{CardID}`

Use the numeric `CardID`. Supports updating `CardCreditAttributes` limits and other details, but `RevalueCashBit` cannot be changed after creation.

### Test cards

Create your own test cards in the sandbox to exercise these endpoints. Make at least two: one with `CardCreditAttributes.RevalueCashBit: true` (to test revalue) and one without it (to confirm revalue is correctly rejected). Note the `CardUniqueIdentifier` you assign and the `CardID` returned at creation; you will need them for the credit, revalue, status, and lookup calls.

## Traps to avoid

- **Wrong CardTypeID.** `CardTypeID` must be `33` for prepaid cards. Valid values: 31 (Technician), 33 (Prepaid), 34 (Refund), 30000616 (Discount).
- **Wrong CountryID.** Card creation requires CountryID `225` (Nayax's value), not `840` (ISO numeric). This differs from actor endpoints, which use `840`.
- **Missing CardPhysicalType (v1).** Always include `"CardPhysicalType": 2` for v1 creation; it is required even though it may look optional.
- **Wrong physical type field for v2.** The v2 endpoint uses `PhysicalTypeID` (value `30000528`), not `CardPhysicalType`. Using the v1 field name fails.
- **Missing CardDateRules for v2.** `POST /v2/cards` requires a `CardDateRules` object with `ActivationDate` and `ExpirationDate`. Include this block to avoid a failed request.
- **Missing v2 credit limit fields.** `POST /v2/cards` requires `CreditAmountDailyLimit`, `CreditAmountMonthlyLimit`, and `CreditAmountMonthlyReload` inside `CardCreditAttributes`.
- **Forgetting RevalueCashBit.** If revalue endpoints return 400 "This Card is not defined as Revalue", the card was created without `RevalueCashBit: true`. The only fix is to create a new card.
- **Using the wrong method or body for status updates.** Status update is `POST /v1/cards/{CardUniqueIdentifier}/status/{CardStatus}` with the status in the path and no body. A `PUT`, or a body carrying `{"Status": ...}`, will not work.
- **Using a numeric CardID for status updates.** The status path uses the `CardUniqueIdentifier` string. The numeric `CardID` is used for `PUT /v2/cards/{CardID}` detail updates.
