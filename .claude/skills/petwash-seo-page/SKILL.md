---
name: petwash-seo-page
description: Create truthful, schema-rich, Hebrew-first SEO + AEO/GEO landing pages for PetWash stations and services. Use when adding or improving a station/city/service page, FAQ, or structured-data block so it ranks on Google, appears in local search, and can be cited by AI answer engines (ChatGPT/Claude/Perplexity). Reuses the existing SEO lib — never invents a parallel one.
---

# PetWash SEO / AEO Page Skill

Build pages that rank on Google, win local search, and get **cited by AI answer engines** — using only true, live data. PetWash is a **custom React/Vite + Node app — NOT WooCommerce/WordPress.** Any advice that says "install the plugin / WooCommerce checkout / PHP hooks" does not apply here.

## 0. Non-negotiables (these override any external SEO advice)
1. **Truthful data only.** Render prices, hours, addresses, coordinates, and status ONLY from live API data (`/api/public/stations/:code`). Missing field → don't show it. No invented hours, no placeholder prices, no fake reviews. This is the same declared-truth rule the rest of the repo enforces.
2. **Real stations only.** Generate a page per *real* station via `StationPage.tsx` (driven by `operationalStatus`: `active` / `coming_soon` / `maintenance`). **Do NOT hand-author city pages for cities with no station** (e.g. a `/pet-wash-tel-aviv` when there's no Tel Aviv station) — that's a bounce magnet and a ranking penalty, and it misleads. Add a city only when a station opens; `coming_soon` is fine to index early.
3. **Hebrew-first, RTL-correct, English second.** Israel search is Hebrew-first. Keep English brand/product names LTR (`Pet Wash™`, `K9000`) inside RTL text with the correct bidi isolation. Never ship Google-Translate Hebrew — it must read Israeli.
4. **Price is ₪55/wash, VAT-inclusive** (CEO-confirmed 2026-07-09). Any discount claim must match the REAL policy (K9000-only, capped ~10%; member 5%, Black 15%) — never advertise a discount that isn't real. When in doubt, invoke `petwash-marketing-legal`.

## 1. Use the existing SEO lib — never build a parallel one
`client/src/lib/seo.ts` already provides:
- `useSEO({ title, description, keywords, canonical, ogType })` — sets title/meta/OG/canonical.
- `injectStructuredData(obj)` — injects JSON-LD.

`StationPage.tsx` is the canonical reference: per-city Hebrew title, description from live fields, and a `LocalBusiness` JSON-LD built from live address/geo/hours/payment. Copy that pattern; don't reinvent it.

## 2. Meta pattern (bilingual, city-targeted)
- **Title:** `שטיפת כלבים בשירות עצמי ב{city} — {stationName} | Pet Wash™` (≤ 60 chars where possible).
- **Description:** one true sentence with city + address + the honest value ("קל, בטוח ונקי, מוצרים מתוצרת אוסטרליה"). No superlatives you can't back.
- **Canonical:** `https://petwash.co.il/stations/{code}` (lowercase).
- **Keywords:** `שטיפת כלבים {city}, שטיפת כלבים בשירות עצמי {city}, dog wash {city}, K9000`.

## 3. Structured data (this is what makes AI answer engines cite you)
Emit only schema you have true data for:
- `LocalBusiness` (@id, name, url, image, `PostalAddress`, `GeoCoordinates`, `openingHoursSpecification` only when hours exist, `paymentAccepted` from the real accepts* flags, `parentOrganization`).
- `Service` (self-service dog wash), `Product`/`Offer` (only with the real ₪55 price + `priceCurrency: ILS`), `FAQPage`, `BreadcrumbList`.
- `Review` / `AggregateRating` — **only from verified completed washes**, never fabricated. If none, omit.

## 4. AEO/GEO — direct-answer Q&A blocks
Add a visible FAQ (mirrored in `FAQPage` JSON-LD) that answers real questions in one factual sentence each, so an answer engine can lift them verbatim:
- "How much is a wash?" → "The standard self-service wash is ₪55 (VAT included)."
- "Is it open 24/7?" → answer from the station's real hours; if unknown, say where to check.
- "Where can I wash my dog in {city}?" → name the real station + address.
- "Is it suitable for large dogs?" / "How does the K9000 work?" / "What payment methods?" — factual, legal-safe.
Keep answers short, sourceable, and true. This is worth more than more social posts.

## 5. Every page ties to a tracked action
Wire the page's primary CTA to a real analytics event (`useAnalytics`) and to a real destination (navigate, WhatsApp, directions via `NavigationButton`). Never count "page opened" as a conversion — a sale is only a verified SUMIT/payment success.

## Definition of done
Live-data-only · Hebrew-first RTL correct · valid JSON-LD for what's true · honest price/discount · real station only · FAQ answers an AI could cite · CTA tracked. Run `petwash-marketing-legal` over the copy before publish.
