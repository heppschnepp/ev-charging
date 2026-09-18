import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { Car } from '@/types';

export type AddCarInput = Parameters<typeof api.cars.add>[0];

export function useCars() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['cars'],
    queryFn: api.cars.list,
    staleTime: 1000 * 60 * 5,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cars'] });

  const addMutation = useMutation({
    mutationFn: (input: AddCarInput) => api.cars.add(input),
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: number; body: Parameters<typeof api.cars.update>[1] }) =>
      api.cars.update(args.id, args.body),
    onSuccess: () => invalidate(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.cars.remove(id),
    onSuccess: () => invalidate(),
  });

  return {
    cars: query.data ?? [],
    isLoading: query.isLoading,
    addCar: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    addError: addMutation.error,
    resetAddError: () => addMutation.reset(),
    isDuplicate: addMutation.error instanceof ApiError && addMutation.error.code === 'DUPLICATE',
    updateCar: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    removeCar: removeMutation.mutate,
  };
}