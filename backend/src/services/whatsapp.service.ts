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

      console.log('Evolution API Response:', JSON.stringify({
        instanceName: instance?.instanceName,
        hasApiKey: !!hash?.apikey,
        hasQRCode: !!qrcode?.base64,
      }));

      // Configura webhook para receber mensagens
      await this.configureWebhook(finalInstanceName);

      // Salva a instância no banco de dados
      // Se Evolution não retornar apikey individual, usa a global
      const whatsappInstance = await prisma.whatsAppInstance.create({
        data: {
          companyId,
          instanceName: instance.instanceName,
          apiKey: hash?.apikey || this.globalApiKey,
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

      // Se já está conectado, não precisa de QR Code
      if (instance.status === WhatsAppStatus.CONNECTED) {
        return {
          qrCode: null,
          status: instance.status,
        };
      }

      // Se já temos o QR Code recente no banco (menos de 2 minutos), retornamos
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      if (
        instance.qrCode &&
        instance.status === WhatsAppStatus.CONNECTING &&
        instance.updatedAt > twoMinutesAgo
      ) {
        return {
          qrCode: instance.qrCode,
          status: instance.status,
        };
      }

      // Busca o QR Code da Evolution API
      // A Evolution API tem diferentes endpoints dependendo da versão
      let qrCode: string;

      try {
        // Primeiro tenta o endpoint /instance/connect (versões mais recentes)
        const response = await this.axiosInstance.get<EvolutionApiQRCodeResponse>(
          `/instance/connect/${instance.instanceName}`
        );
        qrCode = response.data.base64 || response.data.code;
      } catch (connectError: any) {
        try {
          const response = await this.axiosInstance.get<EvolutionApiQRCodeResponse>(
            `/instance/qrcode/${instance.instanceName}`
          );
          qrCode = response.data.base64 || response.data.code;
        } catch (qrcodeError: any) {
          const response = await this.axiosInstance.get<EvolutionApiQRCodeResponse>(
            `/instance/qr/${instance.instanceName}`
          );
          qrCode = response.data.base64 || response.data.code;
        }
      }

      if (!qrCode) {
        throw new Error('QR Code not found in Evolution API response');
      }

      // Atualiza o QR Code no banco
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          qrCode,
          status: WhatsAppStatus.CONNECTING,
        },
      });

      return {
        qrCode,
        status: WhatsAppStatus.CONNECTING,
      };
    } catch (error: any) {
      console.error('[WhatsApp Service] ✗ Error getting QR code:', error.response?.data || error.message);
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

      // Busca o status da Evolution API (sem cache para garantir atualização imediata)
      let apiState: string;

      try {
        const response = await this.axiosInstance.get<EvolutionApiConnectionStateResponse>(
          `/instance/connectionState/${instance.instanceName}`,
          {
            timeout: 5000,
          }
        );
        apiState = response.data.state;
      } catch (apiError: any) {
        // Se a Evolution API falhar, retorna o último status conhecido
        return {
          status: instance.status,
          phoneNumber: instance.phoneNumber,
          instanceName: instance.instanceName,
        };
      }

      // Mapeia o status da API para o nosso enum
      let status: WhatsAppStatus;
      switch (apiState) {
        case 'open':
          status = WhatsAppStatus.CONNECTED;
          console.log(`✅ Evolution API: ${instance.instanceName} CONNECTED`);
          break;
        case 'connecting':
          status = WhatsAppStatus.CONNECTING;
          break;
        case 'close':
        case 'closed':
          status = WhatsAppStatus.DISCONNECTED;
          console.log(`❌ Evolution API: ${instance.instanceName} DISCONNECTED`);
          break;
        default:
          status = WhatsAppStatus.CONNECTING;
          break;
      }

      // Atualiza o status no banco
      const updatedInstance = await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          status,
          // Limpa o QR Code se conectado ou desconectado
          qrCode: status === WhatsAppStatus.CONNECTED || status === WhatsAppStatus.DISCONNECTED
            ? null
            : instance.qrCode,
          // Atualiza o updatedAt para servir como cache
        },
      });

      return {
        status: updatedInstance.status,
        phoneNumber: updatedInstance.phoneNumber,
        instanceName: updatedInstance.instanceName,
      };
    } catch (error: any) {
      console.error('[WhatsApp Service] ✗ Error getting connection status:', error.response?.data || error.message);
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

      // Configura webhook com todos os eventos necessários
      await this.axiosInstance.post(`/webhook/set/${instanceName}`, {
        url: fullWebhookUrl,
        enabled: true,
        webhook_by_events: false, // Usa webhook único para todos eventos
        webhook_base64: false, // Não envia arquivos em base64 (economiza banda)
        events: [
          // Eventos de mensagens
          'MESSAGES_UPSERT', // Nova mensagem recebida ou enviada
          'MESSAGES_UPDATE', // Status da mensagem (entregue, lido, etc)
          'MESSAGES_DELETE', // Mensagem deletada
          'SEND_MESSAGE', // Mensagem enviada

          // Eventos de conexão (CRÍTICOS para atualizar status)
          'CONNECTION_UPDATE', // Status da conexão (conectando, conectado, desconectado)
          'QRCODE_UPDATED', // QR Code atualizado
          'STATUS_INSTANCE', // Status da instância

          // Eventos de contatos (opcional, para sincronizar contatos)
          // 'CONTACTS_UPDATE',
          // 'CONTACTS_UPSERT',

          // Eventos de grupos (opcional, se for usar grupos)
          // 'GROUPS_UPSERT',
          // 'GROUPS_UPDATE',
        ],
        // Headers customizados (opcional)
        webhook_headers: {
          'X-Webhook-Secret': process.env.WEBHOOK_SECRET || '',
        },
      });

      console.log(`✅ Webhook configured: ${instanceName}`);
    } catch (error: any) {
      console.error('✗ Error configuring webhook:', error.response?.data || error.message);
      // Não lança erro para não bloquear a criação da instância
    }
  }
}

export default new WhatsAppService();
