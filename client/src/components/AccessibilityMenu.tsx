import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Type, Palette, RotateCcw, Eye, MousePointer, ZoomIn, ZoomOut, Minus } from 'lucide-react';
import type { Language } from '@/lib/i18n';

interface AccessibilityMenuProps {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
}

interface AccessibilitySettings {
  fontScale: number;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  focusOutline: boolean;
  colorBlindness: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  linkHighlight: boolean;
  lineSpacing: boolean;
}

const defaultSettings: AccessibilitySettings = {
  fontScale: 100,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  focusOutline: false,
  colorBlindness: 'none',
  linkHighlight: false,
  lineSpacing: false,
};

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Accessibility Settings',
    fontScale: 'Font Size',
    highContrast: 'High Contrast',
    largeText: 'Large Text',
    reducedMotion: 'Reduced Motion',
    focusOutline: 'Focus Indicators',
    colorBlindness: 'Color Blindness Support',
    linkHighlight: 'Highlight Links',
    lineSpacing: 'Increased Line Spacing',
    reset: 'Reset All',
    close: 'Close',
    cbNone: 'None',
    cbProtanopia: 'Red (Protanopia)',
    cbDeuteranopia: 'Green (Deuteranopia)',
    cbTritanopia: 'Blue (Tritanopia)',
  },
  he: {
    title: 'הגדרות נגישות',
    fontScale: 'גודל גופן',
    highContrast: 'ניגודיות גבוהה',
    largeText: 'טקסט גדול',
    reducedMotion: 'תנועה מופחתת',
    focusOutline: 'מסגרות פוקוס',
    colorBlindness: 'תמיכה בעיוורון צבעים',
    linkHighlight: 'הדגשת קישורים',
    lineSpacing: 'ריווח שורות מוגדל',
    reset: 'איפוס הכל',
    close: 'סגור',
    cbNone: 'ללא',
    cbProtanopia: 'אדום (פרוטנופיה)',
    cbDeuteranopia: 'ירוק (דויטרנופיה)',
    cbTritanopia: 'כחול (טריטנופיה)',
  },
  ar: {
    title: 'إعدادات إمكانية الوصول',
    fontScale: 'حجم الخط',
    highContrast: 'تباين عالي',
    largeText: 'نص كبير',
    reducedMotion: 'حركة مخفّضة',
    focusOutline: 'مؤشرات التركيز',
    colorBlindness: 'دعم عمى الألوان',
    linkHighlight: 'تمييز الروابط',
    lineSpacing: 'تباعد أسطر أكبر',
    reset: 'إعادة تعيين الكل',
    close: 'إغلاق',
    cbNone: 'بدون',
    cbProtanopia: 'أحمر (بروتانوبيا)',
    cbDeuteranopia: 'أخضر (ديوترانوبيا)',
    cbTritanopia: 'أزرق (تريتانوبيا)',
  },
  ru: {
    title: 'Настройки доступности',
    fontScale: 'Размер шрифта',
    highContrast: 'Высокая контрастность',
    largeText: 'Крупный текст',
    reducedMotion: 'Уменьшение движения',
    focusOutline: 'Индикаторы фокуса',
    colorBlindness: 'Поддержка дальтонизма',
    linkHighlight: 'Выделение ссылок',
    lineSpacing: 'Увеличенный межстрочный интервал',
    reset: 'Сбросить все',
    close: 'Закрыть',
    cbNone: 'Нет',
    cbProtanopia: 'Красный (протанопия)',
    cbDeuteranopia: 'Зелёный (дейтеранопия)',
    cbTritanopia: 'Синий (тританопия)',
  },
  fr: {
    title: 'Paramètres d\'accessibilité',
    fontScale: 'Taille de police',
    highContrast: 'Contraste élevé',
    largeText: 'Grand texte',
    reducedMotion: 'Mouvement réduit',
    focusOutline: 'Indicateurs de focus',
    colorBlindness: 'Daltonisme',
    linkHighlight: 'Mise en évidence des liens',
    lineSpacing: 'Espacement de ligne augmenté',
    reset: 'Tout réinitialiser',
    close: 'Fermer',
    cbNone: 'Aucun',
    cbProtanopia: 'Rouge (protanopie)',
    cbDeuteranopia: 'Vert (deutéranopie)',
    cbTritanopia: 'Bleu (tritanopie)',
  },
  es: {
    title: 'Configuración de accesibilidad',
    fontScale: 'Tamaño de fuente',
    highContrast: 'Alto contraste',
    largeText: 'Texto grande',
    reducedMotion: 'Movimiento reducido',
    focusOutline: 'Indicadores de foco',
    colorBlindness: 'Daltonismo',
    linkHighlight: 'Resaltar enlaces',
    lineSpacing: 'Mayor interlineado',
    reset: 'Restablecer todo',
    close: 'Cerrar',
    cbNone: 'Ninguno',
    cbProtanopia: 'Rojo (protanopia)',
    cbDeuteranopia: 'Verde (deuteranopia)',
    cbTritanopia: 'Azul (tritanopia)',
  },
};

