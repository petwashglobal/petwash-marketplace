/**
 * petwash-icons.ts — PetWash luxury icon registry (icon_key → asset path).
 *
 * Per the PetWash Smart Luxury Icon System spec: stable icon_keys (never emoji),
 * asset-based, with a luxury DEFAULT fallback (no emoji fallback ever). Assets live
 * under client/public/assets/icons/petwash/<category>/<icon_key>.png and are served
 * at /assets/icons/petwash/...
 *
 * Mode B (colour luxury) icons are extracted from the CEO's concept board via
 * scripts/extract-pet-icons.mjs. Keys listed in PETWASH_ICONS have a real asset;
 * any other planned key (below) safely resolves to DEFAULT_PETWASH_ICON until its
 * asset is added — so the UI is brand-consistent, never an emoji.
 */

export const DEFAULT_PETWASH_ICON = '/assets/icons/petwash/brand/default_petwash.png';

/** Icon keys that currently have a real asset (Mode B colour set, board 1). */
export const PETWASH_ICONS = {
  // animals
  animal_dog: '/assets/icons/petwash/animals/animal_dog.png',
  animal_cat: '/assets/icons/petwash/animals/animal_cat.png',
  animal_rabbit: '/assets/icons/petwash/animals/animal_rabbit.png',
  animal_guinea_pig: '/assets/icons/petwash/animals/animal_guinea_pig.png',
  animal_snake: '/assets/icons/petwash/animals/animal_snake.png',
  animal_pony: '/assets/icons/petwash/animals/animal_pony.png',
  animal_horse: '/assets/icons/petwash/animals/animal_horse.png',
  animal_bird: '/assets/icons/petwash/animals/animal_bird.png',
  animal_fish: '/assets/icons/petwash/animals/animal_fish.png',
  animal_turtle: '/assets/icons/petwash/animals/animal_turtle.png',
  // products
  product_shampoo: '/assets/icons/petwash/products/product_shampoo.png',
  product_conditioner: '/assets/icons/petwash/products/product_conditioner.png',
  product_towel: '/assets/icons/petwash/products/product_towel.png',
  product_grooming_brush: '/assets/icons/petwash/products/product_grooming_brush.png',
  product_collar: '/assets/icons/petwash/products/product_collar.png',
  product_treat: '/assets/icons/petwash/products/product_treat.png',
  // nature
  nature_leaf: '/assets/icons/petwash/nature/nature_leaf.png',
  nature_bubbles: '/assets/icons/petwash/nature/nature_bubbles.png',
  nature_water_drop: '/assets/icons/petwash/nature/nature_water_drop.png',
  nature_natural_ingredients: '/assets/icons/petwash/nature/nature_natural_ingredients.png',
  // trust
  trust_pet_safe: '/assets/icons/petwash/trust/trust_pet_safe.png',
  // brand
  brand_paw: '/assets/icons/petwash/brand/brand_paw.png',
  brand_pet_owner: '/assets/icons/petwash/brand/brand_pet_owner.png',
  brand_sparkle: '/assets/icons/petwash/brand/brand_sparkle.png',
} as const;

/**
 * Planned keys from the spec that don't have an asset YET (other boards: services,
 * more animals, app, station, status, finance). They resolve to DEFAULT until
 * extracted, so callers can reference them now without an emoji ever appearing.
 */
export type PlannedIconKey =
  | 'animal_hamster' | 'animal_ferret' | 'animal_lizard' | 'animal_hedgehog' | 'animal_goat' | 'animal_sheep' | 'animal_chick' | 'animal_swan' | 'animal_butterfly'
  | 'service_self_wash' | 'service_grooming' | 'service_mobile_wash' | 'service_pet_sitting' | 'service_dog_walking' | 'service_pet_hosting' | 'service_pet_transport' | 'service_training' | 'service_vet_care' | 'service_pet_shop'
  | 'product_organic_soap' | 'product_comb' | 'product_scissors' | 'product_engraved_tag' | 'product_pet_bed' | 'product_carrier_bag' | 'product_perfume_mist'
  | 'nature_botanical_sprig' | 'nature_tea_tree' | 'nature_aloe_vera' | 'nature_oatmeal' | 'nature_coconut' | 'nature_organic' | 'nature_plant_based'
  | 'trust_id_verified' | 'trust_insured' | 'trust_background_checked' | 'trust_top_provider' | 'trust_paw_care_certified' | 'trust_5_star' | 'trust_24_7_support'
  | 'app_wallet' | 'app_qr' | 'app_booking' | 'app_live_tracking' | 'app_rewards' | 'app_support' | 'app_notification' | 'app_location' | 'app_calendar' | 'app_upload_document'
  | 'station_smart_hub' | 'station_k9000_dual_bay' | 'station_uv_sanitized' | 'station_paw_dryer' | 'station_hydro_massage' | 'station_aroma_spa' | 'station_flea_tick_care' | 'station_dental_care' | 'station_maintenance'
  | 'status_pending_review' | 'status_approved' | 'status_missing_documents' | 'status_rejected'
  | 'finance_bank' | 'finance_pricing' | 'finance_payout' | 'document_tax_status';

export type PetWashIconName = keyof typeof PETWASH_ICONS | PlannedIconKey;

/** Resolve an icon_key to its asset path, or the luxury default (never an emoji). */
export function resolvePetWashIcon(name: PetWashIconName | string): string {
  return (PETWASH_ICONS as Record<string, string>)[name] ?? DEFAULT_PETWASH_ICON;
}

/** Whether a real (non-default) asset exists for this key. */
export function hasPetWashIcon(name: string): boolean {
  return name in PETWASH_ICONS;
}
