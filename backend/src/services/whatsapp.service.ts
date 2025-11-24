import axios, { AxiosInstance } from 'axios';
import { prisma } from '../utils/prisma';
import { WhatsAppStatus } from '@prisma/client';
import {
  CreateInstanceRequest,
  SendMessageRequest,
  EvolutionApiCreateInstanceResponse,
  EvolutionApiQRCodeResponse,
  EvolutionApiConnectionStateResponse,
  EvolutionApiSendMessageResponse,
} from '../types/whatsapp';

class WhatsAppService {
  private axiosInstance: AxiosInstance;
  private apiUrl: string;
  private globalApiKey: string;

  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    this.globalApiKey = process.env.EVOLUTION_API_KEY || '';

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.globalApiKey,
      },
    });
  }

  /**
   * Cria uma nova instância do WhatsApp na Evolution API
   */
  async createInstance(data: CreateInstanceRequest) {
    try {
      const { companyId, instanceName } = data;

      // Verifica se já existe uma instância para essa empresa
      const existingInstance = await prisma.whatsAppInstance.findFirst({
        where: { companyId },
      });

      if (existingInstance) {
        // Se já existe, retorna a instância existente
        return existingInstance;
      }

      // Gera um nome único para a instância se não foi fornecido
      const finalInstanceName = instanceName || `instance_${companyId}_${Date.now()}`;

      // Chama a Evolution API para criar a instância
      const response = await this.axiosInstance.post<EvolutionApiCreateInstanceResponse>(
        '/instance/create',
        {
          instanceName: finalInstanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }
      );

      const { instance, hash, qrcode } = response.data;

      // Configura webhook para receber mensagens
      await this.configureWebhook(finalInstanceName);

      // Salva a instância no banco de dados
      const whatsappInstance = await prisma.whatsAppInstance.create({
        data: {
          companyId,
          instanceName: instance.instanceName,
          apiKey: hash.apikey,
          qrCode: qrcode?.base64 || null,
          status: WhatsAppStatus.CONNECTING,
        },
      });

      return whatsappInstance;
    } catch (error: any) {
      console.error('Error creating WhatsApp instance:', error.response?.data || error.message);
      throw new Error(
        `Failed to create WhatsApp instance: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Obtém o QR Code de uma instância
   */
  async getQRCode(instanceId: string) {
    try {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        throw new Error('WhatsApp instance not found');
      }

      // Se já temos o QR Code no banco, retornamos
      if (instance.qrCode && instance.status === WhatsAppStatus.CONNECTING) {
        return {
          qrCode: instance.qrCode,
          status: instance.status,
        };
      }

      // Caso contrário, busca o QR Code da API
      const response = await this.axiosInstance.get<EvolutionApiQRCodeResponse>(
        `/instance/qrcode/${instance.instanceName}`
      );

      const qrCode = response.data.base64;

      // Atualiza o QR Code no banco
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: { qrCode },
      });

      return {
        qrCode,
        status: instance.status,
      };
    } catch (error: any) {
      console.error('Error getting QR code:', error.response?.data || error.message);
      throw new Error(
        `Failed to get QR code: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Verifica o status de conexão de uma instância
   */
  async getStatus(instanceId: string) {
    try {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        throw new Error('WhatsApp instance not found');
      }

      // Busca o status da API
      const response = await this.axiosInstance.get<EvolutionApiConnectionStateResponse>(
        `/instance/connectionState/${instance.instanceName}`
      );

      const apiState = response.data.state;

      // Mapeia o status da API para o nosso enum
      let status: WhatsAppStatus;
      switch (apiState) {
        case 'open':
          status = WhatsAppStatus.CONNECTED;
          break;
        case 'connecting':
          status = WhatsAppStatus.CONNECTING;
          break;
        case 'close':
        default:
          status = WhatsAppStatus.DISCONNECTED;
          break;
      }

      // Atualiza o status no banco
      const updatedInstance = await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          status,
          // Limpa o QR Code se conectado
          qrCode: status === WhatsAppStatus.CONNECTED ? null : instance.qrCode,
        },
      });

      return {
        status: updatedInstance.status,
        phoneNumber: updatedInstance.phoneNumber,
        instanceName: updatedInstance.instanceName,
      };
    } catch (error: any) {
      console.error('Error getting connection status:', error.response?.data || error.message);
      throw new Error(
        `Failed to get connection status: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Envia uma mensagem via WhatsApp
   */
  async sendMessage(data: SendMessageRequest) {
    try {
      const { instanceId, to, text } = data;

      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        throw new Error('WhatsApp instance not found');
      }

      if (instance.status !== WhatsAppStatus.CONNECTED) {
        throw new Error('WhatsApp instance is not connected');
      }

      // Formata o número de telefone (remove caracteres especiais e adiciona @s.whatsapp.net)
      const formattedNumber = to.replace(/\D/g, '');
      const remoteJid = `${formattedNumber}@s.whatsapp.net`;

      // Envia a mensagem via Evolution API
      const response = await this.axiosInstance.post<EvolutionApiSendMessageResponse>(
        `/message/sendText/${instance.instanceName}`,
        {
          number: remoteJid,
          text,
        }
      );

      return {
        success: true,
        messageId: response.data.key.id,
        timestamp: response.data.messageTimestamp,
      };
    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
      throw new Error(
        `Failed to send message: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Obtém todas as instâncias de uma empresa
   */
  async getInstancesByCompany(companyId: string) {
    try {
      const instances = await prisma.whatsAppInstance.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      });

      return instances;
    } catch (error: any) {
      console.error('Error getting instances:', error.message);
      throw new Error(`Failed to get instances: ${error.message}`);
    }
  }

  /**
   * Deleta uma instância
   */
  async deleteInstance(instanceId: string) {
    try {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        throw new Error('WhatsApp instance not found');
      }

      // Tenta deletar da Evolution API
      try {
        await this.axiosInstance.delete(`/instance/delete/${instance.instanceName}`);
      } catch (apiError) {
        console.error('Error deleting from Evolution API:', apiError);
        // Continua mesmo se falhar na API
      }

      // Deleta do banco de dados
      await prisma.whatsAppInstance.delete({
        where: { id: instanceId },
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting instance:', error.message);
      throw new Error(`Failed to delete instance: ${error.message}`);
    }
  }

  /**
   * Desconecta uma instância (logout)
   */
  async disconnectInstance(instanceId: string) {
    try {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        throw new Error('WhatsApp instance not found');
      }

      // Desconecta na Evolution API
      await this.axiosInstance.delete(`/instance/logout/${instance.instanceName}`);

      // Atualiza o status no banco
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          status: WhatsAppStatus.DISCONNECTED,
          qrCode: null,
          phoneNumber: null,
        },
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error disconnecting instance:', error.response?.data || error.message);
      throw new Error(
        `Failed to disconnect instance: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Configura webhook na Evolution API
   */
  private async configureWebhook(instanceName: string) {
    try {
      const webhookUrl = process.env.WEBHOOK_URL || process.env.API_URL;

      if (!webhookUrl) {
        console.warn('WEBHOOK_URL not configured, skipping webhook setup');
        return;
      }

      const fullWebhookUrl = `${webhookUrl}/api/webhooks/whatsapp`;

      await this.axiosInstance.post(`/webhook/set/${instanceName}`, {
        url: fullWebhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
        ],
      });

      console.log(`Webhook configured for instance ${instanceName}: ${fullWebhookUrl}`);
    } catch (error: any) {
      console.error('Error configuring webhook:', error.response?.data || error.message);
      // Não lança erro para não bloquear a criação da instância
    }
  }
}

export default new WhatsAppService();
