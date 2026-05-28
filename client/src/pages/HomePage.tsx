import { useState, useMemo } from 'react';
import { Zap } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { StationCard } from '@/components/StationCard';
import { SummaryBar } from '@/components/SummaryBar';
import { FilterBar } from '@/components/FilterBar';
import { Sidebar } from '@/components/Sidebar';
import { useStations } from '@/hooks/useStations';
import { useFavorites } from '@/hooks/useFavorites';
import { useHistory } from '@/hooks/useHistory';
import { filterStations, isFastCharger } from '@/lib/utils';
import type { FilterType } from '@/types';

export function HomePage() {
  const [searchParams, setSearchParams] = useState<{
    city: string; distance: number; maxResults: number; operator?: string; enabled: boolean;
  }>({ city: '', distance: 10, maxResults: 20, enabled: false });

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const { data, isLoading, error } = useStations(
    searchParams.city,
    searchParams.distance,
    searchParams.maxResults,
    searchParams.operator,
    searchParams.enabled,
  );

  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { data: history = [] } = useHistory();

  const handleSearch = (city: string, distance: number, maxResults: number, operator?: string) => {
    setActiveFilter('all');
    setSearchParams({ city, distance, maxResults, operator, enabled: true });
  };

  const handleHistorySelect = (city: string) => {
    setSearchParams((p) => ({ ...p, city, enabled: true }));
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterStations(data.stations, activeFilter);
  }, [data, activeFilter]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, operational: 0, fast: 0, free: 0 };
    const s = data.stations;
    return {
      all: s.length,
      operational: s.filter((x) => x.isOperational === true).length,
      fast: s.filter(isFastCharger).length,
      free: s.filter((x) => x.usageTypeTitle?.toLowerCase().includes('free') ?? false).length,
    };
  }, [data]);

  const historyCities = [...new Set(history.map((h) => h.city))];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ev-600 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-none text-lg">EV Charging Finder</h1>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Powered by Open Charge Map</p>
            </div>
          </div>
          <div className="flex-1 max-w-xl ml-4">
            <SearchBar
              onSearch={handleSearch}
              isLoading={isLoading}
              history={historyCities}
            />
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Results */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                ⚠️ {error instanceof Error ? error.message : 'Something went wrong.'}
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                        <div className="h-3 bg-gray-100 rounded w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {data && !isLoading && (
              <>
                <SummaryBar stations={data.stations} location={data.location} cachedAt={data.cachedAt} />
                <FilterBar active={activeFilter} onChange={setActiveFilter} counts={counts} />

                {filtered.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Zap size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No stations match this filter.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((station) => (
                      <StationCard
                        key={station.id}
                        station={station}
                        isFavorite={isFavorite(station.id)}
                        onToggleFavorite={(s) =>
                          isFavorite(s.id) ? removeFavorite(s.id) : addFavorite(s)
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Empty state */}
            {!data && !isLoading && !error && (
              <div className="text-center py-24 text-gray-300">
                <Zap size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-gray-400 text-base font-medium">Find EV charging stations near you</p>
                <p className="text-gray-300 text-sm mt-1">Enter a city name to get started</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-72 shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <Sidebar
                favorites={favorites}
                history={history}
                onRemoveFavorite={removeFavorite}
                onSelectHistory={handleHistorySelect}
              />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
