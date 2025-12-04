import axios, { AxiosInstance } from "axios";
import { prisma } from "../utils/prisma";
import { WhatsAppStatus } from "@prisma/client";
import {
  CreateInstanceRequest,
  SendMessageRequest,
  EvolutionApiCreateInstanceResponse,
  EvolutionApiQRCodeResponse,
  EvolutionApiConnectionStateResponse,
  EvolutionApiSendMessageResponse,
} from "../types/whatsapp";

class WhatsAppService {
  private axiosInstance: AxiosInstance;
  private apiUrl: string;
  private globalApiKey: string;

  // Cache de status para evitar múltiplas requisições
  private statusCache: Map<string, { status: WhatsAppStatus; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3000; // 3 segundos de cache

  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || "http://localhost:8080";
    this.globalApiKey = process.env.EVOLUTION_API_KEY || "";

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        "Content-Type": "application/json",
        apikey: this.globalApiKey,
      },
    });
  }

  /**
   * Cria uma nova instância do WhatsApp na Evolution API
   */

  async createInstance(data: CreateInstanceRequest) {
    const INSTANCE_LIMIT = 5;

    try {
      const { companyId, instanceName } = data;

      const currentInstances = await prisma.whatsAppInstance.count({
        where: { companyId },
      });

      if (currentInstances >= INSTANCE_LIMIT) {
        throw new Error("Limite atingido: Sua empresa já possui o máximo de 5 conexões de WhatsApp.");
      }

      // Gera um nome único para a instância se não foi fornecido
      const finalInstanceName = instanceName || `instance_${companyId}_${Date.now()}`;

      // Chama a Evolution API para criar a instância
      const response = await this.axiosInstance.post<EvolutionApiCreateInstanceResponse>("/instance/create", {
        instanceName: finalInstanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        reject_call: true, // 💡 Recomendado: Rejeita chamadas de voz/vídeo para não travar a IA
        groups_ignore: true, // 💡 Recomendado: Ignora grupos se seu foco é atendimento individual
        always_online: true, // 💡 Mantém status online
        browser: ["CRM AI Agent", "Chrome", "10.0"],
      });

      const { instance, hash, qrcode } = response.data;

      console.log(
        "Evolution API Response:",
        JSON.stringify({
          instanceName: instance?.instanceName,
          hasApiKey: !!hash?.apikey,
          hasQRCode: !!qrcode?.base64,
        })
      );

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
      console.error("Error creating WhatsApp instance:", error.response?.data || error.message);
      throw new Error(`Failed to create WhatsApp instance: ${error.response?.data?.message || error.message}`);
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
        throw new Error("WhatsApp instance not found");
      }

      // Se já está conectado, não precisa de QR Code
      if (instance.status === WhatsAppStatus.CONNECTED) {
        return {
          qrCode: null,
          status: instance.status,
        };
      }

      // Tenta buscar o QR Code na Evolution API
      let qrCode: string | undefined;

      // Função auxiliar para buscar QR Code
      const fetchQrFromApi = async () => {
        try {
          // Tenta endpoint V2 (/connect)
          const response = await this.axiosInstance.get<EvolutionApiQRCodeResponse>(`/instance/connect/${instance.instanceName}`);
          return response.data.base64 || response.data.code;
        } catch (e) {
          // Se falhar, tenta endpoint alternativo
          try {
            const response = await this.axiosInstance.get<EvolutionApiQRCodeResponse>(`/instance/qr/${instance.instanceName}`);
            return response.data.base64 || response.data.code;
          } catch (e2) {
            return undefined;
          }
        }
      };

      // 1. Primeira tentativa de buscar QR
      qrCode = await fetchQrFromApi();

      // 🛡️ BLINDAGEM: Se não achou QR Code, a instância pode ter sumido da Evolution.
      // Vamos tentar recriá-la automaticamente (Auto-Healing).
      if (!qrCode) {
        console.log(`[WhatsApp Service] ⚠️ QR Code não encontrado. Tentando restaurar instância ${instance.instanceName}...`);

        try {
          // Tenta recriar a instância na Evolution
          await this.axiosInstance.post("/instance/create", {
            instanceName: instance.instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            reject_call: true,
            groups_ignore: true,
            always_online: true,
            browser: ["CRM AI Agent", "Chrome", "10.0"], // Mesma config do createInstance
          });

          console.log(`[WhatsApp Service] ✅ Instância restaurada. Buscando QR Code novamente...`);

          // Aguarda 1s para garantir que a Evolution processou
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // 2. Segunda tentativa após recriar
          qrCode = await fetchQrFromApi();
        } catch (restoreError: any) {
          console.error(`[WhatsApp Service] ❌ Falha ao restaurar instância:`, restoreError.message);
        }
      }

      if (!qrCode) {
        throw new Error("Não foi possível gerar o QR Code. Por favor, exclua a conexão e tente novamente.");
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
      console.error("[WhatsApp Service] ✗ Error getting QR code:", error.response?.data || error.message);
      throw new Error(`Failed to get QR code: ${error.response?.data?.message || error.message}`);
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
        throw new Error("WhatsApp instance not found");
      }

      // Verifica se existe um status em cache válido
      const cached = this.statusCache.get(instanceId);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        return {
          status: cached.status,
          phoneNumber: instance.phoneNumber,
          instanceName: instance.instanceName,
        };
      }

      // Cache expirado ou não existe, busca da Evolution API
      let apiState: string;

      try {
        const response = await this.axiosInstance.get<EvolutionApiConnectionStateResponse>(`/instance/connectionState/${instance.instanceName}`, {
          timeout: 5000,
        });
        apiState = response.data.state;
      } catch (apiError: any) {
        // Se a Evolution API falhar, retorna o último status conhecido (do banco ou cache)
        console.log(`[WhatsApp Service] ⚠ Evolution API failed, returning last known status`);
        return {
          status: cached?.status || instance.status,
          phoneNumber: instance.phoneNumber,
          instanceName: instance.instanceName,
        };
      }

      // Mapeia o status da API para o nosso enum
      let status: WhatsAppStatus;
      switch (apiState) {
        case "open":
          status = WhatsAppStatus.CONNECTED;
          console.log(`✅ Evolution API: ${instance.instanceName} CONNECTED`);
          break;
        case "connecting":
          status = WhatsAppStatus.CONNECTING;
          break;
        case "close":
        case "closed":
          status = WhatsAppStatus.DISCONNECTED;
          console.log(`❌ Evolution API: ${instance.instanceName} DISCONNECTED`);
          break;
        default:
          status = WhatsAppStatus.CONNECTING;
          break;
      }

      // Atualiza o cache
      this.statusCache.set(instanceId, {
        status,
        timestamp: now,
      });

      // Atualiza o status no banco
      const updatedInstance = await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          status,
          // Limpa o QR Code se conectado ou desconectado
          qrCode: status === WhatsAppStatus.CONNECTED || status === WhatsAppStatus.DISCONNECTED ? null : instance.qrCode,
          // Define connectedAt quando conectar pela primeira vez
          connectedAt: status === WhatsAppStatus.CONNECTED && !instance.connectedAt ? new Date() : instance.connectedAt,
          // Atualiza o updatedAt para servir como cache
        },
      });

      return {
        status: updatedInstance.status,
        phoneNumber: updatedInstance.phoneNumber,
        instanceName: updatedInstance.instanceName,
      };
    } catch (error: any) {
      console.error("[WhatsApp Service] ✗ Error getting connection status:", error.response?.data || error.message);
      throw new Error(`Failed to get connection status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Atualiza o status de conexão (chamado pelo Webhook)
   */
  async updateConnectionStatus(instanceId: string, status: WhatsAppStatus, phoneNumber?: string) {
    try {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) return;

      // Atualiza o cache
      this.statusCache.set(instanceId, {
        status,
        timestamp: Date.now(),
      });

      // Atualiza o banco
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          status,
          phoneNumber: phoneNumber || instance.phoneNumber,
          qrCode: status === WhatsAppStatus.CONNECTED || status === WhatsAppStatus.DISCONNECTED ? null : instance.qrCode,
          // Define connectedAt quando conectar pela primeira vez
          connectedAt: status === WhatsAppStatus.CONNECTED && !instance.connectedAt ? new Date() : instance.connectedAt,
        },
      });

      console.log(`[WhatsApp Service] Status updated via Webhook: ${instance.instanceName} -> ${status}`);
    } catch (error: any) {
      console.error("[WhatsApp Service] Error updating connection status:", error.message);
    }
  }

  /**
   * Envia uma mensagem via WhatsApp
   */
  async sendMessage(data: SendMessageRequest) {
    try {
      const { instanceId, to, text } = data;

      let instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      });

      if (!instance) {
        throw new Error("WhatsApp instance not found");
      }

      // Verificação de status com tolerância para 'CONNECTING'
      if (instance.status !== WhatsAppStatus.CONNECTED) {
        console.log(`[WhatsApp Service] Status: ${instance.status}. Double checking API...`);

        const statusResult = await this.getStatus(instanceId);

        // ALTERAÇÃO AQUI: Aceitamos CONNECTED ou CONNECTING
        // A Evolution V2 frequentemente permite envio mesmo em estado 'connecting'
        if (statusResult.status !== WhatsAppStatus.CONNECTED && statusResult.status !== WhatsAppStatus.CONNECTING) {
          throw new Error(`Cannot send: Instance is ${statusResult.status}`);
        }

        console.log("[WhatsApp Service] Connection valid (Open or Connecting). Sending message...");
      }

      // ... (resto do código de formatação do número e envio permanece igual)
      const formattedNumber = to.replace(/\D/g, "");
      const remoteJid = `${formattedNumber}@s.whatsapp.net`;

      const response = await this.axiosInstance.post<EvolutionApiSendMessageResponse>(`/message/sendText/${instance!.instanceName}`, {
        number: remoteJid,
        text,
      });

      return {
        success: true,
        messageId: response.data.key.id,
        timestamp: response.data.messageTimestamp,
      };
    } catch (error: any) {
      // ... (catch permanece igual)
      console.error("Error sending message:", error.response?.data || error.message);
      throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Obtém todas as instâncias de uma empresa
   */
  async getInstancesByCompany(companyId: string) {
    try {
      const instances = await prisma.whatsAppInstance.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      });

      return instances;
    } catch (error: any) {
      console.error("Error getting instances:", error.message);
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
        throw new Error("WhatsApp instance not found");
      }

      // Tenta deletar da Evolution API
      try {
        await this.axiosInstance.delete(`/instance/delete/${instance.instanceName}`);
      } catch (apiError) {
        console.error("Error deleting from Evolution API:", apiError);
        // Continua mesmo se falhar na API
      }

      // Deleta do banco de dados
      await prisma.whatsAppInstance.delete({
        where: { id: instanceId },
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error deleting instance:", error.message);
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
        throw new Error("WhatsApp instance not found");
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
          connectedAt: null, // Limpa a data de conexão ao desconectar
        },
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error disconnecting instance:", error.response?.data || error.message);
      throw new Error(`Failed to disconnect instance: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Baixa mídia (áudio, imagem, etc) através da Evolution API
   * A Evolution API faz o download e descriptografia automaticamente
   * Documentação: https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
   */
  async downloadMedia(instanceName: string, messageKey: any): Promise<Buffer> {
    try {
      console.log(`[WhatsApp Service] 📥 Downloading media for message ${messageKey.id}...`);

      // Endpoint correto da Evolution API v2 para obter base64 de mídia
      const response = await this.axiosInstance.post(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: {
          key: messageKey,
        },
        convertToMp4: false, // Mantém formato original
      });

      // A resposta contém o base64 da mídia
      const base64Data = response.data?.base64;

      if (!base64Data) {
        throw new Error("No base64 data in response");
      }

      console.log(`[WhatsApp Service] ✅ Media base64 received: ${(base64Data.length / 1024).toFixed(2)} KB`);

      // Converte base64 para Buffer
      const mediaBuffer = Buffer.from(base64Data, "base64");

      return mediaBuffer;
    } catch (error: any) {
      console.error("[WhatsApp Service] ❌ Error downloading media:", error.response?.data || error.message);
      throw new Error(`Failed to download media: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Configura webhook na Evolution API
   */
  private async configureWebhook(instanceName: string) {
    try {
      // Prioriza a variável WEBHOOK_URL
      const webhookUrl = process.env.WEBHOOK_URL || process.env.API_URL;

      if (!webhookUrl) {
        console.warn("WEBHOOK_URL not configured, skipping webhook setup");
        return;
      }

      // Garante a rota correta da API
      const fullWebhookUrl = `${webhookUrl}/api/webhooks/whatsapp`;

      console.log(`🔄 Configurando webhook para ${instanceName} em: ${fullWebhookUrl}`);

      // CORREÇÃO: Formato V2 (dentro do objeto webhook) e Eventos Corrigidos
      await this.axiosInstance.post(`/webhook/set/${instanceName}`, {
        webhook: {
          url: fullWebhookUrl,
          enabled: true,
          webhook_by_events: false,
          webhook_base64: true,
          events: [
            "MESSAGES_UPSERT",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "SEND_MESSAGE",
            // STATUS_INSTANCE removido pois causa erro 400
          ],
          webhook_headers: {
            "X-Webhook-Secret": process.env.WEBHOOK_SECRET || "",
          },
        },
      });

      console.log(`✅ Webhook configured successfully: ${instanceName}`);
    } catch (error: any) {
      console.error("✗ Error configuring webhook:", error.response?.data || error.message);
    }
  }

  /**
   * Atualiza o nome amigável (displayName) de uma instância
   * O instanceName técnico permanece o mesmo para não quebrar a integração com Evolution API
   */
  async updateInstanceName(instanceId: string, displayName: string): Promise<void> {
    try {
      console.log(`[WhatsApp Service] Updating instance display name: ${instanceId} -> ${displayName}`);

      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: { displayName },
      });

      console.log(`✅ Instance display name updated successfully: ${displayName}`);
    } catch (error: any) {
      console.error("✗ Error updating instance display name:", error);
      throw new Error(`Failed to update instance display name: ${error.message}`);
    }
  }
}

export default new WhatsAppService();
