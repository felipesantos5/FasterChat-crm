import { Request, Response } from "express";
import messageService from "../services/message.service";
import conversationService from "../services/conversation.service";
import aiService from "../services/ai.service";
import openaiService from "../services/ai-providers/openai.service";
import geminiService from "../services/ai-providers/gemini.service";
import { prisma } from "../utils/prisma";
import { WhatsAppStatus } from "@prisma/client";
import { EvolutionWebhookPayload } from "../types/message";
import whatsappService from "../services/whatsapp.service";
import { linkConversionService } from "../services/link-conversion.service";
import { AIProvider } from "../types/ai-provider";
import { websocketService } from "../services/websocket.service";
import { customerTemperatureService } from "../services/customer-temperature.service";
import {
  detectDirectHandoffIntent,
  parseHandoffTokens,
  detectLoopAndRecord,
  clearLoopCache,
} from "../services/handoff-detector.service";

// Dedup de eventos de mensagem para evitar processamento duplo de AI
// (Evolution API pode reenviar o mesmo webhook)
const recentlyProcessedAI = new Map<string, number>();
const AI_DEDUP_TTL_MS = 120_000; // 2 minutos

// Dedup de fallback de erro para não enviar a mesma mensagem de erro em loop
const recentlyFallbackSent = new Map<string, number>();
const FALLBACK_DEDUP_TTL_MS = 300_000; // 5 minutos por conversa

