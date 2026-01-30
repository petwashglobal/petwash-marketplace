import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/languageStore';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface IOSDatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  minYear?: number;
  maxYear?: number;
  label?: string;
  error?: string;
  className?: string;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

interface WheelColumnProps {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  label: string;
}

function WheelColumn({ items, selectedIndex, onSelect, label }: WheelColumnProps) {
  const handleUp = () => {
    if (selectedIndex > 0) {
      onSelect(selectedIndex - 1);
    }
  };

  const handleDown = () => {
    if (selectedIndex < items.length - 1) {
      onSelect(selectedIndex + 1);
    }
  };

  const prevItem = selectedIndex > 0 ? items[selectedIndex - 1] : null;
  const currentItem = items[selectedIndex];
  const nextItem = selectedIndex < items.length - 1 ? items[selectedIndex + 1] : null;

  return (
    <div className="flex-1 flex flex-col items-center">
      <span className="text-xs text-gray-500 mb-1">{label}</span>
      
      <button
        type="button"
        onClick={handleUp}
        disabled={selectedIndex === 0}
        className="w-full h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
      
      <div className="relative w-full">
        <div className="h-8 flex items-center justify-center text-gray-500 text-sm">
          {prevItem !== null ? prevItem : ''}
        </div>
        
        <div 
          className="h-12 flex items-center justify-center text-white font-bold text-xl rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(37,99,235,0.2) 100%)',
            border: '1px solid rgba(59,130,246,0.4)'
          }}
        >
          {currentItem}
        </div>
        
        <div className="h-8 flex items-center justify-center text-gray-500 text-sm">
          {nextItem !== null ? nextItem : ''}
        </div>
      </div>
      
      <button
        type="button"
        onClick={handleDown}
        disabled={selectedIndex === items.length - 1}
        className="w-full h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20 transition-colors"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}

export function IOSDatePicker({
  value,
  onChange,
  minYear = 1940,
  maxYear = new Date().getFullYear() - 18,
  label,
  error,
  className = '',
}: IOSDatePickerProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const months = isHebrew ? MONTHS_HE : MONTHS_EN;
  
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const [year, month, day] = (value || '').split('-').map(Number);
  
  const [selectedDay, setSelectedDay] = useState(day || 15);
  const [selectedMonth, setSelectedMonth] = useState((month || 6) - 1);
  const [selectedYear, setSelectedYear] = useState(year || 1990);

  useEffect(() => {
    const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onChange(formattedDate);
  }, [selectedDay, selectedMonth, selectedYear, onChange]);

  const yearIndex = years.indexOf(selectedYear);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label} <span className="text-red-400">*</span>
        </label>
      )}
      
      <div 
        className="rounded-2xl overflow-hidden p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        <div className="flex gap-2">
          <WheelColumn
            items={days}
            selectedIndex={selectedDay - 1}
            onSelect={(i) => setSelectedDay(i + 1)}
            label={isHebrew ? 'יום' : 'Day'}
          />
          <WheelColumn
            items={months}
            selectedIndex={selectedMonth}
            onSelect={setSelectedMonth}
            label={isHebrew ? 'חודש' : 'Month'}
          />
          <WheelColumn
            items={years}
            selectedIndex={yearIndex >= 0 ? yearIndex : 0}
            onSelect={(i) => setSelectedYear(years[i])}
            label={isHebrew ? 'שנה' : 'Year'}
          />
        </div>
        
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-center">
          <span className="text-base font-medium text-amber-400">
            {selectedDay}/{selectedMonth + 1}/{selectedYear}
          </span>
        </div>
      </div>
      
      {error && (
        <p className="text-sm text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
