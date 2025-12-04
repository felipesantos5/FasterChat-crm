import useSWR from 'swr'
import { messageApi } from '@/lib/message'
import type { ConversationSummary } from '@/types/message'

export function useConversations(companyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ConversationSummary[]>(
    companyId ? `/messages/conversations/${companyId}` : null,
    async () => {
      const response = await messageApi.getConversations(companyId!)

      // Debug: verificar grupos nas conversas
      const grupos = response.data.filter(c => c.isGroup || c.customerPhone.includes('@g.us'))
      console.log(`[Conversas SWR] Total: ${response.data.length}, Grupos: ${grupos.length}`)

      return response.data
    },
    {
      refreshInterval: 0,
      revalidateOnMount: true,
    }
  )

  return {
    conversations: data || [],
    isLoading,
    isError: error,
    mutate,
  }
}
