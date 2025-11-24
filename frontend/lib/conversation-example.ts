import { api } from './api';
import { ConversationExampleWithMessages } from '@/types/conversation-example';

export const conversationExampleApi = {
  /**
   * Marca uma conversa como exemplo
   */
  async markAsExample(conversationId: string, notes?: string): Promise<{
    success: boolean;
    data: any;
  }> {
    const response = await api.post(`/conversations/${conversationId}/mark-example`, {
      notes,
    });
    return response.data;
  },

  /**
   * Remove marcação de exemplo
   */
  async removeExample(conversationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.delete(`/conversations/${conversationId}/mark-example`);
    return response.data;
  },

  /**
   * Lista todos os exemplos
   */
  async getExamples(): Promise<{
    success: boolean;
    data: ConversationExampleWithMessages[];
  }> {
    const response = await api.get('/ai/examples');
    return response.data;
  },

  /**
   * Verifica se uma conversa está marcada como exemplo
   */
  async isExample(conversationId: string): Promise<{
    success: boolean;
    data: { isExample: boolean };
  }> {
    const response = await api.get(`/conversations/${conversationId}/is-example`);
    return response.data;
  },
};
