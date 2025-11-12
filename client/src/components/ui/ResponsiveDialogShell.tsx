/**
 * Responsive Dialog Shell - Universal Modal Component
 * 
 * Production-quality responsive wrapper for ALL Pet Wash™ modals.
 * Ensures flawless display across:
 * - All mobile devices (iPhone, Samsung, etc.)
 * - All tablets (iPad, iPad Pro, etc.)
 * - All laptops (13", 17", etc.)
 * - Portrait AND landscape orientations
 * 
 * Features:
 * - Dynamic viewport height calculation
 * - Safe area insets (iOS notch/home indicator)
 * - Keyboard avoidance on mobile
 * - Automatic scroll handling
 * - Responsive image support
 * - Zero layout shift
 * - Zero content cut-off
 */

import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ResponsiveDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * Responsive Dialog Shell
 * 
 * Usage:
 * ```tsx
 * <ResponsiveDialogShell
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="My Dialog"
 *   size="md"
 * >
 *   <YourContent />
 * </ResponsiveDialogShell>
 * ```
 */
export function ResponsiveDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
  className,
  contentClassName,
}: ResponsiveDialogShellProps) {
  
  // Size mapping to CSS custom properties
  const sizeClasses = {
    xs: 'max-w-[var(--modal-max-w-xs)]',
    sm: 'max-w-[var(--modal-max-w-sm)]',
    md: 'max-w-[var(--modal-max-w-md)]',
    lg: 'max-w-[var(--modal-max-w-lg)]',
    xl: 'max-w-[var(--modal-max-w-xl)]',
    full: 'max-w-[var(--modal-max-w-full)]',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Responsive width
          sizeClasses[size],
          'w-[95vw]',
          
          // Responsive height - portrait vs landscape
          'max-h-[var(--modal-max-h-portrait)]',
          'landscape:max-h-[var(--modal-max-h-landscape)]',
          
          // Safe area padding
          'safe-area-padding',
          
          // Scroll handling
          'overflow-hidden',
          'flex flex-col',
          
          // Spacing
          'p-4 sm:p-6',
          'gap-4',
          
          // Visual
          'rounded-lg sm:rounded-xl',
          'shadow-2xl',
          
          // Animations
          'transition-all duration-300',
          
          className
        )}
        aria-describedby={description ? 'dialog-description' : undefined}
      >
        {/* Header Section (Fixed) */}
        {(title || description) && (
          <DialogHeader className="flex-shrink-0">
            {title && (
              <DialogTitle className="text-lg sm:text-xl font-bold">
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription id="dialog-description" className="text-sm sm:text-base">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        {/* Content Section (Scrollable) */}
        <div
          className={cn(
            // Scrollable container
            'responsive-scroll',
            'flex-1',
            'overflow-y-auto overflow-x-hidden',
            
            // Spacing
            'px-1',
            'py-2',
            
            // Ensure all images are responsive
            '[&_img]:responsive-media',
            '[&_video]:responsive-media',
            
            contentClassName
          )}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Responsive Alert Dialog Shell
 * 
 * Similar to ResponsiveDialogShell but for alert-style dialogs
 * (confirmations, warnings, etc.)
 */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ResponsiveAlertDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function ResponsiveAlertDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'sm',
  className,
}: ResponsiveAlertDialogShellProps) {
  
  const sizeClasses = {
    xs: 'max-w-[var(--modal-max-w-xs)]',
    sm: 'max-w-[var(--modal-max-w-sm)]',
    md: 'max-w-[var(--modal-max-w-md)]',
    lg: 'max-w-[var(--modal-max-w-lg)]',
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          sizeClasses[size],
          'w-[95vw]',
          'max-h-[var(--modal-max-h-portrait)]',
          'landscape:max-h-[var(--modal-max-h-landscape)]',
          'safe-area-padding',
          'p-4 sm:p-6',
          'rounded-lg sm:rounded-xl',
          className
        )}
      >
        {(title || description) && (
          <AlertDialogHeader>
            {title && <AlertDialogTitle>{title}</AlertDialogTitle>}
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
        )}
        <div className="responsive-scroll overflow-y-auto [&_img]:responsive-media">
          {children}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
