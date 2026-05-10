/**
 * Pet onboarding — photo uploader (PR-PET-6, Lane B).
 *
 * Native file picker → reads selected image into a base64 data URL
 * via FileReader. **No network call. No upload. No storage write.**
 *
 * The data URL is a transient in-memory string. The parent step
 * passes it to PhotoCropper for circular crop, and only the cropped
 * data URL ever reaches the onboarding-context draft. The original
 * (uncropped) data URL is a local component-state value here and
 * is discarded as soon as the cropper produces output.
 *
 * Scope guardrails (CEO directive 2026-05-10, PR-PET-6 Lane B):
 *   • photo onboarding + cropper UI only
 *   • feature-flagged via parent shell; no new flag
 *   • no backend upload
 *   • no storage wiring (no /api/uploads, no fetch with file,
 *     no FormData send, no S3 / Firebase Storage / Cloudinary)
 *   • no payments / wallet / payout / refund / invoice
 *   • no provider activation
 *   • single-revert
 *
 * Accept: image/jpeg, image/png, image/webp.
 * Max size: 15 MB. Anything larger gets a soft error inline.
 */
import { useRef, useState } from 'react';
import type { TFn } from '../shellTypes';

const ACCEPT_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface PhotoUploaderProps {
  t: TFn;
  onPicked: (rawDataUrl: string) => void;
}

export function PhotoUploader({ t, onPicked }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_MIME.has(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image is larger than 15 MB. Choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError('Could not read the file.');
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        onPicked(result);
      } else {
        setError('Could not read the file.');
      }
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-picked after a crop
    // restart.
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center px-6 text-center">
      <div
        aria-hidden="true"
        className="w-32 h-32 rounded-full bg-slate-50 flex items-center justify-center mb-8"
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-400">
          <path d="M3 9a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-base text-slate-500 max-w-sm leading-relaxed mb-8">
        {t('petOnboarding.photo.privacyNote')}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_TYPES}
        onChange={handleChange}
        className="sr-only"
        aria-label={t('petOnboarding.photo.upload')}
        data-pr-pet-6-file-input="true"
      />
      <button
        type="button"
        onClick={handleClick}
        className="min-h-[48px] min-w-[200px] rounded-full bg-slate-900 text-white text-base font-medium hover:bg-slate-800 transition-colors px-6"
        data-pr-pet-6-pick-cta="true"
      >
        {t('petOnboarding.photo.upload')}
      </button>
      {error && (
        <p className="mt-4 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
