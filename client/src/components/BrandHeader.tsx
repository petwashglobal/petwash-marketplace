/**
 * BrandHeader Component
 * Official PetWash™ Logo Display - Brand Guidelines Compliant
 * MANDATORY: Logo must be top-center, transparent, no container/card/shadow
 */

export function BrandHeader() {
  return (
    <div className="pw-logo-wrap" aria-label="PetWash brand">
      <img
        src="/brand/petwash-logo-official.png"
        alt="PetWash™"
        className="pw-logo"
        decoding="async"
        loading="eager"
      />
    </div>
  );
}
