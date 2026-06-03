import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ChargingStation } from '@/types';

export function useFavorites() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['favorites'],
    queryFn: api.favorites.list,
    staleTime: 1000 * 60 * 5,
  });

  const addMutation = useMutation({
    mutationFn: (station: ChargingStation) =>
      api.favorites.add({
        stationId: station.id,
        uuid: station.uuid,
        name: station.addressInfo.title,
        address: [station.addressInfo.addressLine1, station.addressInfo.town, station.addressInfo.postcode]
          .filter(Boolean)
          .join(', '),
        lat: station.addressInfo.lat,
        lon: station.addressInfo.lon,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (stationId: number) => api.favorites.remove(stationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => api.favorites.clearAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const favoriteIds = new Set((query.data ?? []).map((f) => f.station_id));

  return {
    favorites: query.data ?? [],
    isLoading: query.isLoading,
    isFavorite: (id: number) => favoriteIds.has(id),
    addFavorite: addMutation.mutate,
    removeFavorite: removeMutation.mutate,
    clearAllFavorites: clearAllMutation.mutate,
  };
}
