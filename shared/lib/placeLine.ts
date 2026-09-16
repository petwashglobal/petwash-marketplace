/**
 * "Kfar Saba Park, Kfar Saba" reads like a mistake — the area a member types
 * often already contains the city. Keep the area, drop the repeat.
 * Used by the Adopt a Pet and PawFinder™ boards and pet pages.
 */
export function placeLine(city?: string | null, area?: string | null): string {
  const c = String(city || '').trim();
  const a = String(area || '').trim();
  if (!a) return c;
  if (!c || a === c || a.includes(c)) return a;
  return `${a}, ${c}`;
}
