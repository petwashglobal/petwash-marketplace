/**
 * PetWashLogo — the ONE canonical logo (CEO rule 2026-07-06: "logo is IP, only one").
 *
 * Every screen must render the logo through THIS component so there is a single
 * source of truth. Do NOT reference logo image files directly anywhere else, and do
 * NOT generate variations — this points only at the official IP assets in
 * /public/brand. If the logo changes, it changes in one place.
 *
 *   <PetWashLogo />                         // default full-colour paw-drop mark
 *   <PetWashLogo variant="white" />         // for dark/green/gold backgrounds
 *   <PetWashLogo variant="black" />         // for light backgrounds
 *   <PetWashLogo size={40} />               // height in px (width auto)
 */
import { cn } from '@/lib/utils';

export type PetWashLogoVariant = 'default' | 'white' | 'black';

// The official IP assets — the ONLY files the app may use for the logo.
const SRC: Record<PetWashLogoVariant, string> = {
  default: '/brand/petwash-logo-official.png',
  white:   '/brand/petwash-logo-white-bg.png',
  black:   '/brand/petwash-logo-black-bg.png',
};

export interface PetWashLogoProps {
  variant?: PetWashLogoVariant;
  /** Rendered height in px (width scales automatically). Default 32. */
  size?: number;
  className?: string;
  /** Decorative by default; pass a label to announce it to screen readers. */
  alt?: string;
  priority?: boolean;
}

export function PetWashLogo({
  variant = 'default',
  size = 32,
  className,
  alt = '',
  priority = false,
}: PetWashLogoProps) {
  return (
    <img
      src={SRC[variant]}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      height={size}
      style={{ height: size, width: 'auto' }}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn('select-none object-contain', className)}
    />
  );
}

export default PetWashLogo;
