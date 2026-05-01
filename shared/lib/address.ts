/**
 * Israel-aware address helpers.
 *
 * Single source of truth for:
 *   - canonical city slug (cityKey)        — match Hebrew & English spellings
 *   - Hebrew street prefix stripping        — drop "רחוב", "שדרות", "סמטת"
 *   - Israeli postal code shape check       — 5 or 7 digits or null
 *
 * The Hebrew↔English map is intentionally finite. Rather than try to cover
 * every single town, we cover the ~95% of bookings that happen in the top
 * Israeli localities. Anything not in the map falls back to a deterministic
 * slug of whatever was typed, so unknown towns still get a stable key.
 *
 * Usage:
 *   import { cityKey, stripHebrewStreetPrefix } from '@shared/lib/address';
 *   cityKey('רמת גן')   // 'ramat-gan'
 *   cityKey('Ramat Gan') // 'ramat-gan'
 *   cityKey('  רמת-גן  ') // 'ramat-gan'
 */

/**
 * Curated Israel locality map. Keys are lowercase ASCII slugs. Each entry
 * lists every common spelling we want to map to the same key.
 *
 * Add new localities as needed — keep slugs ASCII-only and use a single
 * dash for spaces, no diacritics.
 */
const IL_LOCALITY_ALIASES: Readonly<Record<string, ReadonlyArray<string>>> = {
  'tel-aviv': ['tel aviv', 'tel-aviv', 'tel aviv-yafo', 'tel-aviv-yafo', 'תל אביב', 'תל-אביב', 'תל אביב-יפו', 'תל-אביב-יפו', 'תא', 't"a'],
  'jerusalem': ['jerusalem', 'yerushalayim', 'ירושלים'],
  'haifa': ['haifa', 'hefa', 'חיפה'],
  'rishon-lezion': ['rishon lezion', 'rishon-lezion', 'rishon le zion', 'rishon letzion', 'ראשון לציון', 'ראשון-לציון'],
  'petach-tikva': ['petach tikva', 'petah tikva', 'petach-tikva', 'פתח תקווה', 'פתח-תקווה', 'פתח תקוה'],
  'ashdod': ['ashdod', 'אשדוד'],
  'netanya': ['netanya', 'נתניה'],
  'beer-sheva': ['beer sheva', 'beersheba', 'beer-sheva', 'באר שבע', 'באר-שבע'],
  'bnei-brak': ['bnei brak', 'bnei-brak', 'bene beraq', 'בני ברק', 'בני-ברק'],
  'holon': ['holon', 'חולון'],
  'ramat-gan': ['ramat gan', 'ramat-gan', 'רמת גן', 'רמת-גן'],
  'rehovot': ['rehovot', 'rechovot', 'רחובות'],
  'ashkelon': ['ashkelon', 'ashqelon', 'אשקלון'],
  'bat-yam': ['bat yam', 'bat-yam', 'בת ים', 'בת-ים'],
  'kfar-saba': ['kfar saba', 'kfar-saba', 'kefar sava', 'כפר סבא', 'כפר-סבא'],
  'herzliya': ['herzliya', 'hertsliya', 'הרצליה'],
  'modiin': ['modiin', 'modi in', 'modiin maccabim reut', 'מודיעין', 'מודיעין-מכבים-רעות'],
  'nazareth': ['nazareth', 'nazaret', 'נצרת'],
  'lod': ['lod', 'lydda', 'לוד'],
  'ramla': ['ramla', 'ramleh', 'רמלה'],
  'raanana': ['raanana', 'ra anana', "ra'anana", 'רעננה'],
  'givatayim': ['givatayim', 'גבעתיים'],
  'hadera': ['hadera', 'חדרה'],
  'rosh-haayin': ['rosh haayin', 'rosh ha ayin', 'rosh-haayin', "rosh ha'ayin", 'ראש העין', 'ראש-העין'],
  'kiryat-gat': ['kiryat gat', 'kiryat-gat', 'qiryat gat', 'קרית גת', 'קריית גת', 'קרית-גת'],
  'kiryat-ata': ['kiryat ata', 'qiryat ata', 'קרית אתא', 'קריית אתא'],
  'kiryat-bialik': ['kiryat bialik', 'qiryat bialik', 'קרית ביאליק', 'קריית ביאליק'],
  'kiryat-yam': ['kiryat yam', 'qiryat yam', 'קרית ים', 'קריית ים'],
  'kiryat-motzkin': ['kiryat motzkin', 'קרית מוצקין', 'קריית מוצקין'],
  'kiryat-ono': ['kiryat ono', 'kiryat-ono', 'qiryat ono', 'קרית אונו', 'קריית אונו'],
  'eilat': ['eilat', 'elat', 'אילת'],
  'tiberias': ['tiberias', 'tveriya', 'טבריה'],
  'safed': ['safed', 'tzfat', 'sfat', 'צפת'],
  'akko': ['akko', 'acre', 'עכו'],
  'nahariya': ['nahariya', 'naharia', 'נהריה'],
  'afula': ['afula', 'עפולה'],
  'givat-shmuel': ['givat shmuel', 'גבעת שמואל'],
  'or-yehuda': ['or yehuda', 'אור יהודה'],
  'yehud': ['yehud', 'yehud-monosson', 'יהוד', 'יהוד-מונוסון'],
  'ness-ziona': ['ness ziona', 'nes ziona', 'nes tziona', 'נס ציונה'],
  'beitar-ilit': ['beitar ilit', 'betar illit', 'ביתר עילית'],
  'modiin-ilit': ['modiin ilit', 'modi in illit', 'מודיעין עילית'],
  'el-ad': ['el ad', 'elad', "el'ad", 'אלעד'],
  'yavne': ['yavne', 'yavneh', 'יבנה'],
  'gedera': ['gedera', 'גדרה'],
  'qiryat-malakhi': ['kiryat malachi', 'qiryat malakhi', 'קרית מלאכי', 'קריית מלאכי'],
  'sderot': ['sderot', 'שדרות'],
  'arad': ['arad', 'ערד'],
  'dimona': ['dimona', 'דימונה'],
  'ofakim': ['ofakim', 'אופקים'],
  'netivot': ['netivot', 'נתיבות'],
  'karmiel': ['karmiel', 'carmiel', 'כרמיאל'],
  'maalot-tarshiha': ['maalot tarshiha', 'מעלות-תרשיחא', 'מעלות תרשיחא'],
  'umm-al-fahm': ['umm al fahm', 'umm-al-fahm', 'אום אל-פחם', 'אום אל פחם'],
  'tira': ['tira', 'taybe', 'טירה'],
  'tayibe': ['tayibe', 'taibe', 'טייבה'],
  'qalansawe': ['qalansawe', 'qalansua', 'קלנסווה'],
  'baqa-al-gharbiyye': ['baqa al gharbiyye', 'baka', 'בקה אל-גרביה', 'באקה אל-גרביה'],
};

