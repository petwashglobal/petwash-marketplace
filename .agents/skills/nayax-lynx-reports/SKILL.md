---
name: nayax-lynx-reports
description: >-
  Use this skill when a developer is building transactional reports, dashboard widgets, or machine-level analytics using the Nayax Lynx API. Trigger keywords include: dashboard widgets, widget data, widget types, machine sales, last sales, machine statistics, machine status, machine change log, per-machine reporting, operator-level reporting, sales analytics, vending machine data, Lynx reports, screenTypeId, widgetTypeId, actorId. This skill covers the two reporting surfaces in Lynx — the operator-level dashboard widget endpoints and the per-machine data endpoints — including sandbox-specific constraints that are easy to miss.
---

Lynx has two reporting surfaces: operator-level dashboard widgets that aggregate across machines, and per-machine data endpoints scoped to a single machine. This skill covers both, plus the sandbox-specific constraints worth knowing.

**Audience:** developers building integrations on the Nayax Lynx API.

## Authentication

Every request uses a bearer token in the `Authorization` header:

`Authorization: Bearer <user-token>`

Get the token from the Nayax dashboard: your name menu, then **Account Settings**, then **Security and Login**, scroll to **User Tokens**, and click **Show Token**. Lynx user tokens do not expire, so treat one as a long-lived secret: keep it in an environment variable rather than in source or a prompt, give an AI agent only the token it needs, and revoke it in Nayax Core if it may have been exposed. See [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) for full guidance on using tokens with AI agents.

## Base URL

Sandbox base: `https://qa-lynx.nayax.com/operational`. Every path in this skill is relative to that base, so `/v1/dashboard/widgets` resolves to `https://qa-lynx.nayax.com/operational/v1/dashboard/widgets`. For production, replace the host with `lynx.nayax.com`.

## Workflow routing

| Trying to… | Endpoint | Reference |
| --- | --- | --- |
| Discover available dashboard widgets | `GET /v1/dashboard/widgets?screenTypeId=1` | <references/widgets.md> |
| Get widget data | `POST /v1/dashboard/get-widget-data` | <references/widgets.md> |
| Get a machine's status and statistics | `GET /v1/machines/{MachineID}/status` | <references/machine-data.md> |
| Get a machine's last sales | `GET /v1/machines/{MachineID}/lastSales` | <references/machine-data.md> |
| Get the machine change log | `GET /v1/machines/changeLogs` | <references/machine-data.md> |

## Critical rules

- **Discover widgets first.** Call `GET /v1/dashboard/widgets?screenTypeId=1` before requesting data. It returns the available widgets with their `WidgetTypeId` values (for example 43 "Dashboard Active Machines Boxes", 53 "Dashboard Sales Table", 203 "Machines On Map"). Use a `WidgetTypeId` from this response; do not hardcode or guess one, as the IDs are account-specific.
- **`screenTypeId` must be 1 or higher.** Pass `screenTypeId=1` or higher (`1` and `2` are valid); `0` is not a valid value.
- **Widget data comes from `POST /v1/dashboard/get-widget-data`.** Send a body with `screenTypeId` and a `widgetTypeId` from discovery. The response is `{ "WidgetDetails": {...}, "Data": [...] }`, and its `Data` shape varies by widget type, so inspect it before parsing. There is no `/v1/report/widgetsTypes` or `/v1/report/widgetsData` endpoint.
- **Machine statistics come from `GET /v1/machines/{MachineID}/status`.** This single endpoint returns the machine's current status and its statistics (fields such as `CardSalesCounter`, `Machine24HEventCount`, `ActorID`). There is no separate `/v1/machines/{MachineID}/statistics` path.
- **The change log path has no MachineID.** It is `GET /v1/machines/changeLogs`, not `/v1/machines/{MachineID}/changeLogs`. It returns `[]` when there are no changes.
- **`lastSales` is machine-scoped.** `GET /v1/machines/{MachineID}/lastSales` requires a real MachineID in the path and returns `[]` when there are no sales in range. For cross-machine aggregates, use the widget endpoints instead.
- **An empty array `[]` is a valid response,** not an error, on `changeLogs` and `lastSales`.

## Key documentation

- [Retrieve widget data](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/reports/retrieve-machine-widget-data) — Discovering widgets and fetching widget data
- [Widgets overview](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/reports/widgets-overview) — Widget types, categories, and filters
- [Retrieve machine information](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/machines/retrieve-machine-information) — Per-machine status, statistics, and sales
- [Security and Token](https://devzone.nayax.com/docs/manage-data-operations/lynx-api/security) — How to obtain and safely use bearer tokens

## Obtaining IDs

- List machines with `GET /v1/machines` to get a `MachineID`.
- List the operators you can access with `GET /v1/actors/hierarchy` to get an `ActorID`.
