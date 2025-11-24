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
};
