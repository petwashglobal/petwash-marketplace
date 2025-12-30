/**
 * Pet Wash™ Global Header 2025
 * Octopus model + Loyalty & VIP Club + 6 languages + luxury menus
 *
 * Platforms:
 * - Pet Wash Hub
 * - Pet Wash Stations
 * - Pet Wash Sitter
 * - Pet Wash Walker
 * - Pet Wash Transport
 * - Pet Wash Academy
 * - Pet Wash Shop (future)
 * - Avatar Studio (FROZEN – show but no live flows)
 *
 * Loyalty & VIP Club:
 * - Free to join for every user
 * - Tiers (example): Member, Silver, Gold, VIP Elite
 * - Benefits: discounted washes, priority booking, birthday gift, VIP events
 * - Refer a friend bonuses
 *
 * Header rules:
 * - Logo always center and dominant
 * - Social icons far left (#PetWashLtd)
 * - Luxury hamburger on the right with deep sections
 * - 6 languages: en, he, ru, fr, es, ar (RTL for he + ar)
 * - Works on iPhone, iPad, laptop, large screens
 *
 * This file assumes Nir's existing CSS classes:
 * pw-header, pw-header-inner, pw-header-left, pw-header-center, pw-header-right,
 * pw-nav-desktop, pw-mega-menu, pw-mega-inner, pw-mobile-drawer, etc.
 */

import React, { useEffect, useState } from "react";
import { SiInstagram, SiFacebook, SiTiktok, SiSpotify } from "react-icons/si";

type LangDir = "ltr" | "rtl";

const LANGUAGES: { code: string; label: string; dir: LangDir }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "he", label: "עברית", dir: "rtl" },
  { code: "ru", label: "Русский", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

// Geo-based language detection: Hebrew for Israel, English for rest of world
function detectInitialLanguage(): string {
  if (typeof window === "undefined") return "en";
  
  // Check for saved preference first
  const saved = window.localStorage.getItem("pw_lang");
  if (saved && LANGUAGES.some(l => l.code === saved)) {
    return saved;
  }
  
  // Check for geo-detected country (set by App or geolocation service)
  const countryCode = window.localStorage.getItem("pw_country");
  if (countryCode === "IL") {
    return "he"; // Hebrew default for Israel
  }
  
  // Fallback: Use browser language or default to English
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("he")) return "he";
  if (lang.startsWith("ar")) return "ar";
  if (lang.startsWith("ru")) return "ru";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("es")) return "es";
  
  return "en"; // English default for rest of world
}

// Async geo-detection to set country code
async function detectCountry(): Promise<string> {
  try {
    const response = await fetch("https://ipapi.co/country_code/", { 
      method: "GET",
      signal: AbortSignal.timeout(3000) 
    });
    if (response.ok) {
      const countryCode = await response.text();
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pw_country", countryCode.trim());
      }
      return countryCode.trim();
    }
  } catch (e) {
    // Fallback silently
  }
  return "";
}

// Octopus platforms model
const PLATFORM_GROUPS = [
  {
    id: "customer-experience",
    title: "Customer platforms",
    items: [
      {
        id: "hub",
        label: "Pet Wash Hub",
        description: "One 7 star account for all your pets and services",
        href: "/hub",
        frozen: false,
      },
      {
        id: "stations",
        label: "Pet Wash Stations",
        description: "Self service K9000 organic wash locations",
        href: "/stations",
        frozen: false,
      },
      {
        id: "sitter",
        label: "Pet Sitter",
        description: "Trusted pet and home sitting like Airbnb for pets",
        href: "/sitter-suite",
        frozen: false,
      },
      {
        id: "walker",
        label: "Pet Walker",
        description: "Walks, play time and outdoor activities",
        href: "/walk-my-pet",
        frozen: false,
      },
      {
        id: "transport",
        label: "Pet Transport",
        description: "Pet taxi between home, sitter and stations",
        href: "/pettrek/book",
        frozen: false,
      },
    ],
  },
  {
    id: "partners-and-growth",
    title: "Partners, academy and future",
    items: [
      {
        id: "academy",
        label: "Pet Wash Academy",
        description: "Training, certification and education for pros",
        href: "/academy",
        frozen: false,
      },
      {
        id: "shop",
        label: "Pet Wash Shop",
        description: "Organic care products and accessories (coming soon)",
        href: "/shop",
        frozen: true,
      },
      {
        id: "avatar",
        label: "Avatar Studio",
        description: "AI pet avatar builder (frozen for now)",
        href: "#",
        frozen: true,
      },
    ],
  },
];

