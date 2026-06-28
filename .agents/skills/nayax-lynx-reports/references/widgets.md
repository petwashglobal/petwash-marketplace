# Dashboard Widgets

## When to use

Use the dashboard widget endpoints when building operator-level dashboards that aggregate data across multiple machines or an entire operator account. These endpoints return pre-shaped data for specific visualization types rather than raw transaction records. There are two steps: discover which widgets are available for the account, then request data for a specific widget type.

## How to do it

**Step 1 — Discover available widgets**

`GET /v1/dashboard/widgets?screenTypeId=1`

Returns the widgets available for the authenticated account. `screenTypeId` is required and must be `1` or higher.

```
GET https://qa-lynx.nayax.com/operational/v1/dashboard/widgets?screenTypeId=1
```

Example response (trimmed):

```json
[
  {"WidgetTypeId":43,"WidgetName":"Dashboard Active Machines Boxes","WidgetConfig":{"filters":[]},"Categories":[1,7,4,2,3],"Groups":[2,4]},
  {"WidgetTypeId":53,"WidgetName":"Dashboard Sales Table","WidgetConfig":{"filters":[{"name":"with_cash","defaultValue":"1","hidden":true,"type":"bit"}]},"Categories":[1,7,4,2,3],"Groups":[2,4]},
  {"WidgetTypeId":203,"WidgetName":"Machines On Map","WidgetConfig":{"filters":[]},"Categories":[1,7,4,2,3],"Groups":[1,3]}
]
```

Save the `WidgetTypeId` values; you need one for Step 2.

**Step 2 — Fetch widget data**

`POST /v1/dashboard/get-widget-data`

```
POST https://qa-lynx.nayax.com/operational/v1/dashboard/get-widget-data
Content-Type: application/json
```

Request body:

```json
{
  "widgetTypeId": 53,
  "screenTypeId": 1,
  "actorId": "<ActorID>",
  "startDate": "2026-01-01",
  "endDate": "2026-05-21"
}
```

Filter fields:

- `widgetTypeId` — required; from the discovery call
- `screenTypeId` — required; minimum value `1`
- `actorId` — operator account ID (get one from `GET /v1/actors/hierarchy`)
- `machineId` — optional; restrict to a single machine
- `startDate` / `endDate` — optional; ISO date strings `"YYYY-MM-DD"`

The response is `{ "WidgetDetails": {...}, "Data": [...] }`. The `Data` shape varies by widget type, so inspect the response for the specific `widgetTypeId` before writing parsing logic.

**Simple GET variant**

A `GET /v1/dashboard/widget-data` variant also exists, but the POST endpoint is preferred for its filter support and broader documentation coverage.

**Reference:**
- Base URL: `https://qa-lynx.nayax.com/operational`
- Get an `actorId` from `GET /v1/actors/hierarchy`.

## Traps to avoid

- **`screenTypeId` must be 1 or higher.** Always use `screenTypeId: 1` or higher; `0` is not a valid value.
- **Wrong endpoint paths.** Discovery is `GET /v1/dashboard/widgets`, data is `POST /v1/dashboard/get-widget-data`. There is no `/v1/report/widgetsTypes` or `/v1/report/widgetsData`.
- **Hardcoding `widgetTypeId`.** Widget type IDs are account-specific. Always discover them first; a hardcoded ID may return nothing or error in another account.
- **Assuming a fixed response schema.** The `Data` shape varies by widget type. Inspect the actual response for your `widgetTypeId` before parsing.
- **Both endpoints require authentication.** Include the bearer token; unauthenticated calls return 401.
