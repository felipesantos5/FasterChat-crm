import { Request, Response } from 'express';
import messageService from '../services/message.service';
import { AppError } from '../utils/errors';

class MessageController {
  /**
   * GET /api/messages/customer/:customerId
   * Obtém mensagens de um customer
   */
  async getCustomerMessages(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
      }

      const result = await messageService.getCustomerMessages(customerId, limit, offset);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in getCustomerMessages controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get messages',
      });
    }
  }

  /**
   * GET /api/messages/conversations/:companyId
   * Obtém resumo de todas as conversas de uma empresa
   */
  async getConversations(req: Request, res: Response) {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const conversations = await messageService.getConversations(companyId);

      return res.status(200).json({
        success: true,
        data: conversations,
      });
    } catch (error: any) {
      console.error('Error in getConversations controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get conversations',
      });
    }
  }

  /**
   * POST /api/messages/mark-read
   * Marca mensagens como lidas
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const { customerId, whatsappInstanceId } = req.body;

      if (!customerId || !whatsappInstanceId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID and WhatsApp Instance ID are required',
        });
      }

      const result = await messageService.markAsRead(customerId, whatsappInstanceId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in markAsRead controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark messages as read',
      });
    }
  }

  /**
   * GET /api/messages
   * Obtém mensagens com filtros
   */
  async getMessages(req: Request, res: Response) {
    try {
      const {
        customerId,
        whatsappInstanceId,
        direction,
        limit,
        offset,
      } = req.query;

      const filters = {
        customerId: customerId as string | undefined,
        whatsappInstanceId: whatsappInstanceId as string | undefined,
        direction: direction as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      };

      const result = await messageService.getMessages(filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in getMessages controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get messages',
      });
    }
  }

  /**
   * POST /api/messages/send
   * Envia uma mensagem para um customer
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { customerId, content, sentBy, whatsappInstanceId } = req.body;

      if (!customerId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID and message content are required',
        });
      }

      const result = await messageService.sendMessage(
        customerId,
        content,
        sentBy || 'HUMAN',
        whatsappInstanceId
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in sendMessage controller:', error);

      // Se é um AppError, retorna o formato estruturado
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      // Erro genérico
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Erro ao enviar mensagem. Tente novamente.',
        },
      });
    }
  }

  /**
   * POST /api/messages/send-media
   * Envia uma imagem para um customer
   */
  async sendMedia(req: Request, res: Response) {
    try {
      const { customerId, mediaBase64, caption, sentBy, whatsappInstanceId } = req.body;

      if (!customerId || !mediaBase64) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID and media (base64) are required',
        });
      }

      // Valida se é uma imagem base64 válida
      if (!mediaBase64.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image format. Must be base64 encoded image.',
        });
      }

      const result = await messageService.sendMedia(
        customerId,
        mediaBase64,
        caption,
        sentBy || 'HUMAN',
        whatsappInstanceId
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in sendMedia controller:', error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Erro ao enviar imagem. Tente novamente.',
        },
      });
    }
  }

  /**
   * POST /api/messages/:id/feedback
   * Adiciona feedback a uma mensagem da IA
   */
  async addFeedback(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { feedback, note } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Message ID is required',
        });
      }

      if (!feedback || !['GOOD', 'BAD'].includes(feedback)) {
        return res.status(400).json({
          success: false,
          message: 'Feedback must be either GOOD or BAD',
        });
      }

      const message = await messageService.addFeedback(id, feedback, note);

      return res.status(200).json({
        success: true,
        data: message,
      });
    } catch (error: any) {
      console.error('Error in addFeedback controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to add feedback',
      });
    }
  }

  /**
   * GET /api/messages/feedback/stats/:companyId
   * Obtém estatísticas de feedback
   */
  async getFeedbackStats(req: Request, res: Response) {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const stats = await messageService.getFeedbackStats(companyId);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error in getFeedbackStats controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get feedback stats',
      });
    }
  }

  /**
   * GET /api/messages/feedback/bad/:companyId
   * Obtém mensagens com feedback negativo
   */
  async getMessagesWithBadFeedback(req: Request, res: Response) {
    try {
      const { companyId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const result = await messageService.getMessagesWithBadFeedback(
        companyId,
        limit,
        offset
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in getMessagesWithBadFeedback controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get messages with bad feedback',
      });
    }
  }
}

export default new MessageController();
