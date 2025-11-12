// ========================================
// THE PLUSH LAB™ - Premium Outfit & Accessory Library
// ========================================
// 7-Star Luxury Avatar Customization System
// "Most Oils" (Maximum Features) Approach

export interface OutfitItem {
  id: string;
  name: string;
  nameHe: string;
  category: 'casual' | 'formal' | 'sports' | 'seasonal' | 'fantasy' | 'premium';
  characterTypes: ('pet' | 'person' | 'superhero' | 'custom')[];
  thumbnail: string;
  description: string;
  descriptionHe: string;
  premium: boolean;
  colors: string[]; // Available color options
  patterns: string[]; // Available patterns
  layers: {
    base: string;
    overlay?: string;
    accent?: string;
  };
}

export interface AccessoryItem {
  id: string;
  name: string;
  nameHe: string;
  category: 'hats' | 'glasses' | 'collars' | 'toys' | 'seasonal';
  thumbnail: string;
  description: string;
  descriptionHe: string;
  premium: boolean;
  position: 'head' | 'eyes' | 'neck' | 'hand' | 'floating';
  colors: string[];
}

// ========================================
// PREMIUM OUTFIT LIBRARY (20+ Options)
// ========================================

export const OUTFIT_LIBRARY: OutfitItem[] = [
  // CASUAL COLLECTION
  {
    id: 'casual_tshirt_01',
    name: 'Classic T-Shirt',
    nameHe: 'חולצת טי קלאסית',
    category: 'casual',
    characterTypes: ['person', 'custom'],
    thumbnail: '👕',
    description: 'Comfortable everyday wear',
    descriptionHe: 'לבוש יומיומי נוח',
    premium: false,
    colors: ['red', 'blue', 'green', 'black', 'white', 'purple', 'pink'],
    patterns: ['solid', 'striped', 'graphic'],
    layers: { base: 'tshirt' }
  },
  {
    id: 'casual_hoodie_01',
    name: 'Cozy Hoodie',
    nameHe: 'הודי נעים',
    category: 'casual',
    characterTypes: ['person', 'custom'],
    thumbnail: '🧥',
    description: 'Warm and stylish',
    descriptionHe: 'חם וסטייליש',
    premium: false,
    colors: ['gray', 'black', 'navy', 'red', 'purple'],
    patterns: ['solid', 'logo'],
    layers: { base: 'hoodie', overlay: 'hood' }
  },
  {
    id: 'casual_bandana_01',
    name: 'Cool Bandana',
    nameHe: 'בנדנה מגניבה',
    category: 'casual',
    characterTypes: ['pet', 'custom'],
    thumbnail: '🎀',
    description: 'Stylish pet bandana',
    descriptionHe: 'בנדנה סטייליש לחיית מחמד',
    premium: false,
    colors: ['red', 'blue', 'rainbow', 'leopard'],
    patterns: ['solid', 'patterned', 'checkered'],
    layers: { base: 'bandana' }
  },

  // FORMAL COLLECTION
  {
    id: 'formal_suit_01',
    name: 'Executive Suit',
    nameHe: 'חליפה מנהלים',
    category: 'formal',
    characterTypes: ['person', 'custom'],
    thumbnail: '👔',
    description: 'Professional business attire',
    descriptionHe: 'לבוש עסקי מקצועי',
    premium: true,
    colors: ['black', 'navy', 'charcoal', 'white'],
    patterns: ['solid', 'pinstripe'],
    layers: { base: 'suit', overlay: 'tie', accent: 'pocket_square' }
  },
  {
    id: 'formal_dress_01',
    name: 'Elegant Dress',
    nameHe: 'שמלה אלגנטית',
    category: 'formal',
    characterTypes: ['person', 'custom'],
    thumbnail: '👗',
    description: 'Sophisticated evening wear',
    descriptionHe: 'לבוש ערב מתוחכם',
    premium: true,
    colors: ['black', 'red', 'gold', 'silver', 'royal_blue'],
    patterns: ['solid', 'sequin', 'lace'],
    layers: { base: 'dress', accent: 'belt' }
  },
  {
    id: 'formal_bowtie_01',
    name: 'Fancy Bow Tie',
    nameHe: 'עניבת פרפר מפוארת',
    category: 'formal',
    characterTypes: ['pet', 'person', 'custom'],
    thumbnail: '🎩',
    description: 'Dapper pet/person bow tie',
    descriptionHe: 'עניבת פרפר מהוגנת',
    premium: true,
    colors: ['black', 'red', 'gold', 'rainbow'],
    patterns: ['solid', 'polka_dot', 'checkered'],
    layers: { base: 'bowtie' }
  },

  // SPORTS COLLECTION
  {
    id: 'sports_jersey_01',
    name: 'Team Jersey',
    nameHe: 'חולצת קבוצה',
    category: 'sports',
    characterTypes: ['person', 'custom'],
    thumbnail: '⚽',
    description: 'Athletic team uniform',
    descriptionHe: 'מדי קבוצה ספורטיביים',
    premium: false,
    colors: ['red', 'blue', 'green', 'yellow', 'custom'],
    patterns: ['solid', 'striped', 'numbered'],
    layers: { base: 'jersey', accent: 'number' }
  },
  {
    id: 'sports_tracksuit_01',
    name: 'Athletic Tracksuit',
    nameHe: 'חליפת אימון',
    category: 'sports',
    characterTypes: ['person', 'custom'],
    thumbnail: '🏃',
    description: 'Performance workout gear',
    descriptionHe: 'ביגוד אימון מקצועי',
    premium: false,
    colors: ['black', 'navy', 'neon_green', 'red'],
    patterns: ['solid', 'striped'],
    layers: { base: 'tracksuit', overlay: 'jacket' }
  },
  {
    id: 'sports_collar_01',
    name: 'Sports Collar',
    nameHe: 'צווארון ספורט',
    category: 'sports',
    characterTypes: ['pet', 'custom'],
    thumbnail: '🏅',
    description: 'Athletic pet collar',
    descriptionHe: 'צווארון ספורטיבי',
    premium: false,
    colors: ['red', 'blue', 'neon_yellow', 'reflective'],
    patterns: ['solid', 'reflective'],
    layers: { base: 'collar', accent: 'medal' }
  },

  // PREMIUM COLLECTION
  {
    id: 'hero_cape_classic_01',
    name: 'Classic Hero Cape',
    nameHe: 'גלימת גיבור קלאסית',
    category: 'premium',
    characterTypes: ['pet', 'person', 'superhero', 'custom'],
    thumbnail: '🦸',
    description: 'Iconic superhero cape',
    descriptionHe: 'גלימת סופר גיבור אייקונית',
    premium: true,
    colors: ['red', 'blue', 'black', 'gold', 'purple'],
    patterns: ['solid', 'starred', 'gradient'],
    layers: { base: 'cape', accent: 'emblem' }
  },
  {
    id: 'hero_suit_tech_01',
    name: 'Tech Hero Suit',
    nameHe: 'חליפת גיבור טכנולוגית',
    category: 'premium',
    characterTypes: ['person', 'superhero', 'custom'],
    thumbnail: '🤖',
    description: 'High-tech armor suit',
    descriptionHe: 'חליפת שריון טכנולוגית',
    premium: true,
    colors: ['silver', 'gold', 'red', 'blue', 'black'],
    patterns: ['metallic', 'circuit', 'holographic'],
    layers: { base: 'armor', overlay: 'tech_panel', accent: 'lights' }
  },
  {
    id: 'hero_mask_01',
    name: 'Hero Mask',
    nameHe: 'מסכת גיבור',
    category: 'premium',
    characterTypes: ['pet', 'person', 'superhero', 'custom'],
    thumbnail: '🎭',
    description: 'Mysterious hero mask',
    descriptionHe: 'מסכת גיבור מסתורית',
    premium: true,
    colors: ['black', 'red', 'gold', 'silver'],
    patterns: ['solid', 'patterned'],
    layers: { base: 'mask' }
  },

  // SEASONAL COLLECTION
  {
    id: 'seasonal_winter_01',
    name: 'Cozy Winter Coat',
    nameHe: 'מעיל חורף נעים',
    category: 'seasonal',
    characterTypes: ['pet', 'person', 'custom'],
    thumbnail: '🧥',
    description: 'Warm winter outerwear',
    descriptionHe: 'מעיל חורף חם',
    premium: false,
    colors: ['red', 'navy', 'forest_green', 'white'],
    patterns: ['solid', 'plaid', 'fur_trim'],
    layers: { base: 'coat', overlay: 'hood', accent: 'buttons' }
  },
  {
    id: 'seasonal_summer_01',
    name: 'Beach Vibes',
    nameHe: 'וויב חוף',
    category: 'seasonal',
    characterTypes: ['person', 'custom'],
    thumbnail: '🏖️',
    description: 'Summer beach outfit',
    descriptionHe: 'תלבושת חוף קיץ',
    premium: false,
    colors: ['tropical_blue', 'sunset_orange', 'pink', 'yellow'],
    patterns: ['floral', 'palm_tree', 'solid'],
    layers: { base: 'hawaiian_shirt' }
  },
  {
    id: 'seasonal_halloween_01',
    name: 'Spooky Halloween',
    nameHe: 'האלווין מפחיד',
    category: 'seasonal',
    characterTypes: ['pet', 'person', 'custom'],
    thumbnail: '🎃',
    description: 'Halloween costume',
    descriptionHe: 'תחפושת האלווין',
    premium: true,
    colors: ['orange', 'black', 'purple', 'green'],
    patterns: ['pumpkin', 'ghost', 'skeleton'],
    layers: { base: 'costume', accent: 'accessory' }
  },
  {
    id: 'seasonal_christmas_01',
    name: 'Festive Holiday',
    nameHe: 'חג חגיגי',
    category: 'seasonal',
    characterTypes: ['pet', 'person', 'custom'],
    thumbnail: '🎄',
    description: 'Christmas celebration outfit',
    descriptionHe: 'תלבושת חגיגת חג המולד',
    premium: true,
    colors: ['red', 'green', 'white', 'gold'],
    patterns: ['santa', 'snowflake', 'reindeer'],
    layers: { base: 'holiday_outfit', accent: 'hat' }
  },

  // FANTASY COLLECTION
  {
    id: 'fantasy_wizard_01',
    name: 'Wizard Robes',
    nameHe: 'גלימת קוסם',
    category: 'fantasy',
    characterTypes: ['person', 'custom'],
    thumbnail: '🧙',
    description: 'Magical wizard attire',
    descriptionHe: 'לבוש קוסם קסום',
    premium: true,
    colors: ['purple', 'blue', 'black', 'starry'],
    patterns: ['stars', 'moons', 'mystical'],
    layers: { base: 'robes', overlay: 'cape', accent: 'belt' }
  },
  {
    id: 'fantasy_fairy_01',
    name: 'Fairy Wings',
    nameHe: 'כנפי פיה',
    category: 'fantasy',
    characterTypes: ['pet', 'person', 'custom'],
    thumbnail: '🧚',
    description: 'Enchanted fairy wings',
    descriptionHe: 'כנפי פיה מכושפות',
    premium: true,
    colors: ['rainbow', 'sparkle', 'pink', 'blue'],
    patterns: ['glitter', 'iridescent'],
    layers: { base: 'wings', accent: 'sparkles' }
  },
  {
    id: 'fantasy_dragon_01',
    name: 'Dragon Armor',
    nameHe: 'שריון דרקון',
    category: 'fantasy',
    characterTypes: ['pet', 'person', 'custom'],
    thumbnail: '🐉',
    description: 'Legendary dragon scales',
    descriptionHe: 'קשקשי דרקון אגדיים',
    premium: true,
    colors: ['emerald', 'ruby', 'sapphire', 'gold'],
    patterns: ['scales', 'flames'],
    layers: { base: 'armor', overlay: 'scales', accent: 'spikes' }
  },
  {
    id: 'fantasy_unicorn_01',
    name: 'Unicorn Magic',
    nameHe: 'קסם חד קרן',
    category: 'fantasy',
    characterTypes: ['pet', 'custom'],
    thumbnail: '🦄',
    description: 'Magical unicorn accessories',
    descriptionHe: 'אביזרי חד קרן קסומים',
    premium: true,
    colors: ['rainbow', 'pastel_pink', 'white', 'gold'],
    patterns: ['sparkle', 'rainbow'],
    layers: { base: 'horn', accent: 'mane' }
  },
];