export function AccessibilityMenu({ language, isOpen, onClose }: AccessibilityMenuProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const dialogRef = useRef<HTMLDivElement>(null);

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
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('petWashAccessibility', JSON.stringify(settings));

      const html = document.documentElement;

      html.classList.remove(
        'a11y-high-contrast',
        'a11y-large-text',
        'a11y-reduced-motion',
        'a11y-focus-outline',
        'a11y-protanopia',
        'a11y-deuteranopia',
        'a11y-tritanopia',
        'a11y-link-highlight',
        'a11y-line-spacing'
      );

      if (settings.highContrast) html.classList.add('a11y-high-contrast');
      if (settings.largeText) html.classList.add('a11y-large-text');
      if (settings.reducedMotion) html.classList.add('a11y-reduced-motion');
      if (settings.focusOutline) html.classList.add('a11y-focus-outline');
      if (settings.linkHighlight) html.classList.add('a11y-link-highlight');
      if (settings.lineSpacing) html.classList.add('a11y-line-spacing');

      if (settings.colorBlindness !== 'none') {
        html.classList.add(`a11y-${settings.colorBlindness}`);
      }

      html.style.setProperty('--a11y-font-scale', `${settings.fontScale / 100}`);
    } catch {
      // silent
    }
  }, [settings]);

  const updateSetting = (key: keyof AccessibilitySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const adjustFontScale = (delta: number) => {
    setSettings(prev => ({
      ...prev,
      fontScale: Math.max(80, Math.min(150, prev.fontScale + delta)),
    }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('petWashAccessibility');
  };

  if (!isOpen) return null;

  const t = (key: string) => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const isRtl = language === 'he' || language === 'ar';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 9200, touchAction: 'auto', WebkitTapHighlightColor: 'transparent' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-menu-title"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
          <h2 id="accessibility-menu-title" className="text-lg font-bold text-gray-900">{t('title')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('close')}
            autoFocus
            className="rounded-full h-8 w-8 p-0"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Type size={18} />
              <span>{t('fontScale')}</span>
              <span className="text-xs text-gray-400 ml-auto" style={{ marginInlineStart: 'auto', marginInlineEnd: 0 }}>{settings.fontScale}%</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => adjustFontScale(-10)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                aria-label="Decrease font size"
              >
                <ZoomOut size={18} />
              </button>
              <div className="flex-1 h-2 bg-gray-100 rounded-full relative">
                <div
                  className="h-2 bg-black rounded-full transition-all"
                  style={{ width: `${((settings.fontScale - 80) / 70) * 100}%` }}
                />
              </div>
              <button
                onClick={() => adjustFontScale(10)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                aria-label="Increase font size"
              >
                <ZoomIn size={18} />
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-gray-600" />
              <span className="text-sm font-medium">{t('highContrast')}</span>
            </div>
            <Switch
              checked={settings.highContrast}
              onCheckedChange={(checked) => updateSetting('highContrast', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type size={18} className="text-gray-600" />
              <span className="text-sm font-medium">{t('largeText')}</span>
            </div>
            <Switch
              checked={settings.largeText}
              onCheckedChange={(checked) => updateSetting('largeText', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Minus size={18} className="text-gray-600" />
              <span className="text-sm font-medium">{t('lineSpacing')}</span>
            </div>
            <Switch
              checked={settings.lineSpacing}
              onCheckedChange={(checked) => updateSetting('lineSpacing', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MousePointer size={18} className="text-gray-600" />
              <span className="text-sm font-medium">{t('linkHighlight')}</span>
            </div>
            <Switch
              checked={settings.linkHighlight}
              onCheckedChange={(checked) => updateSetting('linkHighlight', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-gray-600" />
              <span className="text-sm font-medium">{t('focusOutline')}</span>
            </div>
            <Switch
              checked={settings.focusOutline}
              onCheckedChange={(checked) => updateSetting('focusOutline', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>
              <span className="text-sm font-medium">{t('reducedMotion')}</span>
            </div>
            <Switch
              checked={settings.reducedMotion}
              onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
            />
          </div>

          <div className="h-px bg-gray-100" />

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Palette size={18} />
              <span>{t('colorBlindness')}</span>
            </div>
            <Select value={settings.colorBlindness} onValueChange={(value) => updateSetting('colorBlindness', value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('cbNone')}</SelectItem>
                <SelectItem value="protanopia">{t('cbProtanopia')}</SelectItem>
                <SelectItem value="deuteranopia">{t('cbDeuteranopia')}</SelectItem>
                <SelectItem value="tritanopia">{t('cbTritanopia')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <Button variant="outline" onClick={resetSettings} className="w-full rounded-xl">
              <RotateCcw size={16} className={isRtl ? 'ml-2' : 'mr-2'} />
              {t('reset')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
