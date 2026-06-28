# Products

## What operator products are

Operator products represent the physical items an operator sells — snacks, beverages, digital goods. Each product is tied to a product group, an operator (actor), and a set of pricing and catalog attributes. Once created, the system assigns a `NayaxProductID` that is the canonical identifier used everywhere else in the inventory workflow, including machine product mapping.

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/v1/operators/{ActorID}/products` | Create a new product |
| GET | `/v1/operators/{ActorID}/products` | List all products for an operator |
| PUT | `/v1/products/{NayaxProductID}` | Update a product |
| GET | `/v1/products/{NayaxProductID}` | Get a single product |

## Create a product

```json
POST /v1/operators/<ActorID>/products
Authorization: Bearer <your-token>

{
  "ProductGroupID": "<ProductGroupID>",
  "ActorID": "<ActorID>",
  "ProductName": "Energy Drink",
  "ProductBarcode": "EXAMPLE-EX1",
  "ProductDescription": "Example product",
  "DEXProductName": "ExampleProd",
  "ProductCostPrice": 1.00,
  "ProductDefaultRetailPrice": 3.00,
  "ProductCashPrice": 3.00,
  "ProductCreditCardPrice": 3.00,
  "ProductPrepaidCardPrice": 3.00,
  "ProductStatus": 1
}
```

Pass `ActorID` as both the path parameter and in the request body. `ProductGroupID` must be a valid group that already exists for this operator.

**Response (200 OK):**

```json
{
  "NayaxProductID": "<NayaxProductID>",
  "ProductGroupID": "<ProductGroupID>",
  "ActorID": "<ActorID>",
  "ProductName": "Energy Drink",
  "ProductBarcode": "EXAMPLE-EX1",
  "ProductDescription": "Example product",
  "DEXProductName": "ExampleProd",
  "ProductCostPrice": 1.0000,
  "ProductDefaultRetailPrice": 3.0000,
  "ProductStatus": 1,
  "ProductCashPrice": 3.0000,
  "ProductCreditCardPrice": 3.0000,
  "ProductPrepaidCardPrice": 3.0000,
  "ProductCreationDate": "2026-05-14T23:08:36.04",
  "Refs": {
    "product": "v1/products/<NayaxProductID>",
    "productGroup": "v1/productGroups/<ProductGroupID>",
    "create": "v1/operators/<ActorID>/products",
    "edit": "v1/products/<NayaxProductID>"
  }
}
```

**Capture `NayaxProductID` from the response.** This is the identifier you pass to machine product mapping in the next step. It is not the same as any internal `ProductID`.

## Key body parameters

| Parameter | Type | Notes |
| --------- | ---- | ----- |
| `ProductGroupID` | int32 | Required — must exist before calling this endpoint |
| `ActorID` | int64 | Required — must match the path parameter |
| `ProductName` | string | Display name |
| `ProductStatus` | int32 | `1` = active |
| `DEXProductName` | string | Name used in DEX data exchange protocol |
| `ProductCostPrice` | double | Wholesale cost |
| `ProductDefaultRetailPrice` | double | Default selling price |
| `ProductCashPrice` / `ProductCreditCardPrice` / `ProductPrepaidCardPrice` | double | Per-payment-method pricing |

## NayaxProductID vs ProductID

**`NayaxProductID` and `ProductID` are different identifiers.**

- `NayaxProductID` is assigned by the Nayax system when the product is created. It is returned in the create-product response and is the identifier used by all downstream endpoints (machine products, pick lists, updates by path param).
- Some parts of the documentation and older API versions reference `ProductID` — this is a different field and will not resolve when passed to machine product endpoints.

Always use `NayaxProductID` when mapping products to machines or updating a product by path parameter.

## Update a product

```json
PUT /v1/products/<NayaxProductID>
Authorization: Bearer <your-token>

{
  "ProductName": "Updated Energy Drink",
  "ProductDefaultRetailPrice": 3.50,
  "ProductCashPrice": 3.40,
  "ProductCreditCardPrice": 3.60
}
```

Pass only the fields you want to change. The body accepts the same parameters as the create request.

## Traps to avoid

- **Do not pass `ProductID` when mapping products to machines.** Machine product endpoints require `NayaxProductID`. Passing an operator-scoped `ProductID` causes a 400 or does not resolve.
- **Do not create a product before its product group exists.** The `ProductGroupID` is validated at creation time.
- **Products are operator-scoped.** A product created under one ActorID is not available to a different operator.
