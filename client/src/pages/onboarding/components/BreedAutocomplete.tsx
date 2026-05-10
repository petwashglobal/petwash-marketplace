/**
 * Pet onboarding — luxury breed autocomplete (PR-PET-5).
 *
 * Replaces the basic native <select> in BreedStep with a
 * type-ahead search panel. Consumes the PR-PET-3 dataset (species
 * helpers + breed list + placeholders + popular flag) via direct
 * ESM import — no /api/* call, no backend.
 *
 * Master plan reference: §1.2 step 3 + §3 (breed autocomplete).
 *
 * Scope guardrails (CEO directive 2026-05-10, PR-PET-5 SAFE
 * HIGH-VELOCITY model, Lane A):
 *   • breed autocomplete UI only
 *   • feature flag OFF (parent shell controls)
 *   • no backend
 *   • no schema
 *   • no payment / wallet / payout / refund / invoice
 *   • no provider activation
 *   • no auth / admin changes
 *   • single-purpose, single-revert, source-pin tested
 *
 * UX behaviour (per PR #224 doctrine + master plan):
 *   • Search input shows at top; minimum 16px font (iOS auto-zoom
 *     prevention); inputmode=search; autocomplete=off.
 *   • Below the input, results panel renders 3 sections in order:
 *       1. PLACEHOLDERS — Mixed / Unknown / Other; ALWAYS shown
 *          regardless of search term (per spec invariant).
 *       2. POPULAR — top breeds for this species; shown when
 *          search is empty.
 *       3. MATCHES — full filtered list; shown when search has
 *          ≥1 character. Plain substring match on labels (any
 *          language) and on id.
 *   • Each result row: 44px min tap target. Selected state uses
 *     deep premium green background + soft metallic gold accent
 *     stripe (PR-PET-5 design language).
 *   • Selecting a row commits the breedId to parent context and
 *     collapses the results panel into a confirmed state showing
 *     just the selected breed name + a "change" affordance.
 *   • RTL-safe via parent dir attribute; no hardcoded "left" /
 *     "right".
 *
 * Out of scope (NOT implemented here; deferred to later PR-PET-*):
 *   • Fuzzy / typo-tolerant matching (substring only at v1).
 *   • Breed-image thumbnails (deferred to PR-PET-6 photo flow).
 *   • Recently-selected breeds memory (no persistence; local
 *     state only).
 *   • Autocomplete keyboard arrow-nav (will land in PR-PET-7
 *     accessibility lane).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getBreedsForSpecies,
  getBreedById,
  getPopularBreeds,
  getPlaceholderBreeds,
  getLabel,
  type BreedEntry,
  type Lang,
  type SpeciesId,
} from '../../../../../shared/data/pet-breeds';

interface BreedAutocompleteProps {
  speciesId: SpeciesId;
  lang: Lang;
  selectedBreedId: string | null;
  onSelect: (breedId: string) => void;
  /** i18n string lookup function (injected from shell). */
  t: (key: string) => string;
}

const LISTBOX_ID = 'pet-onboarding-breed-listbox';
const optionDomId = (breedId: string) => `breed-opt-${breedId}`;

