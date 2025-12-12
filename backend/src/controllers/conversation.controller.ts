import { Request, Response } from 'express';
import conversationService from '../services/conversation.service';
import { websocketService } from '../services/websocket.service';

class ConversationController {
  /**
   * GET /api/conversations/:customerId
   * Obtém ou cria uma conversa para um customer
   */
  async getConversation(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const { companyId } = req.query;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const conversation = await conversationService.getOrCreateConversation(
        customerId,
        companyId as string
      );

      return res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      console.error('Error in getConversation controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get conversation',
      });
    }
  }

  /**
   * POST /api/conversations/:customerId/assign
   * Atribui uma conversa a um usuário e desliga a IA
   */
  async assignConversation(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const { userId } = req.body;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      const conversation = await conversationService.assignConversation(
        customerId,
        userId
      );

      return res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      console.error('Error in assignConversation controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to assign conversation',
      });
    }
  }

  /**
   * POST /api/conversations/:customerId/unassign
   * Remove a atribuição e religa a IA
   */
  async unassignConversation(req: Request, res: Response) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
      }

      const conversation = await conversationService.unassignConversation(customerId);

      return res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      console.error('Error in unassignConversation controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to unassign conversation',
      });
    }
  }

  /**
   * GET /api/conversations/assigned/:userId
   * Lista conversas atribuídas a um usuário
   */
  async getAssignedConversations(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      const conversations = await conversationService.getAssignedConversations(userId);

      return res.status(200).json({
        success: true,
        data: conversations,
      });
    } catch (error: any) {
      console.error('Error in getAssignedConversations controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get assigned conversations',
      });
    }
  }

  /**
   * PATCH /api/conversations/:customerId/toggle-ai
   * Ativa/Desativa IA em uma conversa
   */
  async toggleAI(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const { aiEnabled } = req.body;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
      }

      if (typeof aiEnabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'aiEnabled must be a boolean',
        });
      }

      const conversation = await conversationService.toggleAI(customerId, aiEnabled);

      // Emite atualização via WebSocket para atualizar a lista de conversas em tempo real
      if (conversation.customer?.companyId) {
        websocketService.emitConversationUpdate(
          conversation.customer.companyId,
          customerId,
          {
            aiEnabled: conversation.aiEnabled,
            needsHelp: conversation.needsHelp,
          }
        );
      }

      return res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      console.error('Error in toggleAI controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to toggle AI',
      });
    }
  }
}

export default new ConversationController();
