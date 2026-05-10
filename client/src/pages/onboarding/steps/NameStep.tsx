/**
 * Name step — captures the pet's name into in-memory draft (PR-PET-4).
 * Single text input. No persistence. No validation beyond non-empty.
 */
import { usePetOnboarding } from '../PetOnboardingContext';
import type { TFn } from '../shellTypes';

export function NameStep({ t }: { t: TFn }) {
  const { draft, setField } = usePetOnboarding();
  return (
    <div className="flex flex-col px-6">
      <h1 className="text-2xl font-light tracking-tight text-slate-900 mb-2">
        {t('petOnboarding.basics.petName')}
      </h1>
      <input
        id="pet-onboarding-name-input"
        type="text"
        value={draft.name}
        onChange={(e) => setField('name', e.target.value)}
        autoFocus
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        maxLength={40}
        aria-label={t('petOnboarding.basics.petName')}
        aria-required="true"
        aria-invalid={draft.name.trim().length === 0}
        inputMode="text"
        className="mt-6 w-full min-h-[44px] bg-transparent border-0 border-b border-slate-200 focus:border-slate-900 focus:outline-none focus:ring-0 focus-visible:border-emerald-700 text-2xl font-light text-slate-900 pb-3 transition-colors"
        style={{ fontSize: '20px' }}
      />
    </div>
  );
}
