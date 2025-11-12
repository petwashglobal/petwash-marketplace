import { X, User, LogOut } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { type Language } from '@/lib/i18n';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { MultiLayerNavigation } from '@/components/MultiLayerNavigation';
import { navigationTree } from '@/lib/navigationStructure';
import { useEffect, useState } from 'react';

interface EnhancedMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

/**
 * Enhanced Mobile Menu - Pure White Luxury Design
 * 
 * Features:
 * - Multi-layer hierarchical navigation (all 6+ platforms)
 * - Role-based filtering (customer, provider, admin)
 * - Auto-expand active route
 * - Pure white minimalist aesthetic
 * - Always slides from RIGHT (per design spec)
 */
export function EnhancedMobileMenu({ isOpen, onClose, language }: EnhancedMobileMenuProps) {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const [userRoles, setUserRoles] = useState<string[]>(['customer']);

  // Determine user roles from user object or claims
  useEffect(() => {
    if (user) {
      // TODO: Fetch user roles from Firestore or custom claims
      // For now, default to customer
      setUserRoles(['customer', 'provider']); // Temp: show all features
    } else {
      setUserRoles(['customer']); // Guest users see public content
    }
  }, [user]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    await signOut(auth);
    onClose();
    setLocation('/');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true"
      onClick={onClose}
    >
      {/* Menu Drawer - ALWAYS slides from RIGHT (per design spec) */}
      <div 
        className={`
          fixed top-0 right-0 h-full
          bg-white shadow-2xl
          transform transition-transform duration-300 ease-out
          overflow-y-auto
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'clamp(300px, 85vw, 480px)',
        }}
        data-testid="enhanced-mobile-menu"
      >
        {/* Header - Sticky */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pet Wash™</h2>
              {user && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {user.displayName || user.email}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
              data-testid="menu-close-button"
            >
              <X className="h-5 w-5 text-gray-600" />
            </Button>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="p-4">
          <MultiLayerNavigation
            items={navigationTree}
            language={language}
            currentUserRoles={userRoles}
            onNavigate={onClose}
          />
        </div>

        {/* Footer - User Actions */}
        {user && (
          <>
            <Separator className="my-4" />
            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  setLocation('/settings');
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                data-testid="menu-profile-button"
              >
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-base font-medium text-gray-700">
                  {language === 'he' ? 'פרופיל' : 'Profile'}
                </span>
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors text-left text-red-600"
                data-testid="menu-logout-button"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-base font-medium">
                  {language === 'he' ? 'יציאה' : 'Log Out'}
                </span>
              </button>
            </div>
          </>
        )}

        {/* Login Button (for guests) */}
        {!user && (
          <>
            <Separator className="my-4" />
            <div className="p-4">
              <button
                onClick={() => {
                  setLocation('/signin');
                  onClose();
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                data-testid="menu-signin-button"
              >
                {language === 'he' ? 'התחברות' : 'Sign In'}
              </button>
            </div>
          </>
        )}

        {/* Footer Text */}
        <div className="p-6 text-center text-xs text-gray-500">
          <p>Pet Wash Ltd © {new Date().getFullYear()}</p>
          <p className="mt-1">All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
}
