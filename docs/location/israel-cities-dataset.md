# Israel Cities Dataset (PR-LOCATION-CITIES-1)

Pet Wash–owned location data foundation. Phase 1: a normalized, baked-in
seed list of 1,272 Israeli cities/towns/villages that the booking,
search, and provider-coverage code paths can rely on without making any
runtime network call.

> **Status:** data foundation only. No UI yet. No backend route yet. No
> booking matching yet. No provider service-area matching yet. No
> postcode strategy yet.

---

## 1. Seed source

* **Gist URL** (one-time read; not a runtime dependency):
  `https://gist.github.com/GabMic/57cc6b03eefcb47e731003c109e3a67a`
* **File:** `israel_cities_07_2019.json`
* **Snapshot:** July 2019.
* **Rows:** 1,272.
* **Source provenance:** the Gist is a community-published JSON
  conversion of the Israeli Central Bureau of Statistics city table
  (`city_symbol`, `hebrew_name`, `english_name`).

The Gist was fetched **once** during PR-LOCATION-CITIES-1 development
via a one-shot git clone, normalized through `gen_israel_cities.py`,
and baked into `shared/data/israel-cities.ts`. After the PR landed,
**production no longer depends on the Gist URL or any GitHub host**.

If the Gist is taken down, deleted, or renamed, our app keeps working
because the data is already in the repo.

---

## 2. Why we own this

The Pet Wash booking surface needs:

* a **mobile city picker** that works in Hebrew and English with
  forgiving search,
* **provider service-area** records keyed to a stable city identifier,
* **coverage by city** dashboards (admin / Brain),
* a **future postcode** strategy that can be layered on top of stable
  city identifiers,
* a future **Google Sheet export** so the operations team can review,
  amend, and approve the dataset without touching code.

Owning the data — instead of fetching a Gist at runtime — lets us:

* version the dataset with the rest of the app,
* test it (`server/tests/israelCitiesDataset.regression.test.ts`),
* curate aliases / corrections through normal PRs,
* avoid a public-internet dependency in the booking critical path.

---

## 3. Schema

Defined in `shared/data/israel-cities.ts`:

```ts
interface IsraelCity {
  citySymbol: string;            // Official CBS symbol; primary key
  hebrewName: string;            // As stored in source (whitespace trimmed)
  englishName: string;           // As stored in source (whitespace trimmed; may be '')
  normalizedHebrew: string;      // Search-only: parens stripped, ws collapsed
  normalizedEnglish: string;     // Search-only: lower-case, punctuation stripped
  aliases: readonly string[];    // Empty in Phase 1; future: curated alternates
  district: string | null;       // null in Phase 1; future: layered from approved source
  region: string | null;         // null in Phase 1; future: layered from approved source
  postcodes: readonly string[];  // Empty in Phase 1; we do NOT invent
  isActive: boolean;             // true in Phase 1; review before booking matching
  priority: number;              // 100 for top ~20 popular cities, 0 otherwise
  source: 'gabmic-israel-cities-seed';
  notes: string | null;
}
```

`citySymbol` is the primary key. It is a string (not a number) so that
leading-zero / numeric-prefix codes survive lossless. Symbols are
unique across the dataset.

---

## 4. Helpers

```ts
getIsraelCities(): readonly IsraelCity[]
findIsraelCityBySymbol(symbol: string): IsraelCity | undefined
getPopularIsraelCities(): readonly IsraelCity[]
searchIsraelCities(query: string, locale: 'he' | 'en', limit?: number): readonly IsraelCity[]
normalizeHebrewCitySearch(value: string): string
normalizeEnglishCitySearch(value: string): string
```

`searchIsraelCities` is locale-aware substring search. It uses the
pre-baked normalized fields, which means:

* "tel aviv" finds Tel Aviv-Yafo (en),
* "ירוש" finds ירושלים (he),
* punctuation in the query (`be'er`, `bet-shemesh`) is ignored.

Results are sorted by `priority` (popular cities first) then by
`normalizedEnglish`. `limit` defaults to 25.

---

## 5. Known source quirks (carried over, documented, NOT silently fixed)

The 2019 source file is high-quality but has a few quirks that the
operations team must be aware of before we use the data for production
booking matching. Each quirk is preserved in the data **as-imported**
so that a future PR can remediate it transparently.

### 5.1 BiDi-flipped parentheses inside Hebrew names

Example: tribal/קיבוץ variants are stored as
`אבו ג'ווייעד )שבט(` rather than `אבו ג'ווייעד (שבט)`. This is a
visual-order vs logical-order artifact of the source XML→JSON
conversion. We preserve the source character order in `hebrewName`
(BiDi-aware UI renders them correctly), and we strip the parens out
when building `normalizedHebrew` for search.

### 5.2 Six rows have no English name

Six rows have an empty `english_name` in the source:

