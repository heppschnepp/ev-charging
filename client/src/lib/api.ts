import type {
  SearchResult,
  FavoriteStation,
  SearchHistoryEntry,
  Car,
  CarSearchResult,
} from '@/types';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data: { message?: string; code?: string } = {};
  try {
    data = await res.json();
  } catch { /* non-JSON response body */ }
  if (!res.ok) throw new ApiError(data.message ?? 'Request failed', res.status, data.code);
  return data as T;
}

   export const api = {
stations: {
        search: (
          city?: string,
          lat?: number,
          lon?: number,
          distance: number = 10,
          maxResults: number = 20,
          operator?: string,
          power?: number,
          signal?: AbortSignal,
        ): Promise<SearchResult> => {
          const params = new URLSearchParams();
          if (city) params.set('city', city);
          if (lat !== undefined) params.set('lat', String(lat));
          if (lon !== undefined) params.set('lon', String(lon));
          params.set('distance', String(distance));
          params.set('maxResults', String(maxResults));
          if (operator) params.set('operator', operator);
          if (power !== undefined) params.set('power', String(power));
          return request(`/stations/search?${params.toString()}`, { signal });
        },
      },

  favorites: {
    list: (): Promise<FavoriteStation[]> => request('/favorites'),
    add: (body: {
      stationId: number;
      uuid: string;
      name: string;
      address: string;
      lat: number;
      lon: number;
    }): Promise<{ ok: boolean }> =>
      request('/favorites', { method: 'POST', body: JSON.stringify(body) }),
    remove: (stationId: number): Promise<{ ok: boolean }> =>
      request(`/favorites/${stationId}`, { method: 'DELETE' }),
    clearAll: (): Promise<{ ok: boolean }> =>
      request('/favorites', { method: 'DELETE' }),
  },

   history: {
     list: (): Promise<SearchHistoryEntry[]> => request('/history'),
     clear: (): Promise<{ ok: boolean }> => request('/history', { method: 'DELETE' }),
   },

  cars: {
    search: (q: string): Promise<{ results: CarSearchResult[]; total: number }> =>
      request(`/cars/search?q=${encodeURIComponent(q)}`),
    list: (): Promise<Car[]> => request('/cars'),
    add: (body: {
      brand: string;
      model: string;
      rangeKm: number;
      externalId?: string;
      variantName?: string;
      modelYear?: number;
      chargeTime10to80Min?: number;
      chargeTime10to100Min?: number;
    }): Promise<{ ok: boolean; id: number }> =>
      request('/cars', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<{
      brand: string;
      model: string;
      variantName: string | null;
      modelYear: number | null;
      rangeKm: number;
      chargeTime10to80Min: number | null;
      chargeTime10to100Min: number | null;
    }>): Promise<{ ok: boolean }> =>
      request(`/cars/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: number): Promise<{ ok: boolean }> =>
      request(`/cars/${id}`, { method: 'DELETE' }),
  },
};
