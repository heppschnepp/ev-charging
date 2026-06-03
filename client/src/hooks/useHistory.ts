import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useHistory() {
  const query = useQuery({
    queryKey: ['history'],
    queryFn: api.history.list,
    staleTime: 1000 * 30,
  });

  const clearHistory = async () => {
    await api.history.clear();
    query.refetch();
  };

  return {
    ...query,
    clearHistory,
  };
}
