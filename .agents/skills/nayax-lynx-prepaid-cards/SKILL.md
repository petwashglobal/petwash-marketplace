---
name: nayax-lynx-prepaid-cards
description: >-
  Use this skill when a developer is integrating Nayax Lynx prepaid card functionality, including creating virtual or prepaid cards, adding credit or revalue to cards, checking card balances, searching for cards, retrieving card details, viewing transaction history, or transferring revalue between cards. Triggers on keywords like: prepaid card, virtual card, card credit, revalue, CardTypeID, CardUniqueIdentifier, card balance, card transaction history, Lynx cards API, create card, top up card, card status.
---

Nayax Lynx prepaid cards carry two separate stores of value: credit (the spending balance used at machines) and revalue (a separate store used for machine refunds and cashback). This skill covers creating cards, funding them, moving value between them, and looking them up.

**Audience:** developers building integrations on the Nayax Lynx API.

## Authentication

Every request uses a bearer token in the `Authorization` header:

`Authorization: Bearer <user-token>`

Get the token from the Nayax dashboard: your name menu, then **Account Settings**, then **Security and Login**, scroll to **User Tokens**, and click **Show Token**. Lynx user tokens do not expire, so treat one as a long-lived secret: keep it in an environment variable rather than in source or a prompt, give an AI agent only the token it needs, and revoke it in Nayax Core if it may have been exposed. See [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) for full guidance on using tokens with AI agents.

## Base URL

Sandbox base: `https://qa-lynx.nayax.com/operational`. Every path in this skill is relative to that base, so `/v1/cards` resolves to `https://qa-lynx.nayax.com/operational/v1/cards`. For production, replace the host with `lynx.nayax.com`.

## Workflow routing

| Trying to… | Endpoint | Reference |
| --- | --- | --- |
| Create a virtual card (simpler, fewer fields) | `POST /v1/cards` | <references/create-cards.md> |
| Create a full-featured prepaid card | `POST /v2/cards` | <references/create-cards.md> |
| Update card status | `POST /v1/cards/{CardUniqueIdentifier}/status/{CardStatus}` | <references/create-cards.md> |
| Update card details (v2) | `PUT /v2/cards/{CardID}` | <references/create-cards.md> |
| Add credit to a card | `POST /v1/cards/{CardUniqueIdentifier}/credit/add` | <references/credit-and-revalue.md> |
| Check card credit balance | `GET /v1/cards/{CardUniqueIdentifier}/credit` | <references/credit-and-revalue.md> |
| Add revalue to a card | `POST /v1/cards/{CardUniqueIdentifier}/revalue/add` | <references/credit-and-revalue.md> |
| Check card revalue balance | `GET /v1/cards/{CardUniqueIdentifier}/revalue` | <references/credit-and-revalue.md> |
| Transfer revalue between cards | `POST /v1/cards/{FromCardUniqueIdentifier}/revalue/send/{ToCardUniqueIdentifier}` | <references/credit-and-revalue.md> |
| Search for cards with filters | `GET /v1/cards` | <references/search-and-retrieve.md> |
| Get a single card by unique identifier | `GET /v1/cards/uniqueIdentifier/{CardUniqueIdentifier}` | <references/search-and-retrieve.md> |
| Get a single card by display number | `GET /v1/cards/displayNumber/{CardDisplayNumber}` | <references/search-and-retrieve.md> |
| Get card transaction history | `POST /v1/cards/query` | <references/search-and-retrieve.md> |

## Critical rules

- **CardTypeID must be 33.** For prepaid cards, always set `CardTypeID: 33`. Valid values are 31 (Technician), 33 (Prepaid), 34 (Refund), 30000616 (Discount). Any other value fails or creates the wrong card type.
- **Include CardPhysicalType for v1.** Set `CardPhysicalType: 2` in v1 card creation; it is required even though it may look optional. For v2 the field is `PhysicalTypeID` with value `30000528`.
- **CountryID for cards is 225, not 840.** Card endpoints use Nayax's CountryID value (`225` for the United States), not the ISO numeric value (`840`). Actor endpoints use `840`; card endpoints use `225`.
- **CardDateRules is required for v2.** `POST /v2/cards` requires a `CardDateRules` object with at least `ActivationDate` and `ExpirationDate`; include it to avoid a failed request.
- **Set RevalueCashBit at creation.** To use any revalue endpoint, create the card with `CardCreditAttributes.RevalueCashBit: true`. This flag cannot be changed after creation; a card without it returns 400 "This Card is not defined as Revalue" on every revalue call.
- **Update card status is `POST` with the status in the path.** Use `POST /v1/cards/{CardUniqueIdentifier}/status/{CardStatus}` (for example `.../status/1`), not a `PUT` with a body. Always pass a valid `CardStatus` value.
- **Transfer revalue uses query parameters, not a body.** `POST /v1/cards/{FromCardUniqueIdentifier}/revalue/send/{ToCardUniqueIdentifier}` takes `CardCredit` (amount) and `CreditChangeRemarks` (remarks) as query parameters. There is no `/revalue/transfer` path. Both cards must have `RevalueCashBit: true`.
- **`GET /v1/cards` requires a qualifying search field.** Although the parameters look optional, a request with none is rejected. `CardType` and `CardStatus` alone are not sufficient; include an identifying filter such as `CardUniqueIdentifier` or `DisplayNumber`.
- **Get a single card by unique identifier returns a flat object.** `GET /v1/cards/uniqueIdentifier/{CardUniqueIdentifier}` returns fields at the top level (`CardID`, `CardStatus`, `CardType`, `CardDisplayNumber`, and so on). Use this path, not a bare `/v1/cards/{CardUniqueIdentifier}`.
- **Balance endpoints return `{"value": <number>}`.** Both `/credit` and `/revalue` return a simple object with a single `value` field.
- **Transaction history body is a JSON string, not an object.** `POST /v1/cards/query` takes the card number as a SHA1 hash, base64-encoded, sent as a bare JSON string rather than a JSON object.

## Key documentation

- [Create cards](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/cards/create-cards) — Card creation for v1 and v2, required fields, CardCreditAttributes
- [Managing cards](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/cards/managing-cards) — Status updates, card types, updating card details
- [Add credit to a card](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/cards/add-credit-to-card) — Credit and revalue operations
- [Retrieve card data](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/cards/retrieve-card-data) — Search, lookup, and transaction history
- [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) — How to obtain and safely use bearer tokens
