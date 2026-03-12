import { useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { messageApi } from '@/lib/message'
import { useWebSocket } from './useWebSocket'
import { toast } from 'sonner'
import { MessageDirection } from '@/types/message'
import type { ConversationSummary } from '@/types/message'

interface NewMessageEvent {
  id: string;
  customerId: string;
  customerName: string;
  isGroup: boolean;
  direction: MessageDirection;
  content: string;
  timestamp: string;
  status: string;
  senderType: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  messageId: string | null;
  whatsappInstanceId: string;
  aiEnabled?: boolean;
}

interface CachedConversations {
  items: ConversationSummary[];
  total: number;
}

export function useConversations(companyId: string | null, selectedCustomerId?: string | null, archived?: boolean) {
  const selectedRef = useRef(selectedCustomerId)
  selectedRef.current = selectedCustomerId

  const { data, error, isLoading, mutate } = useSWR<CachedConversations>(
    companyId ? `/messages/conversations/${companyId}${archived ? '?archived=true' : ''}` : null,
    async () => {
      const response = await messageApi.getConversations(companyId!, archived)
      let conversations = response.data

      // Preserva unreadCount=0 para a conversa que o usuário está visualizando
      if (selectedRef.current) {
        const selectedId = selectedRef.current
        conversations = conversations.map(conv =>
          conv.customerId === selectedId ? { ...conv, unreadCount: 0 } : conv
        )
      }

      return { items: conversations, total: response.total ?? conversations.length }
    },
    {
      refreshInterval: 0,
      revalidateOnMount: true,
    }
  )

  // Ref para acessar dados atuais sem criar dependência de closure
  const dataRef = useRef(data)
  dataRef.current = data

  // Timer para refetch debounced (só usado quando chega conversa nova não mapeada)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => mutate(), 1500)
  }, [mutate])

  const { isAuthenticated, socket } = useWebSocket({ autoConnect: true })

  useEffect(() => {
    if (!isAuthenticated || !socket) return

    const handleNewConversation = (conversation: { customer?: { name?: string } }) => {
      toast.success(`Nova conversa com ${conversation.customer?.name || 'Cliente'}`, {
        description: 'Uma nova conversa foi iniciada',
        duration: 5000,
      })
      mutate()
    }

    // Atualiza a lista localmente em vez de refetchar — evita pico de requisições
    const handleNewMessage = (message: NewMessageEvent) => {
      const current = dataRef.current
      const existingIdx = current?.items.findIndex(c => c.customerId === message.customerId) ?? -1

      if (existingIdx === -1) {
        // Conversa nova não está no cache — agenda refetch debounced
        scheduleRefetch()
        return
      }

      mutate((prev) => {
        if (!prev) return prev
        const idx = prev.items.findIndex(c => c.customerId === message.customerId)
        if (idx === -1) return prev

        const conv = prev.items[idx]
        const isSelected = selectedRef.current === message.customerId
        const updatedItems = [...prev.items]
        updatedItems[idx] = {
          ...conv,
          lastMessage: message.content ?? conv.lastMessage,
          lastMessageTimestamp: message.timestamp ?? conv.lastMessageTimestamp,
          direction: message.direction,
          lastMediaType: message.mediaType ?? null,
          unreadCount: isSelected
            ? 0
            : (conv.unreadCount ?? 0) + (message.direction === 'INBOUND' ? 1 : 0),
        }
        return { items: updatedItems, total: prev.total }
      }, false)
    }

    const handleConversationUpdate = (update: Partial<ConversationSummary> & { customerId: string }) => {
      mutate((prev) => {
        if (!prev) return prev
        return {
          items: prev.items.map(conv =>
            conv.customerId === update.customerId ? { ...conv, ...update } : conv
          ),
          total: prev.total,
        }
      }, false)
    }

    socket.on('new_conversation', handleNewConversation)
    socket.on('new_message', handleNewMessage)
    socket.on('conversation_update', handleConversationUpdate)

    return () => {
      socket.off('new_conversation', handleNewConversation)
      socket.off('new_message', handleNewMessage)
      socket.off('conversation_update', handleConversationUpdate)
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    }
  }, [isAuthenticated, socket, mutate, scheduleRefetch])

  return {
    conversations: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError: error,
    mutate,
  }
}
