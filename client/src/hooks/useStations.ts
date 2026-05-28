import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useStations(city: string, distance: number, maxResults: number, enabled: boolean) {
  return useQuery({
    queryKey: ['stations', city, distance, maxResults],
    queryFn: () => api.stations.search(city, distance, maxResults),
    enabled: enabled && city.trim().length > 0,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
  });
}
