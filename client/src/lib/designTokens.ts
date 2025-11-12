export const designTokens = {
  colors: {
    background: {
      primary: '#0B0B0B',
      secondary: '#151515',
      tertiary: '#1A1A1A',
      elevated: '#1F1F1F',
    },
    text: {
      primary: '#EDEDED',
      secondary: '#A0A0A0',
      tertiary: '#666666',
      disabled: '#404040',
    },
    border: {
      default: '#2A2A2A',
      hover: '#3A3A3A',
      focus: '#00F57A',
    },
    accent: {
      success: '#00F57A',
      warning: '#FFB547',
      error: '#EF4444',
      info: '#3B82F6',
    },
    status: {
      online: '#00F57A',
      offline: '#EF4444',
      warning: '#FFB547',
      neutral: '#A0A0A0',
    },
  },
  typography: {
    fontFamily: {
      base: '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", system-ui, sans-serif',
      mono: '"SF Mono", "Consolas", "Monaco", monospace',
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '15px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
    },
    lineHeight: {
      tight: 1.25,
      base: 1.5,
      relaxed: 1.75,
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },
  borderRadius: {
    sm: '4px',
    base: '8px',
    lg: '12px',
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  transitions: {
    fast: '100ms ease-in-out',
    base: '150ms ease-in-out',
    slow: '300ms ease-in-out',
  },
  layout: {
    minTouchTarget: '44px',
    maxWidth: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
  },
} as const;

export type DesignTokens = typeof designTokens;
