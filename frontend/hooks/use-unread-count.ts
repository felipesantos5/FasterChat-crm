import useSWR from 'swr';
import { api } from '@/lib/api';
import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

interface UnreadCountResponse {
  count: number;
}

export function useUnreadCount(companyId?: string | null) {
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    companyId ? `/messages/unread-count/${companyId}` : null,
    async (url) => {
      try {
        const response = await api.get<{ data: UnreadCountResponse }>(url);
        return response.data.data;
      } catch (err) {
        console.error('[useUnreadCount] Error fetching:', err);
        throw err;
      }
    },
    {
      refreshInterval: 0, // Não precisa de polling pois usamos websocket
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  );

  const { isAuthenticated, socket } = useWebSocket({
    autoConnect: true,
  });

  useEffect(() => {
    if (!isAuthenticated || !socket) return;

    // Quando recebe nova mensagem, revalida o total de não lidas
    const handleNewMessage = () => {
      mutate();
    };

    // Quando o status da mensagem é alterado (ex: lida), revalida
    const handleMessageStatusUpdate = () => {
      mutate();
    };
    
    // Escutando eventos do WebSocket
    socket.on('new_message', handleNewMessage);
    socket.on('message_status_update', handleMessageStatusUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_status_update', handleMessageStatusUpdate);
    };
  }, [isAuthenticated, socket, mutate]);

  return {
    count: data?.count || 0,
    isLoading,
    isError: error,
    mutate,
  };
}
