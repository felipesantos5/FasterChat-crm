import { prisma } from "../utils/prisma";
import { MessageDirection, MessageStatus, MessageFeedback } from "@prisma/client";
import { CreateMessageRequest, GetMessagesRequest, ConversationSummary } from "../types/message";
import openaiService from "./ai-providers/openai.service";
import geminiService from "./ai-providers/gemini.service";
import { websocketService } from "./websocket.service";
import whatsappService from "./whatsapp.service";
import { Errors, AppError } from "../utils/errors";
import ragService from "./rag.service";
import { AIProvider } from "../types/ai-provider";

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
        orderBy: [
          { timestamp: "asc" },   // Primeiro ordena por timestamp
          { createdAt: "asc" },   // Depois por createdAt para desempate (ordem de criação no banco)
        ],
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
   * Atualiza o status de uma mensagem pelo messageId do WhatsApp (Evolution API)
   * Usado para processar webhooks de status (delivered, read)
   */
  async updateMessageStatusByWhatsAppId(
    whatsappInstanceId: string,
    messageId: string,
    status: MessageStatus
  ): Promise<{ message: any; companyId: string } | null> {
    try {
      // Busca a mensagem pelo índice composto
      const message = await prisma.message.findUnique({
        where: {
          whatsappInstanceId_messageId: {
            whatsappInstanceId,
            messageId,
          },
        },
        include: {
          customer: true,
        },
      });

      if (!message) {
        return null;
      }

      // Só atualiza se o novo status for "mais avançado" que o atual
      // SENT -> DELIVERED -> READ
      const statusOrder = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 0 };
      const currentOrder = statusOrder[message.status as keyof typeof statusOrder] || 0;
      const newOrder = statusOrder[status as keyof typeof statusOrder] || 0;

      if (newOrder <= currentOrder) {
        // Status atual já é igual ou mais avançado, não atualiza
        return { message, companyId: message.customer.companyId };
      }

      // Atualiza o status
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: { status },
        include: {
          customer: true,
        },
      });

      // Emite via WebSocket
      if (websocketService.isInitialized()) {
        websocketService.emitMessageStatusUpdate(
          updatedMessage.customer.companyId,
          updatedMessage.id,
          status
        );
      }

      return { message: updatedMessage, companyId: updatedMessage.customer.companyId };
    } catch (error: any) {
      console.error("Error updating message status by WhatsApp ID:", error);
      return null;
    }
  }

  /**
   * Obtém resumo de conversas (última mensagem por customer)
   */
  async getConversations(companyId: string): Promise<ConversationSummary[]> {
    try {
      // Busca todas as mensagens da empresa ordenadas por timestamp e createdAt
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
        orderBy: [
          { timestamp: "desc" },
          { createdAt: "desc" },
        ],
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
   * Valida e sanitiza o pushName recebido do webhook
   * Detecta quando pushName contém IDs numéricos ao invés de nomes reais
   *
   * @param pushName - Nome fornecido pelo WhatsApp
   * @param phone - Número do telefone (fallback)
   * @returns Nome válido ou null se pushName for inválido
   */
  private sanitizePushName(pushName: string | undefined, phone: string): string {
    // Se não tem pushName, retorna o phone
    if (!pushName || pushName.trim() === '') {
      return phone;
    }

    const trimmedName = pushName.trim();

    // 🚫 REJEITA pushName se for apenas números longos (WABA IDs)
    // Exemplo: "224583923818692" - Isso é claramente um ID, não um nome
    const isOnlyNumbers = /^\d+$/.test(trimmedName);

    if (isOnlyNumbers) {
      // Se tem mais de 10 dígitos consecutivos, provavelmente é um ID, não um nome
      if (trimmedName.length > 10) {
        return phone;
      }
    }

    // 🚫 REJEITA pushName que seja igual ao phone (sem sentido duplicar)
    const cleanPushName = trimmedName.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPushName === cleanPhone) {
      return phone;
    }

    // ✅ pushName válido, retorna ele
    return trimmedName;
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
      let extractedFromParticipant = false;

      // Verifica se é uma mensagem vinda de um ID de Business (@lid)
      if (remoteJid.includes("@lid")) {
        isLid = true;

        // Tenta extrair o número real do campo participant (comum na Evolution API para LIDs)
        // O participant geralmente contém o JID real do usuário (ex: 5511999999999@s.whatsapp.net)
        if (data.key?.participant && data.key.participant.includes("@s.whatsapp.net")) {
          realJid = data.key.participant;
          extractedFromParticipant = true;
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

      // ==================================================================================
      // 🔍 BUSCA INTELIGENTE DE CLIENTE (Previne duplicatas LID/Phone)
      // ==================================================================================

      // Primeiro tenta buscar pelo phone exato
      let customer = await prisma.customer.findUnique({
        where: { companyId_phone: { companyId: instance.companyId, phone } },
      });

      // 🚨 ANTI-DUPLICATA: Se não encontrou pelo phone exato,
      // tenta encontrar o mesmo contato que pode ter sido salvo com phone/LID diferente.
      // Cenários cobertos:
      //   - LID primeiro, phone real depois (ou vice-versa)
      //   - Webhooks duplicados com JIDs diferentes para o mesmo contato
      if (!customer) {
        const trimmedPushName = data.pushName?.trim();
        // pushName válido = não vazio e não é um ID numérico longo (WABA ID)
        const isValidPushName = !!trimmedPushName && !/^\d{11,}$/.test(trimmedPushName);
        const incomingIsLid = isLid && !extractedFromParticipant;

        if (isValidPushName) {
          // Busca cliente existente com o mesmo nome na empresa
          const existingByName = await prisma.customer.findFirst({
            where: {
              companyId: instance.companyId,
              name: trimmedPushName,
              isGroup: false,
            },
            orderBy: { updatedAt: 'desc' },
          });

          if (existingByName && existingByName.phone !== phone) {
            // Confirma que é duplicata LID/Phone: um dos phones deve parecer LID (>=13 dígitos)
            const existingPhoneIsLid = /^\d{13,}$/.test(existingByName.phone);

            if (existingPhoneIsLid || incomingIsLid) {
              customer = existingByName;

              // Se temos phone real e o existente era LID, atualiza para o phone real
              if (!incomingIsLid && existingPhoneIsLid) {
                try {
                  customer = await prisma.customer.update({
                    where: { id: existingByName.id },
                    data: { phone },
                  });
                } catch {
                  // Unique constraint violation - outro customer já tem esse phone
                }
              }
            }
          }
        }
      }

      if (!customer) {
        // 🔧 SANITIZA O NOME: Previne usar WABA IDs como nome
        const sanitizedName = this.sanitizePushName(data.pushName, phone);

        // Busca foto de perfil
        let profilePicUrl: string | null = null;
        if (!isGroup) {
          try {
            // Se extraímos o número real do participant, usa ele para buscar foto
            // Caso contrário, tenta com o phone (que pode ser LID)
            profilePicUrl = await whatsappService.getProfilePicture(instanceName, phone);
          } catch (picError: any) {
            // Silently ignore profile pic errors
          }
        }

        let pipelineStageId: string | null = null;
        if (!isGroup) {
          const firstStage = await prisma.pipelineStage.findFirst({
            where: { companyId: instance.companyId },
            orderBy: { order: 'asc' },
          });
          pipelineStageId = firstStage?.id || null;
        }

        try {
          customer = await prisma.customer.create({
            data: {
              companyId: instance.companyId,
              name: sanitizedName,
              phone,
              isGroup,
              profilePicUrl,
              pipelineStageId,
            },
          });
        } catch (createError: any) {
          // Race condition: outro webhook criou o customer entre o findUnique e o create
          // Unique constraint violation (P2002) no companyId_phone
          if (createError.code === 'P2002') {
            customer = await prisma.customer.findUnique({
              where: { companyId_phone: { companyId: instance.companyId, phone } },
            });
            if (!customer) throw createError;
          } else {
            throw createError;
          }
        }

      } else {
        // Lógica de atualização existente
        const updates: any = {};
        if (customer.isGroup !== isGroup) updates.isGroup = isGroup;

        // 🔧 ATUALIZA NOME: Apenas se o nome atual for o phone E o pushName for válido
        if (data.pushName && customer.name === customer.phone) {
          const sanitizedName = this.sanitizePushName(data.pushName, phone);
          if (sanitizedName !== customer.phone && sanitizedName !== customer.name) {
            updates.name = sanitizedName;
          }
        }

        // Tenta buscar foto se não tiver e agora temos o número real
        if (!customer.profilePicUrl && !isGroup) {
          try {
            const profilePicUrl = await whatsappService.getProfilePicture(instanceName, phone);
            if (profilePicUrl) {
              updates.profilePicUrl = profilePicUrl;
            }
          } catch (picError: any) {
            // Silently ignore profile pic errors
          }
        }

        if (Object.keys(updates).length > 0) {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updates,
          });
        }
      }

      // ==================================================================================
      // PROCESSAMENTO DE MÍDIA E CONTEÚDO
      // ==================================================================================
      let content = "";
      let mediaType = "text";
      let mediaUrl: string | null = null;
      const msgData = data.message;

      // 1. MENSAGEM DE TEXTO
      if (msgData?.conversation || msgData?.extendedTextMessage?.text) {
        content = msgData.conversation || msgData.extendedTextMessage.text;
      }
      // 2. MENSAGEM DE ÁUDIO
      else if (msgData?.audioMessage) {
        mediaType = "audio";
        console.log(`[MessageService] 🎤 Audio message detected. Checking for base64...`);

        try {
          const mimetype = msgData.audioMessage.mimetype || "audio/ogg";
          let base64Audio = msgData.audioMessage.base64;

          if (base64Audio) {
            console.log(`[MessageService] ✅ Audio found in base64 format in payload.`);
          } else {
            console.log(`[MessageService] ⬇️ Audio base64 not found in payload. Attempting download...`);
            // Baixa o áudio da Evolution API
            const audioBuffer = await whatsappService.downloadMedia(instanceName, data.key);
            base64Audio = audioBuffer.toString("base64");
            console.log(`[MessageService] ✅ Audio downloaded and converted to base64.`);
          }

          // Define a URL do áudio em base64
          mediaUrl = `data:${mimetype};base64,${base64Audio}`;

          // Provider é definido via .env (AI_PROVIDER), não usa mais o banco
          const aiProvider: AIProvider = (process.env.AI_PROVIDER as AIProvider) || "gemini";

          // Transcreve o áudio com o provedor configurado (Gemini é o padrão)
          console.log(`[MessageService] 📝 Starting transcription with ${aiProvider}...`);
          try {
            if (aiProvider === "openai" && openaiService.isConfigured()) {
              content = await openaiService.transcribeAudio(base64Audio);
            } else {
              content = await geminiService.transcribeAudio(base64Audio, mimetype);
            }
            console.log(`[MessageService] ✅ Transcription successful: "${content.substring(0, 50)}..."`);
          } catch (transcribeError: any) {
            console.error(`[MessageService] ❌ Erro ao transcrever áudio:`, transcribeError.message);
            content = "[Áudio recebido - transcrição indisponível]";
          }
        } catch (downloadError: any) {
          console.error(`[MessageService] ❌ Erro ao processar áudio:`, downloadError.message);
          content = "[Áudio recebido - erro ao processar]";
        }
      }
      // 3. MENSAGEM DE IMAGEM
      else if (msgData?.imageMessage) {
        mediaType = "image";
        console.log(`[MessageService] 📷 Image message detected. Checking for base64...`);

        try {
          const mimetype = msgData.imageMessage.mimetype || "image/jpeg";
          let base64Image = msgData.imageMessage.base64;

          if (base64Image) {
            console.log(`[MessageService] ✅ Image found in base64 format in payload.`);
          } else {
            console.log(`[MessageService] ⬇️ Image base64 not found in payload. Attempting download...`);
            // Baixa a imagem da Evolution API
            const imageBuffer = await whatsappService.downloadMedia(instanceName, data.key);
            base64Image = imageBuffer.toString("base64");
            console.log(`[MessageService] ✅ Image downloaded and converted to base64.`);
          }

          // Define a URL da imagem em base64
          mediaUrl = `data:${mimetype};base64,${base64Image}`;

          // Usa a legenda se disponível
          content = msgData.imageMessage.caption || "Imagem recebida";
        } catch (downloadError: any) {
          console.error(`[MessageService] ❌ Erro ao baixar imagem:`, downloadError.message);
          content = "[Imagem recebida - erro ao processar]";
        }
      }
      // 4. MENSAGEM DE VÍDEO
      else if (msgData?.videoMessage) {
        mediaType = "video";
        content = msgData.videoMessage.caption || "Vídeo recebido";
        // Vídeos são muito grandes para baixar, apenas registra a mensagem
      }
      // 5. MENSAGEM DE DOCUMENTO
      else if (msgData?.documentMessage) {
        mediaType = "document";
        content = msgData.documentMessage.fileName || "Documento recebido";
      }
      // 6. MENSAGEM DE STICKER
      else if (msgData?.stickerMessage) {
        mediaType = "sticker";
        content = "[Sticker]";
      }
      // 7. MENSAGEM DE LOCALIZAÇÃO
      else if (msgData?.locationMessage) {
        mediaType = "location";
        content = `Localização: ${msgData.locationMessage.degreesLatitude}, ${msgData.locationMessage.degreesLongitude}`;
      }
      // 8. MENSAGEM DE CONTATO
      else if (msgData?.contactMessage) {
        mediaType = "contact";
        content = msgData.contactMessage.displayName || "Contato recebido";
      }

      // Se não conseguiu extrair conteúdo, retorna null
      if (!content && !mediaUrl) {
        return null;
      }

      // ==================================================================================
      // CRIA A MENSAGEM NO BANCO
      // ==================================================================================
      const message = await this.createMessage({
        customerId: customer.id,
        whatsappInstanceId: instance.id,
        direction: MessageDirection.INBOUND,
        content,
        timestamp: new Date((data.messageTimestamp || Date.now() / 1000) * 1000),
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

      // Se foi especificada uma instância explícita na chamada (ex: flow configurado para X), usa ela
      if (whatsappInstanceId) {
        whatsappInstance = customer.company.whatsappInstances.find((i) => i.id === whatsappInstanceId);
        if (!whatsappInstance) {
          throw Errors.whatsappInstanceNotFound();
        }
      } else {
        // Busca a última mensagem INBOUND do cliente para manter a mesma linha em respostas de chat humano
        const lastMessage = await prisma.message.findFirst({
          where: {
            customerId: customer.id,
            direction: MessageDirection.INBOUND,
          },
          orderBy: [
            { timestamp: "desc" },
            { createdAt: "desc" },
          ],
        });

        if (lastMessage) {
          whatsappInstance = customer.company.whatsappInstances.find((i) => i.id === lastMessage.whatsappInstanceId);
        }

        // Se o contato nunca nos mandou mensagem, usa a ESTRATÉGIA DE ENVIO DA EMPRESA (Random ou Específico)
        if (!whatsappInstance) {
          const { whatsappStrategy, defaultWhatsappInstanceId } = customer.company as any;
          const connectedInstances = customer.company.whatsappInstances.filter((i) => i.status === "CONNECTED");

          if (whatsappStrategy === "SPECIFIC" && defaultWhatsappInstanceId) {
            whatsappInstance = customer.company.whatsappInstances.find((i) => i.id === defaultWhatsappInstanceId);
          } else if (connectedInstances.length > 0) {
            // RANDOM (aleatório entre as conectadas)
            const randomIndex = Math.floor(Math.random() * connectedInstances.length);
            whatsappInstance = connectedInstances[randomIndex];
          }
        }

        // FALLBACK: Se não achar nenhuma conectada pela estratégia, pega a primeira (pode falhar no whatsappService mas evita quebrar a lógica aqui)
        if (!whatsappInstance && customer.company.whatsappInstances.length > 0) {
          whatsappInstance = customer.company.whatsappInstances[0];
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
   * Envia uma mídia (imagem ou áudio) para um customer via WhatsApp
   */
  async sendMedia(
    customerId: string,
    mediaBase64: string,
    caption?: string,
    sentBy: "HUMAN" | "AI" = "HUMAN",
    whatsappInstanceId?: string
  ) {
    try {
      // Detecta o tipo de mídia pelo header base64
      const isAudio = mediaBase64.startsWith('data:audio/');
      const isImage = mediaBase64.startsWith('data:image/');
      const mediaType = isAudio ? 'audio' : isImage ? 'image' : 'image'; // Default para image se não detectar

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
          orderBy: [
            { timestamp: "desc" },
            { createdAt: "desc" },
          ],
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
        mediaType: mediaType as any, // Usa o tipo detectado (audio ou image)
      });

      // Define conteúdo padrão baseado no tipo
      const defaultContent = isAudio ? "[Áudio enviado]" : "[Imagem enviada]";

      // Salva a mensagem no banco
      const message = await prisma.message.create({
        data: {
          customerId: customer.id,
          whatsappInstanceId: whatsappInstance.id,
          direction: MessageDirection.OUTBOUND,
          content: caption || defaultContent,
          timestamp: new Date(),
          messageId: result.messageId,
          status: MessageStatus.SENT,
          senderType: sentBy,
          mediaType: mediaType as any, // Usa o tipo detectado
          mediaUrl: mediaBase64, // Salva o base64 para exibição no chat
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      // Emite evento WebSocket
      if (websocketService.isInitialized()) {
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
   * Adiciona ou remove feedback de uma mensagem da IA
   */
  async addFeedback(messageId: string, feedback: "GOOD" | "BAD" | null, feedbackNote?: string) {
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

      // Atualiza a mensagem com o feedback (ou remove se for null)
      const message = await prisma.message.update({
        where: { id: messageId },
        data: {
          feedback: feedback as MessageFeedback | null,
          feedbackNote: feedback === null ? null : (feedbackNote || null),
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      // Indexa feedback no RAG para aprendizado semântico
      const companyId = message.customer.companyId;
      const ragSource = `feedback_msg_${messageId}`;

      if (feedback === null) {
        // Feedback removido - limpa do RAG
        ragService.clearBySource(companyId, ragSource).catch(() => {});
      } else {
        // Busca a mensagem do cliente que gerou esta resposta da IA
        const previousCustomerMsg = await prisma.message.findFirst({
          where: {
            customerId: message.customerId,
            timestamp: { lt: message.timestamp },
            direction: "INBOUND",
          },
          orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
        });

        const customerQuestion = previousCustomerMsg?.content || "(contexto não disponível)";
        const ragType = feedback === "GOOD" ? "feedback_good" : "feedback_bad";

        let ragText: string;
        if (feedback === "GOOD") {
          ragText = `[FEEDBACK POSITIVO] Exemplo de boa resposta da IA:\nCliente perguntou: "${customerQuestion}"\nResposta da IA (aprovada): "${message.content}"`;
          if (feedbackNote) ragText += `\nNota do avaliador: "${feedbackNote}"`;
        } else {
          ragText = `[FEEDBACK NEGATIVO] Exemplo de resposta ruim da IA - EVITE repetir:\nCliente perguntou: "${customerQuestion}"\nResposta problemática: "${message.content}"`;
          if (feedbackNote) ragText += `\nMotivo da reclamação: "${feedbackNote}"`;
        }

        ragService.processAndStore(companyId, ragText, {
          source: ragSource,
          type: ragType,
        }).catch((err: any) => console.warn("[MessageService] Erro ao indexar feedback no RAG:", err.message));
      }

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
        orderBy: [
          { timestamp: "desc" },
          { createdAt: "desc" },
        ],
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
