# Search and Retrieve

## When to use

Use this reference when looking up cards by identifier, searching for cards using filters, retrieving a card's full details, or querying a card's transaction history. Each pattern uses a different endpoint and a different identifier type.

## How to do it

### Search for cards with filters

`GET /v1/cards`

At least one qualifying search field must be supplied. Although the parameters look optional, a request with none is rejected. `CardType` and `CardStatus` alone are not treated as qualifying fields; include an identifying filter such as `CardUniqueIdentifier` or `DisplayNumber`.

Common parameters:

| Parameter | Description |
| --- | --- |
| `CardUniqueIdentifier` | The string identifier assigned at card creation |
| `DisplayNumber` | Nayax-assigned display number |
| `CardStatus` | Filter by status value (e.g. `1` for active) |
| `CardType` | Filter by CardTypeID (e.g. `33` for prepaid) |

Example request:

```
GET /v1/cards?CardUniqueIdentifier=<CardUniqueIdentifier>
```

Inspect the response shape for the filter you use before writing parsing logic; the search response may nest card data under sub-objects such as `CardDetails`, `CardHolderDetails`, and `CardCreditAttributes`.

### Get a single card by unique identifier

`GET /v1/cards/uniqueIdentifier/{CardUniqueIdentifier}`

Use the string identifier assigned at creation. This path (not a bare `/v1/cards/{CardUniqueIdentifier}`) returns the card as a **flat** object with fields at the top level:

```json
{
  "CardID": "<CardID>",
  "ActorID": "<ActorID>",
  "CardUniqueIdentifier": "<CardUniqueIdentifier>",
  "CardDisplayNumber": "<CardDisplayNumber>",
  "CardHolderName": "Jane Doe",
  "CardStatus": 1,
  "CardType": 33
}
```

### Get a card by display number

`GET /v1/cards/displayNumber/{CardDisplayNumber}`

Use the Nayax-assigned display number (different from `CardUniqueIdentifier`). Useful when you have the printed card number but not the internal identifier.

### Get transaction history

`POST /v1/cards/query`

This endpoint expects the body to be a bare JSON string (not a JSON object) containing the base64-encoded SHA1 hash of the card number. Send the hash as described below rather than a JSON object.

Steps to construct the body:

1. Take the card number (the `DisplayNumber` or card identifier used for transactions).
2. Compute the SHA1 hash of the card number.
3. Base64-encode the SHA1 hash bytes.
4. Send that base64 string as the entire request body, a JSON string and not an object.

Example request body (the value is a base64 string):

```
"dGhpcyBpcyBhbiBleGFtcGxlIGhhc2g="
```

The `Content-Type` header should still be `application/json`. The body is a JSON-encoded string value, not a JSON object.

Optional query parameter:

- `minutes` — the maximum age of transactions to retrieve, in minutes. Defaults to `1440` (24 hours). For example, `POST /v1/cards/query?minutes=60` returns only the last hour of transactions.

## Traps to avoid

- **Sending `GET /v1/cards` with no qualifying filter.** The endpoint requires at least one qualifying search field; `CardType` plus `CardStatus` alone is not sufficient. Include an identifying filter such as `CardUniqueIdentifier` or `DisplayNumber`.
- **Using a bare `/v1/cards/{identifier}` to fetch one card.** The single-card lookup is `/v1/cards/uniqueIdentifier/{CardUniqueIdentifier}` or `/v1/cards/displayNumber/{CardDisplayNumber}`. The lookup by unique identifier returns a flat object, so read fields such as `CardID` and `CardStatus` at the top level.
- **Wrong body format for `POST /v1/cards/query`.** The transaction history endpoint expects a quoted base64 string of the SHA1 hash of the card number, not a JSON object such as `{}` or `{"cardNumber": "..."}`.
- **Mixing up identifier types.** A card has three identifiers: `CardUniqueIdentifier` (your string), `DisplayNumber` (Nayax-assigned), and `CardID` (numeric). Different endpoints expect different ones; confirm which the path uses before calling.
