import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Type, Palette, RotateCcw, Eye, MousePointer, ZoomIn, ZoomOut, Minus, Send, FileText, MessageSquare, ImageOff } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/apiConfig';

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
  grayscale: boolean;
  dyslexiaFont: boolean;
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
  grayscale: false,
  dyslexiaFont: false,
};

type Tab = 'settings' | 'statement' | 'feedback';

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
    grayscale: 'Grayscale',
    dyslexiaFont: 'Dyslexia-Friendly Font',
    reset: 'Reset All',
    close: 'Close',
    cbNone: 'None',
    cbProtanopia: 'Red (Protanopia)',
    cbDeuteranopia: 'Green (Deuteranopia)',
    cbTritanopia: 'Blue (Tritanopia)',
    tabSettings: 'Settings',
    tabStatement: 'Statement',
    tabFeedback: 'Feedback',
    statementTitle: 'Accessibility Statement',
    statementCompliance: 'Compliance Level',
    statementStandard: 'Standard',
    statementAudit: 'Last Audit',
    statementLimitations: 'Known Limitations',
    statementContact: 'Contact',
    statementEmail: 'Email',
    statementPhone: 'Phone',
    statementResponse: 'Response Time',
    feedbackTitle: 'Accessibility Feedback',
    feedbackMessage: 'Describe the issue or suggestion',
    feedbackEmail: 'Your email (optional)',
    feedbackSubmit: 'Send Feedback',
    feedbackSent: 'Thank you! Your feedback has been submitted.',
    feedbackError: 'Failed to send. Please try again.',
    loading: 'Loading...',
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
    grayscale: 'גווני אפור',
    dyslexiaFont: 'גופן ידידותי לדיסלקטים',
    reset: 'איפוס הכל',
    close: 'סגור',
    cbNone: 'ללא',
    cbProtanopia: 'אדום (פרוטנופיה)',
    cbDeuteranopia: 'ירוק (דויטרנופיה)',
    cbTritanopia: 'כחול (טריטנופיה)',
    tabSettings: 'הגדרות',
    tabStatement: 'הצהרת נגישות',
    tabFeedback: 'משוב',
    statementTitle: 'הצהרת נגישות',
    statementCompliance: 'רמת תאימות',
    statementStandard: 'תקן',
    statementAudit: 'ביקורת אחרונה',
    statementLimitations: 'מגבלות ידועות',
    statementContact: 'יצירת קשר',
    statementEmail: 'אימייל',
    statementPhone: 'טלפון',
    statementResponse: 'זמן תגובה',
    feedbackTitle: 'משוב נגישות',
    feedbackMessage: 'תאר/י את הבעיה או ההצעה',
    feedbackEmail: 'אימייל שלך (אופציונלי)',
    feedbackSubmit: 'שלח משוב',
    feedbackSent: 'תודה! המשוב שלך התקבל.',
    feedbackError: 'השליחה נכשלה. נסה/י שוב.',
    loading: 'טוען...',
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
    grayscale: 'تدرج الرمادي',
    dyslexiaFont: 'خط صديق لعسر القراءة',
    reset: 'إعادة تعيين الكل',
    close: 'إغلاق',
    cbNone: 'بدون',
    cbProtanopia: 'أحمر (بروتانوبيا)',
    cbDeuteranopia: 'أخضر (ديوترانوبيا)',
    cbTritanopia: 'أزرق (تريتانوبيا)',
    tabSettings: 'الإعدادات',
    tabStatement: 'بيان إمكانية الوصول',
    tabFeedback: 'ملاحظات',
    statementTitle: 'بيان إمكانية الوصول',
    statementCompliance: 'مستوى التوافق',
    statementStandard: 'المعيار',
    statementAudit: 'آخر تدقيق',
    statementLimitations: 'القيود المعروفة',
    statementContact: 'اتصل بنا',
    statementEmail: 'البريد الإلكتروني',
    statementPhone: 'الهاتف',
    statementResponse: 'وقت الاستجابة',
    feedbackTitle: 'ملاحظات إمكانية الوصول',
    feedbackMessage: 'صف المشكلة أو الاقتراح',
    feedbackEmail: 'بريدك الإلكتروني (اختياري)',
    feedbackSubmit: 'إرسال',
    feedbackSent: 'شكراً! تم تقديم ملاحظاتك.',
    feedbackError: 'فشل الإرسال. حاول مرة أخرى.',
    loading: 'جاري التحميل...',
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
    grayscale: 'Оттенки серого',
    dyslexiaFont: 'Шрифт для дислексии',
    reset: 'Сбросить все',
    close: 'Закрыть',
    cbNone: 'Нет',
    cbProtanopia: 'Красный (протанопия)',
    cbDeuteranopia: 'Зелёный (дейтеранопия)',
    cbTritanopia: 'Синий (тританопия)',
    tabSettings: 'Настройки',
    tabStatement: 'Заявление о доступности',
    tabFeedback: 'Обратная связь',
    statementTitle: 'Заявление о доступности',
    statementCompliance: 'Уровень соответствия',
    statementStandard: 'Стандарт',
    statementAudit: 'Последний аудит',
    statementLimitations: 'Известные ограничения',
    statementContact: 'Контакт',
    statementEmail: 'Эл. почта',
    statementPhone: 'Телефон',
    statementResponse: 'Время ответа',
    feedbackTitle: 'Обратная связь по доступности',
    feedbackMessage: 'Опишите проблему или предложение',
    feedbackEmail: 'Ваш email (необязательно)',
    feedbackSubmit: 'Отправить',
    feedbackSent: 'Спасибо! Ваш отзыв получен.',
    feedbackError: 'Ошибка отправки. Попробуйте ещё раз.',
    loading: 'Загрузка...',
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
    grayscale: 'Niveaux de gris',
    dyslexiaFont: 'Police adaptée à la dyslexie',
    reset: 'Tout réinitialiser',
    close: 'Fermer',
    cbNone: 'Aucun',
    cbProtanopia: 'Rouge (protanopie)',
    cbDeuteranopia: 'Vert (deutéranopie)',
    cbTritanopia: 'Bleu (tritanopie)',
    tabSettings: 'Paramètres',
    tabStatement: 'Déclaration d\'accessibilité',
    tabFeedback: 'Commentaires',
    statementTitle: 'Déclaration d\'accessibilité',
    statementCompliance: 'Niveau de conformité',
    statementStandard: 'Norme',
    statementAudit: 'Dernier audit',
    statementLimitations: 'Limitations connues',
    statementContact: 'Contact',
    statementEmail: 'E-mail',
    statementPhone: 'Téléphone',
    statementResponse: 'Délai de réponse',
    feedbackTitle: 'Commentaires sur l\'accessibilité',
    feedbackMessage: 'Décrivez le problème ou la suggestion',
    feedbackEmail: 'Votre e-mail (optionnel)',
    feedbackSubmit: 'Envoyer',
    feedbackSent: 'Merci ! Vos commentaires ont été soumis.',
    feedbackError: 'Échec de l\'envoi. Veuillez réessayer.',
    loading: 'Chargement...',
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
    grayscale: 'Escala de grises',
    dyslexiaFont: 'Fuente amigable para dislexia',
    reset: 'Restablecer todo',
    close: 'Cerrar',
    cbNone: 'Ninguno',
    cbProtanopia: 'Rojo (protanopia)',
    cbDeuteranopia: 'Verde (deuteranopia)',
    cbTritanopia: 'Azul (tritanopia)',
    tabSettings: 'Configuración',
    tabStatement: 'Declaración de accesibilidad',
    tabFeedback: 'Comentarios',
    statementTitle: 'Declaración de accesibilidad',
    statementCompliance: 'Nivel de cumplimiento',
    statementStandard: 'Norma',
    statementAudit: 'Última auditoría',
    statementLimitations: 'Limitaciones conocidas',
    statementContact: 'Contacto',
    statementEmail: 'Correo electrónico',
    statementPhone: 'Teléfono',
    statementResponse: 'Tiempo de respuesta',
    feedbackTitle: 'Comentarios sobre accesibilidad',
    feedbackMessage: 'Describe el problema o sugerencia',
    feedbackEmail: 'Tu email (opcional)',
    feedbackSubmit: 'Enviar',
    feedbackSent: '¡Gracias! Tus comentarios han sido enviados.',
    feedbackError: 'Error al enviar. Inténtalo de nuevo.',
    loading: 'Cargando...',
  },
};

