/**
 * Pet onboarding — circular photo cropper (PR-PET-6, Lane B).
 *
 * In-browser only. Reads a data URL into an HTMLImageElement, lets
 * the user pan + zoom inside a circular preview, and outputs a
 * cropped 512×512 PNG data URL via canvas.toDataURL().
 *
 * Scope guardrails (CEO directive 2026-05-10, PR-PET-6 Lane B):
 *   • photo onboarding + cropper UI only
 *   • feature-flagged via parent shell; no new flag
 *   • no backend upload
 *   • no storage wiring
 *   • no payments / wallet / payout / refund / invoice
 *   • single-revert
 *
 * UX (per master plan §1.2 row 24 + §4):
 *   • Square viewport, image fills it. CSS circular mask shows
 *     only the inscribed circle as the crop region.
 *   • Pan via touch/mouse drag.
 *   • Zoom via range slider (1.0 → 3.0). Range slider is the
 *     accessible pattern; pinch-zoom is deferred to PR-PET-7
 *     (Lane C) accessibility/mobile pass.
 *   • Confirm crop button: composites the visible region inside
 *     the circle onto a 512×512 canvas, outputs PNG data URL.
 *   • Restart button: returns control to PhotoUploader to pick a
 *     different file.
 *
 * No new dependency. Native HTMLImageElement + Canvas + pointer
 * events.
 */
import { useEffect, useRef, useState } from 'react';
import type { TFn } from '../shellTypes';

const VIEWPORT_PX = 320;
const OUTPUT_PX = 512;
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.05;

interface PhotoCropperProps {
  t: TFn;
  rawDataUrl: string;
  onConfirm: (croppedDataUrl: string) => void;
  onRestart: () => void;
}

export function PhotoCropper({ t, rawDataUrl, onConfirm, onRestart }: PhotoCropperProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  }>({ active: false, startClientX: 0, startClientY: 0, startOffsetX: 0, startOffsetY: 0 });

  // Load image natural size for fitting math.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      imgRef.current = img;
      // Reset transform on new image.
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = rawDataUrl;
  }, [rawDataUrl]);

  /** Compute the on-screen image dimensions at current zoom: image
   *  is sized to `cover` the viewport at zoom=1, and scales up from
   *  there. */
  const dims = naturalSize
    ? (() => {
        const { w, h } = naturalSize;
        const scale = Math.max(VIEWPORT_PX / w, VIEWPORT_PX / h) * zoom;
        return { w: w * scale, h: h * scale, scale };
      })()
    : null;

  /** Clamp pan offset so the image always covers the viewport. */
  const clamp = (next: { x: number; y: number }) => {
    if (!dims) return next;
    const maxX = (dims.w - VIEWPORT_PX) / 2;
    const maxY = (dims.h - VIEWPORT_PX) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  // Re-clamp on zoom change.
  useEffect(() => {
    setOffset((prev) => clamp(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, naturalSize]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStateRef.current = {
      active: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    const dx = e.clientX - dragStateRef.current.startClientX;
    const dy = e.clientY - dragStateRef.current.startClientY;
    setOffset(
      clamp({
        x: dragStateRef.current.startOffsetX + dx,
        y: dragStateRef.current.startOffsetY + dy,
      }),
    );
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragStateRef.current.active = false;
  };

  /** Keyboard accessibility (PR-PET-7):
   *   Arrow keys pan the image by 16 px / step.
   *   '+' / '=' zoom in by ZOOM_STEP. '-' / '_' zoom out.
   *   '0' resets to fit (zoom=1, offset=0). */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const STEP = 16;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setOffset((prev) => clamp({ x: prev.x - STEP, y: prev.y }));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setOffset((prev) => clamp({ x: prev.x + STEP, y: prev.y }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOffset((prev) => clamp({ x: prev.x, y: prev.y - STEP }));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOffset((prev) => clamp({ x: prev.x, y: prev.y + STEP }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
    } else if (e.key === '0') {
      e.preventDefault();
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !naturalSize || !dims) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;

    // The image is centred in the viewport at (VIEWPORT_PX/2 + offset.x,
    // VIEWPORT_PX/2 + offset.y) and drawn at dims.w × dims.h. We need to
    // sample the same content onto the OUTPUT_PX × OUTPUT_PX canvas.
    const ratio = OUTPUT_PX / VIEWPORT_PX;
    const drawW = dims.w * ratio;
    const drawH = dims.h * ratio;
    const drawX = OUTPUT_PX / 2 - drawW / 2 + offset.x * ratio;
    const drawY = OUTPUT_PX / 2 - drawH / 2 + offset.y * ratio;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_PX / 2, OUTPUT_PX / 2, OUTPUT_PX / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    const out = canvas.toDataURL('image/png');
    onConfirm(out);
  };

  return (
    <div className="flex flex-col items-center px-6">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-full border border-slate-200 bg-slate-50 select-none touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        style={{ width: VIEWPORT_PX, height: VIEWPORT_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="application"
        aria-label={t('petOnboarding.photo.slideZoom')}
        aria-roledescription="image cropper"
        data-pr-pet-6-cropper-viewport="true"
      >
        {dims && (
          <img
            src={rawDataUrl}
            alt=""
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              width: dims.w,
              height: dims.h,
              left: VIEWPORT_PX / 2 - dims.w / 2 + offset.x,
              top: VIEWPORT_PX / 2 - dims.h / 2 + offset.y,
              maxWidth: 'none',
            }}
          />
        )}
      </div>

      <div className="w-full max-w-sm mt-8">
        <label
          htmlFor="pet-onboarding-zoom"
          className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2"
        >
          {t('petOnboarding.photo.slideZoom')}
        </label>
        <input
          id="pet-onboarding-zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
          data-pr-pet-6-zoom="true"
        />
      </div>

      <div className="flex gap-3 mt-8 w-full max-w-sm">
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 min-h-[48px] rounded-full bg-white border border-slate-200 text-base text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {t('petOnboarding.start.back')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!naturalSize}
          className="flex-1 min-h-[48px] rounded-full bg-slate-900 text-white text-base font-medium hover:bg-slate-800 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          data-pr-pet-6-confirm-crop="true"
        >
          {t('petOnboarding.photo.confirmCrop')}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
