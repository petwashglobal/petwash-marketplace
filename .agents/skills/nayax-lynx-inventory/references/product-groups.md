# Product Groups

## What product groups are

Product groups are organizational containers that categorize products — for example, "Beverages" or "Snacks." Every product in the Nayax system must belong to a product group. You cannot create a product without a valid `ProductGroupID`. Create product groups first, before any other inventory step.

Product groups and their products are scoped to a single operator and cannot be shared across operators.

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/v1/productGroups` | Create a new product group |
| GET | `/v1/productGroups` | List all product groups |
| GET | `/v1/operators/{ActorID}/productGroups` | List product groups for a specific operator |
| GET/POST/PUT/DELETE | `/v1/productGroups/{id}/tax` | Tax settings — **403-gated, see below** |

## Create a product group

```json
POST /v1/productGroups
Authorization: Bearer <your-token>

{
  "ActorID": "<ActorID>",
  "ProductGroupName": "Beverages",
  "ProductGroupCode": 1001,
  "ProductGroupSubCode": 10,
  "ProductGroupCategoryCode": "DRINKS"
}
```

Only `ProductGroupName` is required. `ActorID` should be the operator's ActorID.

**Response (200 OK):**

```json
{
  "ProductGroupRef": "v1/productGroups/<ProductGroupID>",
  "ActorRef": "/v1/actors/<ActorID>",
  "ProductGroupID": "<ProductGroupID>",
  "ActorID": "<ActorID>",
  "ProductGroupName": "Beverages",
  "ProductGroupCode": 0,
  "ProductGroupSubCode": 0,
  "ProductGroupCreatedBy": "<UserID>",
  "ProductGroupCreationDate": "2026-05-14T23:08:08.8395139Z",
  "ProductGroupUpdatedBy": "<UserID>",
  "ProductGroupLastUpdated": "2026-05-14T23:08:08.8395149Z",
  "ProductGroupPictureURL": null,
  "ProductGroupCategoryCode": ""
}
```

Capture `ProductGroupID` from the response. You need it when creating products in the next step.

## Body parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `ActorID` | int64 | Yes | Operator's ActorID |
| `ProductGroupName` | string | Yes | Display name for the group |
| `ProductGroupCode` | int64 | No | Group code — may not be persisted (see traps) |
| `ProductGroupSubCode` | int64 | No | Sub-code for further categorization |
| `ProductGroupCategoryCode` | string | No | Category tag (e.g., "DRINKS") |

## Tax endpoints — permission-gated

**The tax endpoints (`GET/POST/PUT/DELETE /v1/productGroups/{id}/tax`) require elevated permissions.** They are not accessible with a standard operator token. Do not include them in standard integration flows unless you have confirmed your token has tax management permissions.

## Traps to avoid

- **Do not rely on `ProductGroupCode` for lookups.** Use `ProductGroupID` for all subsequent references; `ProductGroupCode` is not a reliable lookup key.
- **Do not create products before creating a group.** A `ProductGroupID` is required at product creation time. Attempting to create a product with `ProductGroupID: 0` or an invalid ID will fail.
- **Products are operator-scoped.** A product group created under one ActorID cannot be used by a different operator.
