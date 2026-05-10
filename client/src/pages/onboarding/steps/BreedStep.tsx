/**
 * Breed step — autocomplete against the PR-PET-3 dataset (PR-PET-5).
 *
 * PR-PET-4 shipped a basic native <select>; PR-PET-5 replaces it with
 * the luxury BreedAutocomplete component (search + popular surface +
 * always-available placeholders + RTL-safe + 44px tap targets +
 * 16px input font).
 *
 * Scope guardrails (PR-PET-5 SAFE HIGH-VELOCITY model, Lane A):
 *   • breed autocomplete UI only
 *   • feature flag OFF (parent shell controls)
 *   • no backend, no schema, no money path
 *   • single-purpose, single-revert, source-pin tested
 *
 * The species fallback + section header + helper-text composition
 * are PR-PET-4 invariants and are unchanged. This step only swaps
 * the inner widget.
 */
import { type Lang } from '../../../../../shared/data/pet-breeds';
import { usePetOnboarding } from '../PetOnboardingContext';
import { BreedAutocomplete } from '../components/BreedAutocomplete';
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

  return (
    <div className="px-6">
      <h1 className="text-2xl font-light tracking-tight text-slate-900 mb-2">
        {t('petOnboarding.breed.search')}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {t('petOnboarding.breed.cantFind')}
      </p>
      <BreedAutocomplete
        speciesId={draft.species}
        lang={lang}
        selectedBreedId={draft.breedId}
        onSelect={(id) => setField('breedId', id)}
        t={t}
      />
    </div>
  );
}
