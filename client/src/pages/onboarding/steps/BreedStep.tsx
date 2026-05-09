/**
 * Breed step — basic select against the PR-PET-3 dataset (PR-PET-4).
 *
 * IMPORTANT: This is NOT the autocomplete UX. Autocomplete (search +
 * fuzzy + popular surface) is PR-PET-5. PR-PET-4 only renders a plain
 * native select grouped into "popular", "all breeds", "placeholder"
 * (mixed / unknown / other) sections — enough to drive the rest of the
 * shell without locking in autocomplete UX choices.
 */
import {
  getBreedsForSpecies,
  getLabel,
  type BreedEntry,
  type Lang,
} from '../../../../../shared/data/pet-breeds';
import { usePetOnboarding } from '../PetOnboardingContext';
import type { TFn } from '../shellTypes';

export function BreedStep({ t, lang }: { t: TFn; lang: Lang }) {
  const { draft, setField } = usePetOnboarding();
  if (!draft.species) {
    return (
      <div className="px-6 text-slate-500 text-sm">
        {t('petOnboarding.breed.unknown')}
      </div>
    );
  }
  const all = getBreedsForSpecies(draft.species);
  const placeholders = all.filter((b) => b.placeholder !== undefined);
  const popular = all.filter((b) => b.popular === true && !b.placeholder);
  const rest = all.filter((b) => !b.popular && !b.placeholder);

  return (
    <div className="px-6">
      <h1 className="text-2xl font-light tracking-tight text-slate-900 mb-2">
        {t('petOnboarding.breed.search')}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {t('petOnboarding.breed.cantFind')}
      </p>
      <select
        value={draft.breedId ?? ''}
        onChange={(e) => setField('breedId', e.target.value || null)}
        aria-label={t('petOnboarding.breed.search')}
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-0"
        style={{ fontSize: '16px' }}
      >
        <option value="">—</option>
        {popular.length > 0 && (
          <optgroup label={t('petOnboarding.breed.popular')}>
            {popular.map(renderOption(lang))}
          </optgroup>
        )}
        {rest.length > 0 && (
          <optgroup label={t('petOnboarding.basics.breed')}>
            {rest.map(renderOption(lang))}
          </optgroup>
        )}
        {placeholders.length > 0 && (
          <optgroup label="—">
            {placeholders.map(renderOption(lang))}
          </optgroup>
        )}
      </select>
    </div>
  );
}

function renderOption(lang: Lang) {
  return (b: BreedEntry) => (
    <option key={b.id} value={b.id}>
      {getLabel(b.label, lang)}
    </option>
  );
}
