import { useEffect } from 'react'
import useSWR from 'swr'
import { messageApi } from '@/lib/message'
import { useWebSocket } from './useWebSocket'
import { toast } from 'sonner'
import type { ConversationSummary } from '@/types/message'

export function useConversations(companyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ConversationSummary[]>(
    companyId ? `/messages/conversations/${companyId}` : null,
    async () => {
      const response = await messageApi.getConversations(companyId!)
      return response.data
    },
    {
      refreshInterval: 0,
      revalidateOnMount: true,
    }
  )

  // WebSocket: escuta nova conversa e nova mensagem para atualizar a lista
  const { isAuthenticated, socket } = useWebSocket({
    autoConnect: true,
  })

  useEffect(() => {
    if (!isAuthenticated || !socket) return

    // Escuta nova conversa criada
    const handleNewConversation = (conversation: any) => {
      // Mostra notificação
      toast.success(`Nova conversa com ${conversation.customer?.name || 'Cliente'}`, {
        description: 'Uma nova conversa foi iniciada',
        duration: 5000,
      })

      // Revalida os dados para buscar a nova conversa
      mutate()
    }

    // Escuta nova mensagem para atualizar lastMessage
    const handleNewMessage = () => {
      // Revalida para atualizar a lista (ordenação, lastMessage, etc)
      mutate()
    }

    socket.on('new_conversation', handleNewConversation)
    socket.on('new_message', handleNewMessage)

    return () => {
      socket.off('new_conversation', handleNewConversation)
      socket.off('new_message', handleNewMessage)
    }
  }, [isAuthenticated, socket, mutate])

  return {
    conversations: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}

