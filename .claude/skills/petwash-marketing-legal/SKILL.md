---
name: petwash-marketing-legal
description: Marketing/legal safety guardrail for any PetWash public copy — ads, landing pages, social posts, emails, meta descriptions, provider recruitment. Use before publishing any customer- or provider-facing marketing text to block false, unsafe, or non-compliant claims (fake reviews, guaranteed safety, medical/eco claims, fake discounts, employment language). Israel-focused.
---

# PetWash Marketing Legal-Safety Skill

Run this over any public marketing copy before it ships. PetWash operates in Israel with real money, real pets, real providers — an exaggerated or false claim is a legal and trust liability. When copy violates a rule below, rewrite it to the safe form and flag the change.

## BLOCK — never publish these
- **Guarantees of safety / outcome.** No "100% safe", "guaranteed safe", "your pet is always safe", "guaranteed availability", "guaranteed results". → Use *"PetWash uses reasonable verification, safety, monitoring and review processes."*
- **Medical / health claims.** No treating, curing, preventing skin/health conditions, no vet claims. Cosmetic wash only.
- **Unverified product claims.** No "chemical-free", "all-natural", "organic", "hypoallergenic" unless the product certification is on file. Safe: *"Australian-made, pet-formulated products."*
- **Fake or implied social proof.** No invented reviews, ratings, star counts, "trusted by thousands", "500+ stations", fake testimonials. Reviews come ONLY from verified completed washes/bookings. A new provider shows **"New provider"**, not a fabricated rating.
- **False or misleading discounts/prices.** The wash is **₪55 (VAT included)**. Discounts are K9000-only, capped ~10% (member 5%, Black 15%) — never advertise a blanket "15% municipal discount" or any rate that isn't the real policy. No "was ₪X now ₪Y" unless ₪X was a real prior price.
- **Provider = employee language.** Providers are **independent providers, not employees** (misclassification risk under Israeli labor law). Never write "PetWash employee", "staff shift", "salary", "manager controls hours", "must accept bookings". → Use *"independent provider", "booking request", "availability", "provider acceptance", "platform rules"*.
- **Guaranteed background checks.** Don't claim every provider is background-checked/insured unless universally true and enforced. → *"reasonable verification, safety and review processes."*
- **PII in public copy.** No customer full address, ID, phone, disability, or exact provider home address in any public/marketing surface.

## REQUIRE
- **Hebrew-first + correct RTL**, English brand names LTR. Israeli Hebrew, not machine translation (pair with `petwash-hebrew-copy` if it exists).
- **Every claim traceable to truth** — a live price, a real station status, a certified product, a verified review. No "declared-truth" violations (same standard as the rest of the repo).
- **Municipal / council claims** must reflect actual agreements, not aspiration.
- **Ad → landing page match**: paid traffic goes to the specific relevant page (station/service), never a generic homepage; and only with a real conversion event wired (a sale = verified SUMIT/payment success, not "page opened").

## Output when reviewing copy
Return: (1) any BLOCK hits with the exact offending phrase, (2) the safe rewrite, (3) a one-line reason. If clean, say so plainly. Never soften a block into a suggestion — a false claim doesn't ship.
