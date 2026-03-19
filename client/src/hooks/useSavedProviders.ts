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

type SavedData = { saved: SavedProviderItem[] };

const QK = ['/api/saved-providers'] as const;

export function useSavedProviders() {
  const { user } = useFirebaseAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<SavedData>({
    queryKey: QK,
    enabled: !!user,
    staleTime: 30_000,
  });

  const savedList: SavedProviderItem[] = data?.saved ?? [];
  const savedIds = new Set(savedList.map(s => s.providerId));

  const isSaved = (id: string) => savedIds.has(id);

  const mutation = useMutation({
    mutationFn: ({ id, platform, remove }: { id: string; platform?: string | null; remove: boolean }) =>
      remove
        ? apiRequest('DELETE', `/api/saved-providers/${id}`)
        : apiRequest('POST', `/api/saved-providers/${id}`, { platform: platform ?? null }),

    onMutate: async ({ id, platform, remove }) => {
      await qc.cancelQueries({ queryKey: QK });
      const previous = qc.getQueryData<SavedData>(QK);

      qc.setQueryData<SavedData>(QK, old => {
        if (!old) return old;
        if (remove) {
          return { saved: old.saved.filter(s => s.providerId !== id) };
        }
        if (old.saved.some(s => s.providerId === id)) return old;
        return {
          saved: [
            { providerId: id, platform: platform ?? null, savedAt: new Date().toISOString(), displayName: null, profilePicUrl: null },
            ...old.saved,
          ],
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(QK, context.previous);
      }
    },

    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
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
