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
  city: z.string().min(1).max(100).optional(),
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
  distance: z.coerce.number().int().min(1).max(100).default(10),
  maxResults: z.coerce.number().int().min(1).max(100).default(20),
  operator: z.string().optional(),
  power: z.coerce.number().int().min(0).max(1000).optional(),
}).refine(
  (data) => data.city || (data.lat !== undefined && data.lon !== undefined),
  {
    message: "Either city or lat/lon coordinates must be provided",
    path: ["city"], // or could use ["lat", "lon"] but placing on city for simplicity
  }
);

stationsRouter.get('/search', async (req, res) => {
   const parsed = SearchSchema.safeParse(req.query);
   if (!parsed.success) {
     return res.status(400).json({ message: 'Invalid parameters', code: 'INVALID_PARAMS', details: parsed.error.flatten() });
   }

   const { city, lat, lon, distance, maxResults, operator, power } = parsed.data;

   try {
     let selected: { lat: number; lon: number; displayName: string };
     let locationKey: string; // For caching and history

     // Use GPS coordinates if provided, otherwise geocode city
     if (lat !== undefined && lon !== undefined) {
       // Use provided coordinates
       selected = { lat, lon, displayName: `Latitude: ${lat.toFixed(4)}, Longitude: ${lon.toFixed(4)}` };
       locationKey = `gps_lat:${lat}_lon:${lon}`; // Key for caching/history
     } else {
       // Geocode city to get coordinates (existing behavior)
       if (!city) throw new Error('City is required when lat/lon not provided');
       const geocodeResults = await geocodeCity(city);
       const primary = geocodeResults[0];
       selected = primary;
       locationKey = city.toLowerCase(); // Key for caching/history
     }

     // 2. Check station cache with selected coordinates
     let stations: ChargingStation[];
     let cachedAt: string | undefined;
     const cached = getCachedStations(locationKey, distance, maxResults);
     if (cached) {
       stations = JSON.parse(cached.data);
       cachedAt = cached.cached_at;
     } else {
       stations = await fetchStations(selected.lat, selected.lon, distance, maxResults);
       setCachedStations(locationKey, selected.lat, selected.lon, distance, maxResults, JSON.stringify(stations));
       addSearchHistory(locationKey, selected.lat, selected.lon, distance, stations.length);
     }

     // 3. Filter by operator (case-insensitive partial match) if provided
     if (operator && operator.trim()) {
       const operatorLower = operator.toLowerCase().trim();
       stations = stations.filter((s) =>
         s.operator?.title?.toLowerCase().includes(operatorLower)
       );
     }

     // 4. Filter by minimum power if provided
     if (power !== undefined && power > 0) {
       stations = stations.filter((station) =>
         station.connections.some((connection) => 
           connection.powerKW !== undefined && connection.powerKW >= power)
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
