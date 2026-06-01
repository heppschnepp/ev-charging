import { useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fits the map view to the route bounds whenever routeCoords changes
function FitBounds({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}
import { ChargingStation } from '@/types';
import { getStationStatus, isFastCharger, formatDistance } from '@/lib/utils';
import { StationCardSummary } from '@/components/StationCardSummary';

// Custom icon for stations
const getStationIcon = (status: string, fast: boolean) => {
  let iconColor = 'green';
  if (!status || status !== 'operational') iconColor = 'red';
  else if (fast) iconColor = 'orange';

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${iconColor}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
  });
};

interface RoutingViewProps {
  sourceCity: string;
  setSourceCity: (city: string) => void;
  destinationCity: string;
  setDestinationCity: (city: string) => void;
  isCalculating: boolean;
  setIsCalculating: (calculating: boolean) => void;
  routeError: string | null;
  setRouteError: (error: string | null) => void;
  routeCoords: [number, number][] | null;
  setRouteCoords: (coords: [number, number][] | null) => void;
  routeStations: ChargingStation[];
  setRouteStations: (stations: ChargingStation[]) => void;
}

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
}: RoutingViewProps) {
  // Haversine distance in meters
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Helper function to sample points along a route at a given interval (in km)
  function sampleRoutePoints(points: [number, number][], intervalKm: number): [number, number][] {
    if (points.length < 2) return points;

    const sampled: [number, number][] = [points[0]];
    let accumulatedDistance = 0;
    const targetDistance = intervalKm * 1000;

    for (let i = 1; i < points.length; i++) {
      const [lat1, lon1] = points[i - 1];
      const [lat2, lon2] = points[i];
      const segmentDistance = haversineDistance(lat1, lon1, lat2, lon2);
      accumulatedDistance += segmentDistance;

      while (accumulatedDistance >= targetDistance && sampled.length < points.length) {
        const overshoot = accumulatedDistance - targetDistance;
        const direction = segmentDistance > 0 ? (segmentDistance - overshoot) / segmentDistance : 0;
        const interpolatedLat = lat1 + (lat2 - lat1) * direction;
        const interpolatedLon = lon1 + (lon2 - lon1) * direction;
        sampled.push([interpolatedLat, interpolatedLon]);
        accumulatedDistance = overshoot;
      }
    }

    if (
      sampled[sampled.length - 1][0] !== points[points.length - 1][0] ||
      sampled[sampled.length - 1][1] !== points[points.length - 1][1]
    ) {
      sampled.push(points[points.length - 1]);
    }

    return sampled;
  }

  // Helper function to geocode a city using Nominatim
  async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
    if (!city.trim()) return null;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'ev-charging-finder/1.0' } },
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || data.length === 0) return null;
      const [result] = data;
      return { lat: parseFloat(result.lat), lon: parseFloat(result.lon) };
    } catch {
      return null;
    }
  }

  // Helper function to fetch stations from our backend
  async function fetchStations(
    lat: number,
    lon: number,
    distance: number,
    maxResults: number,
  ): Promise<ChargingStation[]> {
    try {
      const response = await fetch(
        `/api/stations/search?lat=${lat}&lon=${lon}&distance=${distance}&maxResults=${maxResults}`,
      );
      if (!response.ok) throw new Error('Failed to fetch stations');
      const data = await response.json();
      return data.stations || [];
    } catch {
      return [];
    }
  }

  const calculateRoute = useCallback(async () => {
    setIsCalculating(true);
    setRouteError(null);
    setRouteCoords(null);
    setRouteStations([]);

    try {
      // 1. Geocode source and destination
      const [sourceLoc, destLoc] = await Promise.all([
        geocodeCity(sourceCity),
        geocodeCity(destinationCity),
      ]);

      if (!sourceLoc || !destLoc) {
        throw new Error('Could not geocode one or both locations');
      }

      const { lat: startLat, lon: startLon } = sourceLoc;
      const { lat: endLat, lon: endLon } = destLoc;

      // 2. Get route from OSRM
      const routeResponse = await fetch(
        `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`,
      );
      if (!routeResponse.ok) throw new Error('Failed to calculate route');

      const routeData = await routeResponse.json();
      if (!routeData.routes || routeData.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = routeData.routes[0];
      const coordinates = route.geometry.coordinates as number[][];
      const latLngs = coordinates.map((coord) => [coord[1], coord[0]]) as [number, number][];

      setRouteCoords(latLngs);

      // 3. Sample points along the route every 10km
      const samplePoints = sampleRoutePoints(latLngs, 10);

      // 4. Fetch stations for each sample point
      const allStations: ChargingStation[] = [];
      const seenIds = new Set<number>();

      for (const point of samplePoints) {
        const [lat, lon] = point;
        const stations = await fetchStations(lat, lon, 10, 20);
        for (const station of stations) {
          if (!seenIds.has(station.id)) {
            seenIds.add(station.id);
            allStations.push(station);
          }
        }
      }

      setRouteStations(allStations);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setRouteError(message);
      console.error('Routing error:', err);
    } finally {
      setIsCalculating(false);
    }
  }, [
    sourceCity,
    destinationCity,
    setIsCalculating,
    setRouteError,
    setRouteCoords,
    setRouteStations,
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">EV Route Planner</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source City</label>
            <input
              type="text"
              value={sourceCity}
              onChange={(e) => setSourceCity(e.target.value)}
              placeholder="Enter source city"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ev-600 focus:border-transparent"
              disabled={isCalculating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
            <input
              type="text"
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              placeholder="Enter destination city"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-ev-600 focus:border-transparent"
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

      {(routeCoords || routeStations.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Route Map</h2>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '400px', width: '100%' }}
            scrollWheelZoom={true}
          >
            <FitBounds coords={routeCoords} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {routeCoords && (
              <Polyline positions={routeCoords} color="blue" weight={5} opacity={0.7}>
                <Popup>
                  <span>EV Route</span>
                </Popup>
              </Polyline>
            )}
            {routeStations.map((station) => {
              const status = getStationStatus(station);
              const isOperational = status === 'operational';
              const fast = isFastCharger(station);
              const { addressInfo: addr } = station;

              const icon = getStationIcon(status, fast);

              const statusText = isOperational
                ? 'Operational'
                : status === 'planned'
                  ? 'Not Operational'
                  : 'Unknown';
              const distanceText =
                addr.distance != null ? `${formatDistance(addr.distance)} away` : '';
              const ariaLabel = `${addr.title}, ${statusText}, ${fast ? 'Fast charging, ' : ''}${distanceText}, ${station.connections.reduce((sum, c) => sum + (c.quantity ?? 1), 0)} connectors`;

              return (
                <Marker
                  key={station.id}
                  position={[addr.lat, addr.lon]}
                  icon={icon}
                  aria-label={ariaLabel}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -10]}
                    sticky={true}
                    className="station-tooltip"
                  >
                    <StationCardSummary station={station} />
                  </Tooltip>
                  <Popup maxWidth={300} className="station-popup" autoPan={false}>
                    <StationCardSummary station={station} />
                    <div className="pt-3 border-t border-gray-200">
                      <button
                        onClick={() => console.log('Station clicked:', station)}
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
