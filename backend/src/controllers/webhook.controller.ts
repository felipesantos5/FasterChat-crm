import { Request, Response } from "express";
import messageService from "../services/message.service";
import conversationService from "../services/conversation.service";
import aiService from "../services/ai.service";
import { prisma } from "../utils/prisma";
import { WhatsAppStatus } from "@prisma/client";
import { EvolutionWebhookPayload } from "../types/message";
import whatsappService from "../services/whatsapp.service";

class WebhookController {
  /**
   * POST /api/webhooks/whatsapp
   * Recebe webhooks da Evolution API
   */
  async handleWhatsAppWebhook(req: Request, res: Response) {
    try {
      // Valida webhook secret (segurança)
      // const webhookSecret = process.env.WEBHOOK_SECRET;
      // const receivedSecret = req.headers['x-webhook-secret'];

      // if (webhookSecret && webhookSecret !== receivedSecret) {
      //   console.warn('⚠️  Invalid webhook secret received');
      //   return res.status(401).json({ success: false, message: 'Unauthorized' });
      // }

      const payload: EvolutionWebhookPayload = req.body;

      // Log do webhook recebido para debug
      console.log(`[Webhook] Event: ${payload.event}, Instance: ${payload.instance || "NOT PROVIDED"}`);

      // Verifica se é um evento de mensagem recebida
      if (payload.event === "messages.upsert") {
        const { data } = payload;

        // Validação: verifica se tem key
        if (!data.key) {
          return res.status(200).json({ success: true, message: "Invalid message data" });
        }

        // Ignora mensagens enviadas por nós (fromMe = true)
        if (data.key.fromMe) {
          return res.status(200).json({ success: true, message: "Ignored outbound message" });
        }

        // Validação: verifica se payload.instance está presente
        if (!payload.instance) {
          console.error("Error: payload.instance is null or undefined", JSON.stringify(payload, null, 2));
          return res.status(200).json({ success: false, message: "Instance name not found in payload" });
        }

        // Processa a mensagem (o método agora aceita o payload completo)
        const result = await messageService.processInboundMessage(
          payload.instance,
          data.key.remoteJid,
          data // Payload completo com data.key para download de mídia
        );

        // Se não conseguiu processar (mensagem sem conteúdo válido)
        if (!result) {
          return res.status(200).json({ success: true, message: "No valid content to process" });
        }

        // 👇👇👇 ADICIONE ESTE BLOCO DE CORREÇÃO AQUI 👇👇👇
        // AUTO-FIX: Se recebemos mensagem, é prova de que estamos conectados.
        // Forçamos o status para CONNECTED para que a IA não seja bloqueada.
        if (result.instance.status !== WhatsAppStatus.CONNECTED) {
          await whatsappService.updateConnectionStatus(result.instance.id, WhatsAppStatus.CONNECTED);
          console.log(`✅ Status auto-corrected to CONNECTED for ${result.instance.instanceName} (Message received)`);

          // Atualiza o objeto local para a lógica seguinte
          result.instance.status = WhatsAppStatus.CONNECTED;
        }

        // Verifica se deve processar com IA
        const conversation = await conversationService.getOrCreateConversation(result.customer.id, result.customer.companyId);

        // Se IA está habilitada, gera e envia resposta automática
        if (conversation.aiEnabled && aiService.isConfigured()) {
          try {
            // 📅 PRIORITY CHECK: Verifica se JÁ ESTÁ em fluxo de agendamento ativo
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

              // 🎯 COMANDO ESPECIAL: Verifica se a IA detectou intenção de agendamento
              if (aiResponse.startsWith("[INICIAR_AGENDAMENTO]")) {
                console.log(`📅 IA detectou intenção de agendamento para ${result.customer.name}`);

                // Remove a tag e pega a mensagem da IA
                const aiMessage = aiResponse.replace("[INICIAR_AGENDAMENTO]", "").trim();

                // Envia a mensagem da IA primeiro
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
              // 🚨 TRANSBORDO HUMANO: Verifica se a IA solicitou transferência para humano
              else if (aiResponse.startsWith("[TRANSBORDO]")) {
                console.log(`🚨 Transbordo solicitado para cliente ${result.customer.name}`);

                // Remove a tag [TRANSBORDO] da mensagem
                const cleanMessage = aiResponse.replace("[TRANSBORDO]", "").trim();

                // Envia a mensagem limpa ao cliente
                await messageService.sendMessage(result.customer.id, cleanMessage, "AI");

                // Desativa a IA para essa conversa (transbordo para humano)
                await conversationService.toggleAI(result.customer.id, false);

                // Marca a conversa como precisando de ajuda
                await prisma.conversation.update({
                  where: { customerId: result.customer.id },
                  data: { needsHelp: true },
                });

                console.log(`✓ Conversa transferida para atendimento humano: ${result.customer.id}`);
              } else {
                // Resposta normal da IA (sem comandos especiais)
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
            customerName: result.customer.name,
            aiProcessed: conversation.aiEnabled && aiService.isConfigured(),
          },
        });
      }

      // Eventos de status de mensagem (delivered, read)
      if (payload.event === "messages.update") {
        return res.status(200).json({ success: true, message: "Status update received" });
      }

      // Eventos de conexão (CONNECTION_UPDATE)
      if (payload.event === "connection.update") {
        try {
          // Validação: verifica se payload.instance está presente
          if (!payload.instance) {
            console.error("Error: payload.instance is null for connection.update", JSON.stringify(payload, null, 2));
            return res.status(200).json({ success: false, message: "Instance name not found in payload" });
          }

          const instance = await prisma.whatsAppInstance.findFirst({
            where: { instanceName: payload.instance },
          });

          if (!instance) {
            console.warn(`[Webhook] Instance ${payload.instance} not found in database`);
            return res.status(200).json({ success: true, message: "Instance not found" });
          }

          const connectionState = payload.data?.state || payload.data?.connection;
          let newStatus: WhatsAppStatus | null = null;

          switch (connectionState) {
            case "open":
              newStatus = WhatsAppStatus.CONNECTED;
              console.log(`✅ Evolution API: ${payload.instance} CONNECTED`);
              break;
            case "connecting":
              newStatus = WhatsAppStatus.CONNECTING;
              break;
            case "close":
            case "closed":
              const reason =
                payload.data?.lastDisconnect?.error?.output?.statusCode ||
                payload.data?.statusReason || // Adicionei esta leitura do statusReason direto
                payload.data?.reason;
              console.log(`⚠️ Evolution API Connection Closed. Reason: ${reason}`);

              // Se for 401 (Logged Out), marcamos como DISCONNECTED
              // Para qualquer outro erro (instabilidade, restart), marcamos como CONNECTING (para tentar de novo)
              if (reason === 401 || reason === 403 || reason === "loggedOut") {
                newStatus = WhatsAppStatus.DISCONNECTED;

                // 🔥 BLINDAGEM: Limpar QR Code e Phone Number para forçar nova geração limpa
                await whatsappService.updateConnectionStatus(instance.id, WhatsAppStatus.DISCONNECTED);

                // Limpeza adicional se necessário (já feito pelo updateConnectionStatus mas garantindo campos extras se houver)
                await prisma.whatsAppInstance.update({
                  where: { id: instance.id },
                  data: {
                    qrCode: null,
                    phoneNumber: null,
                  },
                });
                console.log(`❌ Instance ${instance.instanceName} invalidated (401/403). Cleaned up for reconnection.`);

                // Opcional: Chamar endpoint de Logout na Evolution para garantir limpeza lá também
                // whatsappService.logout(instance.instanceName);
              } else {
                newStatus = WhatsAppStatus.CONNECTING;
                console.log(`🔄 Evolution API: ${payload.instance} RECONNECTING (Temporary fluctuation)`);
              }
              break;
          }

          if (newStatus) {
            const phoneNumber =
              newStatus === WhatsAppStatus.CONNECTED && payload.data?.instance?.wuid ? payload.data.instance.wuid.split("@")[0] : undefined;

            await whatsappService.updateConnectionStatus(instance.id, newStatus, phoneNumber);
          }

          return res.status(200).json({
            success: true,
            message: "Connection status updated",
            data: { status: newStatus },
          });
        } catch (error: any) {
          console.error("Error processing connection update:", error.message);
          return res.status(200).json({
            success: false,
            message: error.message,
          });
        }
      }

      // Eventos de QR Code atualizado
      if (payload.event === "qrcode.updated") {
        try {
          // Validação: verifica se payload.instance está presente
          if (!payload.instance) {
            console.error("Error: payload.instance is null for qrcode.updated", JSON.stringify(payload, null, 2));
            return res.status(200).json({ success: false, message: "Instance name not found in payload" });
          }

          const instance = await prisma.whatsAppInstance.findFirst({
            where: { instanceName: payload.instance },
          });

          if (!instance) {
            console.warn(`[Webhook] Instance ${payload.instance} not found in database`);
            return res.status(200).json({ success: true, message: "Instance not found" });
          }

          const qrCode = payload.data?.qrcode?.base64 || payload.data?.qrcode?.code;

          if (qrCode) {
            await prisma.whatsAppInstance.update({
              where: { id: instance.id },
              data: {
                qrCode,
                status: WhatsAppStatus.CONNECTING,
              },
            });
          }

          return res.status(200).json({
            success: true,
            message: "QR Code updated",
          });
        } catch (error: any) {
          console.error("Error processing QR code update:", error.message);
          return res.status(200).json({
            success: false,
            message: error.message,
          });
        }
      }

      return res.status(200).json({ success: true, message: "Event received" });
    } catch (error: any) {
      console.error("Error processing webhook:", error);

      // Retorna 200 mesmo com erro para não fazer a Evolution API retentar
      return res.status(200).json({
        success: false,
        message: error.message || "Failed to process webhook",
      });
    }
  }

  /**
   * GET /api/webhooks/whatsapp/test
   * Endpoint de teste para verificar se o webhook está funcionando
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
