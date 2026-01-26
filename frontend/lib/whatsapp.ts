import { api } from './api';
import {
  CreateInstanceResponse,
  QRCodeResponse,
  StatusResponse,
  SendMessageRequest,
  SendMessageResponse,
  GetInstancesResponse,
} from '@/types/whatsapp';

export const whatsappApi = {
  /**
   * Cria uma nova instância do WhatsApp
   */
  async createInstance(companyId: string, instanceName?: string): Promise<CreateInstanceResponse> {
    const response = await api.post('/whatsapp/create-instance', {
      companyId,
      instanceName,
    });
    return response.data;
  },

  /**
   * Obtém o QR Code de uma instância
   */
  async getQRCode(instanceId: string): Promise<QRCodeResponse> {
    const response = await api.get(`/whatsapp/qr/${instanceId}`);
    return response.data;
  },

  /**
   * Verifica o status de conexão de uma instância
   */
  async getStatus(instanceId: string): Promise<StatusResponse> {
    const response = await api.get(`/whatsapp/status/${instanceId}`);
    return response.data;
  },

  /**
   * Envia uma mensagem via WhatsApp
   */
  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await api.post('/whatsapp/send-message', data);
    return response.data;
  },

  /**
   * Obtém todas as instâncias de uma empresa
   */
  async getInstances(companyId: string): Promise<GetInstancesResponse> {
    const response = await api.get(`/whatsapp/instances/${companyId}`);
    return response.data;
  },

  /**
   * Deleta uma instância
   */
  async deleteInstance(instanceId: string): Promise<{ success: boolean }> {
    const response = await api.delete(`/whatsapp/instance/${instanceId}`);
    return response.data;
  },

  /**
   * Desconecta uma instância (logout)
   */
  async disconnectInstance(instanceId: string): Promise<{ success: boolean }> {
    const response = await api.post(`/whatsapp/disconnect/${instanceId}`);
    return response.data;
  },

  /**
   * Sincroniza status manualmente com Evolution API
   * Útil quando webhook não funciona (Evolution em Docker)
   */
  async syncStatus(instanceId: string): Promise<StatusResponse> {
    const response = await api.post(`/whatsapp/sync/${instanceId}`);
    return response.data;
  },

  /**
   * Atualiza o nome de uma instância
   */
  async updateInstanceName(instanceId: string, instanceName: string): Promise<{ success: boolean }> {
    const response = await api.patch(`/whatsapp/instance/${instanceId}/name`, {
      instanceName,
    });
    return response.data;
  },

  /**
   * Verifica se um contato está online no WhatsApp
   */
  async getContactPresence(instanceId: string, phone: string): Promise<{
    success: boolean;
    data: {
      isOnline: boolean;
      lastSeen?: string;
    };
  }> {
    const response = await api.get(`/whatsapp/presence/${instanceId}/${phone}`);
    return response.data;
  },
};
