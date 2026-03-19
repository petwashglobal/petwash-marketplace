import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { apiRequest } from '@/lib/queryClient';

export interface SavedProviderItem {
  providerId: string;
  platform: string | null;
  savedAt: string;
  displayName: string | null;
  profilePicUrl: string | null;
}

export function useSavedProviders() {
  const { user } = useFirebaseAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ saved: SavedProviderItem[] }>({
    queryKey: ['/api/saved-providers'],
    enabled: !!user,
  });

  const savedList: SavedProviderItem[] = data?.saved ?? [];
  const savedIds = new Set(savedList.map(s => s.providerId));

  const isSaved = (id: string) => savedIds.has(id);

  const mutation = useMutation({
    mutationFn: ({ id, platform, remove }: { id: string; platform?: string | null; remove: boolean }) =>
      remove
        ? apiRequest('DELETE', `/api/saved-providers/${id}`)
        : apiRequest('POST', `/api/saved-providers/${id}`, { platform: platform ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/saved-providers'] }),
  });

  const toggle = (id: string, platform?: string | null) =>
    mutation.mutate({ id, platform, remove: isSaved(id) });

  return {
    saved: savedList,
    savedIds,
    isSaved,
    toggle,
    isLoading,
    isPending: mutation.isPending,
  };
}
