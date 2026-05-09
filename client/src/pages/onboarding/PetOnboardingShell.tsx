/**
 * Pet onboarding luxury shell — PR-PET-4.
 *
 * Scope (CEO directive 2026-05-09, PR-PET-4 only):
 *   • Onboarding shell / scaffolding.
 *   • Controlled step flow (welcome → name → species → breed → review).
 *   • Consumes PR-PET-2 i18n keys via the local `petOnboardingI18n.ts`
 *     fetch-once loader (no global i18n change).
 *   • Consumes PR-PET-3 dataset (species + breeds) via direct ESM import.
 *   • Local React state only (`PetOnboardingContext`).
 *   • Feature-flagged: VITE_PET_ONBOARDING_SHELL_ENABLED='true' required
 *     at the App.tsx <Route> mount.
 *   • Immersive route — registered in client/src/lib/immersive-routes.ts
 *     so the bottom-nav, FloatingStack, PromoAdPopup, and AiChatWidget
 *     do NOT render under the flow on iPhone Safari.
 *
 * NOT in scope (deferred to later PR-PET-* in the roadmap):
 *   • Backend persistence — no /api/pets, no /api/pets/draft.
 *   • Schema migration of any kind.
 *   • Photo upload + cropper (PR-PET-6).
 *   • Breed autocomplete UX (PR-PET-5).
 *   • Provider / sitter / walker coupling.
 *   • PawFinder linkage.
 *   • Wallet / finance / payment / Nayax / UPay / SUMIT.
 *   • AI / Gemini logic.
 *
 * Architecture notes:
 *   • The route param is the step id. We trust it and fall back to
 *     'welcome' on anything unknown.
 *   • We DO NOT block step-skip — a user can deep-link to /onboarding/pet/review
 *     mid-test. The Review step renders whatever is in the in-memory
 *     draft (likely "—" placeholders). This is intentional for v1; a
 *     future PR can add a guard.
 *   • The Save CTA on Review is intentionally stubbed (toast + no-op).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '../../lib/languageStore';
import {
  PET_ONBOARDING_STEP_ORDER,
  type PetOnboardingStepId,
} from './types';
import {
  PetOnboardingProvider,
  isStepId,
  usePetOnboarding,
} from './PetOnboardingContext';
import {
  loadPetOnboardingBundle,
  lookupWithFallback,
} from './petOnboardingI18n';
import { type Lang, SUPPORTED_LANGS } from '../../../../shared/data/pet-breeds';

const WelcomeStep = lazy(() =>
  import('./steps/WelcomeStep').then((m) => ({ default: m.WelcomeStep })),
);
const NameStep = lazy(() =>
  import('./steps/NameStep').then((m) => ({ default: m.NameStep })),
);
const SpeciesStep = lazy(() =>
  import('./steps/SpeciesStep').then((m) => ({ default: m.SpeciesStep })),
);
const BreedStep = lazy(() =>
  import('./steps/BreedStep').then((m) => ({ default: m.BreedStep })),
);
const ReviewStep = lazy(() =>
  import('./steps/ReviewStep').then((m) => ({ default: m.ReviewStep })),
);

function parseStepFromPath(path: string): PetOnboardingStepId {
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return isStepId(last) ? last : 'welcome';
}

function toLang(language: string): Lang {
  return (SUPPORTED_LANGS as readonly string[]).includes(language)
    ? (language as Lang)
    : 'en';
}

export default function PetOnboardingShell() {
  return (
    <PetOnboardingProvider>
      <ShellInner />
    </PetOnboardingProvider>
  );
}

function ShellInner() {
  const { language, dir } = useLanguage();
  const [location, setLocation] = useLocation();
  const lang = toLang(language);
  const step = parseStepFromPath(location);
  const stepIndex = PET_ONBOARDING_STEP_ORDER.indexOf(step);
  const totalSteps = PET_ONBOARDING_STEP_ORDER.length;

  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [englishBundle, setEnglishBundle] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let alive = true;
    loadPetOnboardingBundle(lang)
      .then((b) => {
        if (alive) setBundle(b);
      })
      .catch(() => {
        if (alive) setBundle({});
      });
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    if (lang === 'en') return;
    let alive = true;
    loadPetOnboardingBundle('en')
      .then((b) => {
        if (alive) setEnglishBundle(b);
      })
      .catch(() => {
        if (alive) setEnglishBundle({});
      });
    return () => {
      alive = false;
    };
  }, [lang]);

  const t = useMemo(() => {
    return (key: string) => lookupWithFallback(bundle, englishBundle, key);
  }, [bundle, englishBundle]);

  const goToIndex = (idx: number) => {
    const safe = Math.max(0, Math.min(totalSteps - 1, idx));
    setLocation(`/onboarding/pet/${PET_ONBOARDING_STEP_ORDER[safe]}`);
  };

  return (
    <div
      data-testid="pet-onboarding-shell"
      dir={dir}
      className="fixed inset-0 bg-white text-slate-900 flex flex-col"
      style={{ minHeight: '100dvh' }}
    >
      <Header
        stepNumber={stepIndex + 1}
        totalSteps={totalSteps}
        onBack={() => goToIndex(stepIndex - 1)}
        canGoBack={stepIndex > 0}
        ariaLabel={t('petOnboarding.start.back')}
      />

      <main className="flex-1 overflow-y-auto pt-6 pb-32">
        <Suspense fallback={<div className="px-6 text-sm text-slate-400">…</div>}>
          {step === 'welcome' && <WelcomeStep t={t} />}
          {step === 'name' && <NameStep t={t} />}
          {step === 'species' && <SpeciesStep t={t} lang={lang} />}
          {step === 'breed' && <BreedStep t={t} lang={lang} />}
          {step === 'review' && <ReviewStep t={t} lang={lang} />}
        </Suspense>
      </main>

      <Footer t={t} step={step} stepIndex={stepIndex} totalSteps={totalSteps} onContinue={() => goToIndex(stepIndex + 1)} />
    </div>
  );
}

function Header({
  stepNumber,
  totalSteps,
  onBack,
  canGoBack,
  ariaLabel,
}: {
  stepNumber: number;
  totalSteps: number;
  onBack: () => void;
  canGoBack: boolean;
  ariaLabel: string;
}) {
  const pct = Math.round((stepNumber / totalSteps) * 100);
  return (
    <div
      className="sticky top-0 z-10 bg-white px-4 pt-3"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label={ariaLabel}
          className={[
            'w-10 h-10 rounded-full flex items-center justify-center transition-opacity',
            canGoBack ? 'opacity-100 hover:bg-slate-50' : 'opacity-0 pointer-events-none',
          ].join(' ')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs text-slate-400 tracking-wide">
          {stepNumber} / {totalSteps}
        </span>
        <div className="w-10 h-10" aria-hidden="true" />
      </div>
      <div className="h-[2px] bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemax={100}>
        <div className="h-full bg-slate-900 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Footer({
  t,
  step,
  stepIndex,
  totalSteps,
  onContinue,
}: {
  t: (k: string) => string;
  step: PetOnboardingStepId;
  stepIndex: number;
  totalSteps: number;
  onContinue: () => void;
}) {
  const isLast = stepIndex >= totalSteps - 1;
  const { draft } = usePetOnboarding();

  let canContinue = true;
  if (step === 'name') canContinue = draft.name.trim().length > 0;
  if (step === 'species') canContinue = draft.species !== null;
  if (step === 'breed') canContinue = draft.breedId !== null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-3"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      {isLast ? (
        <StubbedSaveButton t={t} />
      ) : (
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={[
            'w-full h-12 rounded-full text-base font-medium transition-colors',
            canContinue
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          ].join(' ')}
        >
          {t('petOnboarding.start.continue')}
        </button>
      )}
    </div>
  );
}

/** Save CTA on the Review step. Deliberately a no-op for PR-PET-4 —
 *  backend persistence is out of scope (CEO directive 2026-05-09).
 *  Future PR-PET-4B (draft persistence) will replace this. */
function StubbedSaveButton({ t }: { t: (k: string) => string }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setConfirmed(true)}
        className="w-full h-12 rounded-full bg-slate-900 text-white text-base font-medium hover:bg-slate-800 transition-colors"
        data-pr-pet-4-save-stub="true"
      >
        {t('petOnboarding.start.continue')}
      </button>
      {confirmed && (
        <p className="mt-3 text-xs text-slate-400 text-center">
          {/* PR-PET-4 stub: no backend write. Persistence lands in a later PR. */}
          {t('petOnboarding.start.saveAndReturn')}
        </p>
      )}
    </div>
  );
}
