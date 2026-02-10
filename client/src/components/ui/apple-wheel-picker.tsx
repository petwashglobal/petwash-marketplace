import { useRef, useEffect, useState, useCallback } from 'react';
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

const DECELERATION = 0.95;
const MIN_VELOCITY = 0.5;

export function AppleWheelPicker({
  items,
  selectedValue,
  onValueChange,
  itemHeight = 44,
  visibleItems = 5,
  label,
  className,
}: AppleWheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastTouchY = useRef(0);
  const lastTouchTime = useRef(0);
  const currentOffset = useRef(0);
  const isDragging = useRef(false);

  const halfVisible = Math.floor(visibleItems / 2);
  const containerHeight = itemHeight * visibleItems;
  const paddingTop = halfVisible * itemHeight;

  const selectedIndex = items.findIndex(item => item.value === selectedValue);
  const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const [offset, setOffset] = useState(-initialIndex * itemHeight);

  useEffect(() => {
    const idx = items.findIndex(item => item.value === selectedValue);
    if (idx >= 0 && !isDragging.current) {
      const newOffset = -idx * itemHeight;
      currentOffset.current = newOffset;
      setOffset(newOffset);
    }
  }, [selectedValue, items, itemHeight]);

  const snapToNearest = useCallback((currentOff: number, velocity = 0) => {
    cancelAnimationFrame(animFrameRef.current);

    if (Math.abs(velocity) > MIN_VELOCITY) {
      let vel = velocity;
      let off = currentOff;

      const animate = () => {
        vel *= DECELERATION;
        off += vel;

        const maxOffset = 0;
        const minOffset = -(items.length - 1) * itemHeight;
        off = Math.max(minOffset, Math.min(maxOffset, off));

        currentOffset.current = off;
        setOffset(off);

        if (Math.abs(vel) > MIN_VELOCITY && off > minOffset && off < maxOffset) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          const index = Math.round(-off / itemHeight);
          const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
          const snapOffset = -clampedIndex * itemHeight;
          currentOffset.current = snapOffset;
          setOffset(snapOffset);
          if (items[clampedIndex]) {
            onValueChange(items[clampedIndex].value);
          }
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      const index = Math.round(-currentOff / itemHeight);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
      const snapOffset = -clampedIndex * itemHeight;
      currentOffset.current = snapOffset;
      setOffset(snapOffset);
      if (items[clampedIndex]) {
        onValueChange(items[clampedIndex].value);
      }
    }
  }, [items, itemHeight, onValueChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    cancelAnimationFrame(animFrameRef.current);
    isDragging.current = true;
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    lastTouchY.current = touch.clientY;
    lastTouchTime.current = Date.now();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const delta = touch.clientY - lastTouchY.current;
    lastTouchY.current = touch.clientY;
    lastTouchTime.current = Date.now();

    let newOffset = currentOffset.current + delta;
    const maxOffset = itemHeight * 0.5;
    const minOffset = -(items.length - 1) * itemHeight - itemHeight * 0.5;
    newOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));

    currentOffset.current = newOffset;
    setOffset(newOffset);
  }, [items.length, itemHeight]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    const timeDelta = Date.now() - lastTouchTime.current;
    const totalDelta = lastTouchY.current - touchStartY.current;
    const totalTime = Date.now() - touchStartTime.current;

    let velocity = 0;
    if (timeDelta < 100 && totalTime < 300) {
      velocity = totalDelta / Math.max(totalTime, 1) * 15;
    } else if (timeDelta < 50) {
      velocity = totalDelta / Math.max(timeDelta, 1) * 5;
    }

    snapToNearest(currentOffset.current, velocity);
  }, [snapToNearest]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    cancelAnimationFrame(animFrameRef.current);
    isDragging.current = true;
    touchStartY.current = e.clientY;
    touchStartTime.current = Date.now();
    lastTouchY.current = e.clientY;
    lastTouchTime.current = Date.now();

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientY - lastTouchY.current;
      lastTouchY.current = ev.clientY;
      lastTouchTime.current = Date.now();

      let newOffset = currentOffset.current + delta;
      const maxOffset = itemHeight * 0.5;
      const minOffset = -(items.length - 1) * itemHeight - itemHeight * 0.5;
      newOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));
      currentOffset.current = newOffset;
      setOffset(newOffset);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      const timeDelta = Date.now() - lastTouchTime.current;
      const totalDelta = lastTouchY.current - touchStartY.current;
      const totalTime = Date.now() - touchStartTime.current;

      let velocity = 0;
      if (timeDelta < 100 && totalTime < 300) {
        velocity = totalDelta / Math.max(totalTime, 1) * 15;
      }
      snapToNearest(currentOffset.current, velocity);

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    mouseCleanupRef.current = { move: handleMouseMove, up: handleMouseUp };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [items.length, itemHeight, snapToNearest]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    cancelAnimationFrame(animFrameRef.current);
    const delta = -e.deltaY;
    let newOffset = currentOffset.current + delta * 0.5;
    const maxOffset = 0;
    const minOffset = -(items.length - 1) * itemHeight;
    newOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));
    currentOffset.current = newOffset;
    setOffset(newOffset);

    snapToNearest(newOffset, 0);
  }, [items.length, itemHeight, snapToNearest]);

  const handleItemClick = useCallback((index: number) => {
    const newOffset = -index * itemHeight;
    currentOffset.current = newOffset;
    setOffset(newOffset);
    if (items[index]) {
      onValueChange(items[index].value);
    }
  }, [itemHeight, items, onValueChange]);

  const mouseCleanupRef = useRef<{ move: (ev: MouseEvent) => void; up: () => void } | null>(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (mouseCleanupRef.current) {
        document.removeEventListener('mousemove', mouseCleanupRef.current.move);
        document.removeEventListener('mouseup', mouseCleanupRef.current.up);
        mouseCleanupRef.current = null;
      }
    };
  }, []);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {label && (
        <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{label}</span>
      )}
      <div
        ref={containerRef}
        className="relative overflow-hidden select-none cursor-grab active:cursor-grabbing rounded-xl"
        style={{ height: containerHeight, width: '100%' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <div className="absolute inset-0 pointer-events-none z-10">
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: paddingTop,
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.6))',
            }}
          />
          <div
            className="absolute left-0 right-0"
            style={{
              top: paddingTop,
              height: itemHeight,
              borderTop: '1.5px solid rgba(0,0,0,0.08)',
              borderBottom: '1.5px solid rgba(0,0,0,0.08)',
              background: 'rgba(245,245,247,0.5)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: paddingTop,
              background: 'linear-gradient(to top, rgba(255,255,255,0.95), rgba(255,255,255,0.6))',
            }}
          />
        </div>

        <div
          ref={scrollRef}
          className="absolute left-0 right-0"
          style={{
            transform: `translateY(${offset + paddingTop}px)`,
            transition: isDragging.current ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          {items.map((item, index) => {
            const itemOffset = offset + index * itemHeight + paddingTop;
            const center = containerHeight / 2;
            const distance = Math.abs(itemOffset + itemHeight / 2 - center);
            const maxDistance = containerHeight / 2;
            const normalizedDistance = Math.min(distance / maxDistance, 1);
            const scale = 1 - normalizedDistance * 0.25;
            const opacity = 1 - normalizedDistance * 0.6;

            return (
              <div
                key={item.value}
                className="flex items-center justify-center"
                style={{
                  height: itemHeight,
                  transform: `scale(${scale})`,
                  opacity,
                  transition: isDragging.current ? 'none' : 'transform 0.15s ease-out, opacity 0.15s ease-out',
                }}
                onClick={() => handleItemClick(index)}
              >
                <span className="text-lg font-semibold text-gray-900 whitespace-nowrap px-2 text-center">
                  {item.label}
                </span>
              </div>
            );
          })}
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
          isOpen ? 'border-blue-400 shadow-md ring-2 ring-blue-100' : 'border-gray-200 shadow-sm hover:border-gray-300',
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
