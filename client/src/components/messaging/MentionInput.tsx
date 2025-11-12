import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface MentionSuggestion {
  id: string;
  display: string;
  type: 'user' | 'role';
}

const ROLE_SUGGESTIONS: MentionSuggestion[] = [
  { id: 'tech-ops', display: 'Tech Ops Team', type: 'role' },
  { id: 'hq', display: 'HQ Staff', type: 'role' },
  { id: 'sales', display: 'Sales Team', type: 'role' },
  { id: 'support', display: 'Support Team', type: 'role' },
  { id: 'management', display: 'Management', type: 'role' },
  { id: 'franchisee', display: 'Franchisee', type: 'role' },
  { id: 'techs', display: 'Field Technicians', type: 'role' },
  { id: 'logistics', display: 'Logistics Team', type: 'role' },
];

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function MentionInput({ value, onChange, placeholder, disabled, className, onKeyDown }: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@([\w-]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      
      const filtered = ROLE_SUGGESTIONS.filter(
        s => s.id.toLowerCase().includes(query) || s.display.toLowerCase().includes(query)
      );
      
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  }, [value]);

  const insertMention = (suggestion: MentionSuggestion) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@([\w-]*)$/);

    if (mentionMatch) {
      const newText = textBeforeCursor.slice(0, -mentionMatch[0].length) + `@${suggestion.id} ` + textAfterCursor;
      onChange(newText);
      setShowSuggestions(false);
      
      setTimeout(() => {
        textareaRef.current?.focus();
        const newCursorPos = cursorPosition - mentionMatch[0].length + suggestion.id.length + 2;
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'Tab') {
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
        }
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
          return;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }
    
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        data-testid="input-mention-textarea"
      />
      
      {showSuggestions && (
        <Card className="absolute bottom-full left-0 right-0 mb-2 max-h-48 overflow-y-auto z-50 shadow-lg">
          <div className="p-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => insertMention(suggestion)}
                data-testid={`mention-suggestion-${suggestion.id}`}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                    @{suggestion.id}
                  </span>
                  <span className="text-gray-600">{suggestion.display}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
