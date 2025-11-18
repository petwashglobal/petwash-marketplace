import React, { useState } from "react";

/**
 * PetWashHeaderNav
 *
 * - Premium global header + hamburger menu
 * - Desktop: clean top bar with hover mega dropdowns
 * - Mobile: full screen luxury drawer with deep nested sections
 * - Supports many platforms and countries under one Octopus style group
 * - All text and links are easy to change in NAV_SECTIONS only
 */

type NavItem = {
  label: string;
  href?: string;
  note?: string; // small helper text (for future, planned, etc)
  children?: NavItem[];
};

const NAV_SECTIONS: NavItem[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Wash Services",
    children: [
      { label: "Find a station", href: "/stations" },
      { label: "How PetWash works", href: "/how-it-works" },
      { label: "Prices & packages", href: "/pricing" },
      { label: "Organic shampoos", href: "/products/organic" },
      { label: "Accessibility & special needs", href: "/accessibility" },
    ],
  },
  {
    label: "Membership & Loyalty",
    children: [
      { label: "Join PetWash Club", href: "/club" },
      { label: "Loyalty points & rewards", href: "/loyalty" },
      { label: "Gift cards & e-gift", href: "/gift-cards" },
      { label: "Prepaid wash packs", href: "/prepaid" },
      { label: "Senior discount program", href: "/senior" },
    ],
  },
  {
    label: "Franchise & Partners",
    children: [
      { label: "Franchise overview", href: "/franchise" },
      { label: "City & council partners", href: "/partners/cities" },
      { label: "Vet & groomer partners", href: "/partners/vets" },
      { label: "Shopping centers & fuel stations", href: "/partners/locations" },
      { label: "Submit partnership enquiry", href: "/partners/enquiry" },
    ],
  },
  {
    label: "PetWash Group",
    children: [
      {
        label: "Israel – PetWash Ltd",
        note: "Head office & pilot projects",
        children: [
          { label: "About PetWash Ltd", href: "/group/israel/about" },
          { label: "Pilot locations", href: "/group/israel/pilots" },
          { label: "Councils & cities", href: "/group/israel/cities" },
        ],
      },
      {
        label: "Australia",
        note: "Partners & technology roots",
        children: [
          { label: "About Australia link", href: "/group/australia/about" },
          { label: "Technology & suppliers", href: "/group/australia/technology" },
        ],
      },
      {
        label: "Future markets",
        note: "Planned expansion only",
        children: [
          { label: "Europe – planned", href: "/group/future/europe" },
          { label: "Middle East – planned", href: "/group/future/middle-east" },
          { label: "Other regions – planned", href: "/group/future/other" },
        ],
      },
      {
        label: "PetWash Hub Platform",
        note: "Admin, data, and IoT",
        children: [
          { label: "Dashboard overview", href: "/hub/overview" },
          { label: "Franchise console", href: "/hub/franchise" },
          { label: "Service & field teams", href: "/hub/service" },
        ],
      },
      {
        label: "PetWash Academy",
        note: "Training & knowledge",
        children: [
          { label: "PetWash Academy home", href: "/academy" },
          { label: "Online courses", href: "/academy/courses" },
          { label: "Certification tracks", href: "/academy/certification" },
        ],
      },
    ],
  },
  {
    label: "Help & Support",
    children: [
      { label: "Live chat & WhatsApp", href: "/support/live" },
      { label: "FAQ", href: "/support/faq" },
      { label: "Report a station issue", href: "/support/report" },
      { label: "Contact PetWash", href: "/contact" },
      { label: "Legal & privacy", href: "/legal" },
    ],
  },
];

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function PetWashHeaderNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileOpenPath, setMobileOpenPath] = useState<string[]>([]);
  const [desktopOpenIndex, setDesktopOpenIndex] = useState<number | null>(null);

  return (
    <>
      {/* Sticky premium header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 flex items-center justify-between h-16">
          {/* Logo left */}
          <a href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
              PW
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm tracking-wide">
                PetWash<span className="align-top text-[0.6rem] ml-0.5">TM</span>
              </span>
              <span className="text-[0.65rem] text-slate-500">
                Self service pet wash stations
              </span>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {NAV_SECTIONS.map((section, index) => {
              const hasChildren = !!section.children && section.children.length > 0;
              return (
                <div
                  key={section.label}
                  className="relative"
                  onMouseEnter={() => hasChildren && setDesktopOpenIndex(index)}
                  onMouseLeave={() => hasChildren && setDesktopOpenIndex((prev) => (prev === index ? null : prev))}
                >
                  <a
                    href={section.href || "#"}
                    className={classNames(
                      "text-sm font-medium transition-colors",
                      "hover:text-slate-900",
                      desktopOpenIndex === index ? "text-slate-900" : "text-slate-600"
                    )}
                  >
                    {section.label}
                  </a>

                  {/* Mega dropdown */}
                  {hasChildren && desktopOpenIndex === index && (
                    <div className="absolute left-1/2 -translate-x-1/2 mt-3 w-[480px] rounded-2xl bg-white shadow-2xl border border-slate-100 p-4 grid grid-cols-2 gap-4">
                      {section.children!.map((child) => (
                        <div key={child.label} className="space-y-1">
                          <a
                            href={child.href || "#"}
                            className="block text-sm font-semibold text-slate-800 hover:text-black"
                          >
                            {child.label}
                          </a>
                          {child.note && (
                            <p className="text-xs text-slate-500">{child.note}</p>
                          )}
                          {child.children && (
                            <ul className="mt-1 space-y-1">
                              {child.children.map((grand) => (
                                <li key={grand.label}>
                                  <a
                                    href={grand.href || "#"}
                                    className="text-xs text-slate-600 hover:text-slate-900"
                                  >
                                    {grand.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="/signin"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Login
            </a>
            <a
              href="/signup"
              className="inline-flex items-center rounded-full border border-slate-900 px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Sign up
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center rounded-full border border-slate-300 h-9 w-9 text-slate-700"
            onClick={() => {
              setMobileOpen(true);
              setMobileOpenPath([]);
            }}
            aria-label="Open menu"
          >
            <span className="sr-only">Open menu</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
            >
              <path d="M4 7h16M4 12h16M4 17h10" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile full screen drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Dim background */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white flex flex-col shadow-2xl">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-black text-white flex items-center justify-center text-[0.65rem] font-bold">
                  PW
                </div>
                <span className="text-sm font-semibold">PetWash menu</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-700"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Scrollable navigation */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {NAV_SECTIONS.map((section) => {
                const pathHasSection = mobileOpenPath[0] === section.label;
                const hasChildren = !!section.children && section.children.length > 0;

                return (
                  <div key={section.label} className="border border-slate-100 rounded-2xl p-3">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left"
                      onClick={() => {
                        if (!hasChildren && section.href) {
                          window.location.href = section.href;
                        } else {
                          setMobileOpenPath((prev) =>
                            pathHasSection ? [] : [section.label]
                          );
                        }
                      }}
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {section.label}
                        </div>
                        {section.href && (
                          <div className="text-[0.7rem] text-slate-500">
                            Tap to open page
                          </div>
                        )}
                      </div>
                      {hasChildren && (
                        <span className="text-xs text-slate-500">
                          {pathHasSection ? "Hide" : "Show"}
                        </span>
                      )}
                    </button>

                    {/* Level 2 */}
                    {hasChildren && pathHasSection && (
                      <div className="mt-3 space-y-3">
                        {section.children!.map((child) => {
                          const childPathKey = `${section.label} > ${child.label}`;
                          const pathHasChild = mobileOpenPath[1] === childPathKey;
                          const hasGrand = !!child.children && child.children.length > 0;

                          return (
                            <div key={child.label} className="rounded-xl bg-slate-50 p-2">
                              <button
                                type="button"
                                className="w-full flex items-center justify-between text-left"
                                onClick={() => {
                                  if (!hasGrand && child.href) {
                                    window.location.href = child.href;
                                  } else {
                                    setMobileOpenPath((prev) => {
                                      if (pathHasChild) {
                                        return [section.label];
                                      }
                                      return [section.label, childPathKey];
                                    });
                                  }
                                }}
                              >
                                <div>
                                  <div className="text-[0.85rem] font-semibold text-slate-900">
                                    {child.label}
                                  </div>
                                  {child.note && (
                                    <div className="text-[0.7rem] text-slate-500">
                                      {child.note}
                                    </div>
                                  )}
                                </div>
                                {hasGrand && (
                                  <span className="text-[0.7rem] text-slate-500">
                                    {pathHasChild ? "Hide" : "More"}
                                  </span>
                                )}
                              </button>

                              {/* Level 3 */}
                              {hasGrand && pathHasChild && (
                                <ul className="mt-2 space-y-1">
                                  {child.children!.map((grand) => (
                                    <li key={grand.label}>
                                      <button
                                        type="button"
                                        className="w-full text-left text-[0.8rem] text-slate-700 py-1 px-1 rounded-lg hover:bg-white"
                                        onClick={() => {
                                          if (grand.href) {
                                            window.location.href = grand.href;
                                          }
                                        }}
                                      >
                                        {grand.label}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom buttons */}
            <div className="border-t border-slate-100 px-4 py-3 flex gap-2">
              <a
                href="/signin"
                className="flex-1 rounded-full border border-slate-300 text-sm text-center py-2 text-slate-700"
              >
                Login
              </a>
              <a
                href="/signup"
                className="flex-1 rounded-full bg-black text-white text-sm text-center py-2"
              >
                Sign up
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
