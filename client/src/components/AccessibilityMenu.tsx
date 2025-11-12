import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Type, Palette, RotateCcw } from 'lucide-react';
import type { Language } from '@/lib/i18n';

interface AccessibilityMenuProps {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
}

interface AccessibilitySettings {
  fontSize: number;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  soundEnabled: boolean;
  focusOutline: boolean;
  colorBlindness: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

const defaultSettings: AccessibilitySettings = {
  fontSize: 16,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  screenReader: false,
  keyboardNavigation: true,
  soundEnabled: true,
  focusOutline: true,
  colorBlindness: 'none'
};

export function AccessibilityMenu({ language, isOpen, onClose }: AccessibilityMenuProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('petWashAccessibility');
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      // Silent fallback to default settings
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('petWashAccessibility', JSON.stringify(settings));
      
      const html = document.documentElement;
      
      // Remove all accessibility classes
      html.classList.remove(
        'accessibility-high-contrast',
        'accessibility-large-text', 
        'accessibility-reduced-motion',
        'accessibility-focus-outline',
        'accessibility-protanopia',
        'accessibility-deuteranopia', 
        'accessibility-tritanopia'
      );
      
      // Apply settings
      if (settings.highContrast) {
        html.classList.add('accessibility-high-contrast');
      }
      
      if (settings.largeText) {
        html.classList.add('accessibility-large-text');
      }
      
      if (settings.reducedMotion) {
        html.classList.add('accessibility-reduced-motion');
      }
      
      if (settings.focusOutline) {
        html.classList.add('accessibility-focus-outline');
      }
      
      if (settings.colorBlindness !== 'none') {
        html.classList.add(`accessibility-${settings.colorBlindness}`);
      }
      
      html.style.fontSize = `${settings.fontSize}px`;
      
    } catch (error) {
      // Silent error handling - maintain functionality
    }
  }, [settings]);

  const updateSetting = (key: keyof AccessibilitySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('petWashAccessibility');
  };

  if (!isOpen) return null;

  const translations = {
    en: {
      title: 'Accessibility Settings',
      fontSize: 'Font Size',
      highContrast: 'High Contrast',
      largeText: 'Large Text',
      reducedMotion: 'Reduced Motion',
      screenReader: 'Screen Reader Mode',
      keyboardNav: 'Keyboard Navigation',
      sound: 'Sound Effects',
      focusOutline: 'Focus Indicators',
      colorBlindness: 'Color Blindness Support',
      reset: 'Reset All',
      close: 'Close'
    },
    he: {
      title: 'הגדרות נגישות',
      fontSize: 'גודל גופן',
      highContrast: 'ניגודיות גבוהה',
      largeText: 'טקסט גדול',
      reducedMotion: 'תנועה מופחתת',
      screenReader: 'מצב קורא מסך',
      keyboardNav: 'ניווט מקלדת',
      sound: 'אפקטי קול',
      focusOutline: 'מסגרות פוקוס',
      colorBlindness: 'תמיכה בעיוורון צבעים',
      reset: 'איפוס הכל',
      close: 'סגור'
    }
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[language]?.[key] || translations.en[key];
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ display: isOpen ? 'flex' : 'none' }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-menu-title"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 id="accessibility-menu-title" className="text-xl font-semibold">{t('title')}</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            aria-label={t('close')}
            autoFocus
          >
            <X size={20} />
          </Button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Font Size */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type size={20} />
              <span>{t('fontSize')}</span>
            </div>
            <Select value={settings.fontSize.toString()} onValueChange={(value) => updateSetting('fontSize', parseInt(value))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="14">14px</SelectItem>
                <SelectItem value="16">16px</SelectItem>
                <SelectItem value="18">18px</SelectItem>
                <SelectItem value="20">20px</SelectItem>
                <SelectItem value="24">24px</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette size={20} />
              <span>{t('highContrast')}</span>
            </div>
            <Switch 
              checked={settings.highContrast} 
              onCheckedChange={(checked) => updateSetting('highContrast', checked)} 
            />
          </div>

          {/* Large Text */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type size={20} />
              <span>{t('largeText')}</span>
            </div>
            <Switch 
              checked={settings.largeText} 
              onCheckedChange={(checked) => updateSetting('largeText', checked)} 
            />
          </div>

          {/* Color Blindness Support */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette size={20} />
              <span>{t('colorBlindness')}</span>
            </div>
            <Select value={settings.colorBlindness} onValueChange={(value) => updateSetting('colorBlindness', value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="protanopia">Protanopia</SelectItem>
                <SelectItem value="deuteranopia">Deuteranopia</SelectItem>
                <SelectItem value="tritanopia">Tritanopia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t">
            <Button variant="outline" onClick={resetSettings} className="w-full">
              <RotateCcw size={16} className="mr-2" />
              {t('reset')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}