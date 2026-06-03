import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { ChargingStation } from '@/types';
import { getStationStatus, isFastCharger, formatDistance } from '@/lib/utils';
import { StationCardSummary } from '@/components/StationCardSummary';
import {
  geocodeCity,
  geocodeCitySuggestions,
  fetchRoute,
  fetchStationsAlongRoute,
  sampleRoutePoints,
  formatRouteDuration,
  formatRouteDistance,
  type GeoLocation,
  type RouteSummary,
} from '@/utils/routingUtils';

// ─── Sub-components ───────────────────────────────────────────────────────────

function FitBounds({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.length) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}

const getStationIcon = (status: string, fast: boolean) => {
  let color = 'green';
  if (!status || status !== 'operational') color = 'red';
  else if (fast) color = 'orange';

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
  });
};

// ─── Route Summary Banner ─────────────────────────────────────────────────────

function RouteSummaryBanner({
  summary,
  stationCount,
}: {
  summary: RouteSummary;
  stationCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-ev-50 border border-ev-200 rounded-lg text-sm">
      <div className="flex items-center gap-1.5 text-ev-700 font-medium">
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 12h18M3 12l4-4m-4 4 4 4" />
        </svg>
        {formatRouteDistance(summary.distanceMeters)}
      </div>
      <div className="flex items-center gap-1.5 text-ev-700 font-medium">
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        {formatRouteDuration(summary.durationSeconds)}
      </div>
      <div className="flex items-center gap-1.5 text-green-700 font-medium">
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        {stationCount} charging station{stationCount !== 1 ? 's' : ''} along route
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoutingViewProps {
  sourceCity: string;
  setSourceCity: (city: string) => void;
  destinationCity: string;
  setDestinationCity: (city: string) => void;
  isCalculating: boolean;
  setIsCalculating: (v: boolean) => void;
  routeError: string | null;
  setRouteError: (v: string | null) => void;
  routeCoords: [number, number][] | null;
  setRouteCoords: (v: [number, number][] | null) => void;
  routeStations: ChargingStation[];
  setRouteStations: (v: ChargingStation[]) => void;
  onSelectStation?: (station: ChargingStation) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RoutingView({
  sourceCity,
  setSourceCity,
  destinationCity,
  setDestinationCity,
  isCalculating,
  setIsCalculating,
  routeError,
  setRouteError,
  routeCoords,
  setRouteCoords,
  routeStations,
  setRouteStations,
  onSelectStation,
}: RoutingViewProps) {
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [sourceSuggestions, setSourceSuggestions] = useState<GeoLocation[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GeoLocation[]>([]);
  const [highlightedSource, setHighlightedSource] = useState(-1);
  const [highlightedDest, setHighlightedDest] = useState(-1);
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [selectedSourceLoc, setSelectedSourceLoc] = useState<GeoLocation | null>(null);
  const [selectedDestLoc, setSelectedDestLoc] = useState<GeoLocation | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const suggestionSourceRef = useRef<AbortController | null>(null);
  const suggestionDestRef = useRef<AbortController | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      suggestionSourceRef.current?.abort();
      suggestionDestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (sourceCity && !selectedSourceLoc) {
      setShowSourceSuggestions(false);
      setSourceSuggestions([]);
      setHighlightedSource(-1);
    }
  }, [sourceCity, selectedSourceLoc]);

  useEffect(() => {
    if (destinationCity && !selectedDestLoc) {
      setShowDestSuggestions(false);
      setDestSuggestions([]);
      setHighlightedDest(-1);
    }
  }, [destinationCity, selectedDestLoc]);

  const calculateRoute = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setIsCalculating(true);
    setRouteError(null);
    setRouteCoords(null);
    setRouteStations([]);
    setRouteSummary(null);

    try {
      const sourceLoc = selectedSourceLoc ?? (await geocodeCity(sourceCity, signal));
      const destLoc = selectedDestLoc ?? (await geocodeCity(destinationCity, signal));

      if (!sourceLoc) throw new Error(`Could not find "${sourceCity}". Try a more specific name.`);
      if (!destLoc) throw new Error(`Could not find "${destinationCity}". Try a more specific name.`);

      // 2. Fetch route (proxied in production, direct OSRM in dev)
      const { coords, summary } = await fetchRoute(sourceLoc, destLoc, signal);
      setRouteCoords(coords);
      setRouteSummary(summary);

      // 3. Sample every 10 km then fetch ALL points in parallel
      const samplePoints = sampleRoutePoints(coords, 10);
      const stations = await fetchStationsAlongRoute(samplePoints, 10, 20, signal);
      setRouteStations(stations);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // superseded request — ignore silently
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setRouteError(message);
      console.error('Routing error:', err);
    } finally {
      // Only clear loading state if this controller is still the current one
      if (abortRef.current === controller) {
        setIsCalculating(false);
      }
    }
  }, [
    sourceCity,
    destinationCity,
    selectedSourceLoc,
    selectedDestLoc,
    setIsCalculating,
    setRouteError,
    setRouteCoords,
    setRouteStations,
  ]);

  const handleSourceChange = (value: string) => {
    setSourceCity(value);
    setSelectedSourceLoc(null);
    if (value.trim().length >= 2) {
      suggestionSourceRef.current?.abort();
      const controller = new AbortController();
      suggestionSourceRef.current = controller;
      geocodeCitySuggestions(value, controller.signal).then((results) => {
        setSourceSuggestions(results);
        setShowSourceSuggestions(true);
        setHighlightedSource(-1);
      });
    } else {
      setSourceSuggestions([]);
      setShowSourceSuggestions(false);
    }
  };

  const handleDestChange = (value: string) => {
    setDestinationCity(value);
    setSelectedDestLoc(null);
    if (value.trim().length >= 2) {
      suggestionDestRef.current?.abort();
      const controller = new AbortController();
      suggestionDestRef.current = controller;
      geocodeCitySuggestions(value, controller.signal).then((results) => {
        setDestSuggestions(results);
        setShowDestSuggestions(true);
        setHighlightedDest(-1);
      });
    } else {
      setDestSuggestions([]);
      setShowDestSuggestions(false);
    }
  };

  const handleSourceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSourceSuggestions(true);
      setHighlightedSource((prev) => Math.min(prev + 1, sourceSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSource((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlightedSource >= 0 && sourceSuggestions[highlightedSource]) {
        e.preventDefault();
        selectSourceSuggestion(sourceSuggestions[highlightedSource]);
      } else {
        handleKeyDown(e);
      }
    } else if (e.key === 'Escape') {
      setShowSourceSuggestions(false);
    } else {
      handleKeyDown(e);
    }
  };

  const handleDestKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowDestSuggestions(true);
      setHighlightedDest((prev) => Math.min(prev + 1, destSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedDest((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlightedDest >= 0 && destSuggestions[highlightedDest]) {
        e.preventDefault();
        selectDestSuggestion(destSuggestions[highlightedDest]);
      } else {
        handleKeyDown(e);
      }
    } else if (e.key === 'Escape') {
      setShowDestSuggestions(false);
    } else {
      handleKeyDown(e);
    }
  };

  const selectSourceSuggestion = (loc: GeoLocation) => {
    setSourceCity(loc.displayName);
    setSelectedSourceLoc(loc);
    setShowSourceSuggestions(false);
    setSourceSuggestions([]);
    setHighlightedSource(-1);
    sourceInputRef.current?.focus();
  };

  const selectDestSuggestion = (loc: GeoLocation) => {
    setDestinationCity(loc.displayName);
    setSelectedDestLoc(loc);
    setShowDestSuggestions(false);
    setDestSuggestions([]);
    setHighlightedDest(-1);
    destInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && sourceCity && destinationCity && !isCalculating) {
      calculateRoute();
    }
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (sourceInputRef.current && !sourceInputRef.current.contains(e.target as Node)) {
      setShowSourceSuggestions(false);
    }
    if (destInputRef.current && !destInputRef.current.contains(e.target as Node)) {
      setShowDestSuggestions(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasResults = routeCoords || routeStations.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Input Panel ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">EV Route Planner</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source City</label>
            <div className="relative">
              <input
                ref={sourceInputRef}
                type="text"
                value={sourceCity}
                onChange={(e) => handleSourceChange(e.target.value)}
                onKeyDown={handleSourceKeyDown}
                placeholder="Enter source city"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ev-600 focus:border-transparent"
                disabled={isCalculating}
                autoComplete="off"
              />
              {showSourceSuggestions && sourceSuggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {sourceSuggestions.map((loc, i) => (
                    <li
                      key={`${loc.lat}-${loc.lon}-${i}`}
                      onClick={() => selectSourceSuggestion(loc)}
                      className={`px-3 py-2 cursor-pointer text-sm truncate ${
                        i === highlightedSource ? 'bg-ev-50 text-ev-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      {loc.displayName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
            <div className="relative">
              <input
                ref={destInputRef}
                type="text"
                value={destinationCity}
                onChange={(e) => handleDestChange(e.target.value)}
                onKeyDown={handleDestKeyDown}
                placeholder="Enter destination city"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ev-600 focus:border-transparent"
                disabled={isCalculating}
                autoComplete="off"
              />
              {showDestSuggestions && destSuggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {destSuggestions.map((loc, i) => (
                    <li
                      key={`${loc.lat}-${loc.lon}-${i}`}
                      onClick={() => selectDestSuggestion(loc)}
                      className={`px-3 py-2 cursor-pointer text-sm truncate ${
                        i === highlightedDest ? 'bg-ev-50 text-ev-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      {loc.displayName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            onClick={calculateRoute}
            disabled={isCalculating || !sourceCity || !destinationCity}
            className={`w-full flex items-center justify-center px-4 py-2 bg-ev-600 text-white rounded-md hover:bg-ev-700 transition-colors disabled:opacity-50 ${
              isCalculating ? 'animate-pulse' : ''
            }`}
          >
            {isCalculating ? 'Calculating...' : 'Calculate Route'}
          </button>

          {routeError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              ⚠️ {routeError}
            </div>
          )}
        </div>
      </div>

      {/* ── Route Summary ── */}
      {routeSummary && (
        <RouteSummaryBanner summary={routeSummary} stationCount={routeStations.length} />
      )}

      {/* ── Map ── */}
      {hasResults && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Route Map</h2>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '400px', width: '100%' }}
            scrollWheelZoom
          >
            <FitBounds coords={routeCoords} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {routeCoords && (
              <Polyline positions={routeCoords} color="blue" weight={5} opacity={0.7}>
                <Popup>EV Route</Popup>
              </Polyline>
            )}
            {routeStations.map((station) => {
              const status = getStationStatus(station);
              const fast = isFastCharger(station);
              const { addressInfo: addr } = station;
              const icon = getStationIcon(status, fast);
              const isOperational = status === 'operational';
              const statusText = isOperational
                ? 'Operational'
                : status === 'planned'
                  ? 'Not Operational'
                  : 'Unknown';
              const distanceText =
                addr.distance != null ? `${formatDistance(addr.distance)} away` : '';
              const connectors = station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0);

              return (
                <Marker
                  key={station.id}
                  position={[addr.lat, addr.lon]}
                  icon={icon}
                  aria-label={`${addr.title}, ${statusText}, ${fast ? 'Fast charging, ' : ''}${distanceText}, ${connectors} connectors`}
                >
                  <Tooltip direction="top" offset={[0, -10]} sticky className="station-tooltip">
                    <StationCardSummary station={station} />
                  </Tooltip>
                  <Popup maxWidth={300} className="station-popup" autoPan={false}>
                    <StationCardSummary station={station} />
                    <div className="pt-3 border-t border-gray-200">
                      <button
                        onClick={() => onSelectStation?.(station)}
                        className="w-full text-left text-ev-600 hover:text-ev-700 underline"
                      >
                        View Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isCalculating &&
        routeCoords &&
        routeStations.length === 0 &&
        sourceCity &&
        destinationCity && (
          <div className="text-center py-8 text-gray-400">
            <p>
              No charging stations found along the route. Try adjusting the search radius or check
              the route.
            </p>
          </div>
        )}
    </div>
  );
}
