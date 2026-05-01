# Google Calendar Integration — Setup Guide

## Purpose

When a provider accepts a booking, PetWash creates a Google Calendar event on
the provider's calendar and (optionally) emails an invite to the customer.
When a booking is cancelled, the matching event is removed.

This document explains how to wire that up in production. Until it is wired,
the booking flow continues to work — calendar sync is best-effort and never
blocks a booking.

## Architecture

- **Code path**: `server/services/CalendarIntegrationService.ts`
- **Called from**:
  - `server/routes/booking-requests.ts` — provider accept handler
  - `server/routes/bookings.ts` — cancel handler
  - `server/routes/booking-requests.ts` — cancel handler
  - `server/routes/marketplace-bookings.ts` — cancel handler
  - Other legacy paths (`sitter-suite.ts`, `walk-my-pet.ts`, `pettrek.ts`,
    `provider-availability.ts`)
- **Idempotency**: Each event is tagged with
  `extendedProperties.private.petwash_booking_id`, so re-creates are deduped
  and deletes target the right event.
- **Failure mode**: Any error inside the service is caught and logged at
  `warn` level. Callers receive `null` and continue.

## Environment variables

| Variable | When to set | Notes |
| --- | --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Production (Cloud Run) | Full service-account JSON, single-line, properly escaped. **Preferred.** |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Production fallback | Same shape as above; only read if `GOOGLE_SERVICE_ACCOUNT_JSON` is absent. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Last-resort fallback | Already required for FCM push notifications; calendar will reuse it if no calendar-specific key is set. |
| `GOOGLE_CALENDAR_ID` | Optional | Defaults to `'primary'`. Use a shared calendar email address (e.g. `bookings@petwash.co.il`) if you want a single platform-wide calendar. |
| `APP_URL` | Always | Used in event description and customer-facing links. |

If **none** of the three JSON keys are set, `getCalendarClient()` returns
`null`, the service logs a warning (`[CalendarIntegration] No authentication
available — Calendar integration disabled`), and every method returns
`null`/`false` without throwing.

In Replit dev environments the service tries the
`REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY` channel first, so you can
test against your own Google account without provisioning a service account.

## Production setup checklist

1. **Create the service account**
   - Google Cloud Console → IAM & Admin → Service Accounts → *Create*.
   - Recommended name: `petwash-calendar-sync@<project>.iam.gserviceaccount.com`.
   - No project-level roles needed.

2. **Enable the Calendar API**
   - APIs & Services → Library → *Google Calendar API* → *Enable*.

3. **Generate a JSON key**
   - On the new service account: *Keys → Add Key → JSON*.
   - You get a file like `petwash-calendar-sync-1234.json`.

4. **Share the target calendar with the service account**
   - Open Google Calendar (web) as the calendar owner.
   - Settings of the target calendar → *Share with specific people or groups*.
   - Add the service-account email (the `client_email` field from the JSON).
   - Permission: *Make changes to events*.
   - Without this share step, every event-create call returns 403.

5. **Set the Cloud Run env var**
   - Cloud Run → service → *Edit & deploy new revision* → Variables & secrets.
   - Add `GOOGLE_SERVICE_ACCOUNT_JSON` and paste the entire JSON file
     contents as a single line. Use Cloud Run *Secrets* (not plain env vars)
     for the JSON to avoid leaking the private key into logs.
   - Add `GOOGLE_CALENDAR_ID` if you want non-default routing.
   - Add `APP_URL` if not already set.

6. **Deploy and verify**
   - Trigger a test booking accept; check the provider's calendar.
   - Check Cloud Run logs for `[Calendar] Event created`.

## Sanity checks

- `GET /api/calendar/status` (the existing `server/routes/calendar.ts` route)
  returns `{ "connected": true|false }` based on whether the service can
  authenticate. Use it as a health probe.
- Cancel a test booking; confirm the calendar event disappears and the log
  shows `[Calendar] Booking events deleted`.

## What we do **not** do

- **No two-way sync**: PetWash writes to Google Calendar. We do not read
  external calendar events back into PetWash availability. A future
  enhancement could subscribe via Google Calendar push channels.
- **No conflict detection** against the provider's other commitments. The
  provider is responsible for not double-booking themselves outside PetWash.
- **No customer calendar push** unless the customer's email is supplied
  to the service via `attendeeEmails`. When supplied, Google sends an
  invitation email; the customer can accept it to add the event to their
  own calendar.

## Failure / rollback

- Wrong / leaked JSON key: rotate via Cloud Console (delete old key,
  generate new) and update the Cloud Run secret. Old events stay; future
  events use the new key.
- Calendar misconfigured: leave the env vars unset. Booking flow continues
  to work; users just won't get calendar events.
- To temporarily disable: blank out `GOOGLE_SERVICE_ACCOUNT_JSON` and
  redeploy. The service silently no-ops.

## Open questions / future work

- Per-provider calendar (one calendar per provider) vs. one shared platform
  calendar — currently uses `'primary'`. Either approach works; the schema
  already stores `googleCalendarIntegrations` rows for per-user OAuth.
- Customer-facing add-to-calendar: implemented via `generateICalLink`,
  `generateOutlookLink`, and `generateAppleCalendarLink` in the same
  service. These emit URLs the client can open without any backend creds.
