/**
 * Matching the customer's SAVED addresses as they type — locally, with no
 * request and no paid lookup (2026-09-18). Lives in its own module so the
 * address field, and the tests, share exactly one implementation.
 */
/** A row of user_addresses, as the API returns it. */
export interface SavedAddressRow {
  id: number;
  label?: string | null;
  customLabel?: string | null;
  address: string;
  street?: string | null;
  streetNumber?: string | null;
  apartment?: string | null;
  floor?: string | null;
  entrance?: string | null;
  notes?: string | null;
  city?: string | null;
  postalCode?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  isDefault?: boolean | null;
}

/**
 * Match saved addresses against what the customer is typing — locally, with no
 * request. Empty input shows the saved list (default first) so the common case
 * is one tap.
 */
export function matchSavedAddresses(rows: SavedAddressRow[], query: string, limit = 4): SavedAddressRow[] {
  const ordered = [...rows].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault));
  const q = (query || '').trim().toLowerCase();
  if (!q) return ordered.slice(0, limit);
  const hit = (r: SavedAddressRow) =>
    [r.address, r.street, r.city, r.customLabel, r.label]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  return ordered.filter(hit).slice(0, limit);
}

