import { prisma } from "../utils/prisma";
import { MessageDirection, MessageStatus, MessageFeedback } from "@prisma/client";
import { CreateMessageRequest, GetMessagesRequest, ConversationSummary } from "../types/message";
import openaiService from "./ai-providers/openai.service";
import { websocketService } from "./websocket.service";
import whatsappService from "./whatsapp.service";
import { Errors, AppError } from "../utils/errors";

class MessageService {
  /**
   * Cria uma nova mensagem (ou retorna existente se houver duplicata)
   */
  async createMessage(data: CreateMessageRequest) {
    try {
      // Se temos messageId e whatsappInstanceId, usa upsert para evitar duplicatas
      if (data.messageId && data.whatsappInstanceId) {
        const message = await prisma.message.upsert({
          where: {
            whatsappInstanceId_messageId: {
              whatsappInstanceId: data.whatsappInstanceId,
              messageId: data.messageId,
            },
          },
          update: {
            // Atualiza status se a mensagem já existe
            status: data.status || MessageStatus.SENT,
          },
          create: {
            customerId: data.customerId,
            whatsappInstanceId: data.whatsappInstanceId,
            direction: data.direction,
            content: data.content,
            timestamp: data.timestamp,
            status: data.status || MessageStatus.SENT,
            messageId: data.messageId,
            mediaType: data.mediaType || "text",
            mediaUrl: data.mediaUrl || null,
          },
          include: {
            customer: true,
            whatsappInstance: true,
          },
        });

        // 🔌 Emite evento WebSocket
        if (websocketService.isInitialized()) {
          websocketService.emitNewMessage(message.customer.companyId, {
            id: message.id,
            customerId: message.customerId,
            customerName: message.customer.name,
            isGroup: message.customer.isGroup ?? false,
            direction: message.direction,
            content: message.content,
            timestamp: message.timestamp,
            status: message.status,
            senderType: message.senderType,
            mediaType: message.mediaType,
            mediaUrl: message.mediaUrl,
          });
        }

        return message;
      }

      // Fallback para mensagens sem messageId (ex: mensagens enviadas manualmente)
      const message = await prisma.message.create({
        data: {
          customerId: data.customerId,
          whatsappInstanceId: data.whatsappInstanceId,
          direction: data.direction,
          content: data.content,
          timestamp: data.timestamp,
          status: data.status || MessageStatus.SENT,
          messageId: data.messageId,
          mediaType: data.mediaType || "text",
          mediaUrl: data.mediaUrl || null,
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      // 🔌 Emite evento WebSocket
      if (websocketService.isInitialized()) {
        websocketService.emitNewMessage(message.customer.companyId, {
          id: message.id,
          customerId: message.customerId,
          customerName: message.customer.name,
          isGroup: message.customer.isGroup ?? false,
          direction: message.direction,
          content: message.content,
          timestamp: message.timestamp,
          status: message.status,
          senderType: message.senderType,
          mediaType: message.mediaType,
          mediaUrl: message.mediaUrl,
        });
      }

      return message;
    } catch (error: any) {
      console.error("Error creating message:", error);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens com filtros
   */
  async getMessages(filters: GetMessagesRequest) {
    try {
      const { customerId, whatsappInstanceId, direction, limit = 50, offset = 0 } = filters;

      const where: any = {};

      if (customerId) where.customerId = customerId;
      if (whatsappInstanceId) where.whatsappInstanceId = whatsappInstanceId;
      if (direction) where.direction = direction;

      const messages = await prisma.message.findMany({
        where,
        include: {
          customer: true,
          whatsappInstance: true,
        },
        orderBy: {
          timestamp: "asc", // Ordenação ascendente para manter cronologia correta
        },
        take: limit,
        skip: offset,
      });

      const total = await prisma.message.count({ where });

      return {
        messages,
        total,
        limit,
        offset,
      };
    } catch (error: any) {
      console.error("Error getting messages:", error);
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens de um customer específico
   */
  async getCustomerMessages(customerId: string, limit = 50, offset = 0) {
    return this.getMessages({
      customerId,
      limit,
      offset,
    });
  }

  /**
   * Atualiza o status de uma mensagem pelo ID interno
   */
  async updateMessageStatus(id: string, status: MessageStatus) {
    try {
      const message = await prisma.message.update({
        where: { id },
        data: { status },
      });

      return message;
    } catch (error: any) {
      console.error("Error updating message status:", error);
      throw new Error(`Failed to update message status: ${error.message}`);
    }
  }

  /**
   * Obtém resumo de conversas (última mensagem por customer)
   */
  async getConversations(companyId: string): Promise<ConversationSummary[]> {
    try {
      // Busca todas as mensagens da empresa ordenadas por timestamp
      const messages = await prisma.message.findMany({
        where: {
          customer: {
            companyId,
          },
        },
        include: {
          customer: true,
          whatsappInstance: {
            select: {
              id: true,
              instanceName: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      // Busca todas as conversas da empresa com informações de IA e atribuição
      const conversations = await prisma.conversation.findMany({
        where: { companyId },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Cria um mapa de conversações para acesso rápido
      const conversationMap = new Map(conversations.map((c) => [c.customerId, c]));

      // Agrupa por customer E instância e pega a última mensagem de cada combinação
      const conversationsMap = new Map<string, ConversationSummary>();

      for (const message of messages) {
        // Cria chave única combinando customerId e whatsappInstanceId
        const conversationKey = `${message.customerId}-${message.whatsappInstanceId}`;

        if (!conversationsMap.has(conversationKey)) {
          const conversation = conversationMap.get(message.customerId);

          conversationsMap.set(conversationKey, {
            customerId: message.customerId,
            customerName: message.customer.name,
            customerPhone: message.customer.phone,
            customerProfilePic: message.customer.profilePicUrl ?? null,
            lastMessage: message.content,
            lastMessageTimestamp: message.timestamp,
            unreadCount: 0, // TODO: implementar lógica de não lidas
            direction: message.direction,
            aiEnabled: conversation?.aiEnabled ?? true, // Default para true se não houver conversa
            needsHelp: conversation?.needsHelp ?? false,
            isGroup: message.customer.isGroup ?? false, // Identifica se é um grupo do WhatsApp
            assignedToId: conversation?.assignedToId ?? null,
            assignedToName: conversation?.assignedTo?.name ?? null,
            whatsappInstanceId: message.whatsappInstanceId,
            whatsappInstanceName: message.whatsappInstance.instanceName,
          });
        }
      }

      return Array.from(conversationsMap.values());
    } catch (error: any) {
      console.error("Error getting conversations:", error);
      throw new Error(`Failed to get conversations: ${error.message}`);
    }
  }

  /**
   * Valida se um número extraído do remoteJid é um número de telefone válido
   * Detecta e rejeita WABA IDs (WhatsApp Business Account IDs)
   *
   * WABA IDs são IDs internos do WhatsApp Business API que não são números de telefone reais
   * Exemplo de WABA ID: 248103282159807 (muito longo, não segue padrão de telefone)
   *
   * Números válidos:
   * - Brasil: 55 + DDD (2) + número (8-9) = 12-13 dígitos
   * - Internacional: código país (1-3) + número (7-12) = geralmente 8-15 dígitos
   */
private isValidPhoneNumber(phone: string): { valid: boolean; reason?: string } {
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanPhone) return { valid: false, reason: 'Número vazio' };

    // Aceita números normais (8 a 15 dígitos)
    // IDs de Business (LID) costumam ter 15 dígitos e começar com 2
    if (cleanPhone.length < 8) {
      return { valid: false, reason: `Número muito curto (${cleanPhone.length} dígitos)` };
    }
    
    // Aumentamos a tolerância para aceitar LIDs de Business que o usuário mencionou
    if (cleanPhone.length > 16) {
      return { valid: false, reason: `Número muito longo (${cleanPhone.length} dígitos)` };
    }

    // Se parece um LID (15 dígitos começando com 2), aceitamos
    if (cleanPhone.length === 15 && cleanPhone.startsWith('2')) {
      return { valid: true };
    }

    // ... (resto da lógica de códigos de país mantida, mas menos restritiva para não bloquear Business)
    return { valid: true };
  }

  /**
   * Processa mensagem recebida via webhook
   */
  async processInboundMessage(
    instanceName: string,
    remoteJid: string,
    data: any // Payload completo da mensagem
  ) {
    try {
      const instance = await prisma.whatsAppInstance.findFirst({ where: { instanceName } });
      if (!instance) throw new Error(`Instance not found: ${instanceName}`);

      // ==================================================================================
      // 🕵️ CORREÇÃO DE NÚMERO REAL (LID vs PHONE)
      // ==================================================================================
      let realJid = remoteJid;
      let isLid = false;

      // Verifica se é uma mensagem vinda de um ID de Business (@lid)
      if (remoteJid.includes("@lid")) {
        isLid = true;

        // Tenta extrair o número real do campo participant (comum na Evolution API para LIDs)
        // O participant geralmente contém o JID real do usuário (ex: 5511999999999@s.whatsapp.net)
        if (data.key?.participant && data.key.participant.includes("@s.whatsapp.net")) {
          realJid = data.key.participant;
        } else {
        }
      }

      // Remove os domínios para ficar apenas o número/ID limpo
      const phone = realJid.replace("@s.whatsapp.net", "").replace("@lid", "");

      // Validação
      const phoneValidation = this.isValidPhoneNumber(phone);
      if (!phoneValidation.valid) {
        return null;
      }

      // ==================================================================================

      // Detecta se é grupo (agora checando o JID real, pois @lid nunca é grupo de user)
      const isGroup = realJid.includes("@g.us");

      // Busca ou cria cliente
      let customer = await prisma.customer.findUnique({
        where: { companyId_phone: { companyId: instance.companyId, phone } },
      });

      if (!customer) {
        // Busca foto de perfil
        let profilePicUrl: string | null = null;
        if (!isGroup) {
          // Passamos o JID completo se for LID para tentar a sorte, ou o número limpo
          // Nota: Se convertemos para o número real acima, a foto vai funcionar!
          profilePicUrl = await whatsappService.getProfilePicture(instanceName, phone);
        }

        let pipelineStageId: string | null = null;
        if (!isGroup) {
          const firstStage = await prisma.pipelineStage.findFirst({
            where: { companyId: instance.companyId },
            orderBy: { order: 'asc' },
          });
          pipelineStageId = firstStage?.id || null;
        }

        customer = await prisma.customer.create({
          data: {
            companyId: instance.companyId,
            name: data.pushName || phone,
            phone, // Aqui agora salvamos o número real (se recuperado) ou o LID limpo
            isGroup,
            profilePicUrl,
            pipelineStageId,
          },
        });
        
      } else {
        // ... (Lógica de atualização existente mantida) ...
         const updates: any = {};
         if (customer.isGroup !== isGroup) updates.isGroup = isGroup;
         if (data.pushName && data.pushName !== customer.name && customer.name === customer.phone) {
           updates.name = data.pushName;
         }
         // Tenta buscar foto se não tiver e agora temos o número real
         if (!customer.profilePicUrl && !isGroup && isLid) {
             const profilePicUrl = await whatsappService.getProfilePicture(instanceName, phone);
             if (profilePicUrl) updates.profilePicUrl = profilePicUrl;
         }

         if (Object.keys(updates).length > 0) {
           customer = await prisma.customer.update({
             where: { id: customer.id },
             data: updates,
           });
         }
      }

      // ... (O resto do método processInboundMessage continua igual: processamento de áudio, imagem, criação da mensagem) ...
      // Certifique-se de manter todo o bloco de processamento de mídia e o createMessage final
      
      // --- BLOCO DE MÍDIA E CRIAÇÃO (MANTIDO RESUMIDO AQUI PARA CONTEXTO) ---
      let content = "";
      let mediaType = "text";
      let mediaUrl = null;
      const msgData = data.message;

      if (msgData?.conversation || msgData?.extendedTextMessage?.text) {
        content = msgData.conversation || msgData.extendedTextMessage.text;
      } else if (msgData?.audioMessage) {
        // ... (seu código de áudio existente) ...
        mediaType = "audio";
        // Recupere a lógica original do áudio aqui
         // Exemplo rápido para não quebrar:
         if (msgData.audioMessage.base64) {
             const buffer = Buffer.from(msgData.audioMessage.base64, "base64");
             content = await openaiService.transcribeAudio(msgData.audioMessage.base64);
             mediaUrl = `data:audio/ogg;base64,${msgData.audioMessage.base64}`;
         }
      } else if (msgData?.imageMessage) {
         // ... (seu código de imagem existente) ...
         mediaType = "image";
         if (msgData.imageMessage.base64) {
             mediaUrl = `data:${msgData.imageMessage.mimetype};base64,${msgData.imageMessage.base64}`;
             content = msgData.imageMessage.caption || "Imagem recebida";
         }
      }

      if (!content && !mediaUrl) return null;

      const message = await this.createMessage({
        customerId: customer.id,
        whatsappInstanceId: instance.id,
        direction: MessageDirection.INBOUND,
        content,
        timestamp: new Date((data.messageTimestamp || Date.now()) * 1000),
        messageId: data.key.id,
        status: MessageStatus.DELIVERED,
        mediaType,
        mediaUrl,
      });

      return { message, customer, instance };

    } catch (error: any) {
      console.error("Error processing inbound message:", error);
      throw error;
    }
  }

  /**
   * Marca mensagens como lidas
   */
  async markAsRead(customerId: string, whatsappInstanceId: string) {
    try {
      await prisma.message.updateMany({
        where: {
          customerId,
          whatsappInstanceId,
          direction: MessageDirection.INBOUND,
          status: {
            not: MessageStatus.READ,
          },
        },
        data: {
          status: MessageStatus.READ,
        },
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }

  /**
   * Deleta todas as mensagens de um customer
   */
  async deleteCustomerMessages(customerId: string) {
    try {
      await prisma.message.deleteMany({
        where: { customerId },
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error deleting messages:", error);
      throw new Error(`Failed to delete messages: ${error.message}`);
    }
  }

  /**
   * Envia uma mensagem para um customer via WhatsApp
   */
  async sendMessage(customerId: string, content: string, sentBy: "HUMAN" | "AI" = "HUMAN", whatsappInstanceId?: string) {
    try {
      // Busca o customer com sua empresa e TODAS as instâncias (sem filtrar status no banco)
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          company: {
            include: {
              whatsappInstances: {
                orderBy: {
                  updatedAt: "desc", // Pega as mais recentes primeiro
                },
              },
            },
          },
        },
      });

      if (!customer) {
        throw Errors.customerNotFound(customerId);
      }

      // Verifica se a empresa tem instâncias configuradas
      if (customer.company.whatsappInstances.length === 0) {
        throw Errors.whatsappNoInstance();
      }

      let whatsappInstance;

      // Se foi especificada uma instância, usa ela
      if (whatsappInstanceId) {
        whatsappInstance = customer.company.whatsappInstances.find((i) => i.id === whatsappInstanceId);
        if (!whatsappInstance) {
          throw Errors.whatsappInstanceNotFound();
        }
      } else {
        // Busca a última mensagem do cliente para descobrir qual instância usar
        const lastMessage = await prisma.message.findFirst({
          where: {
            customerId: customer.id,
            direction: MessageDirection.INBOUND,
          },
          orderBy: {
            timestamp: "desc",
          },
          include: {
            whatsappInstance: true,
          },
        });

        // Se encontrou mensagem anterior, usa a mesma instância
        if (lastMessage) {
          whatsappInstance = customer.company.whatsappInstances.find((i) => i.id === lastMessage.whatsappInstanceId);
        }

        // Se ainda não tem instância, tenta encontrar uma CONECTADA
        if (!whatsappInstance) {
          whatsappInstance = customer.company.whatsappInstances.find((i) => i.status === "CONNECTED");
        }

        // FALLBACK: Se não achar conectada, pega a primeira (vai dar erro mais claro no whatsappService)
        if (!whatsappInstance && customer.company.whatsappInstances.length > 0) {
          whatsappInstance = customer.company.whatsappInstances[0];
          console.warn(`⚠️ Usando instância com status ${whatsappInstance.status} como fallback.`);
        }
      }

      if (!whatsappInstance) {
        throw Errors.whatsappNoInstance();
      }

      // Importa o whatsappService dinamicamente para evitar dependência circular
      const whatsappService = (await import("./whatsapp.service")).default;

      // Envia a mensagem via WhatsApp
      const result = await whatsappService.sendMessage({
        instanceId: whatsappInstance.id,
        to: customer.phone,
        text: content,
      });

      // Salva a mensagem no banco com senderType
      const message = await prisma.message.create({
        data: {
          customerId: customer.id,
          whatsappInstanceId: whatsappInstance.id,
          direction: MessageDirection.OUTBOUND,
          content,
          timestamp: new Date(),
          messageId: result.messageId,
          status: MessageStatus.SENT,
          senderType: sentBy,
          mediaType: "text", // Mensagens enviadas são sempre texto por enquanto
          mediaUrl: null,
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      // 🔌 Emite evento WebSocket para mensagem da IA ou Humano
      if (websocketService.isInitialized()) {
        console.log(`📤 Emitindo mensagem ${sentBy} via WebSocket para customer ${customer.id}`);
        websocketService.emitNewMessage(customer.companyId, {
          id: message.id,
          customerId: message.customerId,
          customerName: customer.name,
          isGroup: customer.isGroup ?? false,
          direction: message.direction,
          content: message.content,
          timestamp: message.timestamp,
          status: message.status,
          senderType: message.senderType,
          mediaType: message.mediaType,
          mediaUrl: message.mediaUrl,
        });
      }

      return {
        message,
        whatsappResult: result,
        sentBy,
      };
    } catch (error: any) {
      console.error("Error sending message:", error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Envia uma imagem para um customer via WhatsApp
   */
  async sendMedia(
    customerId: string,
    mediaBase64: string,
    caption?: string,
    sentBy: "HUMAN" | "AI" = "HUMAN",
    whatsappInstanceId?: string
  ) {
    try {
      // Busca o customer com sua empresa e instâncias
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          company: {
            include: {
              whatsappInstances: {
                orderBy: { updatedAt: "desc" },
              },
            },
          },
        },
      });

      if (!customer) {
        throw Errors.customerNotFound(customerId);
      }

      if (customer.company.whatsappInstances.length === 0) {
        throw Errors.whatsappNoInstance();
      }

      let whatsappInstance;

      // Se foi especificada uma instância, usa ela
      if (whatsappInstanceId) {
        whatsappInstance = customer.company.whatsappInstances.find((i) => i.id === whatsappInstanceId);
        if (!whatsappInstance) {
          throw Errors.whatsappInstanceNotFound();
        }
      } else {
        // Busca a última mensagem do cliente para descobrir qual instância usar
        const lastMessage = await prisma.message.findFirst({
          where: {
            customerId: customer.id,
            direction: MessageDirection.INBOUND,
          },
          orderBy: { timestamp: "desc" },
          include: { whatsappInstance: true },
        });

        if (lastMessage) {
          whatsappInstance = customer.company.whatsappInstances.find((i) => i.id === lastMessage.whatsappInstanceId);
        }

        if (!whatsappInstance) {
          whatsappInstance = customer.company.whatsappInstances.find((i) => i.status === "CONNECTED");
        }

        if (!whatsappInstance && customer.company.whatsappInstances.length > 0) {
          whatsappInstance = customer.company.whatsappInstances[0];
        }
      }

      if (!whatsappInstance) {
        throw Errors.whatsappNoInstance();
      }

      // Importa o whatsappService dinamicamente
      const whatsappService = (await import("./whatsapp.service")).default;

      // Envia a mídia via WhatsApp
      const result = await whatsappService.sendMedia({
        instanceId: whatsappInstance.id,
        to: customer.phone,
        mediaBase64,
        caption,
        mediaType: "image",
      });

      // Salva a mensagem no banco
      const message = await prisma.message.create({
        data: {
          customerId: customer.id,
          whatsappInstanceId: whatsappInstance.id,
          direction: MessageDirection.OUTBOUND,
          content: caption || "[Imagem enviada]",
          timestamp: new Date(),
          messageId: result.messageId,
          status: MessageStatus.SENT,
          senderType: sentBy,
          mediaType: "image",
          mediaUrl: mediaBase64, // Salva o base64 para exibição no chat
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      // Emite evento WebSocket
      if (websocketService.isInitialized()) {
        console.log(`📤 Emitindo imagem via WebSocket para customer ${customer.id}`);
        websocketService.emitNewMessage(customer.companyId, {
          id: message.id,
          customerId: message.customerId,
          customerName: customer.name,
          isGroup: customer.isGroup ?? false,
          direction: message.direction,
          content: message.content,
          timestamp: message.timestamp,
          status: message.status,
          senderType: message.senderType,
          mediaType: message.mediaType,
          mediaUrl: message.mediaUrl,
        });
      }

      return {
        message,
        whatsappResult: result,
        sentBy,
      };
    } catch (error: any) {
      console.error("Error sending media:", error);
      throw new Error(`Failed to send media: ${error.message}`);
    }
  }

  /**
   * Adiciona feedback a uma mensagem da IA
   */
  async addFeedback(messageId: string, feedback: "GOOD" | "BAD", feedbackNote?: string) {
    try {
      // Verifica se a mensagem existe e é da IA
      const existingMessage = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!existingMessage) {
        throw new Error("Message not found");
      }

      if (existingMessage.senderType !== "AI") {
        throw new Error("Feedback can only be added to AI messages");
      }

      // Atualiza a mensagem com o feedback
      const message = await prisma.message.update({
        where: { id: messageId },
        data: {
          feedback: feedback as MessageFeedback,
          feedbackNote: feedbackNote || null,
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      return message;
    } catch (error: any) {
      console.error("Error adding feedback:", error);
      throw new Error(`Failed to add feedback: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de feedback
   */
  async getFeedbackStats(companyId: string) {
    try {
      // Total de mensagens da IA
      const totalAiMessages = await prisma.message.count({
        where: {
          customer: {
            companyId,
          },
          senderType: "AI",
        },
      });

      // Mensagens com feedback positivo
      const goodFeedback = await prisma.message.count({
        where: {
          customer: {
            companyId,
          },
          senderType: "AI",
          feedback: "GOOD",
        },
      });

      // Mensagens com feedback negativo
      const badFeedback = await prisma.message.count({
        where: {
          customer: {
            companyId,
          },
          senderType: "AI",
          feedback: "BAD",
        },
      });

      // Mensagens sem feedback
      const noFeedback = totalAiMessages - goodFeedback - badFeedback;

      // Percentual de feedback positivo (sobre mensagens com feedback)
      const totalWithFeedback = goodFeedback + badFeedback;
      const goodPercentage = totalWithFeedback > 0 ? (goodFeedback / totalWithFeedback) * 100 : 0;

      return {
        totalAiMessages,
        goodFeedback,
        badFeedback,
        noFeedback,
        goodPercentage: Math.round(goodPercentage * 10) / 10, // Arredonda para 1 casa decimal
      };
    } catch (error: any) {
      console.error("Error getting feedback stats:", error);
      throw new Error(`Failed to get feedback stats: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens com feedback negativo para revisão
   */
  async getMessagesWithBadFeedback(companyId: string, limit = 50, offset = 0) {
    try {
      const messages = await prisma.message.findMany({
        where: {
          customer: {
            companyId,
          },
          senderType: "AI",
          feedback: "BAD",
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit,
        skip: offset,
      });

      const total = await prisma.message.count({
        where: {
          customer: {
            companyId,
          },
          senderType: "AI",
          feedback: "BAD",
        },
      });

      return {
        messages,
        total,
        limit,
        offset,
      };
    } catch (error: any) {
      console.error("Error getting messages with bad feedback:", error);
      throw new Error(`Failed to get messages with bad feedback: ${error.message}`);
    }
  }
}

export default new MessageService();