// Global menu structure
const MENU_STRUCTURE = {
  // Main user flows
  forUsers: [
    {
      id: "booking",
      label: "Smart booking",
      href: "/booking",
      description: "Pet Wash style booking engine for all platforms",
    },
    {
      id: "loyalty-club",
      label: "Loyalty & VIP Club",
      href: "/loyalty",
      description: "Free to join. Earn points and climb tiers.",
    },
    {
      id: "loyalty-tiers",
      label: "Tiers: Member, Silver, Gold, VIP Elite",
      href: "/loyalty/tiers",
      description: "Luxury 4 tier structure for our best members.",
    },
    {
      id: "loyalty-benefits",
      label: "Benefits and perks",
      href: "/loyalty/benefits",
      description: "Discounted washes, early access, VIP events.",
    },
    {
      id: "loyalty-birthday",
      label: "Birthday & special rewards",
      href: "/loyalty/birthday",
      description: "Automatic surprises for pets and humans.",
    },
    {
      id: "refer",
      label: "Refer a friend",
      href: "/loyalty/refer",
      description: "Invite friends and earn wash credits.",
    },
    {
      id: "egift",
      label: "eGift cards",
      href: "/egift",
      description: "Digital Pet Wash gifts for friends and family.",
    },
    {
      id: "map",
      label: "Find a station",
      href: "/map",
      description: "Live map of all K9000 locations.",
    },
  ],

  // Partners and franchise
  forPartners: [
    {
      id: "franchise",
      label: "Franchise & city partners",
      href: "/partners/franchise",
    },
    {
      id: "business-locations",
      label: "Business locations & landlords",
      href: "/partners/locations",
    },
    {
      id: "suppliers",
      label: "Suppliers & brands",
      href: "/partners/suppliers",
    },
    {
      id: "municipal",
      label: "Municipal & council projects",
      href: "/partners/municipal",
    },
  ],

  // Company
  company: [
    { id: "about", label: "About Pet Wash", href: "/about" },
    { id: "story", label: "Our story and mission", href: "/story" },
    { id: "media", label: "Media, photos and videos", href: "/media" },
    { id: "gallery", label: "Gallery", href: "/gallery" },
    { id: "careers", label: "Careers", href: "/careers" },
  ],

  // Legal and compliance
  legal: [
    { id: "terms", label: "Terms and conditions", href: "/legal/terms" },
    { id: "privacy", label: "Privacy & data protection", href: "/legal/privacy" },
    {
      id: "egift-policy",
      label: "eGift and refund policy",
      href: "/legal/egift-policy",
    },
    {
      id: "loyalty-terms",
      label: "Loyalty & VIP Club terms",
      href: "/legal/loyalty-terms",
    },
    { id: "cookies", label: "Cookies & tracking", href: "/legal/cookies" },
    {
      id: "accessibility",
      label: "Accessibility statement",
      href: "/legal/accessibility",
    },
  ],

  // Support
  support: [
    { id: "faq", label: "Help center & FAQ", href: "/support" },
    { id: "contact", label: "Contact & WhatsApp", href: "/contact" },
    { id: "status", label: "System status", href: "/status" },
  ],
};

// Optional props for controlled component mode
interface PetWashHeaderProps {
  language?: string;
  onLanguageChange?: (language: string) => void;
}

