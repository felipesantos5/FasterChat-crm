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
    // Remove caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');

    // Verifica se é vazio
    if (!cleanPhone) {
      return { valid: false, reason: 'Número vazio' };
    }

    // Verifica comprimento mínimo (muito curto não é número válido)
    if (cleanPhone.length < 8) {
      return { valid: false, reason: `Número muito curto (${cleanPhone.length} dígitos)` };
    }

    // Verifica comprimento máximo (muito longo provavelmente é WABA ID)
    // Números de telefone internacionais raramente excedem 15 dígitos
    if (cleanPhone.length > 15) {
      return { valid: false, reason: `Número muito longo (${cleanPhone.length} dígitos) - provavelmente WABA ID` };
    }

    // Verifica padrões de WABA ID conhecidos
    // WABA IDs geralmente são números longos que não começam com códigos de país válidos
    // Lista de códigos de país válidos mais comuns (primeiros 1-3 dígitos)
    const validCountryCodes = [
      '1',    // EUA, Canadá
      '7',    // Rússia
      '20',   // Egito
      '27',   // África do Sul
      '30',   // Grécia
      '31',   // Holanda
      '32',   // Bélgica
      '33',   // França
      '34',   // Espanha
      '39',   // Itália
      '40',   // Romênia
      '41',   // Suíça
      '44',   // Reino Unido
      '45',   // Dinamarca
      '46',   // Suécia
      '47',   // Noruega
      '48',   // Polônia
      '49',   // Alemanha
      '51',   // Peru
      '52',   // México
      '53',   // Cuba
      '54',   // Argentina
      '55',   // Brasil
      '56',   // Chile
      '57',   // Colômbia
      '58',   // Venezuela
      '60',   // Malásia
      '61',   // Austrália
      '62',   // Indonésia
      '63',   // Filipinas
      '64',   // Nova Zelândia
      '65',   // Singapura
      '66',   // Tailândia
      '81',   // Japão
      '82',   // Coreia do Sul
      '84',   // Vietnã
      '86',   // China
      '90',   // Turquia
      '91',   // Índia
      '92',   // Paquistão
      '93',   // Afeganistão
      '94',   // Sri Lanka
      '95',   // Myanmar
      '98',   // Irã
      '212',  // Marrocos
      '213',  // Argélia
      '216',  // Tunísia
      '218',  // Líbia
      '220',  // Gâmbia
      '221',  // Senegal
      '222',  // Mauritânia
      '223',  // Mali
      '224',  // Guiné
      '225',  // Costa do Marfim
      '226',  // Burkina Faso
      '227',  // Níger
      '228',  // Togo
      '229',  // Benin
      '230',  // Maurício
      '231',  // Libéria
      '232',  // Serra Leoa
      '233',  // Gana
      '234',  // Nigéria
      '235',  // Chade
      '236',  // República Centro-Africana
      '237',  // Camarões
      '238',  // Cabo Verde
      '239',  // São Tomé e Príncipe
      '240',  // Guiné Equatorial
      '241',  // Gabão
      '242',  // Congo
      '243',  // RD Congo
      '244',  // Angola
      '245',  // Guiné-Bissau
      '246',  // Diego Garcia
      '247',  // Ascensão
      '248',  // Seychelles
      '249',  // Sudão
      '250',  // Ruanda
      '251',  // Etiópia
      '252',  // Somália
      '253',  // Djibuti
      '254',  // Quênia
      '255',  // Tanzânia
      '256',  // Uganda
      '257',  // Burundi
      '258',  // Moçambique
      '260',  // Zâmbia
      '261',  // Madagascar
      '262',  // Reunião
      '263',  // Zimbábue
      '264',  // Namíbia
      '265',  // Malawi
      '266',  // Lesoto
      '267',  // Botsuana
      '268',  // Eswatini
      '269',  // Comores
      '290',  // Santa Helena
      '291',  // Eritreia
      '297',  // Aruba
      '298',  // Ilhas Faroé
      '299',  // Groenlândia
      '350',  // Gibraltar
      '351',  // Portugal
      '352',  // Luxemburgo
      '353',  // Irlanda
      '354',  // Islândia
      '355',  // Albânia
      '356',  // Malta
      '357',  // Chipre
      '358',  // Finlândia
      '359',  // Bulgária
      '370',  // Lituânia
      '371',  // Letônia
      '372',  // Estônia
      '373',  // Moldávia
      '374',  // Armênia
      '375',  // Bielorrússia
      '376',  // Andorra
      '377',  // Mônaco
      '378',  // San Marino
      '380',  // Ucrânia
      '381',  // Sérvia
      '382',  // Montenegro
      '383',  // Kosovo
      '385',  // Croácia
      '386',  // Eslovênia
      '387',  // Bósnia
      '389',  // Macedônia do Norte
      '420',  // República Tcheca
      '421',  // Eslováquia
      '423',  // Liechtenstein
      '500',  // Ilhas Falkland
      '501',  // Belize
      '502',  // Guatemala
      '503',  // El Salvador
      '504',  // Honduras
      '505',  // Nicarágua
      '506',  // Costa Rica
      '507',  // Panamá
      '508',  // Saint Pierre
      '509',  // Haiti
      '590',  // Guadalupe
      '591',  // Bolívia
      '592',  // Guiana
      '593',  // Equador
      '594',  // Guiana Francesa
      '595',  // Paraguai
      '596',  // Martinica
      '597',  // Suriname
      '598',  // Uruguai
      '599',  // Curaçao
      '670',  // Timor-Leste
      '672',  // Ilha Norfolk
      '673',  // Brunei
      '674',  // Nauru
      '675',  // Papua Nova Guiné
      '676',  // Tonga
      '677',  // Ilhas Salomão
      '678',  // Vanuatu
      '679',  // Fiji
      '680',  // Palau
      '681',  // Wallis e Futuna
      '682',  // Ilhas Cook
      '683',  // Niue
      '685',  // Samoa
      '686',  // Kiribati
      '687',  // Nova Caledônia
      '688',  // Tuvalu
      '689',  // Polinésia Francesa
      '690',  // Tokelau
      '691',  // Micronésia
      '692',  // Ilhas Marshall
      '850',  // Coreia do Norte
      '852',  // Hong Kong
      '853',  // Macau
      '855',  // Camboja
      '856',  // Laos
      '880',  // Bangladesh
      '886',  // Taiwan
      '960',  // Maldivas
      '961',  // Líbano
      '962',  // Jordânia
      '963',  // Síria
      '964',  // Iraque
      '965',  // Kuwait
      '966',  // Arábia Saudita
      '967',  // Iêmen
      '968',  // Omã
      '970',  // Palestina
      '971',  // Emirados Árabes
      '972',  // Israel
      '973',  // Bahrein
      '974',  // Catar
      '975',  // Butão
      '976',  // Mongólia
      '977',  // Nepal
      '992',  // Tajiquistão
      '993',  // Turcomenistão
      '994',  // Azerbaijão
      '995',  // Geórgia
      '996',  // Quirguistão
      '998',  // Uzbequistão
    ];

    // Verifica se começa com algum código de país válido
    const startsWithValidCode = validCountryCodes.some(code => cleanPhone.startsWith(code));

    if (!startsWithValidCode && cleanPhone.length >= 12) {
      // Se não começa com código válido E tem mais de 12 dígitos, provavelmente é WABA ID
      return { valid: false, reason: `Não começa com código de país válido - provavelmente WABA ID` };
    }

    // Validação específica para Brasil (código 55)
    if (cleanPhone.startsWith('55')) {
      // Brasil: 55 + DDD (2 dígitos) + número (8-9 dígitos) = 12-13 dígitos
      if (cleanPhone.length < 12 || cleanPhone.length > 13) {
        return { valid: false, reason: `Número brasileiro com tamanho inválido (${cleanPhone.length} dígitos, esperado 12-13)` };
      }
    }

    return { valid: true };
  }

  /**
   * Processa mensagem recebida via webhook
   */
  async processInboundMessage(
    instanceName: string,
    remoteJid: string,
    data: any // Payload completo da mensagem (EvolutionWebhookMessage)
  ) {
    try {
      const instance = await prisma.whatsAppInstance.findFirst({ where: { instanceName } });
      if (!instance) throw new Error(`Instance not found: ${instanceName}`);

      const phone = remoteJid.replace("@s.whatsapp.net", "");

      // Valida se é um número de telefone válido (não é WABA ID)
      const phoneValidation = this.isValidPhoneNumber(phone);
      if (!phoneValidation.valid) {
        console.warn(`⚠️ [MessageService] Número inválido detectado - ignorando mensagem`);
        console.warn(`   RemoteJid: ${remoteJid}`);
        console.warn(`   Número extraído: ${phone}`);
        console.warn(`   Motivo: ${phoneValidation.reason}`);
        console.warn(`   PushName: ${data.pushName || 'N/A'}`);
        console.warn(`   Este é provavelmente um WABA ID de uma conta WhatsApp Business API oficial.`);
        return null; // Ignora a mensagem
      }

      // Detecta automaticamente se é um grupo do WhatsApp
      const isGroup = phone.includes("@g.us");

      // Busca ou cria cliente (Upsert otimizado)
      let customer = await prisma.customer.findUnique({
        where: { companyId_phone: { companyId: instance.companyId, phone } },
      });

      if (!customer) {
        // Busca foto de perfil para novo cliente (assíncrono, não bloqueia)
        let profilePicUrl: string | null = null;
        if (!isGroup) {
          profilePicUrl = await whatsappService.getProfilePicture(instanceName, phone);
        }

        // Busca o primeiro estágio do pipeline para novos clientes (apenas para não-grupos)
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
            phone,
            isGroup,
            profilePicUrl,
            pipelineStageId,
          },
        });
      } else {
        // Atualiza nome e/ou foto se necessário
        const updates: any = {};

        if (customer.isGroup !== isGroup) {
          updates.isGroup = isGroup;
        }

        // Atualiza nome se veio pushName e é diferente
        if (data.pushName && data.pushName !== customer.name && customer.name === customer.phone) {
          updates.name = data.pushName;
        }

        // Busca foto de perfil se ainda não tem (apenas uma vez por cliente)
        if (!customer.profilePicUrl && !isGroup) {
          const profilePicUrl = await whatsappService.getProfilePicture(instanceName, phone);
          if (profilePicUrl) {
            updates.profilePicUrl = profilePicUrl;
          }
        }

        if (Object.keys(updates).length > 0) {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updates,
          });
        }
      }

      // --- LÓGICA DE PROCESSAMENTO DE MÍDIA ---
      let content = "";
      let mediaType = "text";
      let mediaUrl = null;

      const msgData = data.message;

      // 1. Texto Simples
      if (msgData?.conversation || msgData?.extendedTextMessage?.text) {
        content = msgData.conversation || msgData.extendedTextMessage.text;
      }
      // 2. Áudio
      else if (msgData?.audioMessage) {
        mediaType = "audio";
        console.log(`[MessageService] 🎤 Audio message detected for ${phone}`);

        // Evolution API pode enviar base64 ou URL
        const base64Audio = msgData.audioMessage.base64;
        const audioUrl = msgData.audioMessage.url;

        // Log para debug
        console.log(`[MessageService] 🔍 Audio message structure:`, {
          hasBase64: !!base64Audio,
          base64Length: base64Audio ? base64Audio.length : 0,
          hasUrl: !!audioUrl,
          audioUrl: audioUrl || "null",
          mimetype: msgData.audioMessage.mimetype,
          seconds: msgData.audioMessage.seconds,
        });

        try {
          let audioBuffer: Buffer | null = null;

          // Estratégia 1: Usar base64 se disponível
          if (base64Audio && base64Audio.length > 0) {
            console.log(`[MessageService] 📦 Using base64 audio data`);
            audioBuffer = Buffer.from(base64Audio, "base64");
          }
          // Estratégia 2: Baixar através da Evolution API (descriptografa automaticamente)
          else if (data.key) {
            console.log(`[MessageService] 🔄 Downloading audio via Evolution API...`);
            const whatsappService = (await import("./whatsapp.service")).default;
            audioBuffer = await whatsappService.downloadMedia(instanceName, data.key);
          }
          // Estratégia 3: Fallback - tentar baixar direto da URL (pode não funcionar se encriptado)
          else if (audioUrl) {
            console.log(`[MessageService] ⚠️ Trying direct URL download (may fail if encrypted)...`);
            audioBuffer = (await openaiService.transcribeAudio(audioUrl)) as any; // Usa a função que já baixa
          }

          if (audioBuffer && audioBuffer.length > 0) {
            console.log(`[MessageService] 🎤 Transcribing audio (${(audioBuffer.length / 1024).toFixed(2)} KB)...`);

            // Converte buffer para base64 para passar ao OpenAI
            const base64ForTranscription = audioBuffer.toString("base64");
            const transcription = await openaiService.transcribeAudio(base64ForTranscription);

            console.log(`[MessageService] ✅ Transcription successful: "${transcription}"`);

            // Salva o áudio como Data URI para reprodução no frontend
            mediaUrl = `data:audio/ogg;base64,${base64ForTranscription}`;

            // Conteúdo é a transcrição para a IA processar
            content = transcription;

            console.log(`[MessageService] 📝 Audio saved with transcription for playback`);
          } else {
            console.warn(`[MessageService] ⚠️ Could not obtain audio data`);
            content = "Recebi seu áudio mas não consegui processar. Pode me enviar sua mensagem por texto? 🙏";
          }
        } catch (error: any) {
          console.error(`[MessageService] ❌ Audio processing failed:`, error.message);
          console.error(`[MessageService] ❌ Full error:`, error);
          content = "Recebi seu áudio mas não consegui processar. Pode me enviar sua mensagem por texto? 🙏";
        }
      }
      // 3. Imagem
      else if (msgData?.imageMessage) {
        mediaType = "image";
        console.log(`[MessageService] 📷 Image message detected for ${phone}`);

        const caption = msgData.imageMessage.caption || "";
        const base64Image = msgData.imageMessage.base64;
        const imageUrl = msgData.imageMessage.url;

        // Log para debug
        console.log(`[MessageService] 🔍 Image message structure:`, {
          hasBase64: !!base64Image,
          hasUrl: !!imageUrl,
          hasCaption: !!caption,
          caption: caption || "none",
          mimetype: msgData.imageMessage.mimetype,
        });

        try {
          let imageBuffer: Buffer | null = null;

          // Estratégia 1: Usar base64 se disponível
          if (base64Image && base64Image.length > 0) {
            console.log(`[MessageService] 📦 Using base64 image data`);
            imageBuffer = Buffer.from(base64Image, "base64");
          }
          // Estratégia 2: Baixar através da Evolution API (descriptografa automaticamente)
          else if (data.key) {
            console.log(`[MessageService] 🔄 Downloading image via Evolution API...`);
            const whatsappService = (await import("./whatsapp.service")).default;
            imageBuffer = await whatsappService.downloadMedia(instanceName, data.key);
          }

          if (imageBuffer && imageBuffer.length > 0) {
            console.log(`[MessageService] 📷 Image downloaded: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

            // Detecta o mimetype (padrão JPEG se não especificado)
            const mimetype = msgData.imageMessage.mimetype || "image/jpeg";

            // Salva a imagem como Data URI para exibição no frontend
            const base64ForDisplay = imageBuffer.toString("base64");
            mediaUrl = `data:${mimetype};base64,${base64ForDisplay}`;

            // Conteúdo inicial com legenda (se houver)
            if (caption) {
              content = `Cliente enviou uma imagem com legenda: "${caption}"`;
            } else {
              content = `Cliente enviou uma imagem`;
            }

            console.log(`[MessageService] 📝 Image saved for Vision API analysis`);
          } else {
            console.warn(`[MessageService] ⚠️ Could not obtain image data`);
            content = caption ? `[Imagem com legenda: ${caption}]` : "[Imagem não disponível]";
          }
        } catch (error: any) {
          console.error(`[MessageService] ❌ Image processing failed:`, error.message);
          content = caption ? `[Imagem com legenda: ${caption}]` : "[Imagem não processada]";
        }
      }

      if (!content && !mediaUrl) return null; // Ignora mensagens vazias/status

      console.log(`[MessageService] 📝 Creating message:`, {
        mediaType,
        hasMediaUrl: !!mediaUrl,
        contentPreview: content.substring(0, 50),
      });

      // Cria a mensagem
      const message = await this.createMessage({
        customerId: customer.id,
        whatsappInstanceId: instance.id,
        direction: MessageDirection.INBOUND,
        content,
        timestamp: new Date((data.messageTimestamp || Date.now()) * 1000),
        messageId: data.key.id,
        status: MessageStatus.DELIVERED,
        mediaType, // Tipo correto (text, audio, image)
        mediaUrl, // URL da mídia (se houver)
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