class WebhookController {
  /**
   * POST /api/webhooks/whatsapp
   * Recebe webhooks da Evolution API
   */
  async handleWhatsAppWebhook(req: Request, res: Response) {
    try {
      // Valida webhook secret enviado pela Evolution API
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (webhookSecret && webhookSecret !== 'your-webhook-secret-key') {
        const receivedSecret = req.headers['x-webhook-secret'] || req.headers['x-api-key'];
        if (!receivedSecret || receivedSecret !== webhookSecret) {
          return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
      }

      const payload: EvolutionWebhookPayload = req.body;


      // Verifica se é um evento de mensagem recebida
      if (payload.event === "messages.upsert") {
        const { data } = payload;

        // Validação: verifica se tem key
        if (!data.key) {
          return res.status(200).json({ success: true, message: "Invalid message data" });
        }

        // Validação: verifica se payload.instance está presente
        if (!payload.instance) {
          console.error("Error: payload.instance is null or undefined", JSON.stringify(payload, null, 2));
          return res.status(200).json({ success: false, message: "Instance name not found in payload" });
        }

        // Se for mensagem enviada pelo celular (fromMe = true), apenas retorna (pode salvar histórico se quiser)
        if (data.key.fromMe) {
          return res.status(200).json({ success: true, message: "Phone message ignored" });
        }

        // Processa a mensagem recebida (INBOUND)
        const result = await messageService.processInboundMessage(
          payload.instance,
          data.key.remoteJid,
          data // Payload completo com data.key para download de mídia
        );

        // 🔄 FLOW ENGINE: Verifica se há fluxo esperando resposta deste cliente
        // IMPORTANTE: Roda ANTES do early return de !result para que mensagens
        // de tipos não processados (stickers, reactions, etc.) ainda disparem o "respondeu"
        try {
          const remoteJid = data.key.remoteJid;
          const isGroup = remoteJid?.endsWith("@g.us");

          if (!isGroup && remoteJid) {
            // Extrai phone e companyId: usa result se disponível, senão busca da instância
            let phone: string | null = null;
            let companyId: string | null = null;
            let messageContent = "";

            let instanceId: string | null = null;

            if (result) {
              phone = result.customer.phone;
              companyId = result.customer.companyId;
              messageContent = result.message.content || "";
              instanceId = result.instance?.id || result.message?.whatsappInstanceId || null;
            } else {
              // Fallback: extrai phone do remoteJid e companyId da instância
              phone = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
              const instance = await prisma.whatsAppInstance.findFirst({
                where: { instanceName: payload.instance },
                select: { companyId: true, id: true },
              });
              companyId = instance?.companyId || null;
              instanceId = instance?.id || null;

              // 🔗 Se o phone parece ser um LID (14+ dígitos), tenta encontrar o phone real
              // via mapeamento lidPhone no customer
              if (phone && companyId && phone.replace(/\D/g, '').length >= 14) {
                const cleanLid = phone.replace(/\D/g, '');
                const customerByLid = await prisma.customer.findFirst({
                  where: { companyId, lidPhone: cleanLid },
                  select: { phone: true },
                });
                if (customerByLid) {
                  phone = customerByLid.phone;
                } else {
                  // 🔑 Fallback: Busca por contactLid na FlowExecution (mapeado pelo storeLidMapping no envio)
                  const execByLid = await prisma.flowExecution.findFirst({
                    where: {
                      contactLid: cleanLid,
                      status: 'WAITING_REPLY',
                      flow: { companyId },
                      startedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
                    },
                    select: { id: true, contactPhone: true },
                  });

                  if (execByLid) {
                    phone = execByLid.contactPhone;

                    // Salva no customer para futuras resoluções permanentes
                    await prisma.customer.updateMany({
                      where: {
                        companyId,
                        phone: execByLid.contactPhone,
                        lidPhone: null,
                      },
                      data: { lidPhone: cleanLid },
                    });
                  } else {
                    // ⛔ Sem mapeamento conhecido — não associar a nenhum fluxo para evitar contaminação.
                  }
                }
              }

              // Tenta extrair conteúdo de qualquer tipo de mensagem
              messageContent = data.message?.conversation
                || data.message?.extendedTextMessage?.text
                || data.message?.imageMessage?.caption
                || data.message?.videoMessage?.caption
                || data.message?.documentMessage?.fileName
                || data.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName
                || (data.message?.audioMessage ? '[Áudio]' : undefined)
                || (data.message?.stickerMessage ? '[Sticker]' : undefined)
                || (data.message ? '[Mídia]' : '')
                || "";
            }

            // Logging omitted
            if (phone && companyId) {
              const { FlowEngineService } = await import("../services/FlowEngineService");
              const flowEngine = new FlowEngineService();
              const flowResumed = await flowEngine.handleIncomingMessage(phone, companyId, messageContent, instanceId);

              // Logging omitted
              if (flowResumed) {
                return res.status(200).json({
                  success: true,
                  message: "Flow resumed, skipping other processing"
                });
              }
            }
          }
        } catch (flowError) {
          console.error("[Webhook] Error processing flow engine reply:", flowError);
        }

        // Se não conseguiu processar (mensagem sem conteúdo válido)
        if (!result) {
          return res.status(200).json({ success: true, message: "No valid content to process" });
        }

        // 🌡️ TEMPERATURA: Atualiza temperatura do cliente em background (fire-and-forget)
        if (!result.customer.isGroup) {
          customerTemperatureService
            .analyzeAndUpdate(result.customer.id, result.customer.companyId)
            .catch(() => {});
        }

        // 🔗 LINK CONVERSION: Verifica se a mensagem veio de um link rastreado
        try {
          await linkConversionService.processMessageConversion(
            result.customer.phone,
            result.message.content,
            result.customer.id,
            result.customer.companyId
          );
        } catch (conversionError) {
          console.error("[Webhook] Error processing link conversion:", conversionError);
        }

        // AUTO-FIX: Se recebemos mensagem, estamos conectados
        if (result.instance.status !== WhatsAppStatus.CONNECTED) {
          await whatsappService.updateConnectionStatus(result.instance.id, WhatsAppStatus.CONNECTED);
          result.instance.status = WhatsAppStatus.CONNECTED;
        }

        // Verifica se deve processar com IA
        const conversation = await conversationService.getOrCreateConversation(result.customer.id, result.customer.companyId);

        // Busca configuração global de auto-reply da empresa
        const aiKnowledge = await prisma.aIKnowledge.findUnique({
          where: { companyId: result.customer.companyId },
        });

        // Verifica condições para IA:
        // 1. IA habilitada na conversa
        // 2. Auto-reply habilitado na empresa
        // 3. Provedor de IA configurado (OpenAI ou Gemini)
        // 4. Não é grupo
        const isAutoReplyEnabled = aiKnowledge?.autoReplyEnabled === true;

        // Provider é definido via .env (AI_PROVIDER), não usa mais o banco
        const aiProvider: AIProvider = (process.env.AI_PROVIDER as AIProvider) || "gemini";
        const isAIConfigured = aiProvider === "openai"
          ? openaiService.isConfigured()
          : geminiService.isConfigured();

        if (conversation.aiEnabled && isAutoReplyEnabled && isAIConfigured && !result.customer.isGroup) {
          // Dedup: ignora se este messageId já foi enviado para IA recentemente
          const aiDedupKey = `${result.instance.id}:${result.message.messageId || result.message.id}`;
          const now = Date.now();
          const lastProcessed = recentlyProcessedAI.get(aiDedupKey);
          if (lastProcessed && now - lastProcessed < AI_DEDUP_TTL_MS) {
            console.error(`[Webhook] AI dedup: skipping duplicate event for message ${aiDedupKey}`);
            return res.status(200).json({ success: true, message: "Duplicate event ignored" });
          }
          recentlyProcessedAI.set(aiDedupKey, now);
          // Limpa entradas expiradas para não acumular memória
          for (const [key, ts] of recentlyProcessedAI.entries()) {
            if (now - ts > AI_DEDUP_TTL_MS) recentlyProcessedAI.delete(key);
          }

          try {
            // 📅 PRIORITY CHECK: Verifica se JÁ ESTÁ em fluxo de agendamento ativo
            // Import dinâmico para evitar dependência circular se houver
            const { aiAppointmentService } = await import("../services/ai-appointment.service");
            const hasActiveFlow = await aiAppointmentService.hasActiveAppointmentFlow(result.customer.id);

            if (hasActiveFlow) {
              // Cliente está EM MEIO a um agendamento, continua o fluxo
              const appointmentResult = await aiAppointmentService.processAppointmentMessage(
                result.customer.id,
                result.customer.companyId,
                result.message.content
              );

              if (appointmentResult.shouldContinue && appointmentResult.response) {
                await messageService.sendMessage(result.customer.id, appointmentResult.response, "AI");
              }
            } else {
              // NÃO está em fluxo de agendamento, processa normalmente com a IA

              // ═══════════════════════════════════════════════════════════════
              // 🛡️ CAMADA 1: Detecção de intenção direta (ANTES da IA)
              // Keywords como "quero falar com humano", "me passa um atendente"
              // ═══════════════════════════════════════════════════════════════
              if (detectDirectHandoffIntent(result.message.content)) {
                const handoffMessage = "Entendi! Vou te transferir para um atendente agora. Aguarde um momento, por favor. 🙏";
                await messageService.sendMessage(result.customer.id, handoffMessage, "AI");
                await conversationService.toggleAI(result.customer.id, false);
                await prisma.conversation.update({
                  where: { customerId: result.customer.id },
                  data: { needsHelp: true },
                });
                clearLoopCache(result.customer.id);
                websocketService.emitTypingIndicator(result.customer.companyId, result.customer.id, false);
                websocketService.emitConversationUpdate(result.customer.companyId, result.customer.id, {
                  aiEnabled: false,
                  needsHelp: true,
                  handoffReason: "Solicitação direta do cliente para falar com humano",
                });
              } else {
                // ⏱️ DELAY antes de gerar resposta: random entre 30-60 segundos
                const replyDelay = Math.floor(Math.random() * 31_000) + 30_000;
                websocketService.emitTypingIndicator(result.customer.companyId, result.customer.id, true);
                await whatsappService.sendPresence(result.instance.id, result.customer.phone, replyDelay, "composing");
                await new Promise(resolve => setTimeout(resolve, replyDelay));
                websocketService.emitTypingIndicator(result.customer.companyId, result.customer.id, false);

                const aiResponse = await aiService.generateResponse(result.customer.id, result.message.content);

                // COMANDO ESPECIAL: Agendamento
                if (aiResponse.startsWith("[INICIAR_AGENDAMENTO]")) {
                  const aiMessage = aiResponse.replace("[INICIAR_AGENDAMENTO]", "").trim();

                  if (aiMessage) {
                    await messageService.sendMessage(result.customer.id, aiMessage, "AI");
                  }

                  const appointmentResult = await aiAppointmentService.startAppointmentFlow(
                    result.customer.id,
                    result.customer.companyId,
                    result.message.content
                  );

                  if (appointmentResult.response) {
                    await messageService.sendMessage(result.customer.id, appointmentResult.response, "AI");
                  }
                } else {
                  // ═══════════════════════════════════════════════════════════
                  // 🛡️ CAMADA 2: Tokens de handoff na resposta da IA
                  // [TRANSBORDO] ou HANDOFF_ACTION detectados no texto
                  // ═══════════════════════════════════════════════════════════
                  const handoff = parseHandoffTokens(aiResponse);

                  // ═══════════════════════════════════════════════════════════
                  // 🛡️ CAMADA 3: Detecção de loop semântico
                  // Se a IA está repetindo respostas muito similares → transbordo
                  // ═══════════════════════════════════════════════════════════
                  const isLoop = !handoff.shouldHandoff && detectLoopAndRecord(result.customer.id, handoff.cleanMessage);

                  if (handoff.shouldHandoff || isLoop) {
                    const reason = isLoop ? "Loop de IA detectado — respostas repetitivas" : handoff.reason;

                    // Se é loop e a IA não adicionou mensagem de transbordo, adiciona
                    const messageToSend = isLoop && !handoff.shouldHandoff
                      ? "Percebi que não estou conseguindo resolver sua dúvida da melhor forma. Vou transferir você para um atendente que poderá te ajudar. Aguarde um momento! 🙏"
                      : handoff.cleanMessage;

                    await messageService.sendMessage(result.customer.id, messageToSend, "AI");
                    await conversationService.toggleAI(result.customer.id, false);
                    await prisma.conversation.update({
                      where: { customerId: result.customer.id },
                      data: { needsHelp: true },
                    });
                    clearLoopCache(result.customer.id);
                    websocketService.emitTypingIndicator(result.customer.companyId, result.customer.id, false);
                    websocketService.emitConversationUpdate(result.customer.companyId, result.customer.id, {
                      aiEnabled: false,
                      needsHelp: true,
                      handoffReason: reason,
                    });
                  } else {
                    // Resposta normal da IA
                    await messageService.sendMessage(result.customer.id, handoff.cleanMessage, "AI");
                  }
                }
              }
            }
          } catch (aiError: any) {
            // Erros de regra de negócio: não enviar fallback ao cliente
            const isSilentError =
              aiError.message?.includes("FREE plan") ||
              aiError.message?.includes("Auto-reply is disabled") ||
              aiError.message?.includes("AI is disabled") ||
              aiError.message?.includes("not configured");

            if (isSilentError) {
              console.error("AI skipped (business rule):", aiError.message);
            } else {
              console.error("Error processing AI response:", aiError.message);
              const fallbackKey = result.customer.id;
              const lastFallback = recentlyFallbackSent.get(fallbackKey);
              const nowFallback = Date.now();
              if (!lastFallback || nowFallback - lastFallback > FALLBACK_DEDUP_TTL_MS) {
                recentlyFallbackSent.set(fallbackKey, nowFallback);
                try {
                  await messageService.sendMessage(
                    result.customer.id,
                    "Desculpe, tive um problema técnico momentâneo. Pode repetir sua mensagem? 🙏",
                    "AI"
                  );
                } catch (fallbackSendError: any) {
                  console.error("Failed to send AI fallback message:", fallbackSendError.message);
                }
              }
            }
          }

          // IA respondeu → marca mensagens inbound como lidas
          messageService.markAsRead(result.customer.id, result.instance.id).catch(() => {});
        }

        return res.status(200).json({
          success: true,
          data: {
            messageId: result.message.id,
            customerId: result.customer.id,
            aiProcessed: conversation.aiEnabled && isAutoReplyEnabled && isAIConfigured && !result.customer.isGroup,
          },
        });
      }

      // Eventos de status de mensagem (delivered, read)
      if (payload.event === "messages.update") {
        try {
          if (!payload.instance || !payload.data) {
            return res.status(200).json({ success: true, message: "Invalid status update data" });
          }


          // Busca a instância
          const instance = await prisma.whatsAppInstance.findFirst({
            where: { instanceName: payload.instance },
          });

          if (!instance) {
            return res.status(200).json({ success: true, message: "Instance not found" });
          }

          // O payload.data pode ser um array de updates ou um único update
          const updates = Array.isArray(payload.data) ? payload.data : [payload.data];

          for (const update of updates) {
            const messageId = update.key?.id;
            const statusValue = update.status;

            if (!messageId || statusValue === undefined) continue;

            // Mapeia o status da Evolution API para o nosso enum
            // Evolution API pode enviar números OU strings
            // Números: 0=ERROR, 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
            // Strings: "ERROR", "PENDING", "SERVER_ACK", "DELIVERY_ACK", "READ", "PLAYED"
            let newStatus: "SENT" | "DELIVERED" | "READ" | "FAILED" | null = null;

            // Normaliza para string para comparação
            const statusStr = String(statusValue).toUpperCase();

            if (statusValue === 0 || statusStr === "ERROR" || statusStr === "FAILED") {
              newStatus = "FAILED";
            } else if (statusValue === 1 || statusValue === 2 || statusStr === "PENDING" || statusStr === "SERVER_ACK") {
              newStatus = "SENT";
            } else if (statusValue === 3 || statusStr === "DELIVERY_ACK" || statusStr === "DELIVERED") {
              newStatus = "DELIVERED";
            } else if (statusValue === 4 || statusValue === 5 || statusStr === "READ" || statusStr === "READ_ACK" || statusStr === "PLAYED") {
              newStatus = "READ";
            }


            if (newStatus) {
              const result = await messageService.updateMessageStatusByWhatsAppId(
                instance.id,
                messageId,
                newStatus as any,
                update.key?.remoteJid
              );
            }
          }

          return res.status(200).json({ success: true, message: "Status updates processed" });
        } catch (error: any) {
          console.error("Error processing message status update:", error.message);
          return res.status(200).json({ success: false, message: error.message });
        }
      }

      // Eventos de conexão
      if (payload.event === "connection.update") {
        try {
          if (!payload.instance) {
            return res.status(200).json({ success: false, message: "Instance name missing" });
          }

          const instance = await prisma.whatsAppInstance.findFirst({
            where: { instanceName: payload.instance },
          });

          if (!instance) {
            return res.status(200).json({ success: true, message: "Instance not found" });
          }

          const connectionState = payload.data?.state || payload.data?.connection;
          let newStatus: WhatsAppStatus | null = null;

          switch (connectionState) {
            case "open":
              newStatus = WhatsAppStatus.CONNECTED;
              break;
            case "connecting":
              newStatus = WhatsAppStatus.CONNECTING;
              break;
            case "close":
            case "closed":
              const reason = payload.data?.lastDisconnect?.error?.output?.statusCode || 
                           payload.data?.statusReason || 
                           payload.data?.reason;
              

              // Se for 401/403 ou loggedOut, desconecta totalmente
              if (reason === 401 || reason === 403 || reason === "loggedOut") {
                newStatus = WhatsAppStatus.DISCONNECTED;
                await whatsappService.updateConnectionStatus(instance.id, WhatsAppStatus.DISCONNECTED);

                // Limpa dados de conexão
                await prisma.whatsAppInstance.updateMany({
                  where: { id: instance.id },
                  data: { qrCode: null, phoneNumber: null },
                });

                // Alerta o frontend via WebSocket
                websocketService.emitInstanceDisconnected(instance.companyId, instance.instanceName);
              } else {
                newStatus = WhatsAppStatus.CONNECTING;
              }
              break;
          }

          if (newStatus) {
            const phoneNumber = newStatus === WhatsAppStatus.CONNECTED && payload.data?.instance?.wuid 
              ? payload.data.instance.wuid.split("@")[0] 
              : undefined;

            await whatsappService.updateConnectionStatus(instance.id, newStatus, phoneNumber);
          }

          return res.status(200).json({ success: true, data: { status: newStatus } });
        } catch (error: any) {
          console.error("Error processing connection update:", error.message);
          return res.status(200).json({ success: false, message: error.message });
        }
      }

      // QR Code Update
      if (payload.event === "qrcode.updated") {
        try {
          if (!payload.instance) return res.status(200).json({ success: false });

          const instance = await prisma.whatsAppInstance.findFirst({
            where: { instanceName: payload.instance },
          });

          if (instance) {
            const qrCode = payload.data?.qrcode?.base64 || payload.data?.qrcode?.code;
            if (qrCode) {
              await prisma.whatsAppInstance.update({
                where: { id: instance.id },
                data: { qrCode, status: WhatsAppStatus.CONNECTING },
              });
            }
          }
          return res.status(200).json({ success: true, message: "QR Code updated" });
        } catch (error) {
          return res.status(200).json({ success: false, message: "Error updating QR" });
        }
      }

      // 🔗 Evento SEND_MESSAGE: captura LID mapping de mensagens enviadas
      // Quando enviamos uma mensagem via API, a Evolution pode retornar o remoteJid
      // como LID ao invés do phone real. Usamos isso para criar o mapeamento.
      if (payload.event === "send.message") {
        try {
          const sendData = payload.data;
          const sendKey = sendData?.key;

          if (sendKey?.remoteJid && payload.instance) {
            const sentToJid = sendKey.remoteJid;
            const sentToPhone = sentToJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");

            // Se o remoteJid parece ser um LID (14+ dígitos), tenta criar mapeamento
            if (sentToPhone.length >= 14) {
              const inst = await prisma.whatsAppInstance.findFirst({
                where: { instanceName: payload.instance },
                select: { companyId: true },
              });

              if (inst) {
                // 🔗 Usa o messageId para correlação EXATA: busca a mensagem salva pelo fluxo
                // com o mesmo externalId (WhatsApp message ID), e a partir dela identifica o customer/phone.
                const messageId = sendKey.id;
                let mapped = false;

                if (messageId) {
                  const savedMsg = await prisma.message.findFirst({
                    where: {
                      messageId: messageId,
                      customer: { companyId: inst.companyId },
                    },
                    select: { customer: { select: { phone: true } } },
                  });

                  if (savedMsg) {
                    const realPhone = savedMsg.customer.phone.replace(/\D/g, '');
                    // Encontra a execução deste phone para salvar o LID (opcional)
                    const exec = await prisma.flowExecution.findFirst({
                      where: {
                        contactPhone: { endsWith: realPhone.slice(-(Math.min(realPhone.length, 11))) },
                        contactLid: null,
                        flow: { companyId: inst.companyId },
                        status: { in: ['RUNNING', 'WAITING_REPLY', 'DELAYED'] },
                      },
                      orderBy: { updatedAt: 'desc' },
                    });

                    if (exec) {
                      await prisma.flowExecution.update({
                        where: { id: exec.id },
                        data: { contactLid: sentToPhone },
                      });
                    }

                    // IMPORTANTE: Atualiza o mapeamento no Customer INDEPENDENTEMENTE de ter um FlowExecution!
                    // Isso evita que mensagens enviadas fora de fluxo (ex: IA ou atendente) deixem de mapear o LID
                    await prisma.customer.updateMany({
                      where: { companyId: inst.companyId, phone: savedMsg.customer.phone, lidPhone: null },
                      data: { lidPhone: sentToPhone },
                    });

                    mapped = true;
                  }
                }

                if (!mapped) { /* LID não mapeado — storeLidMapping() cobre no envio */ }
              }
            }
          }
        } catch (sendErr: any) {
          console.error(`[Webhook] Error processing send.message LID mapping:`, sendErr.message);
        }
        return res.status(200).json({ success: true, message: "Send message processed" });
      }

      return res.status(200).json({ success: true, message: "Event received" });
    } catch (error: any) {
      console.error("Error processing webhook:", error);
      return res.status(200).json({ success: false, message: "Failed to process webhook" });
    }
  }

  /**
   * Endpoint de teste
   */
  async testWebhook(_req: Request, res: Response) {
    return res.status(200).json({
      success: true,
      message: "Webhook endpoint is working",
      timestamp: new Date().toISOString(),
    });
  }
}

export default new WebhookController();