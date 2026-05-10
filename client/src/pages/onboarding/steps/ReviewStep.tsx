/**
 * Review step — read-only summary of the in-memory draft (PR-PET-4).
 *
 * The "Save" CTA is intentionally STUBBED. PR-PET-4 scope (CEO directive
 * 2026-05-09) explicitly excludes backend persistence. The button below
 * merely surfaces a copy line confirming that a future PR (PR-PET-4B
 * draft persistence) will wire it. No /api/pets call. No /api/pets/draft
 * call. No localStorage write.
 */
import { getBreedById, getLabel, type Lang } from '../../../../../shared/data/pet-breeds';
import { getSpecies } from '../../../../../shared/data/pet-species';
import { usePetOnboarding } from '../PetOnboardingContext';
import type { TFn } from '../shellTypes';

export function ReviewStep({ t, lang }: { t: TFn; lang: Lang }) {
  const { draft } = usePetOnboarding();
  const speciesEntry = draft.species ? getSpecies(draft.species) : null;
  const breedEntry = draft.breedId ? getBreedById(draft.breedId) : null;

  return (
    <div className="px-6">
      <h1 className="text-2xl font-light tracking-tight text-slate-900 mb-6">
        {t('petOnboarding.petId.name')}
      </h1>

      {draft.photoDataUrl && (
        <div className="mb-6 flex justify-center" data-pr-pet-6-review-thumb="true">
          <img
            src={draft.photoDataUrl}
            alt={draft.name ? `${draft.name}` : ''}
            className="w-24 h-24 rounded-full object-cover border border-slate-200"
          />
        </div>
      )}

      <dl className="space-y-4">
        <Row
          label={t('petOnboarding.basics.petName')}
          value={draft.name || '—'}
        />
        <Row
          label={t('petOnboarding.basics.breed')}
          value={
            speciesEntry
              ? getLabel(speciesEntry.label, lang)
              : '—'
          }
        />
        <Row
          label={t('petOnboarding.breed.search')}
          value={breedEntry ? getLabel(breedEntry.label, lang) : '—'}
        />
      </dl>

      <p className="mt-10 text-xs text-slate-400 leading-relaxed">
        {t('petOnboarding.consent.privateByDefault')}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 text-right max-w-[60%] truncate">
        {value}
      </dd>
    </div>
  );
}
