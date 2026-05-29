import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useStations(
  city?: string,
  lat?: number,
  lon?: number,
  distance: number = 10,
  maxResults: number = 20,
  operator?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['stations', city, lat, lon, distance, maxResults, operator],
    queryFn: () => api.stations.search(city, lat, lon, distance, maxResults, operator),
    enabled: enabled && ((city && city.trim().length > 0) || (lat !== undefined && lon !== undefined)),
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
  });
}
