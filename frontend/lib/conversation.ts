import { api } from './api';
import {
  GetConversationResponse,
  AssignConversationRequest,
  AssignConversationResponse,
} from '@/types/conversation';

export const conversationApi = {
  /**
   * Obtém ou cria uma conversa para um customer
   */
  async getConversation(customerId: string, companyId: string): Promise<GetConversationResponse> {
    const response = await api.get(`/conversations/${customerId}`, {
      params: { companyId },
    });
    return response.data;
  },

  /**
   * Atribui uma conversa a um usuário (desliga IA)
   */
  async assignConversation(
    customerId: string,
    userId: string
  ): Promise<AssignConversationResponse> {
    const response = await api.post(`/conversations/${customerId}/assign`, { userId });
    return response.data;
  },

  /**
   * Remove atribuição (religa IA)
   */
  async unassignConversation(customerId: string): Promise<AssignConversationResponse> {
    const response = await api.post(`/conversations/${customerId}/unassign`);
    return response.data;
  },

  /**
   * Lista conversas atribuídas a um usuário
   */
  async getAssignedConversations(userId: string): Promise<{
    success: boolean;
    data: any[];
  }> {
    const response = await api.get(`/conversations/assigned/${userId}`);
    return response.data;
  },

  /**
   * Ativa/Desativa IA em uma conversa
   */
  async toggleAI(customerId: string, aiEnabled: boolean): Promise<AssignConversationResponse> {
    const response = await api.patch(`/conversations/${customerId}/toggle-ai`, { aiEnabled });
    return response.data;
  },
};
