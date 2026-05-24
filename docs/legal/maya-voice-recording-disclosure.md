# Maya Voice — recording disclosure (Israeli law)

Last reviewed: 2026-05-23 — **not yet reviewed by counsel.**

## Default position for MVP

**Path A — no recording.** ASR (automatic speech recognition) converts the caller's speech to text in real time. The text is persisted as `maya_messages` rows. **The audio itself is not stored.** `ff.maya.voice.recording.enabled` defaults to `false`.

This avoids the Israeli wiretap law (חוק האזנת סתר) requirement to disclose recording, because no recording is created.

## If Path B (recording) is ever turned on

Required first:
1. **Legal review** by Israeli telecom counsel — the disclosure language must be approved.
2. **Consent flow** built into the call:
   - Maya's first utterance includes the disclosure (both Hebrew and English available).
   - Caller's response is captured.
   - If caller declines, recording stays OFF for that call; transcript-only continues.
3. **Storage policy** for recordings: retention period, access controls, deletion process, encryption at rest.
4. **Customer-visible privacy page** updated.

## Suggested disclosure language (DRAFT — counsel must approve before use)

**Hebrew (after greeting):**
> "לתשומת לבך, השיחה הזו עשויה להיות מוקלטת לצורכי איכות שירות. האם זה בסדר?"

**English (after greeting):**
> "Just so you know, this call may be recorded for quality assurance. Is that okay?"

**If caller declines (Hebrew):**
> "אין בעיה, אני לא אקליט. נמשיך."

**If caller declines (English):**
> "No problem, I won't record. Let's continue."

## What the schema already supports

The `maya_conversations` table (Stage 3A migration `0030_maya_voice_channel.sql`) has these columns:

| Column | Purpose |
|---|---|
| `recording_consent` (boolean, nullable) | Tracks per-call consent — NULL = not asked, TRUE = consent given, FALSE = declined |
| `recording_url` (text, nullable) | Pointer to where the recording is stored — NULL when Path A is in effect |

## Rules if Path B ever ships

- Recording must be opt-IN, not opt-out.
- Disclosure must be Maya's first or second utterance, before any substantive intake.
- The consent answer must be persisted to `recording_consent` BEFORE the recording starts.
- A request to delete a recording from the caller (GDPR / Israeli equivalent) must be honored within the legal window.
- Recordings must be encrypted at rest with a separate key from the application data.
- Access logs on `recording_url` reads (who accessed which recording when).
- Retention default: 90 days, then purge.

## Out-of-scope for this document

- Marketing call / cold-outreach regulations — Maya only handles inbound for MVP. Outbound (`ff.maya.voice.outbound.enabled`) requires its own regulatory review.
- Recording of sensitive disclosures (medical, financial details) — Maya is scope-disciplined and shouldn't elicit these in the first place.
- Cross-border data transfer — depends on where the recording is hosted (Cloud Run region, storage region).
