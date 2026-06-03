import { useState, useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { geocodeCitySuggestions, type GeoLocation } from '@/utils/routingUtils';

export interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (loc: GeoLocation | null, label: string) => void;
  placeholder?: string;
  disabled?: boolean;
  history?: string[];
  className?: string;
  inputClassName?: string;
}

export function CityAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Enter city name…',
  disabled,
  history = [],
  className = '',
  inputClassName = '',
}: CityAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ label: string; loc?: GeoLocation }>>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
  }, [value]);

  const loadSuggestions = useCallback(
    (query: string) => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      geocodeCitySuggestions(query, controller.signal).then((apiResults) => {
        const apiItems = apiResults.map((loc) => ({ label: loc.displayName, loc }));
        const lower = query.toLowerCase();
        const historyMatches = history
          .filter((h) => h.toLowerCase().includes(lower) && h !== query)
          .slice(0, Math.max(0, 5 - apiItems.length))
          .map((label) => ({ label, loc: undefined as GeoLocation | undefined }));
        const combined = [...apiItems, ...historyMatches];
        setSuggestions(combined);
        setShowSuggestions(combined.length > 0);
        setHighlightedIndex(-1);
      }).catch(() => {
        const lower = query.toLowerCase();
        const historyMatches = history
          .filter((h) => h.toLowerCase().includes(lower) && h !== query)
          .slice(0, 5)
          .map((label) => ({ label, loc: undefined as GeoLocation | undefined }));
        setSuggestions(historyMatches);
        setShowSuggestions(historyMatches.length > 0);
        setHighlightedIndex(-1);
      });
    },
    [history],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    setShowSuggestions(true);
    loadSuggestions(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSuggestions(true);
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (item: { label: string; loc?: GeoLocation }) => {
    onSelect(item.loc ?? null, item.label);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value.trim().length >= 2) loadSuggestions(value);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full text-gray-900 placeholder-gray-400 text-base outline-none bg-transparent pr-8 ${inputClassName}`}
        autoComplete="off"
        inputMode="search"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(s);
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
              className={`w-full text-left px-4 py-3 text-base flex items-center gap-2 ${
                i === highlightedIndex ? 'bg-ev-50 text-ev-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Search size={16} className="text-gray-400 shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
