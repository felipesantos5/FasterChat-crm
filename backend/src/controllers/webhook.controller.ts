import { Request, Response } from 'express';
import messageService from '../services/message.service';
import conversationService from '../services/conversation.service';
import aiService from '../services/ai.service';
import { EvolutionWebhookPayload } from '../types/message';

class WebhookController {
  /**
   * POST /api/webhooks/whatsapp
   * Recebe webhooks da Evolution API
   */
  async handleWhatsAppWebhook(req: Request, res: Response) {
    try {
      // Valida webhook secret (segurança)
      const webhookSecret = process.env.WEBHOOK_SECRET;
      const receivedSecret = req.headers['x-webhook-secret'];

      if (webhookSecret && webhookSecret !== receivedSecret) {
        console.warn('⚠️  Invalid webhook secret received');
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const payload: EvolutionWebhookPayload = req.body;

      console.log('📩 Webhook received:', {
        event: payload.event,
        instance: payload.instance,
      });

      // Verifica se é um evento de mensagem recebida
      if (payload.event === 'messages.upsert') {
        const { data } = payload;

        // Ignora mensagens enviadas por nós (fromMe = true)
        if (data.key.fromMe) {
          console.log('Ignoring outbound message from webhook');
          return res.status(200).json({ success: true, message: 'Ignored outbound message' });
        }

        // Extrai o conteúdo da mensagem
        let content = '';
        if (data.message?.conversation) {
          content = data.message.conversation;
        } else if (data.message?.extendedTextMessage?.text) {
          content = data.message.extendedTextMessage.text;
        }

        if (!content) {
          console.log('No text content found in message');
          return res.status(200).json({ success: true, message: 'No text content' });
        }

        // Converte timestamp
        const timestamp = new Date(
          typeof data.messageTimestamp === 'string'
            ? parseInt(data.messageTimestamp) * 1000
            : data.messageTimestamp * 1000
        );

        // Processa a mensagem
        const result = await messageService.processInboundMessage(
          payload.instance,
          data.key.remoteJid,
          content,
          data.key.id,
          timestamp,
          data.pushName
        );

        console.log('Message processed successfully:', result.message.id);

        // Verifica se deve processar com IA
        const conversation = await conversationService.getOrCreateConversation(
          result.customer.id,
          result.customer.companyId
        );

        // Se IA está habilitada, gera e envia resposta automática
        if (conversation.aiEnabled && aiService.isConfigured()) {
          console.log('🤖 AI is enabled for this conversation, generating response...');

          try {
            // Gera resposta usando IA
            const aiResponse = await aiService.generateResponse(
              result.customer.id,
              content
            );

            // Envia a resposta via WhatsApp
            await messageService.sendMessage(result.customer.id, aiResponse, 'AI');

            console.log('✓ AI response sent successfully');
          } catch (aiError: any) {
            console.error('✗ Error processing AI response:', aiError);
            // Não falha o webhook se a IA falhar
          }
        } else {
          console.log('ℹ️  AI disabled for this conversation or not configured');
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
      if (payload.event === 'messages.update') {
        // TODO: Implementar atualização de status de mensagens
        console.log('Message status update received (not implemented yet)');
        return res.status(200).json({ success: true, message: 'Status update received' });
      }

      // Outros eventos
      console.log('Unhandled webhook event:', payload.event);
      return res.status(200).json({ success: true, message: 'Event received' });
    } catch (error: any) {
      console.error('Error processing webhook:', error);

      // Retorna 200 mesmo com erro para não fazer a Evolution API retentar
      return res.status(200).json({
        success: false,
        message: error.message || 'Failed to process webhook',
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
      message: 'Webhook endpoint is working',
      timestamp: new Date().toISOString(),
    });
  }
}

export default new WebhookController();
