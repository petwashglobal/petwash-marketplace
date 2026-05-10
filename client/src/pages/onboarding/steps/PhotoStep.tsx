/**
 * Photo step — circular crop pet photo onboarding (PR-PET-6, Lane B).
 *
 * Three internal phases:
 *   1. EMPTY     — no photo yet. Renders <PhotoUploader>.
 *   2. CROPPING  — raw image picked. Renders <PhotoCropper>.
 *   3. CONFIRMED — cropped data URL committed to draft. Shows the
 *                  thumbnail + "change photo" affordance.
 *
 * Photo is OPTIONAL. The shell footer's Continue button does NOT
 * gate on the photo. Master plan §1.2 row 24 + the existing
 * PR-PET-2 i18n key `petOnboarding.start.skip` reflect the
 * skip-for-now expectation.
 *
 * Scope guardrails (CEO directive 2026-05-10, PR-PET-6):
 *   • photo onboarding + cropper UI only
 *   • feature-flagged via parent shell
 *   • no backend upload, no storage wiring
 *   • no payments / wallet / payout / refund / invoice
 *   • single-revert
 */
import { useState } from 'react';
import { usePetOnboarding } from '../PetOnboardingContext';
import { PhotoUploader } from '../components/PhotoUploader';
import { PhotoCropper } from '../components/PhotoCropper';
import type { TFn } from '../shellTypes';

export function PhotoStep({ t }: { t: TFn }) {
  const { draft, setField } = usePetOnboarding();
  const [rawDataUrl, setRawDataUrl] = useState<string | null>(null);

  const phase: 'empty' | 'cropping' | 'confirmed' = draft.photoDataUrl
    ? 'confirmed'
    : rawDataUrl
      ? 'cropping'
      : 'empty';

  return (
    <div>
      <div className="mb-6 px-6">
        <h1 className="text-2xl font-light tracking-tight text-slate-900">
          {t('petOnboarding.photo.upload')}
        </h1>
      </div>

      {phase === 'empty' && (
        <PhotoUploader t={t} onPicked={(url) => setRawDataUrl(url)} />
      )}

      {phase === 'cropping' && rawDataUrl && (
        <PhotoCropper
          t={t}
          rawDataUrl={rawDataUrl}
          onConfirm={(croppedUrl) => {
            setField('photoDataUrl', croppedUrl);
            setRawDataUrl(null);
          }}
          onRestart={() => setRawDataUrl(null)}
        />
      )}

      {phase === 'confirmed' && draft.photoDataUrl && (
        <div className="flex flex-col items-center px-6">
          <img
            src={draft.photoDataUrl}
            alt={draft.name ? `${draft.name}` : ''}
            className="w-40 h-40 rounded-full object-cover mb-6 border border-slate-200"
            data-pr-pet-6-confirmed-thumb="true"
          />
          <button
            type="button"
            onClick={() => {
              setField('photoDataUrl', null);
              setRawDataUrl(null);
            }}
            className="text-sm text-slate-500 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 min-h-[44px] px-3"
          >
            {t('petOnboarding.photo.edit')}
          </button>
        </div>
      )}
    </div>
  );
}
