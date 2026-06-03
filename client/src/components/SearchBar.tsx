import { useState, useRef } from 'react';
import { Search, Sliders, X, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import type { GeoLocation } from '@/utils/routingUtils';

interface Props {
  onSearch: (params: {
    city?: string;
    lat?: number;
    lon?: number;
    distance: number;
    maxResults: number;
    operator?: string;
    power?: number;
  }) => void;
  isLoading: boolean;
  history?: string[];
}

export function SearchBar({ onSearch, isLoading, history = [] }: Props) {
  const [city, setCity] = useState('');
  const [distance, setDistance] = useState(10);
  const [maxResults, setMaxResults] = useState(20);
  const [operator, setOperator] = useState('');
  const [power, setPower] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocationError(null);
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onSearch({
          lat: latitude,
          lon: longitude,
          distance,
          maxResults,
          operator: operator.trim() || undefined,
          power: power || undefined,
        });
        setIsFetchingLocation(false);
        setCity('');
        inputRef.current?.blur();
      },
      (error) => {
        let message = 'Unknown error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            message = 'The request to get user location timed out.';
            break;
          default:
            message = `An unknown error occurred: error.code`;
        }
        setLocationError(message);
        setIsFetchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const handleSelect = (loc: GeoLocation | null, label: string) => {
    setCity(label);
    if (loc) {
      onSearch({
        lat: loc.lat,
        lon: loc.lon,
        distance,
        maxResults,
        operator: operator.trim() || undefined,
        power: power || undefined,
      });
    } else {
      onSearch({
        city: label,
        distance,
        maxResults,
        operator: operator.trim() || undefined,
        power: power || undefined,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    onSearch({
      city: city.trim(),
      distance,
      maxResults,
      operator: operator.trim() || undefined,
      power: power || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
        {/* Main search row */}
        <div className="flex items-center px-4 py-3 gap-2 relative">
          {/* Location button */}
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isFetchingLocation || isLoading}
            className={cn(
              'p-2.5 rounded-lg transition-colors shrink-0',
              isFetchingLocation
                ? 'bg-ev-100 text-ev-600 animate-pulse'
                : 'text-gray-400 hover:bg-gray-100',
            )}
            title="Use my location"
            aria-label="Use my location"
          >
            {isFetchingLocation ? (
              <MapPin className="animate-spin" size={20} />
            ) : (
              <MapPin size={20} />
            )}
          </button>
          <Search className="text-gray-400 shrink-0" size={20} />
          <div className="relative flex-1">
            <CityAutocomplete
              value={city}
              onChange={setCity}
              onSelect={handleSelect}
              placeholder="Enter city name…"
              disabled={isFetchingLocation || isLoading}
              history={history}
              inputClassName="pr-8"
            />
            {city && (
              <button
                type="button"
                onClick={() => {
                  setCity('');
                  inputRef.current?.focus();
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className={cn(
              'p-2.5 rounded-lg transition-colors shrink-0',
              showOptions ? 'bg-ev-100 text-ev-600' : 'text-gray-400 hover:bg-gray-100',
            )}
            title="Search options"
            aria-label="Toggle search options"
          >
            <Sliders size={20} />
          </button>
          <button
            type="submit"
            disabled={isLoading || (!city.trim() && !isFetchingLocation)}
            className={cn(
              'px-5 py-2.5 rounded-xl font-semibold text-base transition-all shrink-0',
              isLoading || (!city.trim() && !isFetchingLocation)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-ev-600 text-white hover:bg-ev-700 active:bg-ev-800',
            )}
          >
            {isLoading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* Location error message */}
        {locationError && (
          <div className="px-4 py-2 text-sm text-red-600 bg-red-50 rounded-b-md">
            ⚠️ {locationError}
          </div>
        )}

        {/* Options panel */}
        {showOptions && (
          <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
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
                className="w-full accent-ev-600 h-5"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 km</span>
                <span>100 km</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">
                Min Power (KW): <span className="text-gray-900 font-semibold">{power}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={power}
                onChange={(e) => setPower(Number(e.target.value))}
                className="w-full accent-ev-600 h-5"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0 KW</span>
                <span>1000 KW</span>
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
                className="w-full accent-ev-600 h-5"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5</span>
                <span>100</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-2">
                Operator (optional)
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Filter by operator name…"
                className="w-full text-gray-900 placeholder-gray-400 text-base outline-none bg-transparent border border-gray-200 rounded-lg px-3 py-2.5"
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
