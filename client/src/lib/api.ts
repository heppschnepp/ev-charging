import type { SearchResult, FavoriteStation, SearchHistoryEntry } from '@/types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data as T;
}

export const api = {
  stations: {
    search: (city: string, distance: number, maxResults: number, operator?: string): Promise<SearchResult> => {
      const params = new URLSearchParams({
        city,
        distance: String(distance),
        maxResults: String(maxResults),
      });
      if (operator) params.set('operator', operator);
      return request(`/stations/search?${params.toString()}`);
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
  },

  history: {
    list: (): Promise<SearchHistoryEntry[]> => request('/history'),
  },
};
