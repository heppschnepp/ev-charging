import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import {
  getCachedGeocode,
  setCachedGeocode,
  getCachedStations,
  setCachedStations,
  addSearchHistory,
} from '../db/index.js';
import { geocodeCity, fetchStations } from '../middleware/ocm.js';

export const stationsRouter: RouterType = Router();

const SearchSchema = z.object({
  city: z.string().min(1).max(100),
  distance: z.coerce.number().int().min(1).max(100).default(10),
  maxResults: z.coerce.number().int().min(1).max(100).default(20),
});

stationsRouter.get('/search', async (req, res) => {
  const parsed = SearchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid parameters', code: 'INVALID_PARAMS', details: parsed.error.flatten() });
  }

  const { city, distance, maxResults } = parsed.data;

  try {
    // 1. Geocode (with cache)
    let geo = getCachedGeocode(city);
    if (!geo) {
      const result = await geocodeCity(city);
      setCachedGeocode(city, result.lat, result.lon, result.displayName);
      geo = { lat: result.lat, lon: result.lon, display_name: result.displayName, cached_at: new Date().toISOString() };
    }

    // 2. Fetch stations (with cache)
    let stations;
    let cachedAt: string | undefined;
    const cached = getCachedStations(city, distance, maxResults);
    if (cached) {
      stations = JSON.parse(cached.data);
      cachedAt = cached.cached_at;
    } else {
      stations = await fetchStations(geo.lat, geo.lon, distance, maxResults);
      setCachedStations(city, geo.lat, geo.lon, distance, maxResults, JSON.stringify(stations));
      addSearchHistory(city, geo.lat, geo.lon, distance, stations.length);
    }

    return res.json({
      stations,
      total: stations.length,
      location: { lat: geo.lat, lon: geo.lon, displayName: geo.display_name },
      cachedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      return res.status(404).json({ message, code: 'CITY_NOT_FOUND' });
    }
    console.error('Search error:', err);
    return res.status(502).json({ message: 'Failed to fetch data', code: 'UPSTREAM_ERROR' });
  }
});
