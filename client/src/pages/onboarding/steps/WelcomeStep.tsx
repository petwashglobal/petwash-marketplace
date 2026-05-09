/**
 * Welcome step — first screen of the pet onboarding shell (PR-PET-4).
 * One sentence + Continue. No state read. Read-only intro.
 */
import type { TFn } from '../shellTypes';

export function WelcomeStep({ t }: { t: TFn }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6">
      <div
        aria-hidden="true"
        className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-8 text-3xl"
      >
        🐾
      </div>
      <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-4">
        {t('petOnboarding.start.addPet')}
      </h1>
      <p className="text-base text-slate-500 max-w-sm leading-relaxed">
        {t('petOnboarding.start.oneTimeNotice')}
      </p>
    </div>
  );
}
