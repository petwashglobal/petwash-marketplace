/**
 * FILE: src/brand/petwash_homepage_content_guard_2025.ts
 *
 * PURPOSE:
 * =========
 * Single source of truth for the FIRST APPROVED HOMEPAGE LAYOUT
 * that Nir provided in chat (hero, wording, images, feeling).
 *
 * This file is the boss for homepage marketing copy and hero images.
 * - GitHub is the source of truth.
 * - Replit is only the programmer.
 * - The AI dev is not allowed to "improve", "simplify" or replace
 *   any of the approved wording or hero image choices unless Nir
 *   changes this file himself.
 *
 * IMPORTANT:
 * ==========
 * 1. The strong legal rules that block hype words apply ONLY to:
 *    - legal text
 *    - compliance pages
 *    - backend admin UIs
 *    They DO NOT cancel the homepage marketing copy that Nir approved.
 *
 * 2. The homepage is allowed to use:
 *    - "7 Star Luxury" wording
 *    - comparisons like "Apple", "Tesla", "Louis Vuitton" etc
 *      inside specific marketing examples
 *    as long as they are used exactly as defined below.
 *
 * 3. Every future preflight / guardian script must read from this file,
 *    and treat the content here as ALLOWED and PROTECTED, not as a violation.
 *
 * HOW TO USE:
 * ===========
 * - Import HOMEPAGE_APPROVED_2025 into the homepage React/Next/Vite page
 *   and render text and images ONLY from these fields.
 * - Import HOMEPAGE_COPY_GUARD into any preflight or CI guard
 *   and call runHomepageCopyGuard() before build.
 *
 *   Example:
 *     import { HOMEPAGE_APPROVED_2025, runHomepageCopyGuard } from
 *       "@/brand/petwash_homepage_content_guard_2025";
 *
 *     runHomepageCopyGuard(projectSourceTreeAsString);
 *
 * - Do not hardcode strings like "Revolutionizing Self-Service Pet Grooming & Washing"
 *   directly in components. Always reference this file.
 */

export type LocaleCode = "en" | "he";

/**
 * Structure of a single text block on the homepage.
 */
export interface HomepageTextBlock {
  id: string;
  description: string; // for developers only, not rendered
  approvedText: {
    en?: string;
    he?: string;
  };
  // If true, this text must appear exactly as written at least once.
  required: boolean;
  // If true, it must NOT be changed by AI or auto translation tools.
  locked: boolean;
}

/**
 * Structure of a hero or section image that Nir approved.
 * The actual files should live in /public/assets/petwash/homepage/2025/*
 */
export interface HomepageImageAsset {
  id: string;
  description: string;
  src: string; // relative path in the web app
  alt: {
    en?: string;
    he?: string;
  };
  locked: boolean;
}

/**
 * Main object: all homepage approved content for 2025.
 * This represents the FIRST hero layout Nir liked.
 */
