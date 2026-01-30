import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/languageStore';

interface IOSDatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  minYear?: number;
  maxYear?: number;
  label?: string;
  error?: string;
  className?: string;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

interface WheelColumnProps {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  height?: number;
}

function WheelColumn({ items, selectedIndex, onSelect, height = 200 }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 44;
  const visibleItems = Math.floor(height / itemHeight);
  const padding = Math.floor(visibleItems / 2) * itemHeight;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = selectedIndex * itemHeight;
    }
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop;
      const newIndex = Math.round(scrollTop / itemHeight);
      if (newIndex >= 0 && newIndex < items.length && newIndex !== selectedIndex) {
        onSelect(newIndex);
      }
    }
  }, [items.length, onSelect, selectedIndex]);

  const handleScrollEnd = useCallback(() => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop;
      const targetIndex = Math.round(scrollTop / itemHeight);
      containerRef.current.scrollTo({
        top: targetIndex * itemHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden" style={{ height }}>
      <div 
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 bg-blue-500/20 border-y border-blue-400/30 pointer-events-none z-10"
      />
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-hide scroll-smooth"
        style={{ 
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          paddingTop: padding,
          paddingBottom: padding,
        }}
        onScroll={handleScroll}
        onTouchEnd={handleScrollEnd}
        onMouseUp={handleScrollEnd}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className={`
              h-11 flex items-center justify-center
              cursor-pointer select-none
              transition-all duration-150
              ${index === selectedIndex 
                ? 'text-white font-semibold text-lg' 
                : 'text-gray-400 text-base'
              }
            `}
            style={{ scrollSnapAlign: 'center' }}
            onClick={() => {
              onSelect(index);
              if (containerRef.current) {
                containerRef.current.scrollTo({
                  top: index * itemHeight,
                  behavior: 'smooth'
                });
              }
            }}
          >
            {item}
          </div>
        ))}
      </div>
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
  
  const [year, month, day] = (value || '').split('-').map(Number);
  
  const [selectedDay, setSelectedDay] = useState(day || 15);
  const [selectedMonth, setSelectedMonth] = useState((month || 1) - 1);
  const [selectedYear, setSelectedYear] = useState(year || 1990);

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  useEffect(() => {
    if (selectedDay && selectedMonth !== undefined && selectedYear) {
      const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      onChange(formattedDate);
    }
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
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        <div className="flex gap-1 p-2" style={{ height: 200 }}>
          <WheelColumn
            items={days}
            selectedIndex={selectedDay - 1}
            onSelect={(i) => setSelectedDay(i + 1)}
          />
          <WheelColumn
            items={months}
            selectedIndex={selectedMonth}
            onSelect={setSelectedMonth}
          />
          <WheelColumn
            items={years}
            selectedIndex={yearIndex >= 0 ? yearIndex : 0}
            onSelect={(i) => setSelectedYear(years[i])}
          />
        </div>
        
        <div className="px-4 py-2 border-t border-white/10 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            {isHebrew ? 'תאריך לידה' : 'Date of Birth'}
          </span>
          <span className="text-sm font-medium text-amber-400">
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
