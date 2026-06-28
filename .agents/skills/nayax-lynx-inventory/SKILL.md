---
name: nayax-lynx-inventory
description: >-
  Use this skill when a developer is managing product inventory in Nayax Lynx:
  creating product groups, adding products, mapping products to machines, or
  generating and managing pick lists for restocking. Triggers on keywords like:
  inventory, product group, ProductGroupID, product, ProductID, machine products,
  machine mapping, pick list, picklist, restock, restocking, inventory workflow,
  400 error on inventory endpoints. Also use when troubleshooting validation errors
  on inventory endpoints or questions about the required inventory workflow order.
---

The Nayax Lynx inventory system organizes vending machine stock into a four-level hierarchy: product groups contain products, products are mapped to machines, and pick lists drive restocking trips.

**Audience:** developers building integrations on the Nayax Lynx API.

## Authentication

Every request uses a bearer token in the `Authorization` header:

`Authorization: Bearer <user-token>`

Get the token from the Nayax dashboard: click the menu with your name, go to **Account Settings** → **Security and Login**, scroll down to **User Tokens**, click **Show Token**, and copy it. This single value is what older docs called "Token", "API Token", or "Bearer Token"; they are the same credential. Lynx user tokens do not expire, so treat one as a long-lived secret: keep it in an environment variable rather than in source or a prompt, give an AI agent only the token it needs, and revoke it in Nayax Core if it may have been exposed. See [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) for full guidance on using tokens with AI agents. A 401 *with a response body* means the token is valid but lacks permission for that endpoint; it does not mean the token expired.

## Base URL

Sandbox base: `https://qa-lynx.nayax.com/operational`. Every path in this skill is relative to that base — for example, `/v1/productGroups` resolves to `https://qa-lynx.nayax.com/operational/v1/productGroups`.

## Prerequisites: ActorID and MachineID

Steps 2 through 4 need an `ActorID` (your operator ID) and a `MachineID`. Neither is guessable:

- **ActorID** is the operator tied to your token. List the operators you can access with `GET /v1/actors/hierarchy`.
- **MachineID** is the numeric machine identifier. List machines with `GET /v1/machines`, or filter to one operator with `GET /v1/machines?OperatorID={ActorID}`, then read `MachineID` from each record. Do not use the machine serial — these paths take the numeric ID only.

## The 4-step workflow

These steps must be completed in order. Skipping or reversing a step causes 400 errors or missing data downstream.

| Step | Action | Endpoint | Reference |
| ---- | ------ | -------- | --------- |
| 1 | Create product groups | `POST /v1/productGroups` | <references/product-groups.md> |
| 2 | Create operator products | `POST /v1/operators/{ActorID}/products` | <references/products.md> |
| 3 | Map products to machines | `POST /v1/machines/{MachineID}/machineProducts` | <references/machine-products.md> |
| 4 | Generate pick lists for restocking | `POST /v1/machines/{MachineID}/pickLists` | <references/pick-lists.md> |

Read the relevant reference file before writing code or answering questions about any of these steps.

## Critical rules

- **Always create product groups before products.** Products require a valid `ProductGroupID`. There is no way to create a product without one.
- **Tax endpoints on product groups require elevated permissions.** `GET/POST/PUT/DELETE /v1/productGroups/{id}/tax` are not accessible with a standard operator token. Do not attempt these without confirmed elevated permissions.
- **Use `ProductGroupID`, not `ProductGroupCode`, for lookups.** `ProductGroupCode` is not a reliable lookup key; reference groups by `ProductGroupID` instead.
- **Create Pick List returns an empty response body on success.** `POST /v1/machines/{MachineID}/pickLists` returns `200 OK` with no body. An empty body is the success state, not an error. Confirm creation with `GET /v1/machines/{MachineID}/pickList`.
- **An empty pick list (`[]`) on a brand-new machine is normal.** `GET /v1/machines/{MachineID}/pickList` returns `[]` when the machine has no sales or stock history yet. This means "nothing to restock right now," not a failure or a missing pick list. To see line items, the machine needs sales activity, or populate the list with `PUT /v1/machines/{MachineID}/pickList`.
- **Always include at least one product when updating a pick list.** Include at least one product object in the `Products` array when calling `PUT /v1/machines/{MachineID}/pickList`; an empty array is not accepted.
- **Machine Products use `NayaxProductID`, not `ProductID`.** `NayaxProductID` is the system-assigned identifier returned in the create-product response. The operator-scoped `ProductID` is a different field and will not resolve when mapping to a machine.

## Key documentation

- [Inventory Workflow](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/inventory-management/inventory-workflow) — Canonical step order
- [Product Groups](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/inventory-management/create-product-group) — Group creation and management
- [Operator Products](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/inventory-management/create-products) — Product creation and field reference
- [Pick Lists](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/inventory-management/pick-lists) — Pick list generation and actions
- [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) — How to obtain and use bearer tokens
