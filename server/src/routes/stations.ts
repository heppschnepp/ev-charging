import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import type { ChargingStation } from '../types/index.js';
import {
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
  operator: z.string().optional(),
});

stationsRouter.get('/search', async (req, res) => {
  const parsed = SearchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid parameters', code: 'INVALID_PARAMS', details: parsed.error.flatten() });
  }

  const { city, distance, maxResults, operator } = parsed.data;

  try {
    // 1. Geocode to get location options (always fresh for disambiguation)
    const geocodeResults = await geocodeCity(city);
    const primary = geocodeResults[0];
    
    // Use first result as default (placeId selection would require passing it from client)
    const selected = primary;

    // 2. Check station cache with selected coordinates
    let stations: ChargingStation[];
    let cachedAt: string | undefined;
    const cached = getCachedStations(city, distance, maxResults);
    if (cached) {
      stations = JSON.parse(cached.data);
      cachedAt = cached.cached_at;
    } else {
      stations = await fetchStations(selected.lat, selected.lon, distance, maxResults);
      setCachedStations(city, selected.lat, selected.lon, distance, maxResults, JSON.stringify(stations));
      addSearchHistory(city, selected.lat, selected.lon, distance, stations.length);
    }

    // 3. Filter by operator (case-insensitive partial match) if provided
    if (operator && operator.trim()) {
      const operatorLower = operator.toLowerCase().trim();
      stations = stations.filter((s) =>
        s.operator?.title?.toLowerCase().includes(operatorLower)
      );
    }

    return res.json({
      stations,
      total: stations.length,
      location: { lat: selected.lat, lon: selected.lon, displayName: selected.displayName },
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