export const HOMEPAGE_APPROVED_2025 = {
  version: "2025.01",
  locales: ["en", "he"] as LocaleCode[],

  /**
   * Approved text blocks.
   * If you need a new block, add it here and ask Nir to approve.
   * Do not edit or remove existing blocks without explicit request.
   */
  textBlocks: [
    // ================= HERO SECTION =================
    {
      id: "hero_headline",
      description: "Main hero headline at top of homepage.",
      approvedText: {
        en: "7-Star Luxury Pet Grooming Excellence",
        he: "מהפכה בשטיפת חיות המחמד"
      },
      required: true,
      locked: true
    },
    {
      id: "hero_subheadline",
      description: "Hero subheadline directly under the main headline.",
      approvedText: {
        en: "Premium Professional Care, Available 24/7",
        he: "שירותי רחצה וטיפוח מתקדמים בטכנולוגיית K9000"
      },
      required: true,
      locked: true
    },
    {
      id: "hero_description",
      description: "Short description under hero subheadline.",
      approvedText: {
        en: "100% organic shampoo with Tea Tree Oil. Pest-repelling, antibacterial, and soothing for your furry friend.",
        he: "100% שמפו אורגני עם שמן עץ התה. טיפול אנטיבקטריאלי ועדין לכלב ולחתול."
      },
      required: true,
      locked: true
    },

    // ================= CTA BUTTONS =================
    {
      id: "cta_primary",
      description: "Main primary CTA button in hero.",
      approvedText: {
        en: "Get Started",
        he: "התחל עכשיו"
      },
      required: true,
      locked: true
    },
    {
      id: "cta_secondary",
      description: "Secondary CTA button in hero.",
      approvedText: {
        en: "Login",
        he: "התחברות"
      },
      required: true,
      locked: true
    },

    // ================= K9000 SECTION =================
    {
      id: "k9000_badge",
      description: "Small badge above hero or K9000 block.",
      approvedText: {
        en: "K9000 Technology",
        he: "טכנולוגיית K9000"
      },
      required: true,
      locked: true
    },
    {
      id: "k9000_section_title",
      description: "Title above the double K9000 image section.",
      approvedText: {
        en: "Double K9000 Stations",
        he: "תחנות K9000 כפולה"
      },
      required: true,
      locked: true
    },

    // ================= BRAND LINE =================
    {
      id: "brand_tagline",
      description: "Short brand tagline under logo or footer.",
      approvedText: {
        en: "PetWash – Clean. Safe. Smart.",
        he: "PetWash – נקי. בטוח. חכם."
      },
      required: true,
      locked: true
    },

    // ================= SOCIAL STRIP =================
    {
      id: "social_caption",
      description: "Optional caption near social icons if used.",
      approvedText: {
        en: "Follow PetWash for fresh locations, offers and behind the scenes.",
        he: "עקבו אחרי PetWash לעדכונים על מיקומים חדשים, מבצעים והצצה מאחורי הקלעים."
      },
      required: false,
      locked: true
    },

    // ================= LUXURY COMPARISON SECTION =================
    {
      id: "luxury_comparison_intro",
      description:
        "Short sentence that compares the feeling of the brand to Apple, Tesla, Louis Vuitton level service. This is allowed here only.",
      approvedText: {
        en: "PetWash brings the feeling of Apple, Tesla and Louis Vuitton service into the world of pet care.",
        he: "PetWash מביאה את תחושת השירות של Apple, Tesla ו-Louis Vuitton לעולם של חיות המחמד."
      },
      required: false,
      locked: true
    }
  ] as HomepageTextBlock[],

  /**
   * Approved hero and section images.
   * All image paths must exist in the repo and be used directly.
   * No stock image replacement without explicit approval.
   */
  images: [
    {
      id: "hero_dogs_and_cats",
      description:
        "Main hero image with clean white background and 4 or 5 happy dogs and cats standing in a line. This is the image Nir liked.",
      src: "/assets/petwash/homepage/2025/hero-dogs-cats-white-bg.webp",
      alt: {
        en: "Happy dogs and cats on a clean white background at PetWash.",
        he: "כלבים וחתולים מחייכים על רקע לבן ונקי של PetWash."
      },
      locked: true
    },
    {
      id: "k9000_double_station",
      description:
        "Image or render of double K9000 dog wash stations, used in the K9000 section.",
      src: "/assets/petwash/homepage/2025/k9000-double-station.webp",
      alt: {
        en: "Double K9000 pet wash stations ready for use.",
        he: "תחנות K9000 כפולה מוכנות לשימוש."
      },
      locked: true
    }
  ] as HomepageImageAsset[],

  /**
   * Approved social icon assets. Only these should appear in the top header
   * or footer strip. If design changes, update here instead of hardcoding.
   */
  socialIcons: [
    {
      id: "facebook",
      platform: "facebook",
      src: "/assets/petwash/social/facebook-circle.svg"
    },
    {
      id: "instagram",
      platform: "instagram",
      src: "/assets/petwash/social/instagram-circle.svg"
    },
    {
      id: "tiktok",
      platform: "tiktok",
      src: "/assets/petwash/social/tiktok-circle.svg"
    }
  ]
} as const;

/**
 * Helper type so React components can import strongly typed content.
 */
export type HomepageApprovedConfig = typeof HOMEPAGE_APPROVED_2025;

/* =====================================================================
 *  RUNTIME GUARD FOR PREFLIGHT / CI
 * =====================================================================
 *
 * This guard is used by preflight scripts (like petwash-preflight.ts)
 * and CI workflows. It must treat the phrases here as ALLOWED even if
 * other legal rules normally block "7 Star", "Apple level" etc.
 */