| symbol | hebrew |
| ------ | ------ |
| 0      | לא רשום (placeholder for "not registered") |
| 1329   | יתיר   |
| 1331   | כמאנה |
| 1347   | קצר א-סר |
| 3400   | חברון |
| 3777   | סנסנה |

We preserve them with `englishName === ''` and `normalizedEnglish === ''`
so callers can opt-in to a transliteration backfill in a future PR.

### 5.3 Some English names are truncated to 21 characters

The source field appears to be limited to ~21 chars, so longer names
are cut mid-word. Examples:

| symbol | source                  | actual                       |
| ------ | ----------------------- | ---------------------------- |
| 1200   | `MODI'IN-MAKKABBIM-RE`  | `MODI'IN-MAKKABBIM-RE'UT`    |
| 1245   | `PARDES HANNA-KARKUR`   | (already correct)            |
| 3823   | `GANNE MODIIN`          | (already correct)            |

These corrected long-form names belong in `aliases[]` in a future
maintenance PR — never silently overwritten on top of the source.

### 5.4 Alternate transliterations

Several major cities use older or alternate official transliterations:

| symbol | english used      | also commonly written |
| ------ | ----------------- | --------------------- |
| 9000   | `BE'ER SHEVA`     | BEER SHEVA, BEERSHEBA |
| 6400   | `HERZELIYYA`      | HERZLIYA              |
| 8700   | `RA'ANANA`        | RAANANA               |
| 2600   | `ELAT`            | EILAT                 |
| 7900   | `PETAH TIQWA`     | PETAH TIKVA           |

The `searchIsraelCities('en')` helper strips apostrophes from the query,
so `searchIsraelCities('beer sheva')`, `searchIsraelCities("be'er sheva")`
and `searchIsraelCities('be er sheva')` all match the BE'ER SHEVA row.
Alternate spellings (BEERSHEBA, HERZLIYA, …) need to land in `aliases`
before they search-match — that is a future curation PR.

---

## 6. What is intentionally absent

| Field        | Why empty                                                 |
| ------------ | --------------------------------------------------------- |
| `postcodes`  | Source has none. We do **not** invent postcodes — that is its own future PR with a CEO-approved data source. |
| `district`   | Source has none. Layering districts will be a separate PR with a CEO-approved district source (CBS publishes one). |
| `region`     | Same as district. |
| `aliases`    | We do **not** auto-generate alternate spellings. Curated additions go through normal PR review. |

Tests in `server/tests/israelCitiesDataset.regression.test.ts` enforce
that every row keeps `postcodes: []`, `district: null`, `region: null`,
and `aliases: []` until those features are explicitly designed.

---

## 7. Future work (separate PRs)

1. **Aliases** — curated alternate spellings (BEERSHEBA →9000, HERZLIYA
   →6400, etc.) so the search box works with any reasonable input.
2. **District / region** — layer the CBS district + sub-district map
   keyed by `citySymbol`.
3. **Postcodes** — once the CEO selects a postcode source we trust,
   layer postcodes onto each row.
4. **Google Sheet sync** — operations team review/approve workflow.
   Recommended export columns: `citySymbol, hebrewName, englishName,
   district, region, postcodes, aliases, isActive, priority, notes`.
5. **Booking search wiring** — front-end city picker that uses
   `searchIsraelCities` with the user's UI locale.
6. **Provider service-area** — provider record stores an array of
   `citySymbol`s the provider serves; matching is a join against
   `findIsraelCityBySymbol`.
7. **Coverage dashboard** — admin / Brain view that joins providers
   per city for ops planning.

Each item above is a separate PR. None of them ship in
PR-LOCATION-CITIES-1.

---

## 8. Data review required before booking matching

Before any booking, payment, or provider-payout flow uses
`isActive === true` as a "this city is shippable" signal, the
operations team must:

1. Walk the dataset and flip `isActive` to `false` for any row that
   should NOT be presented to customers (placeholders like row `0` /
   "לא רשום", encampments, dissolved settlements, etc.).
2. Curate aliases for the major cities (§5.4).
3. Backfill English names for the six empty rows (§5.2).
4. Approve a postcode source.

Until that review happens, the dataset is for **search and display**
only — never for "is this city shippable" decisions.

---

## 9. Re-running the normalizer

The one-time generator lives at `/tmp/gen_israel_cities.py` (kept
in this PR's commit description for traceability; not committed to
the repo). To regenerate from a fresh source snapshot:

1. `git clone https://gist.github.com/GabMic/57cc6b03eefcb47e731003c109e3a67a /tmp/gabmic-gist`
2. `python3 gen_israel_cities.py`
3. Run the regression suite:
   `npx vitest run server/tests/israelCitiesDataset.regression.test.ts`
4. Open a follow-up PR — never push regenerated data without a PR.
