/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  THE ADDRESS RULEBOOK — single source of truth for address capture.        ║
 * ║                                                                            ║
 * ║  The user types, it suggests (Google-style), a pin + structured fields     ║
 * ║  are captured, and the address is saved to the user's profile and reused   ║
 * ║  across every activity (booking, purchase, onboarding, …). The provider    ║
 * ║  is FREE OpenStreetMap/Nominatim — never paid Google Places (cost rule;    ║
 * ║  a Google bill once hit ~$1,000). The Referee fails the build if paid      ║
 * ║  Google autocomplete is ever wired back into the shared component.         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import type { RuleCheck } from '../auth/authRulebook';

export interface AddressRule {
  id: string;
  plain: string;
  status: 'enforced';
  checks: RuleCheck[];
}

export const ADDRESS_RULEBOOK = {
  domain: 'address/autocomplete-and-reuse',
  version: '1.0.0',
  updated: '2026-06-28',

  rules: [
    {
      id: 'autocomplete.free-osm-only',
      plain: 'The shared address autocomplete suggests as the user types via the FREE OSM endpoint (/api/geocode/suggest). It must NOT load paid Google Places/Maps JS (the ~$1,000-bill provider). Same Google-style UX, zero per-lookup cost.',
      status: 'enforced',
      checks: [
        { id: 'autocomplete.usesFreeEndpoint', says: 'The shared autocomplete fetches suggestions from the free OSM endpoint.',
          file: 'client/src/components/ui/google-places-autocomplete.tsx',
          mustContain: ['/api/geocode/suggest'],
          mustNotContain: ['google.maps.places', 'maps.googleapis.com/maps/api/place'] },
        { id: 'geocode.nominatim', says: 'The server suggest endpoint proxies free OSM Nominatim.',
          file: 'server/routes/geocode.ts', mustContain: ['nominatim.openstreetmap.org'] },
      ],
    },
    {
      id: 'address.saved-and-reused',
      plain: 'A chosen address is tied to the user — auto-saved to their profile (with lat/lng) and offered back from saved addresses, so it is reused across booking, purchase, onboarding and every activity instead of being retyped.',
      status: 'enforced',
      checks: [
        { id: 'address.autosave', says: 'The address picker auto-saves the chosen address to the user profile.',
          file: 'client/src/components/ui/address-picker.tsx', mustContain: ['/api/user/addresses', 'autoSave'] },
      ],
    },
  ] as AddressRule[],
};

export type AddressRulebook = typeof ADDRESS_RULEBOOK;