export interface HomepageCopyGuardResult {
  ok: boolean;
  missingRequiredBlocks: string[];
  notes: string[];
}

/**
 * Utility that checks if required approved strings exist at least once
 * in the full source of the project (simple string scan).
 *
 * projectSourceText:
 *   entire repo text concatenated, or at minimum all homepage related
 *   files loaded into a string. The exact implementation is up to
 *   the preflight script.
 */
export function runHomepageCopyGuard(
  projectSourceText: string
): HomepageCopyGuardResult {
  const missingRequiredBlocks: string[] = [];
  const notes: string[] = [];

  for (const block of HOMEPAGE_APPROVED_2025.textBlocks) {
    if (!block.required) continue;

    const approvedEn = block.approvedText.en || "";
    const approvedHe = block.approvedText.he || "";

    const foundEn =
      approvedEn && projectSourceText.includes(approvedEn.trim());
    const foundHe =
      approvedHe && projectSourceText.includes(approvedHe.trim());

    if (!foundEn && !foundHe) {
      missingRequiredBlocks.push(block.id);
      notes.push(
        `Required homepage text block "${block.id}" not found in source. You must render the approved text from HOMEPAGE_APPROVED_2025 instead of inventing new wording.`
      );
    }
  }

  if (missingRequiredBlocks.length === 0) {
    notes.push(
      "All required approved homepage text blocks found. Do not auto modify or rephrase them."
    );
  }

  return {
    ok: missingRequiredBlocks.length === 0,
    missingRequiredBlocks,
    notes
  };
}

/* =====================================================================
 *  RENDER HELPERS FOR REACT / NEXT / VITE FRONTEND
 * ===================================================================== */

/**
 * Helper to fetch a text block safely inside React components.
 *
 * Example:
 *   const heroTitle = getHomepageText("hero_headline", "en");
 *   return <h1>{heroTitle}</h1>;
 */
export function getHomepageText(
  id: HomepageTextBlock["id"],
  locale: LocaleCode
): string {
  const block = HOMEPAGE_APPROVED_2025.textBlocks.find((b) => b.id === id);
  if (!block) {
    throw new Error(
      `[PetWash Homepage Guard] Text block "${id}" not found. Do not invent new ids, add them in HOMEPAGE_APPROVED_2025 first.`
    );
  }

  const text = block.approvedText[locale] || block.approvedText.en;
  if (!text) {
    throw new Error(
      `[PetWash Homepage Guard] Text block "${id}" has no text for locale "${locale}" and no English fallback.`
    );
  }

  return text;
}

/**
 * Helper to fetch an image asset for the homepage.
 *
 * Example:
 *   const heroImg = getHomepageImage("hero_dogs_and_cats");
 *   <img src={heroImg.src} alt={heroImg.alt.en} />
 */
export function getHomepageImage(id: HomepageImageAsset["id"]): HomepageImageAsset {
  const img = HOMEPAGE_APPROVED_2025.images.find((i) => i.id === id);
  if (!img) {
    throw new Error(
      `[PetWash Homepage Guard] Image asset "${id}" not found. Use one of the approved ids defined in HOMEPAGE_APPROVED_2025.images.`
    );
  }
  return img;
}

/**
 * Helper to fetch social icon configuration.
 */
export function getHomepageSocialIcons() {
  return HOMEPAGE_APPROVED_2025.socialIcons;
}

/* =====================================================================
 *  FINAL NOTES FOR THE AI DEVELOPER (READ CAREFULLY)
 * =====================================================================
 *
 * 1. This file lives in the GitHub repo and is the master reference for
 *    homepage wording and hero images.
 *
 * 2. Do not:
 *    - rename ids
 *    - change the text
 *    - change the images
 *    unless Nir explicitly changes this file.
 *
 * 3. You ARE allowed to:
 *    - rearrange layout components
 *    - update spacing, paddings, responsive behavior
 *    - implement new sections as long as the hero and core texts here
 *      stay exactly as they are.
 *
 * 4. If any future legal guard complains about words like "7 Star",
 *    "Apple", "Tesla", "Louis Vuitton" etc when they appear inside
 *    this approved content, the guard is wrong and must be updated,
 *    not this file.
 *
 * 5. Always respect Nir's original wording and visuals. They are not
 *    placeholders. They are final creative direction.
 */