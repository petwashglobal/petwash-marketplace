/**
 * PetIcon — renders a PetWash luxury icon by semantic name.
 *
 * Until the real cut-out asset exists (and VITE_PET_ICONS_ENABLED='true'), it
 * shows the registry's emoji fallback, so the UI is never broken. Once assets are
 * dropped into client/public/pet-icons/<name>.png and the flag is on, every
 * <PetIcon> across the app switches to your artwork in one go.
 *
 * Transparent + object-contain so it sits cleanly on ANY background (no white box)
 * and stays sharp at any size — provide ≥256px square transparent files for crisp
 * rendering on every device.
 *
 *   <PetIcon name="dog" size={28} />
 */
import { useState } from 'react';
import { PET_ICONS, PET_ICONS_ENABLED, type PetIconName } from '@/lib/petIconRegistry';

const EXT = 'png'; // change here if you export as webp/svg

export function PetIcon({
  name,
  size = 24,
  className,
  title,
}: {
  name: PetIconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  const entry = PET_ICONS[name];
  const [failed, setFailed] = useState(false);
  const label = title || entry?.label || String(name);

  // Emoji fallback (flag off, unknown name, or asset 404'd).
  if (!PET_ICONS_ENABLED || failed || !entry) {
    return (
      <span
        role="img"
        aria-label={label}
        className={className}
        style={{ fontSize: size, lineHeight: 1, display: 'inline-block', verticalAlign: 'middle' }}
      >
        {entry?.emoji ?? '•'}
      </span>
    );
  }

  return (
    <img
      src={`/pet-icons/${name}.${EXT}`}
      width={size}
      height={size}
      alt={label}
      title={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

export default PetIcon;