export function BreedAutocomplete({
  speciesId,
  lang,
  selectedBreedId,
  onSelect,
  t,
}: BreedAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activeBreedId, setActiveBreedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const all = useMemo(() => getBreedsForSpecies(speciesId), [speciesId]);
  const placeholders = useMemo(
    () => getPlaceholderBreeds(speciesId),
    [speciesId],
  );
  const popular = useMemo(
    () => getPopularBreeds(speciesId).filter((b) => !b.placeholder),
    [speciesId],
  );

  const trimmedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (trimmedQuery.length === 0) return [];
    return all.filter((b) => {
      if (b.placeholder) return false;
      if (b.id.toLowerCase().includes(trimmedQuery)) return true;
      const labels = b.label;
      for (const code of Object.keys(labels) as Lang[]) {
        const label = labels[code];
        if (label && label.toLowerCase().includes(trimmedQuery)) return true;
      }
      return false;
    });
  }, [all, trimmedQuery]);

  /** Flat list of currently-rendered options in DOM order. Used for
   *  ArrowUp / ArrowDown / Home / End keyboard navigation
   *  (PR-PET-7). */
  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const b of placeholders) ids.push(b.id);
    if (trimmedQuery.length === 0) {
      for (const b of popular) ids.push(b.id);
    } else {
      for (const b of matches) ids.push(b.id);
    }
    return ids;
  }, [placeholders, popular, matches, trimmedQuery]);

  // If active id falls out of the visible set (e.g. query change
  // hides the active option), reset to first visible.
  useEffect(() => {
    if (activeBreedId && !visibleIds.includes(activeBreedId)) {
      setActiveBreedId(visibleIds[0] ?? null);
    }
  }, [visibleIds, activeBreedId]);

  const selectedBreed = selectedBreedId ? getBreedById(selectedBreedId) : null;

  const commit = (id: string) => {
    onSelect(id);
    setIsPanelOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (visibleIds.length === 0) return;
    const currentIdx = activeBreedId ? visibleIds.indexOf(activeBreedId) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % visibleIds.length;
      setActiveBreedId(visibleIds[nextIdx]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx =
        currentIdx <= 0 ? visibleIds.length - 1 : currentIdx - 1;
      setActiveBreedId(visibleIds[prevIdx]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveBreedId(visibleIds[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveBreedId(visibleIds[visibleIds.length - 1]);
    } else if (e.key === 'Enter') {
      if (activeBreedId) {
        e.preventDefault();
        commit(activeBreedId);
      }
    } else if (e.key === 'Escape') {
      if (query.length > 0) {
        e.preventDefault();
        setQuery('');
      }
    }
  };

  if (selectedBreed && !isPanelOpen) {
    return (
      <div className="px-0">
        <div
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
          data-pr-pet-5-selected="true"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="block h-2 w-2 rounded-full bg-emerald-700"
            />
            <span className="text-base font-medium text-slate-900">
              {getLabel(selectedBreed.label, lang)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsPanelOpen(true);
              setQuery('');
              setActiveBreedId(null);
              // Restore focus to the search input on the next tick
              // so it reads as the new active landmark.
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-sm text-slate-500 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            aria-label={t('petOnboarding.start.back')}
          >
            {t('petOnboarding.photo.edit')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('petOnboarding.breed.search')}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="search"
        role="combobox"
        aria-label={t('petOnboarding.breed.search')}
        aria-expanded="true"
        aria-autocomplete="list"
        aria-controls={LISTBOX_ID}
        aria-activedescendant={
          activeBreedId ? optionDomId(activeBreedId) : undefined
        }
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        style={{ fontSize: '16px' }}
      />

      <div
        id={LISTBOX_ID}
        role="listbox"
        aria-label={t('petOnboarding.basics.breed')}
        className="mt-4 max-h-[60vh] overflow-y-auto"
      >
        {/* Placeholders — always visible, regardless of search term. */}
        <ResultSection
          title={t('petOnboarding.breed.cantFind')}
          items={placeholders}
          lang={lang}
          selectedBreedId={selectedBreedId}
          activeBreedId={activeBreedId}
          onSelect={commit}
          isPlaceholderSection
        />

        {trimmedQuery.length === 0 && popular.length > 0 && (
          <ResultSection
            title={t('petOnboarding.breed.popular')}
            items={popular}
            lang={lang}
            selectedBreedId={selectedBreedId}
            activeBreedId={activeBreedId}
            onSelect={commit}
          />
        )}

        {trimmedQuery.length > 0 && (
          <ResultSection
            title={t('petOnboarding.basics.breed')}
            items={matches}
            lang={lang}
            selectedBreedId={selectedBreedId}
            activeBreedId={activeBreedId}
            onSelect={commit}
            emptyHint={t('petOnboarding.breed.cantFind')}
          />
        )}
      </div>
    </div>
  );
}

interface ResultSectionProps {
  title: string;
  items: BreedEntry[];
  lang: Lang;
  selectedBreedId: string | null;
  activeBreedId: string | null;
  onSelect: (breedId: string) => void;
  isPlaceholderSection?: boolean;
  emptyHint?: string;
}

function ResultSection({
  title,
  items,
  lang,
  selectedBreedId,
  activeBreedId,
  onSelect,
  isPlaceholderSection = false,
  emptyHint,
}: ResultSectionProps) {
  if (items.length === 0 && !emptyHint) return null;

  return (
    <div className="mb-6 last:mb-0">
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      {items.length === 0 && emptyHint ? (
        <p className="px-1 text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((b) => {
            const isSelected = selectedBreedId === b.id;
            const isActive = activeBreedId === b.id;
            return (
              <li key={b.id} role="presentation">
                <button
                  id={optionDomId(b.id)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onClick={() => onSelect(b.id)}
                  className={[
                    'group flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2 text-start text-base transition-colors',
                    isSelected
                      ? 'bg-emerald-700 text-white'
                      : isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-900 hover:bg-slate-50',
                  ].join(' ')}
                  data-pr-pet-5-option="true"
                  data-placeholder={isPlaceholderSection ? 'true' : undefined}
                  data-active={isActive ? 'true' : undefined}
                >
                  <span className="font-medium">{getLabel(b.label, lang)}</span>
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="block h-1.5 w-1.5 rounded-full bg-amber-200"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
