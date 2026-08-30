/**
 * SavedSearchService — CEO PROGRAM 31 (Saved Search).
 *
 * Pure evaluator + pluggable store. A saved search is the shape the
 * customer used to find a provider (service, dates, area, pet mix,
 * requirements, filters). When a provider declines / becomes
 * unavailable, the client restores the search quickly by calling
 * this service.
 *
 * The evaluator NEVER runs the search itself — that's the marketplace
 * ranking service. It only stores + returns the shape.
 */

export type SearchService = 'DOG_WALK' | 'PET_SITTING' | 'DAYCARE' | 'TRAINING' | 'GROOMING' | 'HOME_VISIT' | 'TRANSPORT';

export interface PetMix {
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  count: number;
}

export interface SavedSearch {
  savedSearchId: string;
  ownerUid: string;
  service: SearchService;
  dates?: { startAt: string; endAt: string };   // ISO
  areaCode?: string;                             // stable slug e.g. 'TLV_CENTER'
  petMix: PetMix[];
  requirements?: string[];                       // stable slugs e.g. ['MEDICATION', 'CAT_FRIENDLY']
  filterFlags?: string[];                        // stable slugs
  updatedAt: string;                             // ISO
}

export interface SavedSearchStore {
  put(sc: SavedSearch): Promise<void> | void;
  list(ownerUid: string): Promise<SavedSearch[]> | SavedSearch[];
  delete(ownerUid: string, savedSearchId: string): Promise<void> | void;
}

export class InMemorySavedSearchStore implements SavedSearchStore {
  private rows: SavedSearch[] = [];
  put(sc: SavedSearch): void {
    // Upsert by (ownerUid, savedSearchId).
    const idx = this.rows.findIndex((r) => r.ownerUid === sc.ownerUid && r.savedSearchId === sc.savedSearchId);
    if (idx >= 0) this.rows[idx] = sc;
    else this.rows.push(sc);
  }
  list(ownerUid: string): SavedSearch[] { return this.rows.filter((r) => r.ownerUid === ownerUid); }
  delete(ownerUid: string, savedSearchId: string): void {
    this.rows = this.rows.filter((r) => !(r.ownerUid === ownerUid && r.savedSearchId === savedSearchId));
  }
  clear(): void { this.rows = []; }
}

/**
 * Compare two saved searches; a "match" is used by the client to
 * detect that the current search input already exists as a saved
 * search (so the star icon shows filled).
 */
export function isSameSearch(a: Omit<SavedSearch, 'savedSearchId' | 'updatedAt'>, b: Omit<SavedSearch, 'savedSearchId' | 'updatedAt'>): boolean {
  if (a.ownerUid !== b.ownerUid) return false;
  if (a.service !== b.service) return false;
  if (a.areaCode !== b.areaCode) return false;
  const dA = a.dates && `${a.dates.startAt}|${a.dates.endAt}`;
  const dB = b.dates && `${b.dates.startAt}|${b.dates.endAt}`;
  if (dA !== dB) return false;
  const petA = a.petMix.slice().sort((x, y) => x.species.localeCompare(y.species) || x.count - y.count);
  const petB = b.petMix.slice().sort((x, y) => x.species.localeCompare(y.species) || x.count - y.count);
  if (petA.length !== petB.length) return false;
  for (let i = 0; i < petA.length; i++) {
    if (petA[i].species !== petB[i].species || petA[i].count !== petB[i].count) return false;
  }
  const reqA = (a.requirements ?? []).slice().sort();
  const reqB = (b.requirements ?? []).slice().sort();
  if (reqA.join(',') !== reqB.join(',')) return false;
  const flagA = (a.filterFlags ?? []).slice().sort();
  const flagB = (b.filterFlags ?? []).slice().sort();
  return flagA.join(',') === flagB.join(',');
}
