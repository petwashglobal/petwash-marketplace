# Open-PR Dependency Map

**Owner:** parent Claude session
**Refreshed:** 2026-08-22
**Rule:** No merges. CEO merges. Do not stack new PRs on unmerged PRs unless dependency is truly unavoidable.

## Legend

- 💰 = money / VAT / commission / payout / refund / provider-earnings / Prestige / eGift
- 🔐 = auth / signup / session / claims / password / OTP / passkey
- 🗄️ = schema / migration / new column
- 📱 = affects mobile bundle / native app
- 🌐 = changes public-facing API contract or response shape
- ⚙️ = CI / workflow YAML only
- 📄 = docs only
- ✅ = pure additive UI / no external behavior change

## Currently open PRs (after all merges 2026-08-21…08-22)

| # | Title | Base | Depends on | Supersedes | Conflicts with | Class | Safe to CEO review? |
|---|---|---|---|---|---|---|---|
| **2032** | feat(provider-onboarding): country-aware city picker (IL uses baked registry) | main | 2026, 2027, 2028 (all merged; supplies `CityPicker` component + `shared/data/israel-cities.ts`) | — | — | ✅ | Yes — additive UI, no wire change |
| **2031** | docs: CEO master execution queue + recent-merge reconciliation | main | — | prior archaeology docs #2011, #2021 (still current, this is a new file) | — | 📄 | Yes — docs only |

## Recently-merged reference (context for reviewing the open two)

These PRs supply the pieces #2032 depends on. Already on `main`.

| # | Title | Supplies |
|---|---|---|
| 2030 | street picker from baked israel-streets + PetTrek CityPicker | `GET /api/geocode/streets`, `getStreetsForCity()`, `AddressPicker.showCitySuggestion` + StreetCombo, `MyAccountStreetSuggestions` |
| 2028 | booker+provider CityPicker into AddressPicker + sitter profile | `AddressPicker.showCitySuggestion` prop, Sitter/Walker BookingFlow wireup, SitterEditProfile city picker |
| 2027 | shop CityPicker | Shop checkout city picker |
| 2026 | MyAccount CityPicker + postcode autofill | MyAccount profile city picker |

## Stacking rule while merge freeze is active

- New PRs branch **only from `main`** to keep each independently reviewable.
- Anywhere a genuine dependency exists (e.g. #2032 needs `CityPicker` which is already on main), it's already satisfied because those PRs merged before the freeze. No stacking on unmerged branches at all.
- Doc PRs (#2031) never block code PRs.

## No-merge freeze

Absolute merge freeze from 2026-08-22 onwards until CEO instructs otherwise with explicit `MERGE #XXXX`. Session role from here: author / test / commit / push / open PR / continue next independent task.

## Update rhythm

Parent session updates this file whenever a new PR is opened, closed, or merged. If a CEO-approved merge lands, note it in the "Recently-merged reference" table with what it supplies.
