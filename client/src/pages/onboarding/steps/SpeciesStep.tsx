/**
 * Species step — large-tap-target species cards (PR-PET-4).
 * Consumes the canonical PR-PET-3 species list. No free text.
 */
import { PET_SPECIES } from '../../../../../shared/data/pet-species';
import { usePetOnboarding } from '../PetOnboardingContext';
import type { TFn } from '../shellTypes';
import type { Lang } from '../../../../../shared/data/pet-breeds';

const SPECIES_KEY: Record<string, string> = {
  dog: 'petOnboarding.species.dog',
  cat: 'petOnboarding.species.cat',
  bird: 'petOnboarding.species.bird',
  rabbit: 'petOnboarding.species.smallMammal',
  guinea_pig: 'petOnboarding.species.smallMammal',
  reptile: 'petOnboarding.species.reptile',
  snake: 'petOnboarding.species.reptile',
  small_mammal: 'petOnboarding.species.smallMammal',
  other: 'petOnboarding.species.other',
};

export function SpeciesStep({ t, lang }: { t: TFn; lang: Lang }) {
  const { draft, setField } = usePetOnboarding();
  return (
    <div className="px-6">
      <h1 className="text-2xl font-light tracking-tight text-slate-900 mb-6">
        {t('petOnboarding.basics.breed')}
      </h1>
      <div role="radiogroup" className="grid grid-cols-2 gap-3">
        {PET_SPECIES.map((s) => {
          const labelKey = SPECIES_KEY[s.id] ?? 'petOnboarding.species.other';
          const label = t(labelKey);
          const fallback = s.label[lang] || s.label.en;
          const selected = draft.species === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setField('species', s.id);
                if (draft.breedId) setField('breedId', null);
              }}
              className={[
                'min-h-[88px] rounded-2xl border text-left px-4 py-4 transition-colors',
                selected
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300',
              ].join(' ')}
            >
              <span className="block text-base font-medium">
                {label === labelKey ? fallback : label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
