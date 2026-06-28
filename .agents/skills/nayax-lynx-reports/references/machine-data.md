# Machine Data

## When to use

Use these endpoints when building per-machine reporting or analytics. `status` returns the machine's current state and statistics, `lastSales` returns recent transactions, and `changeLogs` returns configuration history. For cross-machine or operator-level reporting, use the dashboard widget endpoints in `widgets.md` instead.

All paths are relative to the base `https://qa-lynx.nayax.com/operational`. The examples below use `<MachineID>` as a placeholder; retrieve a real one from `GET /v1/machines`.

## How to do it

**Get a machine's status and statistics**

`GET /v1/machines/{MachineID}/status`

Returns the machine's current status together with its statistics. There is no separate `/statistics` endpoint; this one carries both.

```
GET https://qa-lynx.nayax.com/operational/v1/machines/<MachineID>/status
```

Response: an object with status and aggregated metrics, including fields such as `ActorID`, `MachineID`, `CardSalesCounter`, `Machine24HEventCount`, and several nullable status fields (for example `MachineCashBoxLevel`, `TemperatureCelcius`).

---

**Get a machine's last sales**

`GET /v1/machines/{MachineID}/lastSales`

Returns recent transactions for the machine.

```
GET https://qa-lynx.nayax.com/operational/v1/machines/<MachineID>/lastSales
```

Optional query parameters:
- `startDate` — ISO date string `"YYYY-MM-DD"`
- `endDate` — ISO date string `"YYYY-MM-DD"`

Response: an array of transaction objects. Returns `[]` when there are no sales in the range.

---

**Get the machine change log**

`GET /v1/machines/changeLogs`

Note the path has no MachineID. Returns a history of configuration changes.

```
GET https://qa-lynx.nayax.com/operational/v1/machines/changeLogs
```

Response: an array of change log entries. Returns `[]` when there are none.

---

**Reference:**
- Base URL: `https://qa-lynx.nayax.com/operational`
- Get a `MachineID` from `GET /v1/machines`.

## Traps to avoid

- **Statistics live on `/status`, not `/statistics`.** There is no `/v1/machines/{MachineID}/statistics` endpoint. Read the machine's metrics from `GET /v1/machines/{MachineID}/status`.
- **The change log path has no MachineID.** Use `GET /v1/machines/changeLogs`, not `/v1/machines/{MachineID}/changeLogs`.
- **`lastSales` requires a real MachineID.** There is no default; an invalid or non-existent ID returns an error. Retrieve one from `GET /v1/machines`.
- **An empty array `[]` is not an error.** When a machine has no data in range, `lastSales` and `changeLogs` return `[]`; treat it as a valid empty state.
- **These per-machine endpoints are not operator-scoped.** For aggregated data across an operator's machines, use `POST /v1/dashboard/get-widget-data`.
- **All endpoints require authentication.** Include the bearer token; unauthenticated calls return 401.
