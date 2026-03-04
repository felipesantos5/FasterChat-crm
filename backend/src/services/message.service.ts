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
import { customerService } from "./customer.service";

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
    status: MessageStatus,
    remoteJid?: string
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
        console.warn(`[MessageService:StatusUpdate] ⚠️ Mensagem não encontrada: instanceId=${whatsappInstanceId} messageId=${messageId}`);
        return null;
      }

      // Só atualiza se o novo status for "mais avançado" que o atual
      // SENT -> DELIVERED -> READ
      const statusOrder = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 0 };
      const currentOrder = statusOrder[message.status as keyof typeof statusOrder] || 0;
      const newOrder = statusOrder[status as keyof typeof statusOrder] || 0;

      if (newOrder <= currentOrder) {
        // Status atual já é igual ou mais avançado, não atualiza
        // Mas podemos ainda assim aproveitar para mapear o LID
        if (remoteJid && !message.customer.isGroup) {
          const rawPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
          if (rawPhone.length >= 14 && rawPhone !== message.customer.phone && message.customer.lidPhone !== rawPhone) {
            try {
              await prisma.customer.update({
                where: { id: message.customer.id },
                data: { lidPhone: rawPhone }
              });
              console.log(`[MessageService] 🔗 LID mapping salvo via Status Update: customer "${message.customer.phone}" → lidPhone "${rawPhone}"`);
            } catch (e) {
              console.warn(`[MessageService] ⚠️ Erro ao salvar lidPhone:`, e);
            }
          }
        }
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

      // Mapeamento LID também aqui caso precisasse atualizar
      if (remoteJid && !updatedMessage.customer.isGroup) {
        const rawPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
        if (rawPhone.length >= 14 && rawPhone !== updatedMessage.customer.phone && updatedMessage.customer.lidPhone !== rawPhone) {
          try {
            await prisma.customer.update({
              where: { id: updatedMessage.customer.id },
              data: { lidPhone: rawPhone }
            });
            console.log(`[MessageService] 🔗 LID mapping salvo via Status Update: customer "${updatedMessage.customer.phone}" → lidPhone "${rawPhone}"`);
          } catch (e) {
            console.warn(`[MessageService] ⚠️ Erro ao salvar lidPhone:`, e);
          }
        }
      }

      // Emite via WebSocket para atualizar checkmarks em tempo real
      if (websocketService.isInitialized()) {
        console.log(`[MessageService:StatusUpdate] ✅ ${message.status} → ${status} | msgId=${updatedMessage.id} customer=${updatedMessage.customer.phone}`);
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
  async getConversations(companyId: string, includeArchived?: boolean): Promise<ConversationSummary[]> {
    try {
      // Busca todas as mensagens da empresa ordenadas por timestamp e createdAt
      const messages = await prisma.message.findMany({
        where: {
          customer: {
            companyId,
            ...(includeArchived === true ? { isArchived: true } : includeArchived === false || includeArchived === undefined ? { isArchived: false } : {}),
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

      // Conta mensagens INBOUND não lidas agrupadas por (customerId, whatsappInstanceId)
      const unreadGroups = await prisma.message.groupBy({
        by: ['customerId', 'whatsappInstanceId'],
        where: {
          customer: { companyId },
          direction: MessageDirection.INBOUND,
          status: { not: MessageStatus.READ },
        },
        _count: { id: true },
      });

      const unreadMap = new Map<string, number>();
      for (const row of unreadGroups) {
        unreadMap.set(`${row.customerId}-${row.whatsappInstanceId}`, row._count.id);
      }

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
            unreadCount: unreadMap.get(conversationKey) ?? 0,
            direction: message.direction,
            aiEnabled: conversation?.aiEnabled ?? true, // Default para true se não houver conversa
            needsHelp: conversation?.needsHelp ?? false,
            isGroup: message.customer.isGroup ?? false, // Identifica se é um grupo do WhatsApp
            assignedToId: conversation?.assignedToId ?? null,
            assignedToName: conversation?.assignedTo?.name ?? null,
            whatsappInstanceId: message.whatsappInstanceId,
            whatsappInstanceName: message.whatsappInstance.instanceName,
            isArchived: message.customer.isArchived ?? false,
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
   * Detecta e rejeita WABA IDs / LIDs (WhatsApp Business Account IDs)
   *
   * LIDs (Linked Identifiers) são IDs internos do WhatsApp que NÃO são telefones reais.
   * Exemplos: 217986837266644, 210831606300673, 188180284313837
   *
   * Números válidos:
   * - Brasil: 55 + DDD (2) + número (8-9) = 12-13 dígitos
   * - Internacional: código país (1-3) + número (7-12) = geralmente 8-15 dígitos
   * - Máximo real: 15 dígitos (E.164), mas na prática telefones reais têm no máximo 13
   */
  private isValidPhoneNumber(phone: string): { valid: boolean; reason?: string; isLid?: boolean } {
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanPhone) return { valid: false, reason: 'Número vazio' };

    // Mínimo 10 dígitos: telefone real com DDI tem no mínimo 10 dígitos (ex: +1XXXXXXXXX)
    // Números com 8-9 dígitos (sem DDI) não são válidos como JID do WhatsApp
    if (cleanPhone.length < 10) {
      return { valid: false, reason: `Número muito curto para ser telefone real (${cleanPhone.length} dígitos): ${cleanPhone}` };
    }

    // 🚨 DETECÇÃO DE LID: Números com 14+ dígitos são quase certamente LIDs, não telefones reais.
    if (cleanPhone.length >= 14) {
      return {
        valid: true, // ✅ Permite salvar para não perder a conversa
        reason: `Provável LID/WABA ID (${cleanPhone.length} dígitos): ${cleanPhone}`,
        isLid: true,
      };
    }

    return { valid: true };
  }

  /**
   * Detecta se um número parece ser um LID (Linked Identifier) do WhatsApp
   * mesmo sem o sufixo @lid. LIDs são IDs internos com 14+ dígitos.
   */
  private looksLikeLid(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    // LIDs têm 14+ dígitos, telefones reais têm no máximo 13
    return cleanPhone.length >= 14;
  }

  /**
   * Valida se um número resolvido de um LID parece um telefone real.
   * Rejeita IDs internos do WhatsApp Business que a Evolution API retorna
   * como se fossem telefones (ex: "2500068408", "1555XXXXXXX").
   *
   * Telefones válidos aceitos:
   * - Brasil: 55 + DDD(11-99) + 8-9 dígitos → 12-13 dígitos
   * - Internacional: qualquer DDI reconhecido + número local
   *
   * Rejeita:
   * - Números que começam com DDIs inexistentes ou suspeitos
   * - Números com menos de 10 ou mais de 13 dígitos
   */
  private isValidResolvedPhone(phone: string): boolean {
    const clean = phone.replace(/\D/g, '');

    // Muito curto ou muito longo para ser telefone real
    if (clean.length < 10 || clean.length > 15) return false;

    // Brasil: deve começar com 55 + DDD válido (11-99, sendo que DDDs reais são 11-99 exceto faixas inválidas)
    if (clean.startsWith('55')) {
      const ddd = parseInt(clean.substring(2, 4), 10);
      // DDDs brasileiros válidos: 11-99 (na prática 11-99, com alguns vazios, mas sempre >= 11)
      if (ddd >= 11 && ddd <= 99) return true;
      // 55 + DDD inválido (ex: 5500, 5501, etc.)
      return false;
    }

    // DDIs internacionais comuns (1=EUA/CA, 44=UK, 34=ES, 351=PT, 54=AR, 56=CL, 57=CO, 58=VE, 593=EC, 595=PY, 598=UY)
    const validInternationalPrefixes = ['1', '44', '34', '351', '54', '56', '57', '58', '593', '595', '598', '49', '33', '39', '81', '86', '91'];
    for (const prefix of validInternationalPrefixes) {
      if (clean.startsWith(prefix) && clean.length >= 10) return true;
    }

    // Números que começam com 25, 15, ou outros prefixos que NÃO são DDIs reais
    // e que a Evolution API retorna como "resolução" de LIDs → rejeitar
    // DDI 25 não existe, DDI 15 não existe
    // Se não bateu nenhum DDI reconhecido e tem 10-11 dígitos, pode ser telefone local sem DDI
    // Mas após resolução de LID, esperamos o formato completo com DDI → rejeitar
    console.warn(`[MessageService] 🔍 isValidResolvedPhone: "${clean}" não corresponde a nenhum DDI reconhecido. Rejeitando.`);
    return false;
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
      if (!instance) {
        console.warn(`[MessageService] Instance not found (ignoring webhook): ${instanceName}`);
        return null;
      }

      // ==================================================================================
      // 🕵️ RESOLUÇÃO DE NÚMERO REAL (LID vs PHONE)
      // A Evolution API pode enviar o remoteJid como um LID (Linked Identifier) ao invés
      // do número real. LIDs são IDs internos do WhatsApp Business.
      // Exemplos de LIDs: 42903166537767@lid, 217986837266644@s.whatsapp.net (SEM @lid!)
      //
      // ⚠️ IMPORTANTE: Algumas versões da Evolution API enviam LIDs COM @s.whatsapp.net
      // ao invés de @lid, fazendo o número parecer um telefone válido mas com 14+ dígitos.
      // Precisamos detectar isso e resolver o número real.
      // ==================================================================================
      // ==================================================================================
      // 📋 LOG DE ENTRADA: Dados brutos do webhook para debug de routing
      // ==================================================================================
      const msgText = data.message?.conversation
        || data.message?.extendedTextMessage?.text
        || data.message?.imageMessage?.caption
        || '[mídia sem texto]';
      const msgPreview = String(msgText).substring(0, 80);
      console.log(`[MessageService] 📩 INBOUND | instance="${instanceName}" remoteJid="${remoteJid}" fromMe=${data.key?.fromMe} pushName="${data.pushName || ''}" msgType="${data.messageType || ''}" preview="${msgPreview}"`);
      console.log(`[MessageService] 📩 INBOUND EXTRA | senderPn="${data.senderPn || ''}" participant="${data.key?.participant || ''}" remoteJidAlt="${data.remoteJidAlt || ''}" owner="${data.owner || ''}" messageStubParams=${JSON.stringify(data.messageStubParameters || [])}`);

      let realJid = remoteJid;
      let isLid = false;
      let resolvedFromLid = false;

      // Detecta se é grupo no JID original, ANTES da verificação de LID
      // Isso é crítico para não processar grupos como LIDs (já que grupos têm muitos dígitos)
      const isGroup = remoteJid.includes("@g.us");

      // Ignora JIDs que não são conversas individuais reais
      if (isGroup) {
        return null;
      }

      // Filtra broadcast lists, newsletters, status e outros JIDs não-individuais
      if (remoteJid.includes("@broadcast") || remoteJid.includes("@newsletter") || remoteJid === "status@broadcast") {
        console.warn(`[MessageService] ⚠️ Ignorando JID não-individual: ${remoteJid}`);
        return null;
      }

      // Extrai o número bruto do JID para análise
      const rawNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace("@g.us", "").replace(/\D/g, "");

      // 🔍 DETECÇÃO EXPANDIDA DE LID:
      // 1. Deve conter @lid no sufixo (detecção óbvia)
      // 2. OU ser um número com 14+ dígitos (LIDs que vieram com @s.whatsapp.net por engano)
      // 🚨 IMPORTANTE: GRUPOS NUNCA SÃO LIDs (mesmo tendo 18 dígitos)
      if (!isGroup && (remoteJid.includes("@lid") || this.looksLikeLid(rawNumber))) {
        isLid = true;
        const lidId = rawNumber;


        // =====================================================
        // TENTATIVAS DE RESOLUÇÃO (em ordem de prioridade)
        // =====================================================

        // Helper: verifica se o número resolvido NÃO é o número da própria instância
        const instancePhoneClean = instance.phoneNumber?.replace(/\D/g, "") || "";
        const isNotSelfPhone = (resolved: string): boolean => {
          if (!instancePhoneClean || !resolved) return true;
          return !(instancePhoneClean.endsWith(resolved) || resolved.endsWith(instancePhoneClean));
        };

        // 🔑 PRIORIDADE 1: Campo 'senderPn' (sender Phone Number)
        // Este é o campo OFICIAL que a Evolution API fornece para resolver LIDs → telefone real
        // Formato: "5548999999999" ou "5548999999999@s.whatsapp.net"
        if (data.senderPn) {
          const senderPhone = String(data.senderPn).replace("@s.whatsapp.net", "").replace(/\D/g, "");
          if (senderPhone && senderPhone.length >= 10 && senderPhone.length <= 13 && isNotSelfPhone(senderPhone)) {
            realJid = `${senderPhone}@s.whatsapp.net`;
            resolvedFromLid = true;
          }
        }

        // 🔑 PRIORIDADE 2: Campo 'remoteJidAlt' (JID alternativo fornecido pela Evolution v2.3+)
        if (!resolvedFromLid && data.remoteJidAlt) {
          const altJid = String(data.remoteJidAlt);
          if (altJid.includes("@s.whatsapp.net")) {
            const altPhone = altJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            if (altPhone && altPhone.length >= 10 && altPhone.length <= 13 && isNotSelfPhone(altPhone)) {
              realJid = `${altPhone}@s.whatsapp.net`;
              resolvedFromLid = true;
            }
          }
        }

        // 🔑 PRIORIDADE 3: Campo 'key.participant' (comum em grupos ou conversas @lid)
        if (!resolvedFromLid && data.key?.participant) {
          const participant = String(data.key.participant);
          if (participant.includes("@s.whatsapp.net")) {
            const participantPhone = participant.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            if (participantPhone && participantPhone.length >= 10 && participantPhone.length <= 13 && isNotSelfPhone(participantPhone)) {
              realJid = participant;
              resolvedFromLid = true;
            }
          }
        }

        // 🔑 PRIORIDADE 4: Campo 'messageStubParameters' (pode conter o JID real em alguns eventos)
        if (!resolvedFromLid && Array.isArray(data.messageStubParameters)) {
          for (const param of data.messageStubParameters) {
            const paramStr = String(param);
            if (paramStr.includes("@s.whatsapp.net")) {
              const paramPhone = paramStr.replace("@s.whatsapp.net", "").replace(/\D/g, "");
              if (paramPhone && paramPhone.length >= 10 && paramPhone.length <= 13 && isNotSelfPhone(paramPhone)) {
                realJid = `${paramPhone}@s.whatsapp.net`;
                resolvedFromLid = true;
                break;
              }
            }
          }
        }

        // 🔑 PRIORIDADE 5: Campo 'owner' (pode conter JID real em formatos antigos)
        if (!resolvedFromLid && data.owner) {
          const ownerStr = String(data.owner);
          // Ignora se owner for igual ao nosso próprio número de instância
          if (ownerStr.includes("@s.whatsapp.net")) {
            const ownerPhone = ownerStr.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            // Só usa owner se não for o número da instância (owner geralmente é "nós mesmos")
            if (ownerPhone && ownerPhone.length >= 10 && ownerPhone.length <= 13 && isNotSelfPhone(ownerPhone)) {
              realJid = `${ownerPhone}@s.whatsapp.net`;
              resolvedFromLid = true;
            }
          }
        }

        // 🔑 PRIORIDADE 6: Tenta resolver via Evolution API (chat/findContacts)
        if (!resolvedFromLid) {
          try {
            const resolvedPhone = await whatsappService.resolveContactFromLid(instanceName, `${lidId}@lid`);
            if (resolvedPhone) {
              realJid = `${resolvedPhone}@s.whatsapp.net`;
              resolvedFromLid = true;
            }
          } catch (resolveError: any) {
            console.warn(`[MessageService] ⚠️ Falha ao resolver LID via API: ${resolveError.message}`);
          }
        }

        // 🔑 PRIORIDADE 7: FlowExecution WAITING_REPLY (WhatsApp Business sem LID no send response)
        // Quando enviamos para um número WA Business, a Evolution API retorna o mesmo phone (sem LID).
        // Mas quando o WA Business responde, o remoteJid vem como LID. Como nenhum mapeamento foi criado,
        // todas as prioridades anteriores falham. Aqui buscamos uma execução de fluxo aguardando resposta
        // na mesma instância e sem contactLid mapeado.
        //
        // ⚠️ SEGURANÇA: Só usa esta heurística se houver EXATAMENTE 1 execução WAITING_REPLY sem LID.
        // Se houver múltiplas (ex: disparo em massa), NÃO podemos adivinhar qual é — seria routing errado.
        if (!resolvedFromLid) {
          try {
            const waitingExecs = await prisma.flowExecution.findMany({
              where: {
                status: 'WAITING_REPLY',
                flow: { companyId: instance.companyId },
                whatsappInstanceId: instance.id,
                contactLid: null,
                startedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
              },
              orderBy: { updatedAt: 'desc' },
              select: { id: true, contactPhone: true },
              take: 2, // Só precisa saber se tem 1 ou mais
            });

            if (waitingExecs.length === 1) {
              const waitingExec = waitingExecs[0];
              realJid = `${waitingExec.contactPhone}@s.whatsapp.net`;
              resolvedFromLid = true;
              console.log(`[MessageService] 🔗 PRIORIDADE 7: LID "${lidId}" resolvido via FlowExecution WAITING_REPLY (única) → phone "${waitingExec.contactPhone}"`);

              // Armazena o mapeamento LID para futuras resoluções
              await prisma.flowExecution.update({
                where: { id: waitingExec.id },
                data: { contactLid: lidId },
              });

              await prisma.customer.updateMany({
                where: {
                  companyId: instance.companyId,
                  phone: waitingExec.contactPhone,
                  lidPhone: null,
                },
                data: { lidPhone: lidId },
              });

              console.log(`[MessageService] 🔗 LID mapping criado: phone "${waitingExec.contactPhone}" → LID "${lidId}"`);
            } else if (waitingExecs.length > 1) {
              console.warn(`[MessageService] ⚠️ PRIORIDADE 7 IGNORADA: ${waitingExecs.length} execuções WAITING_REPLY sem LID na mesma instância. Não é possível adivinhar qual contato respondeu. LID="${lidId}"`);
            }
          } catch (p7Error: unknown) {
            const msg = p7Error instanceof Error ? p7Error.message : String(p7Error);
            console.warn(`[MessageService] ⚠️ Falha na PRIORIDADE 7 (FlowExecution WAITING_REPLY): ${msg}`);
          }
        }
      }

      // Log do resultado da resolução LID
      if (isLid) {
        console.log(`[MessageService] 🔍 LID RESOLUÇÃO | original="${remoteJid}" → realJid="${realJid}" resolved=${resolvedFromLid}`);
      }

      // ==================================================================================
      // 🛡️ VALIDAÇÃO PÓS-RESOLUÇÃO DE LID
      // Quando a Evolution API resolve um LID, pode retornar um número inválido
      // (ex: IDs internos do WhatsApp Business como "2500068408" que não são telefones reais).
      // Se o LID foi resolvido mas o resultado não parece um telefone brasileiro válido,
      // rejeitamos para não criar customers fantasma.
      // ==================================================================================
      if (isLid && resolvedFromLid) {
        const resolvedPhone = realJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
        if (!this.isValidResolvedPhone(resolvedPhone)) {
          console.warn(`[MessageService] 🚫 LID resolvido para número inválido: LID="${remoteJid}" → resolved="${resolvedPhone}". Descartando mensagem (provavelmente auto-reply de WhatsApp Business).`);
          console.warn(`[MessageService] 🔍 Payload descartado: pushName="${data.pushName || ''}" msgPreview="${String(data.message?.conversation || data.message?.extendedTextMessage?.text || '').substring(0, 100)}"`);
          return null;
        }
      }

      // Se o LID não foi resolvido por nenhuma prioridade, descarta — não criar customer com LID bruto
      if (isLid && !resolvedFromLid) {
        console.warn(`[MessageService] 🚫 LID não resolvido por nenhuma prioridade. Descartando: remoteJid="${remoteJid}" pushName="${data.pushName || ''}"`);
        return null;
      }

      // Remove os domínios para ficar apenas o número/ID limpo
      const phone = realJid.replace("@s.whatsapp.net", "").replace("@lid", "");

      // Validação final — segurança extra caso algo tenha passado
      const phoneValidation = this.isValidPhoneNumber(phone);
      if (!phoneValidation.valid) {
        console.error(`[MessageService] ❌ Número rejeitado na validação final: ${phone} (razão: ${phoneValidation.reason})`);
        console.error(`[MessageService] 🔍 Debug: remoteJid="${remoteJid}" isLid=${isLid} resolvedFromLid=${resolvedFromLid} senderPn="${data.senderPn || ''}" participant="${data.key?.participant || ''}" owner="${data.owner || ''}"`);
        return null;
      }

      // ==================================================================================
      // 🛡️ ANTI SELF-CREATION: Garante que a instância nunca crie a si mesma como cliente
      // ==================================================================================
      if (!isGroup && instance.phoneNumber) {
        const instancePhoneClean = instance.phoneNumber.replace(/\D/g, "");
        const extractPhoneClean = phone.replace(/\D/g, "");

        // Se o número extraído termina com o número da instância (ou vice-versa para pegar erros sem DDD), 
        // ignora a mensagem silenciosamente para não criar lixo na base de dados
        if (
          instancePhoneClean && extractPhoneClean &&
          (instancePhoneClean.endsWith(extractPhoneClean) || extractPhoneClean.endsWith(instancePhoneClean))
        ) {
          console.warn(`[MessageService] ⚠️ Anti Self-Creation acionado. Ignorando mensagem do próprio número da instância: ${phone}`);
          return null;
        }
      }

      // ==================================================================================

      // A detecção de isGroup já foi feita no início do método com sucesso

      // ==================================================================================
      // 🔍 BUSCA INTELIGENTE DE CLIENTE (Previne duplicatas LID/Phone/9º dígito)
      // ==================================================================================

      let customer = null;
      let customerSource = 'NEW'; // Rastreia qual caminho encontrou o customer

      console.log(`[MessageService] 🔍 CUSTOMER LOOKUP | phone="${phone}" isLid=${isLid} resolvedFromLid=${resolvedFromLid} companyId="${instance.companyId}"`);

      // 🌟 ANTI-DUPLICATA POR FLUXO ATIVO: Se o cliente tem um fluxo aguardando resposta,
      // prioriza o número exato atrelado ao fluxo usando variantes do 9º dígito.
      // Isso impede que `findByPhoneWithVariant` priorize um cliente duplicado ou crie um novo.
      //
      // ⚠️ Usa busca exata com variantes (não endsWith) para evitar match cruzado em batch.
      if (!isGroup) {
        const cleanPhoneForFlow = phone.replace(/\D/g, "");
        const phoneVariants: string[] = [cleanPhoneForFlow];

        // Gera variantes do 9º dígito para busca precisa
        if (cleanPhoneForFlow.startsWith('55') && cleanPhoneForFlow.length >= 12) {
          const dddAndNum = cleanPhoneForFlow.substring(2);
          const ddd = dddAndNum.substring(0, 2);
          if (dddAndNum.length === 11) {
            // Com 9: 55489XXXXXXXX → sem 9: 5548XXXXXXXX
            phoneVariants.push(`55${ddd}${dddAndNum.substring(3)}`);
          } else if (dddAndNum.length === 10) {
            // Sem 9: 5548XXXXXXXX → com 9: 55489XXXXXXXX
            phoneVariants.push(`55${ddd}9${dddAndNum.substring(2)}`);
          }
        }

        console.log(`[MessageService] 🔍 FLOW ATIVO CHECK | phoneVariants=${JSON.stringify(phoneVariants)}`);

        const activeFlow = await prisma.flowExecution.findFirst({
          where: {
            contactPhone: { in: phoneVariants },
            status: "WAITING_REPLY",
            flow: { companyId: instance.companyId }
          }
        });

        if (activeFlow) {
          console.log(`[MessageService] 🔍 FLOW ATIVO FOUND | execId="${activeFlow.id}" contactPhone="${activeFlow.contactPhone}" flowId="${activeFlow.flowId}"`);
          customer = await prisma.customer.findFirst({
            where: {
              companyId: instance.companyId,
              phone: activeFlow.contactPhone
            }
          });
          if (customer) {
            customerSource = 'FLOW_ATIVO';
            console.log(`[MessageService] ✅ Customer via Flow Ativo: phone="${phone}" → customer.id="${customer.id}" customer.phone="${customer.phone}" customer.name="${customer.name}"`);
          } else {
            console.warn(`[MessageService] ⚠️ Flow ativo encontrado mas customer NÃO existe no DB: contactPhone="${activeFlow.contactPhone}"`);
          }
        } else {
          console.log(`[MessageService] 🔍 FLOW ATIVO CHECK | Nenhum flow WAITING_REPLY para variantes ${JSON.stringify(phoneVariants)}`);
        }
      }

      // Primeiro tenta buscar pelo phone original, abrangendo variações do 9º dígito, caso não haja fluxo
      if (!customer) {
        customer = await customerService.findByPhoneWithVariant(phone, instance.companyId);
        if (customer) {
          customerSource = 'PHONE_VARIANT';
          console.log(`[MessageService] ✅ Customer via findByPhoneWithVariant: phone="${phone}" → customer.id="${customer.id}" customer.phone="${customer.phone}" customer.name="${customer.name}" customer.lidPhone="${customer.lidPhone || ''}"`);
        }
      }

      // 🔗 ANTI-DUPLICATA POR LID: Se não encontrou pelo phone exato,
      // busca pelo campo lidPhone (mapeamento LID↔telefone real).
      // Cenários cobertos:
      //   - Fluxo enviou para phone real, cliente respondeu com LID → lidPhone contém o LID
      //   - Mensagem anterior já mapeou este LID para um customer existente
      if (!customer) {
        const customerByLid = await prisma.customer.findFirst({
          where: {
            companyId: instance.companyId,
            lidPhone: phone,
          },
        });

        if (customerByLid) {
          customerSource = 'LID_PHONE';
          console.log(`[MessageService] ✅ Customer via lidPhone: LID "${phone}" → customer.id="${customerByLid.id}" customer.phone="${customerByLid.phone}" customer.name="${customerByLid.name}"`);
          customer = customerByLid;
        }
      }

      // 🔗 ANTI-DUPLICATA POR FLOW EXECUTION LID: Se ainda não encontrou,
      // busca execuções de fluxo que tenham este phone como contactLid.
      // Isso cobre o caso onde a Evolution API retornou um LID diferente na resposta do envio.
      if (!customer && !isGroup) {
        const execByLid = await prisma.flowExecution.findFirst({
          where: {
            contactLid: phone,
            flow: { companyId: instance.companyId },
            startedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          },
          select: { contactPhone: true },
        });

        if (execByLid) {
          const flowCustomer = await prisma.customer.findFirst({
            where: {
              companyId: instance.companyId,
              phone: execByLid.contactPhone,
            },
          });

          if (flowCustomer) {
            customerSource = 'FLOW_EXEC_LID';
            console.log(`[MessageService] ✅ Customer via FlowExecution.contactLid: LID "${phone}" → customer.id="${flowCustomer.id}" customer.phone="${flowCustomer.phone}" customer.name="${flowCustomer.name}"`);
            // Armazena o LID no customer para buscas futuras diretas
            try {
              customer = await prisma.customer.update({
                where: { id: flowCustomer.id },
                data: { lidPhone: phone },
              });
            } catch {
              customer = flowCustomer;
            }
          } else {
            console.warn(`[MessageService] ⚠️ FlowExecution.contactLid="${phone}" encontrado mas customer NÃO existe: contactPhone="${execByLid.contactPhone}"`);
          }
        }
      }

      if (!customer) {
        console.log(`[MessageService] 🔍 CUSTOMER LOOKUP FALHOU | Nenhuma das 4 buscas encontrou customer para phone="${phone}". Será criado um novo.`);
      } else {
        console.log(`[MessageService] 📋 CUSTOMER FINAL | source="${customerSource}" id="${customer.id}" phone="${customer.phone}" name="${customer.name}" lidPhone="${customer.lidPhone || ''}" remoteJid="${remoteJid}"`);
      }

      if (!customer) {
        // 🔍 LOG: Novo customer sendo criado — registra dados para debug
        console.log(`[MessageService] 🆕 Criando novo customer: phone="${phone}" remoteJid="${remoteJid}" isLid=${isLid} resolvedFromLid=${resolvedFromLid} pushName="${data.pushName || ''}" senderPn="${data.senderPn || ''}" participant="${data.key?.participant || ''}"`);

        // 🔧 PREPARA O NOME
        let sanitizedName: string;

        if (isGroup) {
          // Para novos grupos, usamos o subject que vier no evento ou buscamos da API
          if (data.messageStubParameters && data.messageStubParameters[0]) {
            sanitizedName = data.messageStubParameters[0];
          } else {
            try {
              const groupInfo = await whatsappService.getGroupInfo(instanceName, phone);
              sanitizedName = groupInfo?.subject || `Grupo ${phone}`;
            } catch {
              sanitizedName = `Grupo ${phone}`;
            }
          }
        } else {
          // Para WABA IDs ou usuários normais
          sanitizedName = this.sanitizePushName(data.pushName, phone);
        }

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

        // 🔧 ATUALIZA NOME: Apenas se for uma pessoa (não atualizar grupo com o nome do participante) 
        // e se o nome atual for o phone e o pushName for válido
        if (!isGroup && data.pushName && customer.name === customer.phone) {
          const sanitizedName = this.sanitizePushName(data.pushName, phone);
          if (sanitizedName !== customer.phone && sanitizedName !== customer.name) {
            updates.name = sanitizedName;
          }
        } else if (isGroup && customer.name.startsWith("Grupo ")) {
          // Se for um grupo salvo erroneamente no passado ou com nome genérico, tenta buscar o nome atualizado
          try {
             const groupInfo = await whatsappService.getGroupInfo(instanceName, phone);
             if (groupInfo && groupInfo.subject) {
                updates.name = groupInfo.subject;
             }
          } catch {}
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
      // 🔗 ARMAZENAR LID MAPPING: Quando resolvemos um LID para phone real,
      // salvamos o LID no customer para buscas futuras sem depender de resolução.
      // ==================================================================================
      if (customer && isLid && !isGroup) {
        const rawLid = rawNumber; // O número bruto do LID original (antes da resolução)
        if (rawLid && !customer.lidPhone && rawLid !== customer.phone) {
          try {
            customer = await prisma.customer.update({
              where: { id: customer.id },
              data: { lidPhone: rawLid },
            });
            console.log(`[MessageService] 🔗 LID mapping salvo: customer "${customer.phone}" → lidPhone "${rawLid}"`);
          } catch (lidErr: any) {
            console.warn(`[MessageService] ⚠️ Falha ao salvar lidPhone (não crítico):`, lidErr.message);
          }
        }
      }

      // ==================================================================================
      // 📈 AUTO-AVANÇAR PIPELINE: Se o cliente está em "Novo Lead" (isFixed, order=0)
      // e enviou uma mensagem inbound, promover automaticamente para "Qualificado" (isFixed, order=1)
      // ==================================================================================
      if (customer && !isGroup && customer.pipelineStageId) {
        try {
          const currentStage = await prisma.pipelineStage.findUnique({
            where: { id: customer.pipelineStageId },
            select: { order: true },
          });
          if (currentStage?.order === 0) {
            const qualifiedStage = await prisma.pipelineStage.findFirst({
              where: { companyId: instance.companyId, order: 1 },
              select: { id: true },
            });
            if (qualifiedStage) {
              customer = await prisma.customer.update({
                where: { id: customer.id },
                data: { pipelineStageId: qualifiedStage.id },
              });
            }
          }
        } catch (pipelineErr: any) {
          console.warn(`[MessageService] ⚠️ Falha ao avançar pipeline (não crítico):`, pipelineErr.message);
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

        try {
          const mimetype = msgData.audioMessage.mimetype || "audio/ogg";
          let base64Audio = msgData.audioMessage.base64;

          if (base64Audio) {
          } else {
            // Baixa o áudio da Evolution API
            const audioBuffer = await whatsappService.downloadMedia(instanceName, data.key);
            base64Audio = audioBuffer.toString("base64");
          }

          // Define a URL do áudio em base64
          mediaUrl = `data:${mimetype};base64,${base64Audio}`;

          // Provider é definido via .env (AI_PROVIDER), não usa mais o banco
          const aiProvider: AIProvider = (process.env.AI_PROVIDER as AIProvider) || "gemini";

          // Transcreve o áudio com o provedor configurado (Gemini é o padrão)
          try {
            if (aiProvider === "openai" && openaiService.isConfigured()) {
              content = await openaiService.transcribeAudio(base64Audio);
            } else {
              content = await geminiService.transcribeAudio(base64Audio, mimetype);
            }
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

        try {
          const mimetype = msgData.imageMessage.mimetype || "image/jpeg";
          let base64Image = msgData.imageMessage.base64;

          if (base64Image) {
          } else {
            // Baixa a imagem da Evolution API
            const imageBuffer = await whatsappService.downloadMedia(instanceName, data.key);
            base64Image = imageBuffer.toString("base64");
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

      // 🔗 CAPTURA NATIVA DE LID: Se a API retornou um LID (14+ dígitos), mapeia imediatamente.
      // Isso é vital para mensagens de IA/Humano onde não há fluxo aguardando para mapear via Webhook.
      if (result.remoteJid && !customer.isGroup) {
        const rawPhone = result.remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
        if (rawPhone.length >= 14 && rawPhone !== customer.phone && customer.lidPhone !== rawPhone) {
          try {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { lidPhone: rawPhone }
            });
            console.log(`[MessageService:sendMessage] 🔗 LID mapping salvo via API Response: customer "${customer.phone}" → lidPhone "${rawPhone}"`);
          } catch (e) {
            console.warn(`[MessageService:sendMessage] ⚠️ Erro ao salvar lidPhone:`, e);
          }
        }
      }

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
   * Edita o conteúdo de uma mensagem OUTBOUND HUMAN já enviada (janela de 15 min)
   */
  async editMessage(messageDbId: string, newContent: string, companyId: string) {
    const EDIT_WINDOW_MS = 15 * 60 * 1000;

    const message = await prisma.message.findUnique({
      where: { id: messageDbId },
      include: {
        customer: true,
      },
    });

    const badRequest = (msg: string) => Object.assign(new Error(msg), { statusCode: 400 });

    if (!message) throw Object.assign(new Error("Mensagem não encontrada"), { statusCode: 404 });
    if (message.customer.companyId !== companyId) throw Object.assign(new Error("Não autorizado"), { statusCode: 403 });
    if (message.direction !== MessageDirection.OUTBOUND) throw badRequest("Só é possível editar mensagens enviadas");
    if (message.senderType !== "HUMAN") throw badRequest("Só é possível editar mensagens humanas");
    if (message.mediaType !== "text") throw badRequest("Só é possível editar mensagens de texto");
    if (!message.messageId) throw badRequest("Mensagem sem ID do WhatsApp");

    const age = Date.now() - new Date(message.timestamp).getTime();
    if (age > EDIT_WINDOW_MS) throw badRequest("Prazo de 15 minutos para edição expirado");

    // Chama a Evolution API para editar no WhatsApp
    await whatsappService.editMessage({
      instanceId: message.whatsappInstanceId,
      remoteJid: message.customer.phone,
      messageId: message.messageId,
      newText: newContent,
    });

    // Atualiza no banco
    const updated = await prisma.message.update({
      where: { id: messageDbId },
      data: { content: newContent },
    });

    // Emite evento WebSocket para atualizar o chat em tempo real
    if (websocketService.isInitialized()) {
      websocketService.emitMessageEdited(companyId, message.customerId, messageDbId, newContent);
    }

    return updated;
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

      // 🔗 CAPTURA NATIVA DE LID: Se a API retornou um LID (14+ dígitos), mapeia imediatamente.
      // Isso é vital para mensagens de IA/Humano onde não há fluxo aguardando para mapear via Webhook.
      if (result.remoteJid && !customer.isGroup) {
        const rawPhone = result.remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
        if (rawPhone.length >= 14 && rawPhone !== customer.phone && customer.lidPhone !== rawPhone) {
          try {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { lidPhone: rawPhone }
            });
            console.log(`[MessageService:sendMedia] 🔗 LID mapping salvo via API Response: customer "${customer.phone}" → lidPhone "${rawPhone}"`);
          } catch (e) {
            console.warn(`[MessageService:sendMedia] ⚠️ Erro ao salvar lidPhone:`, e);
          }
        }
      }

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