// ========================================
// PREMIUM ACCESSORY LIBRARY (30+ Options)
// ========================================

export const ACCESSORY_LIBRARY: AccessoryItem[] = [
  // HATS
  {
    id: 'hat_baseball_01',
    name: 'Baseball Cap',
    nameHe: 'כובע בייסבול',
    category: 'hats',
    thumbnail: '🧢',
    description: 'Classic sporty cap',
    descriptionHe: 'כובע ספורטיבי קלאסי',
    premium: false,
    position: 'head',
    colors: ['red', 'blue', 'black', 'white', 'custom']
  },
  {
    id: 'hat_crown_01',
    name: 'Royal Crown',
    nameHe: 'כתר מלכותי',
    category: 'hats',
    thumbnail: '👑',
    description: 'Majestic golden crown',
    descriptionHe: 'כתר זהב מלכותי',
    premium: true,
    position: 'head',
    colors: ['gold', 'silver', 'jeweled']
  },
  {
    id: 'hat_wizard_01',
    name: 'Wizard Hat',
    nameHe: 'כובע קוסם',
    category: 'hats',
    thumbnail: '🎩',
    description: 'Mystical pointed hat',
    descriptionHe: 'כובע מחודד מיסטי',
    premium: true,
    position: 'head',
    colors: ['purple', 'blue', 'black', 'starry']
  },
  {
    id: 'hat_party_01',
    name: 'Party Hat',
    nameHe: 'כובע מסיבה',
    category: 'hats',
    thumbnail: '🎉',
    description: 'Festive celebration hat',
    descriptionHe: 'כובע חגיגי',
    premium: false,
    position: 'head',
    colors: ['rainbow', 'gold', 'silver', 'colorful']
  },

  // GLASSES
  {
    id: 'glasses_sunglasses_01',
    name: 'Cool Sunglasses',
    nameHe: 'משקפי שמש',
    category: 'glasses',
    thumbnail: '😎',
    description: 'Stylish shades',
    descriptionHe: 'משקפיים סטייליש',
    premium: false,
    position: 'eyes',
    colors: ['black', 'gold', 'rainbow', 'mirror']
  },
  {
    id: 'glasses_nerdy_01',
    name: 'Smart Glasses',
    nameHe: 'משקפיים חכמים',
    category: 'glasses',
    thumbnail: '🤓',
    description: 'Intellectual look',
    descriptionHe: 'מראה אינטלקטואלי',
    premium: false,
    position: 'eyes',
    colors: ['black', 'brown', 'clear']
  },
  {
    id: 'glasses_monocle_01',
    name: 'Fancy Monocle',
    nameHe: 'מונוקל מפואר',
    category: 'glasses',
    thumbnail: '🧐',
    description: 'Distinguished monocle',
    descriptionHe: 'מונוקל מכובד',
    premium: true,
    position: 'eyes',
    colors: ['gold', 'silver']
  },
  {
    id: 'glasses_3d_01',
    name: '3D Glasses',
    nameHe: 'משקפי 3D',
    category: 'glasses',
    thumbnail: '🕶️',
    description: 'Classic 3D cinema glasses',
    descriptionHe: 'משקפי קולנוע 3D קלאסיים',
    premium: false,
    position: 'eyes',
    colors: ['red_blue', 'rainbow']
  },

  // COLLARS
  {
    id: 'jewelry_necklace_01',
    name: 'Diamond Necklace',
    nameHe: 'שרשרת יהלומים',
    category: 'collars',
    thumbnail: '💎',
    description: 'Elegant diamond jewelry',
    descriptionHe: 'תכשיט יהלומים אלגנטי',
    premium: true,
    position: 'neck',
    colors: ['diamond', 'gold', 'silver', 'ruby']
  },
  {
    id: 'jewelry_scarf_01',
    name: 'Silk Scarf',
    nameHe: 'צעיף משי',
    category: 'collars',
    thumbnail: '🧣',
    description: 'Luxurious silk scarf',
    descriptionHe: 'צעיף משי יוקרתי',
    premium: false,
    position: 'neck',
    colors: ['red', 'blue', 'rainbow', 'leopard']
  },
  {
    id: 'jewelry_medal_01',
    name: 'Champion Medal',
    nameHe: 'מדליית אלוף',
    category: 'collars',
    thumbnail: '🏅',
    description: 'Victory medal',
    descriptionHe: 'מדליית ניצחון',
    premium: true,
    position: 'neck',
    colors: ['gold', 'silver', 'bronze']
  },

  // TOYS
  {
    id: 'prop_wand_01',
    name: 'Magic Wand',
    nameHe: 'שרביט קסמים',
    category: 'toys',
    thumbnail: '🪄',
    description: 'Enchanted wand',
    descriptionHe: 'שרביט מכושף',
    premium: true,
    position: 'hand',
    colors: ['brown', 'sparkle', 'rainbow']
  },
  {
    id: 'prop_sword_01',
    name: 'Hero Sword',
    nameHe: 'חרב גיבור',
    category: 'toys',
    thumbnail: '⚔️',
    description: 'Legendary blade',
    descriptionHe: 'להב אגדי',
    premium: true,
    position: 'hand',
    colors: ['silver', 'gold', 'blue_flame']
  },
  {
    id: 'prop_ball_01',
    name: 'Play Ball',
    nameHe: 'כדור משחק',
    category: 'toys',
    thumbnail: '🎾',
    description: 'Fun play ball',
    descriptionHe: 'כדור משחק כיפי',
    premium: false,
    position: 'hand',
    colors: ['tennis_yellow', 'orange', 'blue', 'rainbow']
  },

  // SEASONAL EFFECTS
  {
    id: 'special_wings_angel_01',
    name: 'Angel Wings',
    nameHe: 'כנפי מלאך',
    category: 'seasonal',
    thumbnail: '👼',
    description: 'Heavenly wings',
    descriptionHe: 'כנפיים שמימיות',
    premium: true,
    position: 'floating',
    colors: ['white', 'gold', 'sparkle']
  },
  {
    id: 'special_halo_01',
    name: 'Glowing Halo',
    nameHe: 'הילה זוהרת',
    category: 'seasonal',
    thumbnail: '😇',
    description: 'Radiant halo',
    descriptionHe: 'הילה קורנת',
    premium: true,
    position: 'floating',
    colors: ['gold', 'rainbow', 'white']
  },
  {
    id: 'special_sparkles_01',
    name: 'Magic Sparkles',
    nameHe: 'ניצוצות קסם',
    category: 'seasonal',
    thumbnail: '✨',
    description: 'Floating magical sparkles',
    descriptionHe: 'ניצוצות קסומים מרחפים',
    premium: true,
    position: 'floating',
    colors: ['rainbow', 'gold', 'silver', 'multi']
  },
];

// ========================================
// HELPER FUNCTIONS
// ========================================

export function getOutfitById(id: string): OutfitItem | undefined {
  return OUTFIT_LIBRARY.find(outfit => outfit.id === id);
}

export function getAccessoryById(id: string): AccessoryItem | undefined {
  return ACCESSORY_LIBRARY.find(accessory => accessory.id === id);
}

export function getOutfitsByCategory(category: OutfitItem['category']): OutfitItem[] {
  return OUTFIT_LIBRARY.filter(outfit => outfit.category === category);
}

export function getAccessoriesByCategory(category: AccessoryItem['category']): AccessoryItem[] {
  return ACCESSORY_LIBRARY.filter(accessory => accessory.category === category);
}

export function getOutfitsForCharacterType(type: 'pet' | 'person' | 'superhero' | 'custom'): OutfitItem[] {
  return OUTFIT_LIBRARY.filter(outfit => outfit.characterTypes.includes(type));
}

export function getPremiumOutfits(): OutfitItem[] {
  return OUTFIT_LIBRARY.filter(outfit => outfit.premium);
}

export function getPremiumAccessories(): AccessoryItem[] {
  return ACCESSORY_LIBRARY.filter(accessory => accessory.premium);
}
