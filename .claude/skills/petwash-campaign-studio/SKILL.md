---
name: petwash-campaign-studio
description: Create high-end video campaigns and premium promotional materials for PetWash™. Use whenever the user asks for a video, campaign, ad, promo, launch materials, commercial, reel, storyboard, script, marketing content, social content, or AI video prompts related to PetWash™, K9000 stations, or any PetWash™ service — even without the word "campaign." Also for station openings, city launches, feature launches, seasonal pushes. Produces a full luxury-grade campaign package by default — concept, film script, storyboard, AI video prompts, supporting copy — Hebrew-led with full English parity, and (in Claude Code) can pipe the package into HyperFrames/Remotion to render actual video.
---

# PetWash™ Campaign Studio

Create campaign materials at the level of a global luxury brand's in-house creative
studio. Benchmark: Apple product films, Aesop, Louis Vuitton — restraint, confidence,
craft. Never startup energy, never hype.

**PAIRS WITH (mandatory):** `petwash-marketing-legal` (claim guardrails — a false claim
doesn't ship) and `petwash-visual-design` (hard brand rules — real logo asset only,
never redraw). This skill defers to both on any conflict.

## Non-negotiable house rules

1. **Trademark:** Always **PetWash™** — no space, trailing ™. Never ™PetWash, never
   "Pet Wash". SOLE EXCEPTION: **"Pet Wash Academy"** is canonical WITH the space
   (CEO naming list 2026-06-26). Platform/product names stay ENGLISH in every
   language; English brand names remain LTR inside Hebrew RTL copy.
2. **No invented numbers.** No fake statistics, customer counts, ROI, testimonials,
   reviews, star ratings. A claim that needs a figure gets `[TO VERIFY — source
   needed]` and the package continues. Every public claim must trace to a verifiable
   source or be flagged. (This is the A5-audit standard — it is not optional.)
3. **Known-true facts you may use freely:** single wash ₪55 VAT-inclusive · member
   discount 5% flat on K9000 washes (never advertise tier-scaled discounts) · packs
   ₪150/3, ₪220/5, ₪400/10 · Isaac Wald Park (Kfar Saba) station open daily
   05:30–23:00 except holidays. Anything beyond these: verify or flag.
4. **No fake urgency, no hype vocabulary.** Banned: "revolutionary", "game-changing",
   "!!!", "🔥", "don't miss out", "limited time" (unless genuinely true and confirmed),
   "earn money fast", invented "verified/certified" claims.
5. **Privacy:** never expose private names, addresses, phones, IDs. Stations at
   city/venue level only unless approved address copy is provided.
6. **Kenzo** (the founder's golden retriever) may appear as brand character. Never as
   a source of veterinary, legal, or financial advice.
7. **Legal caution:** any wording touching Israeli consumer-protection law (gift
   cards, prices, guarantees, refunds, §17a all-in pricing) gets a marked
   **⚠️ LEGAL REVIEW** flag. Prices shown must always be the total inclusive price.

## Language protocol

- **Hebrew leads.** Native, elegant, modern Hebrew — never translated-English Hebrew,
  no slang, no cutesy pet-shop tone. (Bad: "אנחנו עובדים קשה כדי להביא לכם".)
- **English is the luxury layer.** Full parity, international premium register.
  English taglines may lead visually — luxury brands in Israel often carry English
  wordmarks with Hebrew support copy.
- Deliver both side by side per section, Hebrew first. Note RTL/LTR layout where
  relevant. Numbers/emails/URLs/phones stay LTR.

## Brand voice & visual DNA

- **Tone:** calm confidence, infrastructure trust, warmth without cuteness. PetWash™
  is premium urban pet-care infrastructure — not a gadget, not a gimmick. Lead with
  easy + safe; eco enters only as quiet supporting proof (never greenwash).
- **Visual world:** stage-white backgrounds, ink-black typography, and **luxury gold
  #D4AF37 as the single accent** (this is the locked brand palette; deep green is
  reserved for Pet Passport surfaces). No other accents, no neon, no purple, no
  cartoon mascots, no stock-photo energy, no fake futurism. Real textures: water,
  steam, fur, brushed steel, natural light.
- **Logo:** the real asset only — never redrawn, recolored, distorted, or composited
  over (petwash-visual-design hard rule).
- **Typography first** in statics; motion slow, physical, deliberate (water in slow
  motion, a shake-off, steam) — never zippy transitions or meme cuts.
- **Sound:** quiet ambience, real diegetic sound (water, breathing, the station door),
  minimal score. No EDM, no stock jingles.

## Default deliverable: Full Campaign Package

Unless the user narrows scope, produce ONE consolidated markdown document with these
sections in order (full template + quality bar: `references/package-template.md`):

1. **Campaign Concept** — big idea in one sentence, audience insight, emotional
   territory, channel plan (Reels/Stories, YouTube, in-station screens, outdoor).
2. **Hero Film Script** — 30–60s, scene-by-scene with timecodes, action, camera,
   sound, VO/supers HE+EN.
3. **Storyboard** — shot-list table: #, duration, frame, camera, light, audio.
4. **Cutdowns** — 15s and 6s derived from the hero film.
5. **AI Video Generation Prompts** — ready-to-paste per shot (Veo/Runway/Sora style),
   English, camera/lens/light/mood baked in. Follow `references/ai-video-prompts.md`.
6. **Supporting Copy** — HE+EN: 3 taglines, Instagram caption set, one landing block,
   in-station screen copy.
7. **Compliance & Verification Log** — every factual claim, its status
   (verified / TO VERIFY / removed), and ⚠️ LEGAL REVIEW flags.

Executive-grade = dense and precise. Never pad. One locked concept; at most one
two-line alternate at the end.

## Rendering the actual video (Claude Code only)

When the HyperFrames/Remotion skills are present, the package is not the end of the
line: on request ("make the video", "render it"), route the hero film or cutdowns
into `/hyperframes` (motion-graphics / general-video / product-launch-video as
appropriate) and render real MP4s — typography films, kinetic stats, logo stings and
end cards are fully renderable in-house; live-action/AI-footage shots remain prompts
for Veo/Runway or a production brief. In other environments say plainly that prompts
and briefs are the executable outputs.

## Workflow

1. **Capture the brief** from the user's message: what's promoted, audience, channels,
   real facts provided. If the brief is one urgent fragment (typical), infer sensibly,
   state assumptions in a 3-line recap at top, and PROCEED — don't interrogate first.
2. **Concept before craft.** Lock one idea.
3. **Write the package** per the template.
4. **Self-audit** with `references/qa-checklist.md`; fix violations, never ship noted.
5. **Deliver** as a single markdown artifact titled
   `PetWash™ — [Campaign Name] — Campaign Package`.

## Scope notes

- Single-component asks ("just the script", "just Veo prompts") → that component only,
  full quality, same rules.
- B2B (deployment partners, municipalities): same restraint; shift emotional territory
  from care/ritual to infrastructure reliability and civic quality. No SaaS-pitch
  energy, no ROI promises. Municipal claims must reflect actual agreements.
