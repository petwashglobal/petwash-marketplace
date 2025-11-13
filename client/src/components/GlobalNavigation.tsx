/**
 * Global Navigation Component
 * 
 * Multi-layer hamburger menu using navigation structure from shared/petwashGlobal.ts
 * Supports role-based filtering, mobile/tablet/desktop responsive, multi-language
 * 
 * Used across all 6 Pet Wash Ltd platforms:
 * - K9000 Wash
 * - Walk My Pet
 * - The Sitter Suite  
 * - PetTrek
 * - Groomers
 * - Pet Wash Hub
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, ChevronRight, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  platformNavigation,
  petWashPlatforms,
  getPlatformByPath,
  getAccessibleNavItems,
  type PlatformId,
  type UserRole,
  type NavItem,
} from "@/shared/petwashGlobal";
import { useLanguage } from "@/lib/languageStore";

interface GlobalNavigationProps {
  userRole?: UserRole;
  className?: string;
  variant?: "hamburger" | "sidebar";
  testId?: string;
}

export function GlobalNavigation({
  userRole,
  className = "",
  variant = "hamburger",
  testId = "global-navigation",
}: GlobalNavigationProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { t } = useLanguage();

  // Detect current platform from URL
  const currentPlatform = getPlatformByPath(location);
  const platformId = currentPlatform?.id as PlatformId | undefined;

  // Global navigation fallback for non-platform pages (home, about, contact, etc.)
  // Using proper translation keys for multilingual support
  const globalNavItems: NavItem[] = [
    { id: "home", label: t("nav.home"), path: "/" },
    { id: "about", label: t("header.aboutUs"), path: "/about" },
    { id: "services", label: t("header.ourServices"), path: "/our-service" },
    { id: "franchise", label: t("header.franchiseOpportunities"), path: "/franchise" },
    { id: "contact", label: t("nav.contact"), path: "/contact" },
    { id: "gallery", label: t("nav.gallery"), path: "/gallery" },
  ];

  // Get accessible navigation items for current platform and user role
  const navItems = platformId
    ? getAccessibleNavItems(platformId, userRole)
    : globalNavItems;

  if (variant === "hamburger") {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={`relative ${className}`}
            data-testid={`${testId}-trigger`}
            aria-label={t("Open navigation menu")}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className="w-[85vw] max-w-[400px] overflow-y-auto"
          data-testid={`${testId}-sheet`}
        >
          <SheetHeader className="border-b pb-4 mb-4">
            <SheetTitle>
              {currentPlatform?.displayName || t("Navigation")}
            </SheetTitle>
          </SheetHeader>

          <nav
            aria-label="Platform navigation"
            className="space-y-1"
            data-testid={`${testId}-nav`}
          >
            {navItems.map((item) => (
              <NavItemComponent
                key={item.id}
                item={item}
                onNavigate={() => setOpen(false)}
                currentPath={location}
                depth={0}
              />
            ))}
          </nav>

          {/* Platform Switcher - Derived from petwashGlobal.ts */}
          {currentPlatform && (
            <div className="mt-8 pt-4 border-t">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                {t("Other Platforms")}
              </div>
              <div className="space-y-1">
                {petWashPlatforms
                  .filter((p) => p.enabled)
                  .map((platform) => (
                    <PlatformLink
                      key={platform.id}
                      href={platform.basePath}
                      label={platform.displayName}
                      active={platformId === platform.id}
                      onClick={() => setOpen(false)}
                    />
                  ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  // Sidebar variant for desktop layouts
  return (
    <nav
      aria-label="Platform navigation"
      className={`space-y-1 ${className}`}
      data-testid={`${testId}-sidebar`}
    >
      {navItems.map((item) => (
        <NavItemComponent
          key={item.id}
          item={item}
          onNavigate={() => {}}
          currentPath={location}
          depth={0}
        />
      ))}
    </nav>
  );
}

interface NavItemComponentProps {
  item: NavItem;
  onNavigate: () => void;
  currentPath: string;
  depth: number;
}

function NavItemComponent({
  item,
  onNavigate,
  currentPath,
  depth,
}: NavItemComponentProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.path === currentPath;
  
  // Deterministic indent classes (Tailwind-safe)
  const indentClassMap: Record<number, string> = {
    0: "",
    1: "ml-4",
    2: "ml-8",
    3: "ml-12",
  };
  const indentClass = indentClassMap[depth] || "";

  // If has children, show expandable section
  if (hasChildren) {
    const childrenId = `${item.id}-children`;
    
    return (
      <div className="space-y-1" data-testid={`nav-item-${item.id}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between py-2 px-3 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${indentClass}`}
          data-testid={`nav-item-${item.id}-toggle`}
          aria-expanded={expanded}
          aria-controls={childrenId}
        >
          <span className="font-medium">{item.label}</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {expanded && item.children && (
          <div 
            id={childrenId} 
            className="space-y-1 pl-4"
            role="region"
            aria-label={`${item.label} submenu`}
          >
            {item.children.map((child) => (
              <NavItemComponent
                key={child.id}
                item={child}
                onNavigate={onNavigate}
                currentPath={currentPath}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf node with link
  if (item.path) {
    return (
      <Link
        href={item.path}
        onClick={onNavigate}
        className={`block py-2 px-3 text-sm rounded-md transition-colors ${indentClass} ${
          isActive
            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold"
            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        }`}
        data-testid={`nav-item-${item.id}-link`}
      >
        {item.label}
      </Link>
    );
  }

  // No path and no children - just a label (rare)
  return (
    <div
      className={`py-2 px-3 text-sm text-gray-500 dark:text-gray-400 ${indentClass}`}
      data-testid={`nav-item-${item.id}-label`}
    >
      {item.label}
    </div>
  );
}

interface PlatformLinkProps {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function PlatformLink({ href, label, active, onClick }: PlatformLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block py-2 px-3 text-sm rounded-md transition-colors ${
        active
          ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold"
          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
      }`}
      data-testid={`platform-link-${href.replace("/", "")}`}
    >
      {label}
    </Link>
  );
}

export default GlobalNavigation;