interface StatementData {
  complianceLevel: string;
  standardIsrael: string;
  lastAuditDate: string;
  knownLimitations: string[];
  contact: {
    title: string;
    email: string;
    phone: string;
    responseTime: string;
  };
}

export function AccessibilityMenu({ language, isOpen, onClose }: AccessibilityMenuProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
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
        'a11y-line-spacing',
        'a11y-grayscale',
        'a11y-dyslexia-font'
      );

      if (settings.highContrast) html.classList.add('a11y-high-contrast');
      if (settings.largeText) html.classList.add('a11y-large-text');
      if (settings.reducedMotion) html.classList.add('a11y-reduced-motion');
      if (settings.focusOutline) html.classList.add('a11y-focus-outline');
      if (settings.linkHighlight) html.classList.add('a11y-link-highlight');
      if (settings.lineSpacing) html.classList.add('a11y-line-spacing');
      if (settings.grayscale) html.classList.add('a11y-grayscale');
      if (settings.dyslexiaFont) html.classList.add('a11y-dyslexia-font');

      if (settings.colorBlindness !== 'none') {
        html.classList.add(`a11y-${settings.colorBlindness}`);
      }

      html.style.setProperty('--a11y-font-scale', `${settings.fontScale / 100}`);
      if (settings.fontScale !== 100) {
        html.style.fontSize = `${settings.fontScale}%`;
      } else {
        html.style.fontSize = '';
      }
    } catch {
      // silent
    }
  }, [settings]);

  const logAudit = useCallback((action: string, details?: string) => {
    try {
      fetch(getApiUrl('/api/accessibility-audit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          details: details || '',
          pageUrl: window.location.pathname,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {});
    } catch {
      // silent
    }
  }, []);

  const updateSetting = (key: keyof AccessibilitySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    logAudit(`toggle_${key}`, String(value));
  };

  const adjustFontScale = (delta: number) => {
    setSettings(prev => {
      const newScale = Math.max(80, Math.min(150, prev.fontScale + delta));
      logAudit('adjust_font_scale', `${newScale}%`);
      return { ...prev, fontScale: newScale };
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('petWashAccessibility');
    logAudit('reset_all');
  };

  const fetchStatement = useCallback(async () => {
    if (statement) return;
    setStatementLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/accessibility-statement'));
      if (res.ok) {
        const data = await res.json();
        setStatement(data);
      }
    } catch {
      // silent
    } finally {
      setStatementLoading(false);
    }
  }, [statement]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'statement') {
      fetchStatement();
      logAudit('view_statement');
    }
    if (tab === 'feedback') {
      logAudit('open_feedback_form');
    }
  };

  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) return;
    setFeedbackStatus('sending');
    try {
      await apiRequest('POST', '/api/accessibility-feedback', {
        message: feedbackMessage.trim(),
        email: feedbackEmail.trim() || undefined,
        pageUrl: window.location.pathname,
      });
      setFeedbackStatus('sent');
      setFeedbackMessage('');
      setFeedbackEmail('');
      logAudit('submit_feedback');
      setTimeout(() => setFeedbackStatus('idle'), 4000);
    } catch {
      setFeedbackStatus('error');
      setTimeout(() => setFeedbackStatus('idle'), 4000);
    }
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
        style={{
          direction: isRtl ? 'rtl' : 'ltr',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
        }}
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

        <div className="flex border-b border-gray-100" role="tablist">
          {(['settings', 'statement', 'feedback'] as Tab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={activeTab === tab}
              onClick={() => handleTabChange(tab)}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', minHeight: 48 }}
              className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === tab
                  ? 'text-black border-b-2 border-black'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'settings' && <Eye size={14} />}
              {tab === 'statement' && <FileText size={14} />}
              {tab === 'feedback' && <MessageSquare size={14} />}
              {t(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </button>
          ))}
        </div>

        {activeTab === 'settings' && (
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
                  className="rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  style={{ width: 48, height: 48, minWidth: 48, minHeight: 48, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  aria-label="Decrease font size"
                  type="button"
                >
                  <ZoomOut size={20} />
                </button>
                <div className="flex-1 h-2 bg-gray-100 rounded-full relative">
                  <div
                    className="h-2 bg-black rounded-full transition-all"
                    style={{ width: `${((settings.fontScale - 80) / 70) * 100}%` }}
                  />
                </div>
                <button
                  onClick={() => adjustFontScale(10)}
                  className="rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  style={{ width: 48, height: 48, minWidth: 48, minHeight: 48, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  aria-label="Increase font size"
                  type="button"
                >
                  <ZoomIn size={20} />
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
                <ImageOff size={18} className="text-gray-600" />
                <span className="text-sm font-medium">{t('grayscale')}</span>
              </div>
              <Switch
                checked={settings.grayscale}
                onCheckedChange={(checked) => updateSetting('grayscale', checked)}
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
                <Type size={18} className="text-gray-600" />
                <span className="text-sm font-medium">{t('dyslexiaFont')}</span>
              </div>
              <Switch
                checked={settings.dyslexiaFont}
                onCheckedChange={(checked) => updateSetting('dyslexiaFont', checked)}
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
        )}

        {activeTab === 'statement' && (
          <div className="p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">{t('statementTitle')}</h3>
            {statementLoading ? (
              <p className="text-sm text-gray-500">{t('loading')}</p>
            ) : statement ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('statementCompliance')}</span>
                  <span className="font-semibold text-green-700">{statement.complianceLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('statementStandard')}</span>
                  <span className="font-medium">{statement.standardIsrael}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('statementAudit')}</span>
                  <span className="font-medium">{statement.lastAuditDate}</span>
                </div>

                {statement.knownLimitations.length > 0 && (
                  <div>
                    <p className="text-gray-500 mb-1">{t('statementLimitations')}</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {statement.knownLimitations.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <p className="font-semibold text-gray-900 mb-2">{t('statementContact')}</p>
                  <div className="space-y-1 text-gray-600">
                    <p>{statement.contact.title}</p>
                    <p>{t('statementEmail')}: <a href={`mailto:${statement.contact.email}`} className="text-blue-600 underline">{statement.contact.email}</a></p>
                    <p>{t('statementPhone')}: <a href={`tel:${statement.contact.phone}`} className="text-blue-600 underline" dir="ltr">{statement.contact.phone}</a></p>
                    <p>{t('statementResponse')}: {statement.contact.responseTime}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('feedbackError')}</p>
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">{t('feedbackTitle')}</h3>

            {feedbackStatus === 'sent' ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                {t('feedbackSent')}
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder={t('feedbackMessage')}
                  className="min-h-[100px] resize-none rounded-xl"
                  aria-label={t('feedbackMessage')}
                />
                <Input
                  type="email"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  placeholder={t('feedbackEmail')}
                  className="rounded-xl"
                  aria-label={t('feedbackEmail')}
                />
                {feedbackStatus === 'error' && (
                  <p className="text-sm text-red-600">{t('feedbackError')}</p>
                )}
                <Button
                  onClick={submitFeedback}
                  disabled={!feedbackMessage.trim() || feedbackStatus === 'sending'}
                  className="w-full rounded-xl"
                >
                  <Send size={16} className={isRtl ? 'ml-2' : 'mr-2'} />
                  {feedbackStatus === 'sending' ? t('loading') : t('feedbackSubmit')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
