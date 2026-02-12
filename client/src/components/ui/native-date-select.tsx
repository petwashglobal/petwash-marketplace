import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const MONTH_NAMES: Record<string, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
};

const DATE_LABELS: Record<string, { day: string; month: string; year: string }> = {
  en: { day: 'Day', month: 'Month', year: 'Year' },
  he: { day: 'יום', month: 'חודש', year: 'שנה' },
  ar: { day: 'يوم', month: 'شهر', year: 'سنة' },
  ru: { day: 'День', month: 'Месяц', year: 'Год' },
  fr: { day: 'Jour', month: 'Mois', year: 'Année' },
  es: { day: 'Día', month: 'Mes', year: 'Año' },
};

interface NativeDateSelectProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  language?: string;
  minYear?: number;
  maxYear?: number;
  error?: string;
  className?: string;
}

export function NativeDateSelect({
  value,
  onChange,
  label,
  language = 'en',
  minYear = 1940,
  maxYear = new Date().getFullYear() - 13,
  error,
  className = '',
}: NativeDateSelectProps) {
  const labels = DATE_LABELS[language] || DATE_LABELS.en;
  const months = MONTH_NAMES[language] || MONTH_NAMES.en;
  const parts = value ? value.split('-') : ['', '', ''];
  const defaultDate = `${Math.max(minYear, maxYear - 25)}-01-01`;

  const updatePart = (index: number, val: string) => {
    const current = value || defaultDate;
    const p = current.split('-');
    p[index] = val;
    onChange(p.join('-'));
  };

  return (
    <div className={className}>
      {label && <Label className="mb-1 block">{label}</Label>}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1 text-center">{labels.day}</label>
          <Select value={parts[2] || ''} onValueChange={(v) => updatePart(2, v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
                <SelectItem key={d} value={d}>{parseInt(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1 text-center">{labels.month}</label>
          <Select value={parts[1] || ''} onValueChange={(v) => updatePart(1, v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {months.map((name, i) => {
                const val = String(i + 1).padStart(2, '0');
                return <SelectItem key={val} value={val}>{name}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1 text-center">{labels.year}</label>
          <Select value={parts[0] || ''} onValueChange={(v) => updatePart(0, v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i)).map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

export { MONTH_NAMES, DATE_LABELS };
