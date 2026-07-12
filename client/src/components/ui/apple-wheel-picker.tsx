import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

export interface WheelPickerItem {
  value: string;
  label: string;
}

interface AppleWheelPickerProps {
  items: WheelPickerItem[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  itemHeight?: number;
  visibleItems?: number;
  label?: string;
  className?: string;
}

/**
 * AppleWheelPicker — a single scrolling wheel column.
 *
 * Built on NATIVE scroll + CSS scroll-snap (not a JS translateY drag). This is
 * the whole point: iOS provides real momentum + rubber-band + snap for free, so
 * it actually feels like Apple's picker, and `overscroll-behavior: contain` on
 * the native scroller reliably keeps the drag inside the wheel — the page never
 * moves. (The old transform-drag reimplemented iOS physics in JS and fought the
 * browser; touch-action patches only masked it.) selectedValue → scrollTop is
 * kept in sync both ways, guarded so programmatic scrolls don't loop.
 */
export function AppleWheelPicker({
  items,
  selectedValue,
  onValueChange,
  itemHeight = 44,
  visibleItems = 5,
  label,
  className,
}: AppleWheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const settleTimer = useRef<number>(0);

  const halfVisible = Math.floor(visibleItems / 2);
  const containerHeight = itemHeight * visibleItems;
  const padHeight = halfVisible * itemHeight;

  const indexOfSelected = useCallback(() => {
    const i = items.findIndex((it) => it.value === selectedValue);
    return i >= 0 ? i : 0;
  }, [items, selectedValue]);

  // Programmatic scroll to an item's centre, guarded so it does NOT echo back
  // through onScroll as a user change (which would loop with the parent state).
  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTo({ top: index * itemHeight, behavior: smooth ? 'smooth' : 'auto' });
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => { programmatic.current = false; }, smooth ? 350 : 60);
  }, [itemHeight]);

  // Position on mount at the initially-selected item (no animation).
  useEffect(() => {
    scrollToIndex(indexOfSelected(), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync when the value changes from OUTSIDE (e.g. day clamped to 28, reset).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || programmatic.current) return;
    const idx = indexOfSelected();
    if (Math.round(el.scrollTop / itemHeight) !== idx) scrollToIndex(idx, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue, items.length]);

  // On settle, report the centred item up. Debounced so it fires once per flick.
  const handleScroll = useCallback(() => {
    if (programmatic.current) return;
    const el = scrollRef.current;
    if (!el) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / itemHeight)));
      const item = items[idx];
      if (item && item.value !== selectedValue) onValueChange(item.value);
    }, 100);
  }, [itemHeight, items, onValueChange, selectedValue]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {label && (
        <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{label}</span>
      )}
      <div className="relative rounded-xl overflow-hidden" style={{ height: containerHeight, width: '100%' }}>
        {/* Static chrome: soft top/bottom fade + centre selection band. */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-0 left-0 right-0" style={{ height: padHeight, background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.55))' }} />
          <div className="absolute left-0 right-0" style={{ top: padHeight, height: itemHeight, borderTop: '1.5px solid rgba(0,0,0,0.08)', borderBottom: '1.5px solid rgba(0,0,0,0.08)', background: 'rgba(245,245,247,0.5)' }} />
          <div className="absolute bottom-0 left-0 right-0" style={{ height: padHeight, background: 'linear-gradient(to top, rgba(255,255,255,0.95), rgba(255,255,255,0.55))' }} />
        </div>

        {/* Native scroller — real iOS momentum + snap; overscroll-contain keeps
            the gesture in the wheel so the page never moves. */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="wheel-scroll h-full overflow-y-scroll"
          style={{ scrollSnapType: 'y mandatory', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ height: padHeight }} aria-hidden="true" />
          {items.map((item, index) => (
            <div
              key={item.value}
              onClick={() => { onValueChange(item.value); scrollToIndex(index, true); }}
              className="flex items-center justify-center cursor-pointer"
              style={{ height: itemHeight, scrollSnapAlign: 'center' }}
            >
              <span className="text-lg font-semibold text-gray-900 whitespace-nowrap px-2 text-center">
                {item.label}
              </span>
            </div>
          ))}
          <div style={{ height: padHeight }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

interface AppleWheelDatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  minYear?: number;
  maxYear?: number;
  label?: string;
  error?: string;
  className?: string;
  monthNames?: string[];
  dayLabel?: string;
  monthLabel?: string;
  yearLabel?: string;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function AppleWheelDatePicker({
  value,
  onChange,
  minYear = 1940,
  maxYear = new Date().getFullYear(),
  label,
  error,
  className,
  monthNames = MONTHS_EN,
  dayLabel = 'Day',
  monthLabel = 'Month',
  yearLabel = 'Year',
}: AppleWheelDatePickerProps) {
  const parts = (value || '').split('-');
  const [selectedYear, setSelectedYear] = useState(parts[0] || String(maxYear - 25));
  const [selectedMonth, setSelectedMonth] = useState(parts[1] || '06');
  const [selectedDay, setSelectedDay] = useState(parts[2] || '15');

  useEffect(() => {
    if (value) {
      const p = value.split('-');
      if (p[0]) setSelectedYear(p[0]);
      if (p[1]) setSelectedMonth(p[1]);
      if (p[2]) setSelectedDay(p[2]);
    }
  }, [value]);

  const emitChange = useCallback((y: string, m: string, d: string) => {
    const maxDays = new Date(parseInt(y), parseInt(m), 0).getDate();
    const clampedDay = Math.min(parseInt(d), maxDays);
    const formatted = `${y}-${m.padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    onChange(formatted);
  }, [onChange]);

  const dayItems: WheelPickerItem[] = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1),
  }));

  const monthItems: WheelPickerItem[] = monthNames.map((name, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: name,
  }));

  const yearItems: WheelPickerItem[] = Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({
    value: String(maxYear - i),
    label: String(maxYear - i),
  }));

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-3">
        <div className="grid grid-cols-3 gap-1">
          <AppleWheelPicker
            items={dayItems}
            selectedValue={selectedDay}
            onValueChange={(v) => {
              setSelectedDay(v);
              emitChange(selectedYear, selectedMonth, v);
            }}
            label={dayLabel}
          />
          <AppleWheelPicker
            items={monthItems}
            selectedValue={selectedMonth}
            onValueChange={(v) => {
              setSelectedMonth(v);
              emitChange(selectedYear, v, selectedDay);
            }}
            label={monthLabel}
          />
          <AppleWheelPicker
            items={yearItems}
            selectedValue={selectedYear}
            onValueChange={(v) => {
              setSelectedYear(v);
              emitChange(v, selectedMonth, selectedDay);
            }}
            label={yearLabel}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}

interface AppleWheelSelectProps {
  items: WheelPickerItem[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  error?: string;
  className?: string;
  placeholder?: string;
}

export function AppleWheelSelect({
  items,
  value,
  onValueChange,
  label,
  error,
  className,
}: AppleWheelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedItem = items.find(i => i.value === value);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-white text-left',
          'text-base font-medium transition-all duration-200',
          isOpen ? 'border-[#D4AF37] shadow-md ring-2 ring-[#D4AF37]' : 'border-gray-200 shadow-sm hover:border-gray-300',
        )}
      >
        <span className={selectedItem ? 'text-gray-900' : 'text-gray-400'}>
          {selectedItem ? selectedItem.label : '--'}
        </span>
        <svg
          className={cn('h-5 w-5 text-gray-400 transition-transform duration-200', isOpen && 'rotate-180')}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <AppleWheelPicker
            items={items}
            selectedValue={value}
            onValueChange={(v) => {
              onValueChange(v);
              setIsOpen(false);
            }}
            visibleItems={7}
          />
        </div>
      )}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
