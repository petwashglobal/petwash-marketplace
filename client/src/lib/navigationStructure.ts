import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Droplet,
  Dog,
  HomeIcon,
  Car,
  Scissors,
  Stethoscope,
  ShoppingCart,
  Phone,
  Settings,
  Award,
  Wallet,
  BarChart3,
  HelpCircle,
  CreditCard,
  Calendar,
  MapPin,
  QrCode,
  Gift,
  FileText,
  Clock,
  Star,
  MessageSquare,
  Users,
  Shield,
  Globe,
  Bell,
  User,
  Lock,
  Smartphone,
  PackageOpen,
} from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  labelHe?: string; // Hebrew translation
  icon?: LucideIcon;
  path?: string;
  children?: MenuItem[];
  badge?: number; // Notification count
  userRoles?: string[]; // Show only for specific roles (customer, provider, admin)
  isNew?: boolean; // Show "NEW" badge
  isComingSoon?: boolean; // Show "Coming Soon" badge
}

/**
 * Pet Wash Ltd - Super App Navigation Structure
 * 
 * Multi-layer hierarchical menu supporting:
 * - 6+ independent business platforms
 * - Customer, Provider, Admin views
 * - Mobile hamburger + Desktop mega menu
 * - Infinite nesting depth
 */

export const navigationTree: MenuItem[] = [
  // =============================================
  // 🏠 PetWash Hub (K9000 Wash Stations)
  // =============================================
  {
    id: 'petwash-hub',
    label: 'PetWash Hub',
    labelHe: 'מרכז רחצת PetWash',
    icon: Droplet,
    children: [
      {
        id: 'wash-packages',
        label: 'Wash Packages & Pricing',
        labelHe: 'חבילות רחיצה ומחירים',
        icon: PackageOpen,
        children: [
          {
            id: 'individual-wash',
            label: 'Individual Wash',
            labelHe: 'רחיצה בודדת',
            path: '/packages',
          },
          {
            id: 'package-deals',
            label: 'Package Deals (3, 5, 10 washes)',
            labelHe: 'חבילות (3, 5, 10 רחיצות)',
            path: '/packages#deals',
          },
          {
            id: 'subscriptions',
            label: 'Monthly Subscriptions',
            labelHe: 'מנויים חודשיים',
            path: '/subscriptions',
          },
          {
            id: 'corporate-packages',
            label: 'Corporate Packages',
            labelHe: 'חבילות ארגוניות',
            path: '/packages#corporate',
            userRoles: ['admin', 'corporate'],
          },
        ],
      },
      {
        id: 'membership-loyalty',
        label: 'Membership & Loyalty',
        labelHe: 'חברות ונאמנות',
        icon: Award,
        children: [
          {
            id: 'tier-status',
            label: 'Tier Status Dashboard',
            labelHe: 'לוח מצב דרגות',
            path: '/loyalty/dashboard',
          },
          {
            id: 'points-balance',
            label: 'Points Balance',
            labelHe: 'יתרת נקודות',
            path: '/loyalty',
          },
          {
            id: 'tier-benefits',
            label: 'Tier Benefits',
            labelHe: 'הטבות דרגות',
            path: '/loyalty#benefits',
          },
          {
            id: 'refer-earn',
            label: 'Refer & Earn',
            labelHe: 'הפנה וקבל',
            path: '/loyalty#referrals',
          },
          {
            id: 'egift-cards',
            label: 'E-Gift Cards',
            labelHe: 'כרטיסי מתנה דיגיטליים',
            path: '/buy-gift-card',
          },
        ],
      },
      {
        id: 'locations',
        label: 'Locations & Availability',
        labelHe: 'מיקומים וזמינות',
        icon: MapPin,
        children: [
          {
            id: 'find-station',
            label: 'Find Nearest Station',
            labelHe: 'מצא תחנה קרובה',
            path: '/locations',
          },
          {
            id: 'live-queue',
            label: 'Live Queue Status',
            labelHe: 'סטטוס תור חי',
            path: '/locations#queue',
          },
          {
            id: 'station-features',
            label: 'Station Features & Amenities',
            labelHe: 'תכונות ושירותים',
            path: '/our-service',
          },
          {
            id: 'opening-hours',
            label: 'Opening Hours',
            labelHe: 'שעות פתיחה',
            path: '/locations#hours',
          },
        ],
      },
      {
        id: 'quick-wash',
        label: 'Pre-Pay & Quick Wash',
        labelHe: 'תשלום מראש ורחיצה מהירה',
        icon: QrCode,
        children: [
          {
            id: 'buy-credit',
            label: 'Buy Wash Credit',
            labelHe: 'קנה קרדיט רחיצה',
            path: '/my-wallet',
          },
          {
            id: 'qr-start',
            label: 'QR Code Quick Start',
            labelHe: 'התחלה מהירה QR',
            path: '/dashboard#qr',
          },
          {
            id: 'saved-payment',
            label: 'Saved Payment Methods',
            labelHe: 'שיטות תשלום שמורות',
            path: '/my-wallet#payment-methods',
          },
        ],
      },
      {
        id: 'wash-history',
        label: 'Your Wash History',
        labelHe: 'היסטוריית רחיצות',
        icon: Clock,
        path: '/dashboard#history',
      },
    ],
  },

  // =============================================
  // 🐕 Walk My Pet™
  // =============================================
  {
    id: 'walk-my-pet',
    label: 'Walk My Pet™',
    labelHe: 'Walk My Pet™',
    icon: Dog,
    children: [
      {
        id: 'find-walker',
        label: 'Find & Book Walker',
        labelHe: 'מצא והזמן מטייל',
        icon: Users,
        children: [
          {
            id: 'available-now',
            label: 'Available Walkers Now',
            labelHe: 'מטיילים זמינים כעת',
            path: '/walk-my-pet',
          },
          {
            id: 'schedule-walk',
            label: 'Schedule Walk',
            labelHe: 'תזמן טיול',
            path: '/walk-my-pet#schedule',
          },
          {
            id: 'recurring-walks',
            label: 'Recurring Walk Plans',
            labelHe: 'תוכניות טיול קבועות',
            path: '/walk-my-pet#recurring',
          },
        ],
      },
      {
        id: 'live-tracking',
        label: 'Live Tracking',
        labelHe: 'מעקב חי',
        icon: MapPin,
        children: [
          {
            id: 'track-current',
            label: 'Track Current Walk',
            labelHe: 'עקוב אחר הטיול הנוכחי',
            path: '/track-my-pet',
          },
          {
            id: 'gps-map',
            label: 'GPS Map View',
            labelHe: 'תצוגת מפה GPS',
            path: '/track-my-pet#map',
          },
        ],
      },
      {
        id: 'walker-profiles',
        label: 'Walker Profiles',
        labelHe: 'פרופילי מטיילים',
        icon: User,
        path: '/walk-my-pet#walkers',
      },
      {
        id: 'pricing-walk',
        label: 'Pricing & Payments',
        labelHe: 'תמחור ותשלומים',
        icon: CreditCard,
        children: [
          {
            id: 'walk-rates',
            label: 'Walk Rates (15min, 30min, 60min)',
            labelHe: 'מחירי טיולים (15 דק, 30 דק, 60 דק)',
            path: '/walk-my-pet#pricing',
          },
          {
            id: 'subscription-plans',
            label: 'Subscription Plans',
            labelHe: 'תוכניות מנוי',
            path: '/subscriptions#walk',
          },
        ],
      },
      {
        id: 'walk-history',
        label: 'Walk History',
        labelHe: 'היסטוריית טיולים',
        icon: Clock,
        path: '/walk-my-pet/owner/dashboard',
        userRoles: ['customer'],
      },
      {
        id: 'walker-dashboard',
        label: 'Walker Dashboard',
        labelHe: 'לוח בקרה למטייל',
        icon: BarChart3,
        path: '/walk-my-pet/walker/dashboard',
        userRoles: ['walker', 'provider'],
      },
    ],
  },

  // =============================================
  // 🏡 The Sitter Suite™
  // =============================================
  {
    id: 'sitter-suite',
    label: 'The Sitter Suite™',
    labelHe: 'The Sitter Suite™',
    icon: HomeIcon,
    children: [
      {
        id: 'sitter-overview',
        label: 'Sitter Suite Overview',
        labelHe: 'סקירת Sitter Suite',
        path: '/sitter-suite/overview',
      },
      {
        id: 'browse-sitters',
        label: 'Browse Sitters',
        labelHe: 'עיין במטפלים',
        icon: Users,
        path: '/sitter-suite/browse-sitters',
      },
      {
        id: 'sitter-booking-flow',
        label: 'Book Sitting Service',
        labelHe: 'הזמן שירות שמרטפות',
        icon: Calendar,
        path: '/sitter-suite/booking-flow',
      },
      {
        id: 'find-host',
        label: 'Find a Host',
        labelHe: 'מצא מארח',
        icon: Users,
        children: [
          {
            id: 'search-location',
            label: 'Search by Location',
            labelHe: 'חפש לפי מיקום',
            path: '/sitter-suite',
          },
          {
            id: 'browse-categories',
            label: 'Browse Host Categories',
            labelHe: 'עיין בקטגוריות מארחים',
            path: '/sitter-suite#categories',
          },
        ],
      },
      {
        id: 'sitter-detail',
        label: 'Sitter Profile Detail',
        labelHe: 'פרטי פרופיל מטפל',
        icon: User,
        path: '/sitter-suite/sitter/:id',
      },
      {
        id: 'host-profiles',
        label: 'Host Profiles',
        labelHe: 'פרופילי מארחים',
        icon: User,
        path: '/sitter-suite#hosts',
      },
      {
        id: 'booking-sitter',
        label: 'Booking System',
        labelHe: 'מערכת הזמנות',
        icon: Calendar,
        children: [
          {
            id: 'request-book',
            label: 'Request to Book',
            labelHe: 'בקשה להזמנה',
            path: '/sitter-suite#book',
          },
          {
            id: 'instant-book',
            label: 'Instant Book',
            labelHe: 'הזמנה מיידית',
            path: '/sitter-suite#instant',
          },
        ],
      },
      {
        id: 'messaging-sitter',
        label: 'Messaging Center',
        labelHe: 'מרכז הודעות',
        icon: MessageSquare,
        path: '/inbox',
      },
      {
        id: 'pricing-sitter',
        label: 'Pricing & Payment',
        labelHe: 'תמחור ותשלום',
        icon: CreditCard,
        path: '/sitter-suite#pricing',
      },
      {
        id: 'bookings-sitter',
        label: 'Your Bookings',
        labelHe: 'ההזמנות שלך',
        icon: Calendar,
        path: '/sitter-suite/owner/dashboard',
        userRoles: ['customer'],
      },
      {
        id: 'become-host',
        label: 'Become a Host',
        labelHe: 'הפוך למארח',
        icon: Star,
        path: '/provider-onboarding?platform=sitter',
        userRoles: ['provider', 'admin'],
      },
    ],
  },

  // =============================================
  // 🚗 PetTrek™ (Pet Transport)
  // =============================================
  {
    id: 'pettrek',
    label: 'PetTrek™',
    labelHe: 'PetTrek™',
    icon: Car,
    children: [
      {
        id: 'track-trip',
        label: 'Track Trip (Live)',
        labelHe: 'עקוב אחר נסיעה (חי)',
        icon: MapPin,
        path: '/pettrek/track-trip',
      },
      {
        id: 'pettrek-customer-dashboard',
        label: 'Customer Dashboard',
        labelHe: 'לוח בקרה לקוח',
        icon: BarChart3,
        path: '/pettrek/customer/dashboard',
        userRoles: ['customer'],
      },
      {
        id: 'driver-dashboard',
        label: 'Driver Dashboard',
        labelHe: 'לוח בקרה לנהג',
        icon: BarChart3,
        path: '/pettrek/driver/dashboard',
        userRoles: ['driver', 'provider'],
      },
      {
        id: 'provider-dashboard-trek',
        label: 'Provider Dashboard',
        labelHe: 'לוח בקרה ספק',
        icon: BarChart3,
        path: '/pettrek/provider/dashboard',
        userRoles: ['provider', 'admin'],
      },
      {
        id: 'pricing-trek',
        label: 'Pricing & Payments',
        labelHe: 'תמחור ותשלומים',
        icon: CreditCard,
        path: '/pettrek#pricing',
      },
    ],
  },

  // =============================================
  // ✂️ Grooming Marketplace
  // =============================================
  {
    id: 'groomers',
    label: 'Grooming Marketplace',
    labelHe: 'שוק מטפחים',
    icon: Scissors,
    children: [
      {
        id: 'find-groomer',
        label: 'Find & Book Groomer',
        labelHe: 'מצא והזמן מטפח',
        icon: Users,
        children: [
          {
            id: 'search-groomers',
            label: 'Search Groomers',
            labelHe: 'חפש מטפחים',
            path: '/groomers',
          },
          {
            id: 'grooming-services',
            label: 'Grooming Services',
            labelHe: 'שירותי טיפוח',
            path: '/groomers#services',
          },
          {
            id: 'mobile-grooming',
            label: 'Mobile Grooming',
            labelHe: 'טיפוח נייד',
            path: '/groomers#mobile',
          },
        ],
      },
      {
        id: 'groomer-profiles',
        label: 'Groomer Profiles',
        labelHe: 'פרופילי מטפחים',
        icon: User,
        path: '/groomers#profiles',
      },
      {
        id: 'booking-grooming',
        label: 'Booking System',
        labelHe: 'מערכת הזמנות',
        icon: Calendar,
        children: [
          {
            id: 'book-grooming',
            label: 'Book Grooming Session',
            labelHe: 'הזמן מפגש טיפוח',
            path: '/groomers/book',
          },
          {
            id: 'grooming-packages',
            label: 'Grooming Packages',
            labelHe: 'חבילות טיפוח',
            path: '/groomers#packages',
          },
        ],
      },
      {
        id: 'pricing-grooming',
        label: 'Pricing & Add-ons',
        labelHe: 'תמחור ותוספות',
        icon: CreditCard,
        path: '/groomers#pricing',
      },
      {
        id: 'grooming-history',
        label: 'Grooming History',
        labelHe: 'היסטוריית טיפוח',
        icon: Clock,
        path: '/groomers/customer/dashboard',
        userRoles: ['customer'],
      },
      {
        id: 'groomer-dashboard',
        label: 'Groomer Dashboard',
        labelHe: 'לוח בקרה למטפח',
        icon: BarChart3,
        path: '/groomers/provider/dashboard',
        userRoles: ['groomer', 'provider'],
      },
    ],
  },

  // =============================================
  // 🌟 Shared Pet Services Foundation
  // =============================================
  {
    id: 'shared-services',
    label: 'Shared Pet Services',
    labelHe: 'שירותי חיות מחמד משותפים',
    icon: Home,
    children: [
      {
        id: 'programs-grants',
        label: 'Programs & Grants',
        labelHe: 'תוכניות ומענקים',
        icon: Award,
        children: [
          {
            id: 'community-programs',
            label: 'Community Programs',
            labelHe: 'תוכניות קהילתיות',
            path: '/shared-services/programs',
          },
          {
            id: 'grant-applications',
            label: 'Grant Applications',
            labelHe: 'בקשות למענק',
            path: '/shared-services/grants',
          },
          {
            id: 'partnerships',
            label: 'Partner Services',
            labelHe: 'שירותי שותפים',
            path: '/shared-services/partners',
          },
        ],
      },
      {
        id: 'volunteering',
        label: 'Community Volunteering',
        labelHe: 'התנדבות קהילתית',
        icon: Users,
        children: [
          {
            id: 'volunteer-opportunities',
            label: 'Volunteer Opportunities',
            labelHe: 'הזדמנויות להתנדבות',
            path: '/shared-services/volunteer',
          },
          {
            id: 'volunteer-dashboard',
            label: 'Volunteer Dashboard',
            labelHe: 'לוח בקרה למתנדב',
            path: '/shared-services/volunteer/dashboard',
            userRoles: ['volunteer'],
          },
        ],
      },
      {
        id: 'knowledge-base',
        label: 'Knowledge Base',
        labelHe: 'מאגר ידע',
        icon: FileText,
        children: [
          {
            id: 'pet-care-guides',
            label: 'Pet Care Guides',
            labelHe: 'מדריכי טיפול בחיות מחמד',
            path: '/shared-services/guides',
          },
          {
            id: 'training-resources',
            label: 'Training Resources',
            labelHe: 'משאבי אימון',
            path: '/shared-services/training',
          },
          {
            id: 'compliance-docs',
            label: 'Compliance Documents',
            labelHe: 'מסמכי ציות',
            path: '/shared-services/compliance',
            userRoles: ['provider', 'admin'],
          },
        ],
      },
      {
        id: 'impact-dashboard',
        label: 'Impact Dashboard',
        labelHe: 'לוח מצב השפעה',
        icon: BarChart3,
        path: '/shared-services/impact',
      },
    ],
  },

  // =============================================
  // ⚙️ Account Settings
  // =============================================
  {
    id: 'settings',
    label: 'Account Settings',
    labelHe: 'הגדרות חשבון',
    icon: Settings,
    children: [
      {
        id: 'profile',
        label: 'Profile',
        labelHe: 'פרופיל',
        icon: User,
        path: '/settings',
      },
      {
        id: 'my-pets',
        label: 'My Pets',
        labelHe: 'חיות המחמד שלי',
        icon: Dog,
        path: '/pets',
      },
      {
        id: 'security',
        label: 'Security & Privacy',
        labelHe: 'אבטחה ופרטיות',
        icon: Shield,
        children: [
          {
            id: 'change-password',
            label: 'Change Password',
            labelHe: 'שנה סיסמה',
            path: '/security-settings',
          },
          {
            id: 'two-factor',
            label: 'Two-Factor Authentication',
            labelHe: 'אימות דו-שלבי',
            path: '/security-settings#2fa',
          },
          {
            id: 'biometric',
            label: 'Biometric Login (Face ID)',
            labelHe: 'כניסה ביומטרית (Face ID)',
            path: '/security-settings#biometric',
          },
          {
            id: 'active-sessions',
            label: 'Active Sessions',
            labelHe: 'הפעלות פעילות',
            path: '/connected-devices',
          },
        ],
      },
      {
        id: 'notifications-settings',
        label: 'Notifications',
        labelHe: 'התראות',
        icon: Bell,
        path: '/notification-preferences',
      },
      {
        id: 'language-region',
        label: 'Language & Region',
        labelHe: 'שפה ואזור',
        icon: Globe,
        path: '/settings#language',
      },
    ],
  },

  // =============================================
  // 💳 Wallet & Payments
  // =============================================
  {
    id: 'wallet',
    label: 'Wallet & Payments',
    labelHe: 'ארנק ותשלומים',
    icon: Wallet,
    children: [
      {
        id: 'wallet-balance',
        label: 'Wallet Balance',
        labelHe: 'יתרת ארנק',
        icon: Wallet,
        path: '/my-wallet',
      },
      {
        id: 'payment-methods',
        label: 'Payment Methods',
        labelHe: 'שיטות תשלום',
        icon: CreditCard,
        path: '/my-wallet#payment-methods',
      },
      {
        id: 'digital-cards',
        label: 'Digital Cards',
        labelHe: 'כרטיסים דיגיטליים',
        icon: Smartphone,
        children: [
          {
            id: 'apple-wallet',
            label: 'Apple Wallet Pass',
            labelHe: 'Apple Wallet',
            path: '/wallet-download',
          },
          {
            id: 'google-wallet',
            label: 'Google Wallet Pass',
            labelHe: 'Google Wallet',
            path: '/wallet-download#google',
          },
        ],
      },
      {
        id: 'billing',
        label: 'Billing & Invoices',
        labelHe: 'חשבוניות',
        icon: FileText,
        path: '/my-wallet#invoices',
      },
    ],
  },

  // =============================================
  // 📊 My Activity
  // =============================================
  {
    id: 'activity',
    label: 'My Activity',
    labelHe: 'הפעילות שלי',
    icon: BarChart3,
    children: [
      {
        id: 'dashboard-activity',
        label: 'Dashboard',
        labelHe: 'לוח בקרה',
        path: '/dashboard',
      },
      {
        id: 'calendar-view',
        label: 'Calendar View',
        labelHe: 'תצוגת לוח שנה',
        path: '/pet-care-planner',
      },
    ],
  },

  // =============================================
  // ✨ Premium Features
  // =============================================
  {
    id: 'premium-features',
    label: 'Premium Features',
    labelHe: 'תכונות פרימיום',
    icon: Sparkles,
    isNew: true,
    children: [
      {
        id: 'kenzo-ai-mascot',
        label: 'Kenzo AI Mascot (3D Avatar)',
        labelHe: 'קנזו AI - מסקוט תלת-ממדי',
        icon: Sparkles,
        path: '/kenzo-ai',
        isNew: true,
      },
      {
        id: 'live-chat-widget',
        label: 'Live Chat Support',
        labelHe: 'צ\'אט תמיכה חי',
        icon: MessageSquare,
        path: '/live-chat',
      },
      {
        id: 'notification-center',
        label: 'Notification Preferences',
        labelHe: 'העדפות התראות',
        icon: Bell,
        path: '/settings/notifications',
      },
      {
        id: 'security-dashboard',
        label: 'Security Status',
        labelHe: 'סטטוס אבטחה',
        icon: Shield,
        path: '/security/status',
      },
    ],
  },

  // =============================================
  // 🎓 Pet Training Academy
  // =============================================
  {
    id: 'academy',
    label: 'Pet Training Academy',
    labelHe: 'אקדמיה לאימון חיות',
    icon: GraduationCap,
    path: '/academy',
  },

  // =============================================
  // 🏢 Franchise Management
  // =============================================
  {
    id: 'franchise',
    label: 'Franchise Management',
    labelHe: 'ניהול זכיינות',
    icon: Building2,
    userRoles: ['franchisee', 'admin'],
    children: [
      {
        id: 'franchise-dashboard',
        label: 'Franchise Dashboard',
        labelHe: 'לוח בקרה זכיין',
        icon: BarChart3,
        path: '/franchise/dashboard',
      },
      {
        id: 'franchise-inbox',
        label: 'Franchise Inbox',
        labelHe: 'תיבת דואר זכיין',
        icon: Inbox,
        path: '/franchise/inbox',
      },
      {
        id: 'franchise-marketing',
        label: 'Marketing Tools',
        labelHe: 'כלי שיווק',
        icon: BarChart3,
        path: '/franchise/marketing',
      },
      {
        id: 'franchise-reports',
        label: 'Reports & Analytics',
        labelHe: 'דוחות וניתוחים',
        icon: FileText,
        path: '/franchise/reports',
      },
      {
        id: 'franchise-support',
        label: 'Franchise Support',
        labelHe: 'תמיכה לזכיין',
        icon: HelpCircle,
        path: '/franchise/support',
      },
    ],
  },

  // =============================================
  // 🆘 Help & Support
  // =============================================
  {
    id: 'help',
    label: 'Help & Support',
    labelHe: 'עזרה ותמיכה',
    icon: HelpCircle,
    children: [
      {
        id: 'knowledge-base',
        label: 'Knowledge Base',
        labelHe: 'מאגר ידע',
        path: '/about',
      },
      {
        id: 'contact-support',
        label: 'Contact Support',
        labelHe: 'צור קשר',
        icon: MessageSquare,
        path: '/contact',
      },
      {
        id: 'legal',
        label: 'Legal & Policies',
        labelHe: 'משפטי ומדיניות',
        icon: FileText,
        children: [
          {
            id: 'terms',
            label: 'Terms of Service',
            labelHe: 'תנאי שימוש',
            path: '/terms',
          },
          {
            id: 'privacy-policy',
            label: 'Privacy Policy',
            labelHe: 'מדיניות פרטיות',
            path: '/privacy',
          },
          {
            id: 'accessibility-statement',
            label: 'Accessibility Statement',
            labelHe: 'הצהרת נגישות',
            path: '/accessibility',
          },
        ],
      },
    ],
  },
];

/**
 * Filter navigation items by user role
 */
export function filterNavigationByRole(
  items: MenuItem[],
  userRoles: string[] = ['customer']
): MenuItem[] {
  return items
    .filter(item => {
      // If no role restriction, show to everyone
      if (!item.userRoles || item.userRoles.length === 0) return true;
      // Check if user has any of the required roles
      return item.userRoles.some(role => userRoles.includes(role));
    })
    .map(item => ({
      ...item,
      children: item.children
        ? filterNavigationByRole(item.children, userRoles)
        : undefined,
    }));
}

/**
 * Get flattened list of all navigation paths (for routing)
 */
export function getAllNavigationPaths(items: MenuItem[] = navigationTree): string[] {
  const paths: string[] = [];
  
  function traverse(menuItems: MenuItem[]) {
    for (const item of menuItems) {
      if (item.path) {
        paths.push(item.path);
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  }
  
  traverse(items);
  return paths;
}

/**
 * Find menu item by path
 */
export function findMenuItemByPath(
  path: string,
  items: MenuItem[] = navigationTree
): MenuItem | null {
  for (const item of items) {
    if (item.path === path) return item;
    if (item.children) {
      const found = findMenuItemByPath(path, item.children);
      if (found) return found;
    }
  }
  return null;
}
