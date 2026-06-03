import { ChargingStation } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeoLocation {
  lat: number;
  lon: number;
}

export interface RouteSummary {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteResult {
  coords: [number, number][];
  summary: RouteSummary;
}

// ─── Geo Math ─────────────────────────────────────────────────────────────────

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Samples a route polyline at a fixed interval (km), always including the
 * first and last point. Guards against zero-length segments.
 */
export function sampleRoutePoints(
  points: [number, number][],
  intervalKm: number,
): [number, number][] {
  if (intervalKm <= 0) throw new Error('intervalKm must be > 0');
  if (points.length < 2) return [...points];

  const sampled: [number, number][] = [points[0]];
  const targetDistance = intervalKm * 1_000;
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1];
    const [lat2, lon2] = points[i];
    const segLen = haversineDistance(lat1, lon1, lat2, lon2);
    if (segLen === 0) continue;

    accumulated += segLen;

    while (accumulated >= targetDistance) {
      const overshoot = accumulated - targetDistance;
      const t = (segLen - overshoot) / segLen;
      sampled.push([lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t]);
      accumulated = overshoot;
    }
  }

  const last = points[points.length - 1];
  const prev = sampled[sampled.length - 1];
  if (prev[0] !== last[0] || prev[1] !== last[1]) sampled.push(last);

  return sampled;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function geocodeCity(
  city: string,
  signal?: AbortSignal,
): Promise<GeoLocation | null> {
  if (!city.trim()) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'ev-charging-finder/1.0' },
        signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return null;
  }
}

export async function fetchRoute(
  start: GeoLocation,
  end: GeoLocation,
  signal?: AbortSignal,
): Promise<RouteResult> {
  // Proxied through own backend to avoid exposing user locations to a
  // third-party and to ensure HTTPS. Falls back to direct OSRM for local dev.
  const url =
    process.env.NODE_ENV === 'production'
      ? `/api/route?startLat=${start.lat}&startLon=${start.lon}&endLat=${end.lat}&endLon=${end.lon}`
      : `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Failed to calculate route');

  const data = await res.json();
  if (!data.routes?.length) throw new Error('No route found between those cities');

  const route = data.routes[0];
  const coords = (route.geometry.coordinates as number[][]).map(
    ([lon, lat]) => [lat, lon] as [number, number],
  );

  return {
    coords,
    summary: {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    },
  };
}

/**
 * Fetches stations for ALL sample points in parallel, deduplicates by id.
 * Failures on individual points are logged but do not abort the whole fetch.
 */
export async function fetchStationsAlongRoute(
  samplePoints: [number, number][],
  radiusKm = 10,
  maxResultsPerPoint = 20,
  signal?: AbortSignal,
): Promise<ChargingStation[]> {
  const results = await Promise.allSettled(
    samplePoints.map(([lat, lon]) =>
      fetchStationsNear(lat, lon, radiusKm, maxResultsPerPoint, signal),
    ),
  );

  const seenIds = new Set<number>();
  const stations: ChargingStation[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      if ((result.reason as Error)?.name === 'AbortError') throw result.reason;
      console.warn('Station fetch failed for a sample point:', result.reason);
      continue;
    }
    for (const station of result.value) {
      if (!seenIds.has(station.id)) {
        seenIds.add(station.id);
        stations.push(station);
      }
    }
  }

  return stations;
}

async function fetchStationsNear(
  lat: number,
  lon: number,
  distance: number,
  maxResults: number,
  signal?: AbortSignal,
): Promise<ChargingStation[]> {
  const res = await fetch(
    `/api/stations/search?lat=${lat}&lon=${lon}&distance=${distance}&maxResults=${maxResults}`,
    { signal },
  );
  if (!res.ok) throw new Error(`Station search failed: ${res.status}`);
  const data = await res.json();
  return data.stations ?? [];
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export function formatRouteDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatRouteDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100
    ? `${Math.round(km)} km`
    : `${km.toFixed(1)} km`;
}
