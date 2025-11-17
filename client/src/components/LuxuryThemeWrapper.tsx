import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface LuxuryPageWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  icon?: ReactNode;
  variant?: 'hero' | 'content' | 'dashboard' | 'minimal';
  className?: string;
  showDivider?: boolean;
}

export function LuxuryPageWrapper({
  children,
  title,
  subtitle,
  badge,
  icon,
  variant = 'content',
  className = '',
  showDivider = false,
}: LuxuryPageWrapperProps) {
  if (variant === 'hero') {
    return (
      <div className="luxury-services-hero">
        <div className="luxury-services-hero-content">
          {badge && (
            <div className="luxury-services-badge">
              <span className="luxury-badge-text">{badge}</span>
            </div>
          )}
          {title && <h1 className="luxury-services-title">{title}</h1>}
          {subtitle && <p className="luxury-services-subtitle">{subtitle}</p>}
          {showDivider && <div className="luxury-hero-divider" />}
        </div>
        <div className={cn('luxury-content-panel', className)}>
          {children}
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('luxury-content-section', className)}>
        {(title || subtitle || icon) && (
          <div className="luxury-content-header">
            {icon && <div className="mb-4">{icon}</div>}
            {title && <h2 className="luxury-content-title">{title}</h2>}
            {subtitle && <p className="luxury-content-subtitle">{subtitle}</p>}
          </div>
        )}
        <div className="luxury-content-panel">
          {children}
        </div>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('luxury-content-section', className)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn('luxury-content-section', className)}>
      {(title || subtitle) && (
        <div className="luxury-content-header">
          {title && <h2 className="luxury-section-title">{title}</h2>}
          {subtitle && <p className="luxury-content-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="luxury-content-panel">
        {children}
      </div>
    </div>
  );
}

interface LuxuryCardGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function LuxuryCardGrid({
  children,
  columns = 3,
  className = '',
}: LuxuryCardGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('luxury-products-grid', gridCols[columns], className)}>
      {children}
    </div>
  );
}

interface LuxuryFeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function LuxuryFeatureCard({
  icon,
  title,
  description,
  className = '',
}: LuxuryFeatureCardProps) {
  return (
    <div className={cn('luxury-feature-card', className)}>
      <div className="luxury-feature-icon">{icon}</div>
      <h3 className="luxury-feature-title">{title}</h3>
      <p className="luxury-feature-desc">{description}</p>
    </div>
  );
}

interface LuxuryProductCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
}

export function LuxuryProductCard({
  icon,
  title,
  description,
  onClick,
  className = '',
}: LuxuryProductCardProps) {
  return (
    <div 
      className={cn('luxury-product-card', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      <div className="luxury-product-icon">{icon}</div>
      <h3 className="luxury-product-title">{title}</h3>
      <p className="luxury-product-desc">{description}</p>
    </div>
  );
}

interface LuxuryHeroSectionProps {
  badge?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}

export function LuxuryHeroSection({
  badge,
  title,
  subtitle,
  children,
  className = '',
}: LuxuryHeroSectionProps) {
  return (
    <div className={cn('luxury-hero-section', className)}>
      <div className="luxury-hero-container">
        <div className="luxury-hero-content">
          {badge && (
            <div className="luxury-hero-badge">
              <span className="luxury-badge-text">{badge}</span>
            </div>
          )}
          <h1 className="luxury-hero-title">{title}</h1>
          {subtitle && <p className="luxury-hero-subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

interface LuxuryAboutCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function LuxuryAboutCard({
  icon,
  title,
  description,
  className = '',
}: LuxuryAboutCardProps) {
  return (
    <div className={cn('luxury-about-card', className)}>
      <div className="luxury-about-icon">{icon}</div>
      <h3 className="luxury-feature-title">{title}</h3>
      <p className="luxury-feature-desc">{description}</p>
    </div>
  );
}

interface LuxuryTabNavigationProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
  }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function LuxuryTabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}: LuxuryTabNavigationProps) {
  return (
    <div className={cn('luxury-tab-navigation', className)}>
      <div className="luxury-tab-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'luxury-tab-button',
              activeTab === tab.id && 'active'
            )}
            onClick={() => onTabChange(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            {tab.icon && <span className="luxury-tab-icon">{tab.icon}</span>}
            <span className="luxury-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface LuxuryPremiumStationCardProps {
  title: string;
  badgeText: string;
  imageUrl?: string;
  features: string[];
  className?: string;
}

export function LuxuryPremiumStationCard({
  title,
  badgeText,
  imageUrl,
  features,
  className = '',
}: LuxuryPremiumStationCardProps) {
  return (
    <div className={cn('premium-station-card', className)}>
      <div className="premium-station-header">
        <div className="premium-station-badge">
          <span className="premium-badge-text">{badgeText}</span>
        </div>
        <h3 className="premium-station-title">{title}</h3>
      </div>
      {imageUrl && (
        <div className="premium-station-image-container">
          <img src={imageUrl} alt={title} className="premium-station-image" />
        </div>
      )}
      <div className="premium-station-feature">
        {features.map((feature, index) => (
          <div key={index} className="premium-feature-label">
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
}

export function useLuxuryTypography() {
  return {
    displayFont: 'font-[\'Playfair_Display\',serif]',
    bodyFont: 'font-[\'Inter\',sans-serif]',
    luxuryTitle: 'luxury-title',
    luxuryAmount: 'luxury-amount',
    luxuryBadge: 'luxury-badge',
  };
}

export function useLuxuryGradients() {
  return {
    metallicGold: 'bg-[linear-gradient(135deg,#FFD700_0%,#FFC700_20%,#FFB700_40%,#FFA500_60%,#FFD700_80%,#FFED4E_100%)]',
    goldRich: 'bg-[linear-gradient(135deg,#F7D358_0%,#E5B73B_25%,#D4A127_50%,#E5B73B_75%,#F7D358_100%)]',
    diamond: 'bg-[linear-gradient(135deg,#FFFFFF_0%,#E8F4F8_20%,#D0E8F0_40%,#B8DDE8_60%,#A0D2E0_80%,#88C7D8_100%)]',
    platinum: 'bg-[linear-gradient(135deg,#E5E4E2_0%,#F5F5F5_20%,#E8E8E8_40%,#DADADA_60%,#F0F0F0_80%,#FFFFFF_100%)]',
    roseGold: 'bg-[linear-gradient(135deg,#F4C2C2_0%,#D4A5A5_50%,#E6B8B8_100%)]',
    champagne: 'bg-[linear-gradient(135deg,#F7E7CE_0%,#E6D5B8_50%,#F5E6D3_100%)]',
  };
}
