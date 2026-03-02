import { useEffect, useRef } from 'react'
import useSWR from 'swr'
import { messageApi } from '@/lib/message'
import { useWebSocket } from './useWebSocket'
import { toast } from 'sonner'
import type { ConversationSummary } from '@/types/message'

export function useConversations(companyId: string | null, selectedCustomerId?: string | null) {
  // Ref para o fetcher ter acesso ao customerId selecionado sem recriar a key do SWR
  const selectedRef = useRef(selectedCustomerId)
  selectedRef.current = selectedCustomerId

  const { data, error, isLoading, mutate } = useSWR<ConversationSummary[]>(
    companyId ? `/messages/conversations/${companyId}` : null,
    async () => {
      const response = await messageApi.getConversations(companyId!)
      const conversations = response.data

      // Preserva unreadCount=0 para a conversa que o usuário está visualizando.
      // Isso evita que um refetch traga de volta o dot antes do markAsRead
      // ter sido processado pelo servidor.
      if (selectedRef.current) {
        const selectedId = selectedRef.current
        return conversations.map(conv =>
          conv.customerId === selectedId ? { ...conv, unreadCount: 0 } : conv
        )
      }

      return conversations
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
      // O fetcher automaticamente preserva unreadCount=0 para a conversa aberta
      mutate()
    }

    // Escuta atualização de conversa (aiEnabled, needsHelp, etc)
    const handleConversationUpdate = (update: any) => {
      // Atualiza a lista localmente sem precisar fazer nova requisição
      mutate((current) => {
        if (!current) return current
        return current.map((conv) => {
          if (conv.customerId === update.customerId) {
            return { ...conv, ...update }
          }
          return conv
        })
      }, false) // false = não revalidar, usar atualização local
    }

    socket.on('new_conversation', handleNewConversation)
    socket.on('new_message', handleNewMessage)
    socket.on('conversation_update', handleConversationUpdate)

    return () => {
      socket.off('new_conversation', handleNewConversation)
      socket.off('new_message', handleNewMessage)
      socket.off('conversation_update', handleConversationUpdate)
    }
  }, [isAuthenticated, socket, mutate])

  return {
    conversations: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}
