/**
 * PetWashIcon — the ONLY way to render an icon in PetWash. Never an emoji.
 *
 * Per the PetWash Smart Luxury Icon System spec: asset-based icons keyed by stable
 * icon_key, with a luxury DEFAULT fallback (no emoji fallback). Accessible label.
 * Transparent-safe + object-contain so it stays sharp at 24/32/44/64px on any device.
 *
 *   <PetWashIcon name="animal_dog" size={44} label="Dog" />
 *   <PetWashIcon name="trust_insured" size={32} label="Insurance declaration" />
 *
 * For the luxury white-card look (spec §13), wrap it: <span class="petwash-icon-card">.
 */
import { useState } from 'react';
import { resolvePetWashIcon, DEFAULT_PETWASH_ICON, type PetWashIconName } from '@/lib/petwash-icons';

export interface PetWashIconProps {
  name: PetWashIconName | string;
  size?: number;
  label?: string;
  className?: string;
}

export function PetWashIcon({ name, size = 32, label, className }: PetWashIconProps) {
  const [src, setSrc] = useState(() => resolvePetWashIcon(name));
  const alt = label || String(name).replace(/^[a-z]+_/, '').replace(/_/g, ' ');
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      onError={() => { if (src !== DEFAULT_PETWASH_ICON) setSrc(DEFAULT_PETWASH_ICON); }}
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

export default PetWashIcon;
