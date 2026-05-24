# Maya Voice — production launch checklist (Stage 3E)

Last reviewed: 2026-05-23

This is the **gate** before flipping `ff.maya.voice.enabled` to `true` in production. Every box must be checked. Owner sign-off required.

---

## 1. Code stages merged to `main`

- [ ] PR Stage 1   (migration 0028) — merged
- [ ] PR Stage 1b  (Drizzle types + admin API + flags) — merged
- [ ] PR Stage 2   (admin UI + backend list endpoints) — merged
- [ ] PR Stage 3A  (voice webhook + transcript persistence + voice flags) — merged
- [ ] PR Stage 3B  (TwilioVoiceProvider + HMAC) — merged
- [ ] PR Stage 3C  (LLM + extraction) — merged
- [ ] PR Stage 3D  (admin UI for voice calls) — merged

## 2. Environment variables set in production (Cloud Run / equivalent)

| Variable | Required | Purpose |
|---|---|---|
| `TWILIO_AUTH_TOKEN` | yes | HMAC verification of inbound webhooks |
| `TWILIO_VOICE_PUBLIC_URL` | recommended | The full public URL Twilio reaches the webhook at; if unset, derived from headers |
| `MAYA_LLM_PROVIDER` | optional | `anthropic` (default), `openai`, or `stub` |
| `MAYA_LLM_MODEL` | optional | Override default model |
| `MAYA_LLM_MAX_TOKENS` | optional | Default 200 — phone turns are short |
| `ANTHROPIC_API_KEY` | yes if provider=anthropic | LLM auth |
| `OPENAI_API_KEY` | yes if provider=openai | LLM auth |
| `MAYA_KNOWLEDGE_PATH` | optional | Override path to `maya-knowledge.json` |

## 3. Feature flags — set in this order

1. **Database / SystemConfig** flips (do NOT add these to `.env` — they live in the SystemConfig store):
   - [ ] `ff.maya.enabled` = `true`
   - [ ] `ff.maya.voice.enabled` = `true`
2. **Smoke test the master switch** by hitting `/api/maya/voice/twilio/voice` without a valid signature — must return `403`. (Confirms the route is live AND auth is enforced.)
3. **Inbound traffic** (only after smoke test passes):
   - [ ] `ff.maya.voice.inbound.enabled` = `true`
4. **LLM responses** (only after a successful scripted-mode test call):
   - [ ] `ff.maya.voice.extraction.enabled` = `true`

Keep these OFF until explicitly approved:
- [ ] `ff.maya.voice.outbound.enabled` = `false` (no outbound calls in MVP)
- [ ] `ff.maya.voice.recording.enabled` = `false` (no recording — see legal disclosure doc)

## 4. Twilio console setup

For the production PetWash phone number, set:
- [ ] **Voice URL** → `https://<your-prod-host>/api/maya/voice/twilio/voice` (POST)
- [ ] **Voice fallback URL** → same URL OR a static "we're not available" recording
- [ ] **Status callback URL** → `https://<your-prod-host>/api/maya/voice/twilio/status` (POST)
- [ ] **Geographic permissions**: confirm inbound Israeli number works on your Twilio account
- [ ] **Recording**: set to **OFF** at the Twilio level too (defense in depth — even if our flag flips, Twilio won't record)

## 5. Pre-launch test call (staging)

- [ ] Dial the staging number from a real Israeli mobile.
- [ ] Hear the Hebrew greeting.
- [ ] Speak: "אני רוצה להזמין רחיצה" — Maya responds in Hebrew.
- [ ] Switch to English: "Where is your nearest location?" — Maya responds in English.
- [ ] Ask: "Are you AI?" — Maya answers honestly per the disclosure line.
- [ ] Hang up. Check `/admin/maya/voice/calls` — the call appears with full transcript.
- [ ] Check `/admin/maya/leads` (or `/booking-drafts`) — any extracted intake appears as DRAFT.
- [ ] Verify `maya_audit_log` got rows for every state change.

## 6. Safety verification (pre-launch)

- [ ] **No wallet writes**: spot-check `wallet_ledger_entries` over the test-call window — should be untouched.
- [ ] **No K9000 release**: confirm no `MachineCommandService.dispatch` calls in logs.
- [ ] **No payments**: confirm no Stripe / Nayax / charge calls.
- [ ] **Provider drafts** that came from the call have `intake_status='draft'` — never `approved`.
- [ ] **Booking drafts** that came from the call have `intake_status='draft'` — never `confirmed`.
- [ ] **Audit log** is append-only — try a manual `UPDATE maya_audit_log SET …` → must raise.

## 7. Rollback drill (run BEFORE going live)

Pick one and time it:
- [ ] Flip `ff.maya.voice.enabled` to `false` in SystemConfig. Within 60 seconds, dial in — must hear the "we're not available" Hebrew + English message.
- [ ] Flip `ff.maya.voice.extraction.enabled` to `false`. Within 60 seconds, place a call — Maya should fall back to the scripted ack (no LLM).
- [ ] At Twilio: temporarily change the Voice URL to an "out of office" recording — within ~30s, new calls hit the alternate.

All three rollback paths verified? Then you're production-ready.

## 8. Monitoring / alerting

- [ ] Add a Datadog (or equivalent) alert: error rate on `/api/maya/voice/twilio/*` > 5% for 5 min → page.
- [ ] Dashboard panel: calls/min, average call duration, % completed vs. failed, LLM token spend per call.
- [ ] Budget alert: LLM spend > $X/day → email.
- [ ] Twilio account balance alert at the Twilio side.

## 9. Israeli legal compliance

- [ ] Read `docs/legal/maya-voice-recording-disclosure.md`.
- [ ] Confirm **Path A — no recording** is what we're shipping.
- [ ] If Path B (recording) is ever planned: full legal review, consent flow design, separate PR.

## 10. Owner sign-off

- [ ] Owner has reviewed this checklist.
- [ ] Owner has approved going live.
- [ ] Date: ____________
- [ ] Signed: ____________

---

After going live, give it **24 hours of close monitoring** with someone on-call before declaring success.

If any user complaint mentions Maya making a commitment she shouldn't have (price quote outside config, booking confirmation, refund promise), **disable extraction immediately** (`ff.maya.voice.extraction.enabled = false`) and debug the LLM prompt before re-enabling.
