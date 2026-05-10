/**
 * Species step — large-tap-target species cards (PR-PET-4).
 * Consumes the canonical PR-PET-3 species list. No free text.
 */
import { useRef } from 'react';
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
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  /** Roving-tabindex pattern (PR-PET-7 a11y): only the active card
   *  is tab-stop; ArrowDown / ArrowUp / ArrowLeft / ArrowRight move
   *  focus + selection within the radiogroup. */
  const focusIndex = (idx: number) => {
    const len = PET_SPECIES.length;
    const target = ((idx % len) + len) % len;
    buttonsRef.current[target]?.focus();
    setField('species', PET_SPECIES[target].id);
    if (draft.breedId) setField('breedId', null);
  };

  const onKey = (currentIdx: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex(currentIdx + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIndex(currentIdx - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusIndex(PET_SPECIES.length - 1);
    }
  };

  const selectedIdx = PET_SPECIES.findIndex((s) => s.id === draft.species);
  const tabStopIdx = selectedIdx >= 0 ? selectedIdx : 0;

  return (
    <div className="px-6">
      <h1 className="text-2xl font-light tracking-tight text-slate-900 mb-6">
        {t('petOnboarding.basics.breed')}
      </h1>
      <div
        role="radiogroup"
        aria-label={t('petOnboarding.basics.breed')}
        aria-required="true"
        className="grid grid-cols-2 gap-3"
      >
        {PET_SPECIES.map((s, idx) => {
          const labelKey = SPECIES_KEY[s.id] ?? 'petOnboarding.species.other';
          const label = t(labelKey);
          const fallback = s.label[lang] || s.label.en;
          const selected = draft.species === s.id;
          return (
            <button
              key={s.id}
              ref={(el) => {
                buttonsRef.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={idx === tabStopIdx ? 0 : -1}
              onClick={() => {
                setField('species', s.id);
                if (draft.breedId) setField('breedId', null);
              }}
              onKeyDown={onKey(idx)}
              className={[
                'min-h-[88px] rounded-2xl border text-start px-4 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700',
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