export const PetWashHeader: React.FC<PetWashHeaderProps> = ({ 
  language: controlledLanguage, 
  onLanguageChange: controlledOnLanguageChange 
}) => {
  // Internal state for uncontrolled mode (backwards compatibility)
  const [internalLanguage, setInternalLanguage] = useState<string>(detectInitialLanguage);
  const [isPlatformsOpen, setIsPlatformsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Use controlled value if provided, otherwise use internal state
  const currentLanguage = controlledLanguage !== undefined ? controlledLanguage : internalLanguage;
  
  // Apply RTL or LTR to html element
  useEffect(() => {
    const selected = LANGUAGES.find((l) => l.code === currentLanguage);
    const dir: LangDir = selected?.dir || "ltr";

    if (typeof document !== "undefined") {
      document.documentElement.dir = dir;
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  // Close platforms mega menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".pw-nav-item-platforms")) {
        setIsPlatformsOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Restore saved language (only in uncontrolled mode)
  useEffect(() => {
    if (controlledLanguage !== undefined) return; // Skip if controlled
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("pw_lang");
    if (saved && LANGUAGES.some((l) => l.code === saved)) {
      setInternalLanguage(saved);
    }
  }, [controlledLanguage]);

  // Geo-detection for language default (Hebrew for Israel, English outside)
  useEffect(() => {
    if (controlledLanguage !== undefined) return; // Skip if controlled
    if (typeof window === "undefined") return;
    
    // Only run geo-detection if no saved preference and no country yet
    const saved = window.localStorage.getItem("pw_lang");
    const country = window.localStorage.getItem("pw_country");
    
    if (!saved && !country) {
      detectCountry().then((countryCode) => {
        if (countryCode === "IL") {
          setInternalLanguage("he");
        }
        // For other countries, keep the default (English)
      });
    }
  }, [controlledLanguage]);

  const handleNavigate = (href: string) => {
    if (!href || href === "#") return;
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(href);
    setIsMobileOpen(false);
  };

  const handleLanguageChange = (code: string) => {
    // If controlled, call the parent handler
    if (controlledOnLanguageChange) {
      controlledOnLanguageChange(code);
    } else {
      // Uncontrolled mode: update internal state
      setInternalLanguage(code);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pw_lang", code);
      }
    }
  };

  return (
    <>
      {/* Main header */}
      <header className="pw-header">
        <div className="pw-header-inner">
          {/* Left: 4 luxury social icons - Instagram, Facebook, TikTok, Spotify */}
          <div className="pw-header-left">
            <a
              className="pw-social-link pw-social-luxury"
              href="https://www.instagram.com/petwashltd"
              target="_blank"
              rel="noreferrer"
              aria-label="Pet Wash Instagram"
              data-testid="link-social-instagram"
            >
              <SiInstagram size={20} strokeWidth={1} />
            </a>
            <a
              className="pw-social-link pw-social-luxury"
              href="https://www.facebook.com/petwashltd"
              target="_blank"
              rel="noreferrer"
              aria-label="Pet Wash Facebook"
              data-testid="link-social-facebook"
            >
              <SiFacebook size={20} strokeWidth={1} />
            </a>
            <a
              className="pw-social-link pw-social-luxury"
              href="https://www.tiktok.com/@petwashltd"
              target="_blank"
              rel="noreferrer"
              aria-label="Pet Wash TikTok"
              data-testid="link-social-tiktok"
            >
              <SiTiktok size={20} strokeWidth={1} />
            </a>
            <a
              className="pw-social-link pw-social-luxury"
              href="https://open.spotify.com/user/petwashltd"
              target="_blank"
              rel="noreferrer"
              aria-label="Pet Wash Spotify"
              data-testid="link-social-spotify"
            >
              <SiSpotify size={20} strokeWidth={1} />
            </a>
          </div>

          {/* Center: official logo - always visible on all screen sizes */}
          <div className="pw-header-center">
            <button
              className="pw-logo-link"
              onClick={() => handleNavigate("/")}
              aria-label="Pet Wash home"
            >
              <img 
                src="/brand/petwash-logo-official.png" 
                alt="PetWash™" 
                className="pw-header-logo-img"
              />
            </button>
          </div>

          {/* Right: nav, language, account, burger */}
          <div className="pw-header-right">
            <nav className="pw-nav-desktop">
              {/* Platforms mega menu */}
              <div className="pw-nav-item pw-nav-item-platforms">
                <button
                  className="pw-nav-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlatformsOpen((prev) => !prev);
                  }}
                >
                  Platforms
                </button>
                {isPlatformsOpen && (
                  <div className="pw-mega-menu">
                    <div className="pw-mega-inner">
                      {PLATFORM_GROUPS.map((group) => (
                        <div className="pw-mega-column" key={group.id}>
                          <div className="pw-mega-title">{group.title}</div>
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              className={
                                "pw-mega-link" +
                                (item.frozen ? " pw-mega-link-frozen" : "")
                              }
                              onClick={() => {
                                if (item.frozen) return;
                                handleNavigate(item.href);
                              }}
                            >
                              <span>{item.label}</span>
                              {item.frozen ? (
                                <span className="pw-pill-frozen">Frozen</span>
                              ) : (
                                <span
                                  style={{
                                    opacity: 0.6,
                                    fontSize: 11,
                                    marginLeft: 8,
                                  }}
                                >
                                  {item.description}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Booking and loyalty quick link */}
              <div className="pw-nav-item">
                <button
                  className="pw-nav-link"
                  onClick={() => handleNavigate("/loyalty")}
                >
                  Loyalty & VIP Club
                </button>
              </div>

              {/* Company */}
              <div className="pw-nav-item">
                <button
                  className="pw-nav-link"
                  onClick={() => handleNavigate("/about")}
                >
                  About
                </button>
              </div>

              {/* Legal */}
              <div className="pw-nav-item">
                <button
                  className="pw-nav-link"
                  onClick={() => handleNavigate("/legal/terms")}
                >
                  Legal
                </button>
              </div>

              {/* Support */}
              <div className="pw-nav-item">
                <button
                  className="pw-nav-link"
                  onClick={() => handleNavigate("/support")}
                >
                  Support
                </button>
              </div>
            </nav>

            {/* Right stack: Hamburger on top, Language toggle below */}
            <div className="pw-right-stack">
              {/* Burger menu - top right */}
              <button
                className="pw-burger pw-burger-luxury"
                onClick={() => setIsMobileOpen(true)}
                aria-label="Open menu"
                data-testid="button-hamburger"
              >
                <span />
                <span />
                <span />
              </button>

              {/* Language toggle - below hamburger, not touching */}
              <select
                className="pw-language-select pw-language-luxury"
                value={currentLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                data-testid="select-language"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div 
        className={`pw-mobile-drawer ${isMobileOpen ? "open" : ""}`}
        aria-hidden={!isMobileOpen}
      >
        <div className="pw-mobile-top">
          <button
            className="pw-mobile-close"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close menu"
            tabIndex={isMobileOpen ? 0 : -1}
          >
            ✕
          </button>
        </div>

        <div className="pw-mobile-logo-wrap">
          <div className="pw-logo-circle pw-logo-circle-mobile">
            <span className="pw-logo-text">PetWash™</span>
          </div>
        </div>

        {/* Language + account row */}
        <div className="pw-mobile-lang-row">
          <select
            className="pw-language-select"
            value={currentLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <button
            className="pw-account-btn"
            onClick={() => handleNavigate("/account")}
          >
            <div className="pw-account-circle">👤</div>
          </button>
        </div>

        {/* Scrollable menu content */}
        <div className="pw-mobile-menu-scroll">
          {/* Platforms */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">Platforms</div>
            {PLATFORM_GROUPS.map((group) => (
              <div className="pw-mobile-group" key={group.id}>
                <div className="pw-mobile-group-title">{group.title}</div>
                <div className="pw-mobile-group-items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={
                        "pw-mobile-link" +
                        (item.frozen ? " pw-mega-link-frozen" : "")
                      }
                      onClick={() => {
                        if (item.frozen) return;
                        handleNavigate(item.href);
                      }}
                    >
                      <span>{item.label}</span>
                      {item.frozen && (
                        <span className="pw-pill-frozen">Frozen</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Loyalty & VIP Club + user items */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">
              Loyalty, booking and club
            </div>
            {MENU_STRUCTURE.forUsers.map((item) => (
              <button
                key={item.id}
                className="pw-mobile-link"
                onClick={() => handleNavigate(item.href)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Partners */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">Partners & franchise</div>
            {MENU_STRUCTURE.forPartners.map((item) => (
              <button
                key={item.id}
                className="pw-mobile-link"
                onClick={() => handleNavigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Company */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">Company</div>
            {MENU_STRUCTURE.company.map((item) => (
              <button
                key={item.id}
                className="pw-mobile-link"
                onClick={() => handleNavigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Legal */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">Legal</div>
            {MENU_STRUCTURE.legal.map((item) => (
              <button
                key={item.id}
                className="pw-mobile-link"
                onClick={() => handleNavigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Support */}
          <div className="pw-mobile-section">
            <div className="pw-mobile-section-title">Support</div>
            {MENU_STRUCTURE.support.map((item) => (
              <button
                key={item.id}
                className="pw-mobile-link"
                onClick={() => handleNavigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
