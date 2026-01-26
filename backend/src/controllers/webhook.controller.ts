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

class WebhookController {
  /**
   * POST /api/webhooks/whatsapp
   * Recebe webhooks da Evolution API
   */
  async handleWhatsAppWebhook(req: Request, res: Response) {
    try {
      // Valida webhook secret (segurança) - Descomentar em produção
      // const webhookSecret = process.env.WEBHOOK_SECRET;
      // const receivedSecret = req.headers['x-webhook-secret'];

      // if (webhookSecret && webhookSecret !== receivedSecret) {
      //   console.warn('⚠️  Invalid webhook secret received');
      //   return res.status(401).json({ success: false, message: 'Unauthorized' });
      // }

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

        // Se não conseguiu processar (mensagem sem conteúdo válido)
        if (!result) {
          return res.status(200).json({ success: true, message: "No valid content to process" });
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
        const isAutoReplyEnabled = aiKnowledge?.autoReplyEnabled !== false;

        // Provider é definido via .env (AI_PROVIDER), não usa mais o banco
        const aiProvider: AIProvider = (process.env.AI_PROVIDER as AIProvider) || "gemini";
        const isAIConfigured = aiProvider === "openai"
          ? openaiService.isConfigured()
          : geminiService.isConfigured();

        if (conversation.aiEnabled && isAutoReplyEnabled && isAIConfigured && !result.customer.isGroup) {
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
              const aiResponse = await aiService.generateResponse(result.customer.id, result.message.content);

              // COMANDO ESPECIAL: Agendamento
              if (aiResponse.startsWith("[INICIAR_AGENDAMENTO]")) {
                const aiMessage = aiResponse.replace("[INICIAR_AGENDAMENTO]", "").trim();

                if (aiMessage) {
                  await messageService.sendMessage(result.customer.id, aiMessage, "AI");
                }

                // Inicia o fluxo de agendamento
                const appointmentResult = await aiAppointmentService.startAppointmentFlow(
                  result.customer.id,
                  result.customer.companyId,
                  result.message.content
                );

                if (appointmentResult.response) {
                  await messageService.sendMessage(result.customer.id, appointmentResult.response, "AI");
                }
              }
              // 🚨 COMANDO ESPECIAL: Transbordo
              else if (aiResponse.startsWith("[TRANSBORDO]")) {
                const cleanMessage = aiResponse.replace("[TRANSBORDO]", "").trim();

                await messageService.sendMessage(result.customer.id, cleanMessage, "AI");
                await conversationService.toggleAI(result.customer.id, false);

                await prisma.conversation.update({
                  where: { customerId: result.customer.id },
                  data: { needsHelp: true },
                });

                // 🔔 Emite eventos via WebSocket para atualizar o frontend em tempo real
                // 1. Para o indicador de "pensando..."
                websocketService.emitTypingIndicator(result.customer.companyId, result.customer.id, false);

                // 2. Atualiza o estado da conversa (switch de IA e needsHelp)
                websocketService.emitConversationUpdate(result.customer.companyId, result.customer.id, {
                  aiEnabled: false,
                  needsHelp: true,
                });
              } else {
                // Resposta normal da IA
                await messageService.sendMessage(result.customer.id, aiResponse, "AI");
              }
            }
          } catch (aiError: any) {
            console.error("Error processing AI response:", aiError.message);
          }
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

          console.log("📨 [Webhook] messages.update received:", JSON.stringify(payload.data, null, 2));

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

            console.log(`📨 [Webhook] Processing message ${messageId} with status: ${statusValue} (type: ${typeof statusValue})`);

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

            console.log(`📨 [Webhook] Mapped status: ${statusValue} -> ${newStatus}`);

            if (newStatus) {
              const result = await messageService.updateMessageStatusByWhatsAppId(
                instance.id,
                messageId,
                newStatus as any
              );
              console.log(`📨 [Webhook] Status update result:`, result ? "Updated" : "Message not found");
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
              
              console.log(`⚠️ Evolution API Closed. Reason: ${reason}`);

              // Se for 401/403 ou loggedOut, desconecta totalmente
              if (reason === 401 || reason === 403 || reason === "loggedOut") {
                newStatus = WhatsAppStatus.DISCONNECTED;
                await whatsappService.updateConnectionStatus(instance.id, WhatsAppStatus.DISCONNECTED);
                
                // Limpa dados de conexão
                await prisma.whatsAppInstance.update({
                  where: { id: instance.id },
                  data: { qrCode: null, phoneNumber: null },
                });
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