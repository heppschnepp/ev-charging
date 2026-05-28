import { useState, useRef, useEffect } from 'react';
import { Search, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onSearch: (city: string, distance: number, maxResults: number, operator?: string) => void;
  isLoading: boolean;
  history?: string[];
}

export function SearchBar({ onSearch, isLoading, history = [] }: Props) {
  const [city, setCity] = useState('');
  const [distance, setDistance] = useState(10);
  const [maxResults, setMaxResults] = useState(20);
  const [operator, setOperator] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = history
    .filter((h) => h.toLowerCase().includes(city.toLowerCase()) && h !== city)
    .slice(0, 5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    setShowSuggestions(false);
    onSearch(city.trim(), distance, maxResults, operator.trim() || undefined);
  };

  const handleSuggestionSelect = (s: string) => {
    setCity(s);
    setShowSuggestions(false);
    onSearch(s, distance, maxResults, operator.trim() || undefined);
  };

  useEffect(() => {
    const handleClick = () => setShowSuggestions(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
        {/* Main search row */}
        <div className="flex items-center px-4 py-3 gap-3 relative">
          <Search className="text-gray-400 shrink-0" size={20} />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Enter city name…"
              className="w-full text-gray-900 placeholder-gray-400 text-base outline-none bg-transparent"
              autoComplete="off"
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSuggestionSelect(s);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Search size={14} className="text-gray-400" />
                    {s}
                  </button>
                ))}
</div>
            )}
           </div>
           <button
             type="button"
             onClick={() => setShowOptions(!showOptions)}
             className={cn(
               'p-2 rounded-lg transition-colors',
               showOptions ? 'bg-ev-100 text-ev-600' : 'text-gray-400 hover:bg-gray-100',
             )}
             title="Search options"
           >
             <Sliders size={18} />
           </button>
           <button
             type="submit"
             disabled={isLoading || !city.trim()}
             className={cn(
               'px-5 py-2 rounded-xl font-semibold text-sm transition-all',
               isLoading || !city.trim()
                 ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                 : 'bg-ev-600 text-white hover:bg-ev-700 active:scale-95',
             )}
           >
             {isLoading ? 'Searching…' : 'Search'}
           </button>
         </div>

        {/* Options panel */}
        {showOptions && (
          <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">
                Search radius: <span className="text-gray-900 font-semibold">{distance} km</span>
              </label>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-full accent-ev-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 km</span><span>100 km</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">
                Max results: <span className="text-gray-900 font-semibold">{maxResults}</span>
              </label>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full accent-ev-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5</span><span>100</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-2">
                Operator (optional)
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Filter by operator name…"
                className="w-full text-gray-900 placeholder-gray-400 text-base outline-none bg-transparent border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
