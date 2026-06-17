---
title: Station Operations Manual
role: staff
version: 1.0-DRAFT
status: DRAFT — pending CLO/legal sign-off (not binding until approved)
signatureLevel: 1
gate: requireAdminPermission("station.ops")
language: EN (Hebrew controlling once translated)
---

# Station Operations Manual

Operational manual for staff operating and supporting PetWash self-service wash stations at **PET WASH LTD** (no. 517145033).

## 1. Hardware reality
The wash unit is a Nayax-MDB vending machine. It has **no native control/telemetry API**: remote start, telemetry, and payment all run through **Nayax**. There are no pump/water sensors exposed to us. Health checks are read-only. Do not promise remote pump control or water-level readings we cannot deliver.

## 2. Daily / shift checks
- Confirm the station is powered, online to Nayax, and accepting payment.
- Visual safety check: hoses, dryer, electrical enclosure, drainage, signage intact.
- Cleanliness and consumables (where Company-supplied).

## 3. Taking a station offline
If a safety risk or major fault is present, take the station **offline immediately** (mark unavailable so it stops accepting bookings/payments) and raise an incident.

## 4. Faults
- Payment/connectivity faults → check Nayax status first.
- Mechanical/electrical faults → do not attempt electrical repair; call the qualified technician/manufacturer.
- Log every fault with station ID, time, symptom, and action.

## 5. Safety
- Never bypass electrical safety devices.
- Wet + electrical environment: only qualified persons service internals.
- Keep the area safe for the public and animals.

## 6. Money & reconciliation
Station revenue flows through Nayax to the Company. Do not handle cash outside approved processes. Discrepancies → finance.

## 7. Location-partner boundary
At partner-hosted sites, respect the [site-access](../partner/site-access-declaration.md) and maintenance matrix. Partners see only their own station data — never share other locations' figures.

## 8. Escalation
Safety/injury → [Incident Handling Manual](./incident-handling-manual.md). Recurring hardware faults → manufacturer/Nayax + station-ops lead.
