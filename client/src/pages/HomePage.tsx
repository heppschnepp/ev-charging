import { useState, useMemo } from 'react';
import { Zap, MapPin, Share2 } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { StationCard } from '@/components/StationCard';
import { SummaryBar } from '@/components/SummaryBar';
import { FilterBar } from '@/components/FilterBar';
import { Sidebar } from '@/components/Sidebar';
import { StationMap } from '@/components/StationMap';
import { StationCardDetails } from '@/components/StationCardDetails';
import { RoutingView } from '@/components/RoutingView';
import { useStations } from '@/hooks/useStations';
import { useFavorites } from '@/hooks/useFavorites';
import { useHistory } from '@/hooks/useHistory';
import type { FilterType, SearchHistoryEntry, ChargingStation } from '@/types';
import { filterStations, isFastCharger, cn } from '@/lib/utils';

export function HomePage() {
  const [searchParams, setSearchParams] = useState<{
    city?: string;
    lat?: number;
    lon?: number;
    distance: number;
    maxResults: number;
    operator?: string;
    power?: number;
    enabled: boolean;
  }>({ city: '', distance: 10, maxResults: 20, enabled: false });

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'routing'>('list');
   const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);

   // Routing state
   const [sourceCity, setSourceCity] = useState('');
   const [destinationCity, setDestinationCity] = useState('');
   const [isCalculating, setIsCalculating] = useState(false);
   const [routeError, setRouteError] = useState<string | null>(null);
   const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
   const [routeStations, setRouteStations] = useState<ChargingStation[]>([]);

    const { data, isLoading, error } = useStations(
      searchParams.city,
      searchParams.lat,
      searchParams.lon,
      searchParams.distance,
      searchParams.maxResults,
      searchParams.operator,
      searchParams.power,
      searchParams.enabled
    );

   const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
   const { data: history = [] } = useHistory();

   const handleSearch = (params: { city?: string; lat?: number; lon?: number; distance: number; maxResults: number; operator?: string; power?: number }) => {
     setActiveFilter('all');
     setSearchParams({ ...params, enabled: true });
   };

   const handleHistorySelect = (entry: SearchHistoryEntry) => {
     setSearchParams({
       city: entry.city,
       lat: entry.lat,
       lon: entry.lon,
       distance: entry.distance,
       maxResults: 20,
       operator: '',
       power: undefined,
       enabled: true,
     });
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
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2.5 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-ev-600 flex items-center justify-center">
                <Zap size={20} className="text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 leading-none text-lg">EV Charging Finder</h1>
                <p className="text-xs text-gray-400 leading-none mt-0.5">Powered by Open Charge Map</p>
              </div>
            </div>
            
            {/* View toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium',
                  viewMode === 'list'
                    ? 'bg-ev-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium',
                  viewMode === 'map'
                    ? 'bg-ev-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                Map
              </button>
              <button
                onClick={() => setViewMode('routing')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium',
                  viewMode === 'routing'
                    ? 'bg-ev-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                Routing
              </button>
            </div>
          </div>
          
           {viewMode !== 'routing' && (
             <SearchBar
               onSearch={handleSearch}
               isLoading={isLoading}
               history={historyCities}
             />
           )}
        </div>
      </header>

       {/* Body */}
       <main className="px-4 sm:px-6 lg:px-8 py-8">
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
                 {viewMode === 'list' && (
                   <>
                     <SummaryBar
                       stations={data.stations}
                       location={data.location}
                     />
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
                 
                  {viewMode === 'map' && (
                    <div className="min-h-[300px] h-[60vh] w-full">
                      <StationMap
                        stations={filtered}
                        onSelectStation={(station) => {
                          setSelectedStation(station);
                        }}
                      />
                    </div>
                  )}
               </>
             )}
             
              {viewMode === 'routing' && (
                <RoutingView
                  sourceCity={sourceCity}
                  setSourceCity={setSourceCity}
                  destinationCity={destinationCity}
                  setDestinationCity={setDestinationCity}
                  isCalculating={isCalculating}
                  setIsCalculating={setIsCalculating}
                  routeError={routeError}
                  setRouteError={setRouteError}
                  routeCoords={routeCoords}
                  setRouteCoords={setRouteCoords}
                  routeStations={routeStations}
                  setRouteStations={setRouteStations}
                   onSelectStation={setSelectedStation}
                  />
                )}
               {/* Selected station details - show when a station is selected */}
              {selectedStation && (
                <div className="mt-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedStation.addressInfo.title}
                    </h2>
                    <button
                      onClick={() => setSelectedStation(null)}
                      className="text-gray-500 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  <StationCardDetails station={selectedStation} />
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