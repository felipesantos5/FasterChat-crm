import useSWR from 'swr';
import { api } from '@/lib/api';
import { useEffect } from 'react';

interface HandoffsCountResponse {
  count: number;
}

export function useHandoffsCount() {
  const { data, error, isLoading, mutate } = useSWR<HandoffsCountResponse>(
    '/conversations/handoffs/count',
    async (url) => {
      try {
        console.log('[useHandoffsCount] Fetching handoffs count...');
        const response = await api.get<{ data: HandoffsCountResponse }>(url);
        console.log('[useHandoffsCount] Response:', response.data);
        return response.data.data;
      } catch (err) {
        console.error('[useHandoffsCount] Error fetching:', err);
        throw err;
      }
    },
    {
      refreshInterval: 30000, // Atualiza a cada 30 segundos
      revalidateOnFocus: true, // Revalida quando a janela ganha foco
      dedupingInterval: 5000, // Evita chamadas duplicadas em 5 segundos
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  );

  useEffect(() => {
    if (error) {
      console.error('[useHandoffsCount] SWR Error:', error);
    }
    if (data) {
      console.log('[useHandoffsCount] Current count:', data.count);
    }
  }, [data, error]);

  return {
    count: data?.count || 0,
    isLoading,
    isError: error,
    mutate,
  };
}
