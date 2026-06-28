# Machine Products

## What machine products are

Machine products are the assignments that connect an operator product to a specific vending machine slot. A product must exist in the operator's catalog (with a valid `NayaxProductID`) before it can be assigned to a machine. This mapping defines which products are available in each machine and carries machine-specific pricing, bin codes, and stock parameters.

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/v1/machines/{MachineID}/machineProducts` | Assign one or more products to a machine |
| GET | `/v1/machineProducts?MachineID={id}` | List all products mapped to a machine |
| PUT | `/v1/machines/{MachineID}/machineProducts` | Update machine product assignments |

## Map products to a machine

The request body is an array — you can map multiple products in a single call.

```json
POST /v1/machines/<MachineID>/machineProducts
Authorization: Bearer <your-token>

[
  {
    "NayaxProductID": "<NayaxProductID>",
    "MDBCode": 3,
    "PAR": 5,
    "CashPrice": 2.50,
    "CreditCardPrice": 2.50,
    "RetailPrice": 2.50,
    "DEXProductName": "ExampleProd",
    "PACode": "C1",
    "PCCode": "03"
  }
]
```

`NayaxProductID` is the system-assigned identifier from the create-product response. `MachineID` is passed as a path parameter.

**Response (200 OK):**

```json
[
  {
    "DexPrice": 0.00,
    "ProductRef": "v1/products/<NayaxProductID>",
    "MachineProductRef": "v1/machines/<MachineID>/machineProducts/<MachineProductID>",
    "MachineRef": "/v1/machines/<MachineID>",
    "MachineProductID": "<MachineProductID>",
    "NayaxProductID": "<NayaxProductID>",
    "MachineID": "<MachineID>",
    "MDBCode": 3,
    "PAR": 5,
    "CashPrice": 2.5000,
    "CreditCardPrice": 2.5000,
    "RetailPrice": 2.5000,
    "DEXProductName": "ExampleProd",
    "PACode": "C1",
    "PCCode": "03",
    "LastUpdated": "2026-05-14T23:24:14.657",
    "ProductGroupID": "<ProductGroupID>",
    "slow_mover": false
  }
]
```

Capture `MachineProductID` from the response if you need to update or remove individual product assignments later.

## Key body parameters

| Parameter | Type | Required | Notes |
| --------- | ---- | -------- | ----- |
| `NayaxProductID` | int64 | Yes | System-assigned product ID — not the operator `ProductID` |
| `MDBCode` | int32 | No | MDB protocol selection number for the machine slot |
| `PAR` | int32 | No | Par level — target stock quantity for this slot |
| `CashPrice` | double | No | Price override for cash payments on this machine |
| `CreditCardPrice` | double | No | Price override for card payments on this machine |
| `RetailPrice` | double | No | Retail price displayed on the machine |
| `DEXProductName` | string | No | Product name used in DEX data exchange |
| `PACode` | string | No | Physical address code for the machine slot |
| `PCCode` | string | No | Product code for the machine slot |

## Get products for a machine

```
GET /v1/machineProducts?MachineID=<MachineID>
Authorization: Bearer <your-token>
```

Returns an array of all products currently mapped to the specified machine, with current pricing and stock metadata.

## Traps to avoid

- **Do not use `ProductID` instead of `NayaxProductID`.** These are different identifiers. `NayaxProductID` is the system-generated value in the create-product response. Passing a wrong ID causes a 400 or creates an invalid mapping.
- **Get the MachineID before mapping.** Machine IDs are not guessable. Retrieve valid machine IDs from `GET /v1/machines` or `GET /v1/operators/{ActorID}/machines` before attempting to map products.
- **Products must exist before mapping.** Complete steps 1 and 2 of the workflow (create product group, create product) before calling this endpoint.
- **Pricing on the machine product is separate from operator product pricing.** If you set `CashPrice` here, it overrides the operator-level price for this specific machine. Omit pricing fields to inherit from the operator product defaults.
