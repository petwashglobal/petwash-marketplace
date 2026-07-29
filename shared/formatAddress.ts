// ONE canonical address renderer. Before this, ~8 places hand-concatenated an
// address string (`${street} ${num}, ${city}`) and each dropped different
// structured fields — so floor/entrance/apartment/postalCode/access-notes that
// the customer carefully entered never reached the receipt, email, or SMS. Route
// every human-facing address string through here so it renders the SAME way
// everywhere: receipts, booking confirmations, shop orders, courier labels.
// (2026-07-29)

export interface AddressParts {
  street?: string | null;
  streetNumber?: string | null;
  apartment?: string | null;
  floor?: string | null;
  entrance?: string | null;
  city?: string | null;
  postalCode?: string | null;
  /** Access notes: gate code, "ring bell", "dog in yard". Only shown when includeNotes. */
  notes?: string | null;
  /** Pre-formatted fallback (older rows that only stored a free-text address). */
  fallback?: string | null;
}

export interface FormatAddressOptions {
  lang?: 'he' | 'en';
  /** Join parts with newlines (courier label / email block) instead of commas. */
  multiline?: boolean;
  /** Include access notes — only for the provider/courier view, never a receipt. */
  includeNotes?: boolean;
  /** Append the country line. */
  includeCountry?: boolean;
}

const LABELS = {
  he: { apartment: 'דירה', floor: 'קומה', entrance: 'כניסה', postal: 'מיקוד', notes: 'הערות', country: 'ישראל' },
  en: { apartment: 'Apt', floor: 'Floor', entrance: 'Entrance', postal: 'ZIP', notes: 'Notes', country: 'Israel' },
} as const;

const clean = (v: unknown): string => (v == null ? '' : String(v).trim());

/**
 * Render a structured address into one consistent human-readable string.
 * Empty fields are skipped; order is street → access details → city/postcode →
 * (notes) → (country). Returns '' only when there is genuinely nothing to show.
 */
export function formatUserAddress(parts: AddressParts, opts: FormatAddressOptions = {}): string {
  const lang = opts.lang === 'en' ? 'en' : 'he';
  const L = LABELS[lang];

  const street = clean(parts.street);
  const num = clean(parts.streetNumber);
  const city = clean(parts.city);
  const postal = clean(parts.postalCode);

  // If we have no structured street/city, fall back to whatever free-text we were given.
  if (!street && !city) {
    const fb = clean(parts.fallback);
    return fb;
  }

  const segments: string[] = [];

  // 1. Street + number.
  const streetLine = [street, num].filter(Boolean).join(' ');
  if (streetLine) segments.push(streetLine);

  // 2. Access details — labeled so a courier/provider can actually reach the door.
  const access = [
    clean(parts.entrance) && `${L.entrance} ${clean(parts.entrance)}`,
    clean(parts.floor) && `${L.floor} ${clean(parts.floor)}`,
    clean(parts.apartment) && `${L.apartment} ${clean(parts.apartment)}`,
  ].filter(Boolean).join(', ');
  if (access) segments.push(access);

  // 3. City + postal code.
  const cityLine = [city, postal && `${L.postal} ${postal}`].filter(Boolean).join(', ');
  if (cityLine) segments.push(cityLine);

  // 4. Access notes — only when explicitly requested (never on a fiscal receipt).
  if (opts.includeNotes) {
    const notes = clean(parts.notes);
    if (notes) segments.push(`${L.notes}: ${notes}`);
  }

  // 5. Country.
  if (opts.includeCountry) segments.push(L.country);

  return segments.join(opts.multiline ? '\n' : ', ');
}

/**
 * Map the frozen booking snapshot columns (customerStreet, customerStreetNumber,
 * customerApartment, customerCity, customerPostalCode + optional floor/entrance/
 * notes) onto AddressParts. Accepts a loose row so both Drizzle rows and plain
 * objects work.
 */
export function bookingSnapshotToAddress(row: Record<string, any> | null | undefined): AddressParts {
  if (!row) return {};
  return {
    street: row.customerStreet ?? row.customer_street ?? row.street,
    streetNumber: row.customerStreetNumber ?? row.customer_street_number ?? row.streetNumber,
    apartment: row.customerApartment ?? row.customer_apartment ?? row.apartment,
    floor: row.customerFloor ?? row.customer_floor ?? row.floor,
    entrance: row.customerEntrance ?? row.customer_entrance ?? row.entrance,
    city: row.customerCity ?? row.customer_city ?? row.city,
    postalCode: row.customerPostalCode ?? row.customer_postal_code ?? row.postalCode,
    notes: row.customerAddressNotes ?? row.customer_address_notes ?? row.notes,
    fallback: row.address ?? row.location ?? null,
  };
}