/**
 * Reverse-lookup table: alias (lowercased, dashes/spaces collapsed) →
 * canonical key. Built once at module load.
 *
 * Aliases are pre-normalised the same way `cityKey` normalises its
 * input, so 'tel-aviv-yafo' and 'tel aviv yafo' both resolve.
 */
function normaliseForLookup(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-]+/g, ' ').trim();
}

const ALIAS_TO_KEY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, aliases] of Object.entries(IL_LOCALITY_ALIASES)) {
    m.set(normaliseForLookup(key), key);
    for (const alias of aliases) {
      m.set(normaliseForLookup(alias), key);
    }
  }
  return m;
})();

/**
 * Normalise any city spelling — Hebrew or English — to a canonical key.
 *
 * Rules:
 *   - Trim whitespace, lowercase, normalise dashes/spaces.
 *   - If the input matches a known alias (Hebrew or English), return its key.
 *   - Otherwise build a deterministic slug of the cleaned input so unknown
 *     localities still produce a stable key (`some-new-town`).
 *   - Return '' for empty/null inputs.
 */
export function cityKey(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, ' ')
    .trim();
  if (!cleaned) return '';
  // Try alias map first (Hebrew + English variants).
  const direct = ALIAS_TO_KEY.get(cleaned);
  if (direct) return direct;
  // Fallback: deterministic slug for unknown towns.
  return cleaned
    .replace(/[֑-ׇ]/g, '') // strip Hebrew nikud (vowel marks)
    .replace(/[^a-zא-ת0-9 ]/g, '') // keep letters (Hebrew + Latin) + digits
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Hebrew street prefixes that should be dropped before storing or comparing.
 *   רחוב = street
 *   שדרות = boulevard
 *   סמטת / סמטה = alley / lane
 *   דרך = road / way
 *   כיכר = square
 */
const HEBREW_STREET_PREFIXES = ['רחוב', 'שדרות', 'סמטת', 'סמטה', 'דרך', 'כיכר'];

/**
 * Strip Hebrew street prefix from a street name. Idempotent.
 *   stripHebrewStreetPrefix('רחוב רימלט')   → 'רימלט'
 *   stripHebrewStreetPrefix('שדרות רוטשילד') → 'רוטשילד'
 *   stripHebrewStreetPrefix('Rothschild')   → 'Rothschild'
 */
export function stripHebrewStreetPrefix(street: string | null | undefined): string {
  if (!street) return '';
  const trimmed = street.trim();
  for (const prefix of HEBREW_STREET_PREFIXES) {
    if (trimmed.startsWith(prefix + ' ')) {
      return trimmed.slice(prefix.length + 1).trim();
    }
  }
  return trimmed;
}

/**
 * Israeli postal codes are 5 or 7 digits. Returns the cleaned digits or
 * null if the input is missing / non-conforming. Intentionally permissive
 * in production: better to save null than to refuse a real address.
 */
export function normalizeIsraeliPostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 5 || digits.length === 7) return digits;
  return null;
}

/**
 * Two Hebrew localities are likely the same place if their cityKeys match.
 * Useful for booking-search fallback when one side stored Hebrew and the
 * other stored English.
 */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = cityKey(a);
  const kb = cityKey(b);
  return !!ka && ka === kb;
}

/**
 * All canonical city keys we currently know about. Useful for tests and
 * for admin filters. Order is not guaranteed.
 */
export function knownCityKeys(): ReadonlyArray<string> {
  return Object.keys(IL_LOCALITY_ALIASES);
}

/**
 * Return every known spelling for the given raw city — Hebrew and English —
 * so a SQL fallback can ilike against all of them in one OR clause.
 *
 * Returns an array containing AT LEAST the input itself (so unknown
 * localities still match their literal). For known localities it includes
 * the canonical key, every alias, plus the original input.
 *
 *   aliasesForCity('Ramat Gan')
 *     → ['Ramat Gan', 'ramat-gan', 'ramat gan', 'רמת גן', 'רמת-גן']
 */
export function aliasesForCity(raw: string | null | undefined): ReadonlyArray<string> {
  if (!raw) return [];
  const key = cityKey(raw);
  const set = new Set<string>([raw.trim()]);
  if (key) {
    set.add(key);
    const aliases = IL_LOCALITY_ALIASES[key];
    if (aliases) {
      for (const a of aliases) set.add(a);
    }
  }
  return Array.from(set).filter(s => s.length > 0);
}
