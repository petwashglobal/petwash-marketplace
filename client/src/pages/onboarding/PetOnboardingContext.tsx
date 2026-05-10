/**
 * In-memory state container for the pet onboarding shell (PR-PET-4).
 *
 * SCOPE GUARDRAILS (CEO directive 2026-05-09):
 *   • Local React state only.
 *   • No localStorage, no sessionStorage, no IndexedDB.
 *   • No fetch / no /api/* call.
 *   • Lives only as long as the component tree is mounted; navigating
 *     away discards it. Resume-later is deferred to PR-PET-4B (draft
 *     persistence) when a backend draft endpoint is approved.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  EMPTY_PET_DRAFT,
  type PetOnboardingDraft,
  type PetOnboardingStepId,
} from './types';

interface PetOnboardingContextValue {
  draft: PetOnboardingDraft;
  setField: <K extends keyof PetOnboardingDraft>(
    key: K,
    value: PetOnboardingDraft[K],
  ) => void;
  reset: () => void;
  /** True when the minimum-required v1 fields are answered. */
  isReadyForReview: boolean;
}

const PetOnboardingContext = createContext<PetOnboardingContextValue | null>(null);

export function PetOnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PetOnboardingDraft>(EMPTY_PET_DRAFT);

  const value = useMemo<PetOnboardingContextValue>(() => {
    return {
      draft,
      setField: (key, val) => {
        setDraft((prev) => ({ ...prev, [key]: val }));
      },
      reset: () => setDraft(EMPTY_PET_DRAFT),
      isReadyForReview:
        draft.name.trim().length > 0 &&
        draft.species !== null &&
        draft.breedId !== null,
    };
  }, [draft]);

  return (
    <PetOnboardingContext.Provider value={value}>
      {children}
    </PetOnboardingContext.Provider>
  );
}

export function usePetOnboarding(): PetOnboardingContextValue {
  const ctx = useContext(PetOnboardingContext);
  if (!ctx) {
    throw new Error('usePetOnboarding must be used within PetOnboardingProvider');
  }
  return ctx;
}

export function isStepId(value: string | undefined): value is PetOnboardingStepId {
  return (
    value === 'welcome' ||
    value === 'name' ||
    value === 'species' ||
    value === 'breed' ||
    value === 'photo' ||
    value === 'review'
  );
}
