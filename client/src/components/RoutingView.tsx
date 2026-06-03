import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { ChargingStation } from '@/types';
import { getStationStatus, isFastCharger, formatDistance } from '@/lib/utils';
import { StationCardSummary } from '@/components/StationCardSummary';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import {
  geocodeCity,
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
  const [selectedSourceLoc, setSelectedSourceLoc] = useState<GeoLocation | null>(null);
  const [selectedDestLoc, setSelectedDestLoc] = useState<GeoLocation | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const calculateRoute = useCallback(async () => {
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

      const { coords, summary } = await fetchRoute(sourceLoc, destLoc, signal);
      setRouteCoords(coords);
      setRouteSummary(summary);

      const samplePoints = sampleRoutePoints(coords, 10);
      const stations = await fetchStationsAlongRoute(samplePoints, 10, 20, signal);
      setRouteStations(stations);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setRouteError(message);
      console.error('Routing error:', err);
    } finally {
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

  const handleSourceSelect = (loc: GeoLocation | null, label: string) => {
    setSourceCity(label);
    setSelectedSourceLoc(loc);
  };

  const handleDestSelect = (loc: GeoLocation | null, label: string) => {
    setDestinationCity(label);
    setSelectedDestLoc(loc);
  };

  const hasResults = routeCoords || routeStations.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Input Panel ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">EV Route Planner</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source City</label>
            <CityAutocomplete
              value={sourceCity}
              onChange={setSourceCity}
              onSelect={handleSourceSelect}
              placeholder="Enter source city"
              disabled={isCalculating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
            <CityAutocomplete
              value={destinationCity}
              onChange={setDestinationCity}
              onSelect={handleDestSelect}
              placeholder="Enter destination city"
              disabled={isCalculating}
            />
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
