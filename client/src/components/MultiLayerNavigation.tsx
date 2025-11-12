import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import type { MenuItem } from '@/lib/navigationStructure';
import { filterNavigationByRole } from '@/lib/navigationStructure';
import { cn } from '@/lib/utils';

// FIX #1: Static Tailwind classes for nesting levels (Tailwind can't generate dynamic classes)
const LEVEL_PADDING: Record<number, string> = {
  0: 'pl-4',
  1: 'pl-8',
  2: 'pl-12',
  3: 'pl-16',
  4: 'pl-20',
  5: 'pl-24',
};

interface NavigationItemProps {
  item: MenuItem;
  level: number;
  language: string;
  currentUserRoles: string[]; // Add roles prop for recursive filtering
  onNavigate?: () => void;
}

function NavigationItem({ item, level, language, currentUserRoles, onNavigate }: NavigationItemProps) {
  // FIX: Check if current user has permission to see this item
  if (item.userRoles && item.userRoles.length > 0) {
    const hasRequiredRole = item.userRoles.some(role => currentUserRoles.includes(role));
    if (!hasRequiredRole) {
      return null; // Hide item if user doesn't have required role
    }
  }

  const [location] = useLocation();
  const isActive = item.path === location;
  
  const hasChildren = item.children && item.children.length > 0;
  const label = language === 'he' && item.labelHe ? item.labelHe : item.label;
  
  // FIX #3: Auto-expand when active path is in this tree
  const isActiveTree = (() => {
    if (isActive) return true;
    if (!hasChildren) return false;
    
    const checkChildren = (children: MenuItem[]): boolean => {
      return children.some(child => {
        if (child.path === location) return true;
        if (child.children) return checkChildren(child.children);
        return false;
      });
    };
    
    return checkChildren(item.children!);
  })();

  // Auto-open accordion if active route is within this tree
  const [isOpen, setIsOpen] = useState(isActiveTree || level === 0);
  
  // Re-open when active path changes
  useEffect(() => {
    if (isActiveTree) {
      setIsOpen(true);
    }
  }, [isActiveTree, location]);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else if (item.path) {
      onNavigate?.();
    }
  };

  // Get padding class from static map
  const paddingLeft = LEVEL_PADDING[Math.min(level, 5)] || LEVEL_PADDING[5];

  return (
    <div className="w-full">
      {/* Menu Item */}
      {item.path && !hasChildren ? (
        <Link href={item.path} onClick={onNavigate}>
          <button
            className={cn(
              'w-full flex items-center justify-between gap-3',
              paddingLeft,
              'pr-4 py-3 rounded-lg',
              'text-left transition-all duration-200',
              'hover:bg-gray-50 active:scale-[0.98]',
              isActive && 'bg-blue-50 text-blue-600 font-medium',
              !isActive && 'text-gray-700'
            )}
            data-testid={`nav-item-${item.id}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {item.icon && (
                <item.icon className={cn(
                  'flex-shrink-0',
                  level === 0 ? 'w-5 h-5' : 'w-4 h-4',
                  isActive ? 'text-blue-600' : 'text-gray-500'
                )} />
              )}
              <span className={cn(
                'truncate',
                level === 0 ? 'text-base font-medium' : 'text-sm'
              )}>
                {label}
              </span>
            </div>
            
            {/* Badges */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.isNew && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                  NEW
                </span>
              )}
              {item.isComingSoon && (
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Soon
                </span>
              )}
              {item.badge && item.badge > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-medium bg-red-500 text-white rounded-full">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
          </button>
        </Link>
      ) : (
        <button
          onClick={handleClick}
          className={cn(
            'w-full flex items-center justify-between gap-3',
            paddingLeft,
            'pr-4 py-3 rounded-lg',
            'text-left transition-all duration-200',
            'hover:bg-gray-50 active:scale-[0.98]',
            isActiveTree && 'bg-gray-50',
            'text-gray-700'
          )}
          data-testid={`nav-group-${item.id}`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {item.icon && (
              <item.icon className={cn(
                'flex-shrink-0',
                level === 0 ? 'w-5 h-5' : 'w-4 h-4',
                'text-gray-500'
              )} />
            )}
            <span className={cn(
              'truncate',
              level === 0 ? 'text-base font-semibold' : 'text-sm font-medium'
            )}>
              {label}
            </span>
          </div>
          
          {/* Badges + Chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.isNew && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                NEW
              </span>
            )}
            {item.isComingSoon && (
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Soon
              </span>
            )}
            {item.badge && item.badge > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-medium bg-red-500 text-white rounded-full">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {hasChildren && (
              isOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )
            )}
          </div>
        </button>
      )}

      {/* Children (Accordion) */}
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
          {filterNavigationByRole(item.children!, currentUserRoles).map((child) => (
            <NavigationItem
              key={child.id}
              item={child}
              level={level + 1}
              language={language}
              currentUserRoles={currentUserRoles}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MultiLayerNavigationProps {
  items: MenuItem[];
  language: string;
  currentUserRoles?: string[]; // FIX #2: Add role prop for filtering
  onNavigate?: () => void;
  className?: string;
}

export function MultiLayerNavigation({
  items,
  language,
  currentUserRoles = ['customer'], // Default to customer role
  onNavigate,
  className,
}: MultiLayerNavigationProps) {
  // FIX #2: Filter navigation by user role
  const filteredItems = filterNavigationByRole(items, currentUserRoles);

  return (
    <nav className={cn('w-full space-y-1', className)}>
      {filteredItems.map((item) => (
        <NavigationItem
          key={item.id}
          item={item}
          level={0}
          language={language}
          currentUserRoles={currentUserRoles}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
