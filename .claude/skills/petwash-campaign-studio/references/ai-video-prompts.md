# AI video prompt rules (Veo / Runway / Sora style)

One prompt block per shot. English only. Structure every prompt as:

  [subject + action], [environment], [light], [camera: framing / movement / lens /
  fps], [mood + grade keywords], [negative list].

House keyword kit:
- Mood/grade: "calm premium editorial mood", "neutral color grade, true whites,
  natural fur tones", "minimalist", "high-key white" (station) / "soft morning
  window light" (home).
- Camera: prefer static or one slow move ("slow tracking", "slow subtle push-in",
  "static medium close-up"); lenses 50mm/85mm, "shallow depth of field"; slow motion
  as "120fps slow-motion feel".
- Standard negative list (append to EVERY prompt): `No text, no logos, no cartoon
  style, no oversaturation, no lens flares.` Add `no identifiable faces` whenever a
  human appears.

Hard rules:
1. NEVER ask the AI model to render the PetWash™ logo, wordmark, brand type, or any
   on-screen text — supers, wordmark, and grade are added in post with the real
   assets. Every prompt gets a one-line `Post:` note saying what post adds.
2. The actual K9000 unit cannot be faithfully generated. Wide station shots = film
   on location or match in post; choose AI shots that work generically (steel tub
   close-ups, water macro, fur, shake-off).
3. Dogs: name breed + coat ("a cream golden retriever") for continuity across shots;
   reuse the exact same subject description in every prompt of a campaign.
4. Keep each prompt a single paragraph, ~40–70 words. No camera jargon the models
   don't parse (no "T-stop", no rig names).
5. Nothing in a prompt may imply a factual claim the compliance log hasn't cleared
   (no signage with prices, no "certified" set dressing).
