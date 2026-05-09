/**
 * Pet onboarding shell — local draft type (PR-PET-4).
 *
 * IN-MEMORY ONLY. Per the PR-PET-4 scope (CEO directive 2026-05-09):
 *   • local component state only
 *   • no backend persistence expansion
 *   • no DB migration
 *   • no /api/pets/draft endpoint (deferred to a future PR)
 *
 * This type intentionally mirrors the *minimum* v1 shape — name, species,
 * breed — i.e. the fields a user can answer in the v1 step set
 * (welcome → name → species → breed → review). It does NOT cover the full
 * 27-step canonical model in
 * docs/product/pet-profile-luxury-onboarding-master-plan.md §1.2; later
 * PRs (PR-PET-4B persistence, PR-PET-7+ canonicalisation) will extend.
 *
 * NOT a schema, NOT exported to server code, NOT used by /api/pets.
 */
import type { SpeciesId } from '../../../../shared/data/pet-breeds';

export type PetOnboardingStepId =
  | 'welcome'
  | 'name'
  | 'species'
  | 'breed'
  | 'review';

export const PET_ONBOARDING_STEP_ORDER: readonly PetOnboardingStepId[] = [
  'welcome',
  'name',
  'species',
  'breed',
  'review',
] as const;

/** In-memory draft. Deliberately small — v1 minimum. */
export interface PetOnboardingDraft {
  name: string;
  species: SpeciesId | null;
  breedId: string | null;
}

export const EMPTY_PET_DRAFT: PetOnboardingDraft = {
  name: '',
  species: null,
  breedId: null,
};
