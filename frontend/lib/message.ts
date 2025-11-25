import { api } from './api';
import {
  GetMessagesResponse,
  GetCustomerMessagesResponse,
  GetConversationsResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
  Message,
} from '@/types/message';

export const messageApi = {
  /**
   * Obtém mensagens com filtros
   */
  async getMessages(params?: {
    customerId?: string;
    whatsappInstanceId?: string;
    direction?: string;
    limit?: number;
    offset?: number;
  }): Promise<GetMessagesResponse> {
    const response = await api.get('/messages', { params });
    return response.data;
  },

  /**
   * Obtém mensagens de um customer específico
   */
  async getCustomerMessages(
    customerId: string,
    limit?: number,
    offset?: number
  ): Promise<GetCustomerMessagesResponse> {
    const params: any = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;

    const response = await api.get(`/messages/customer/${customerId}`, { params });
    return response.data;
  },

  /**
   * Obtém resumo de todas as conversas de uma empresa
   */
  async getConversations(companyId: string): Promise<GetConversationsResponse> {
    const response = await api.get(`/messages/conversations/${companyId}`);
    return response.data;
  },

  /**
   * Envia uma mensagem para um customer
   */
  async sendMessage(customerId: string, content: string, sentBy: 'HUMAN' | 'AI' = 'HUMAN'): Promise<{
    success: boolean;
    data: {
      message: Message;
      whatsappResult: any;
      sentBy: 'HUMAN' | 'AI';
    };
  }> {
    const response = await api.post('/messages/send', {
      customerId,
      content,
      sentBy,
    });
    return response.data;
  },

  /**
   * Marca mensagens como lidas
   */
  async markAsRead(data: MarkAsReadRequest): Promise<MarkAsReadResponse> {
    const response = await api.post('/messages/mark-read', data);
    return response.data;
  },

  /**
   * Adiciona feedback a uma mensagem da IA
   */
  async addFeedback(messageId: string, feedback: 'GOOD' | 'BAD', note?: string): Promise<{
    success: boolean;
    data: Message;
  }> {
    const response = await api.post(`/messages/${messageId}/feedback`, {
      feedback,
      note,
    });
    return response.data;
  },

  /**
   * Obtém estatísticas de feedback
   */
  async getFeedbackStats(companyId: string): Promise<{
    success: boolean;
    data: {
      totalAiMessages: number;
      goodFeedback: number;
      badFeedback: number;
      noFeedback: number;
      goodPercentage: number;
    };
  }> {
    const response = await api.get(`/messages/feedback/stats/${companyId}`);
    return response.data;
  },

  /**
   * Obtém mensagens com feedback negativo
   */
  async getMessagesWithBadFeedback(companyId: string, limit?: number, offset?: number): Promise<{
    success: boolean;
    data: {
      messages: Message[];
      total: number;
      limit: number;
      offset: number;
    };
  }> {
    const params: any = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;

    const response = await api.get(`/messages/feedback/bad/${companyId}`, { params });
    return response.data;
  },
};
