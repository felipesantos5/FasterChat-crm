import { Request, Response } from 'express';
import conversationExampleService from '../services/conversation-example.service';

class ConversationExampleController {
  /**
   * POST /api/conversations/:id/mark-example
   * Marca uma conversa como exemplo
   */
  async markAsExample(req: Request, res: Response) {
    try {
      const { id: conversationId } = req.params;
      const { notes } = req.body;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in token',
        });
      }

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required',
        });
      }

      const example = await conversationExampleService.markAsExample(
        companyId,
        conversationId,
        notes
      );

      return res.status(200).json({
        success: true,
        data: example,
      });
    } catch (error: any) {
      console.error('Error in markAsExample controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark conversation as example',
      });
    }
  }

  /**
   * DELETE /api/conversations/:id/mark-example
   * Remove marcação de exemplo de uma conversa
   */
  async removeExample(req: Request, res: Response) {
    try {
      const { id: conversationId } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in token',
        });
      }

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required',
        });
      }

      await conversationExampleService.removeExample(conversationId, companyId);

      return res.status(200).json({
        success: true,
        message: 'Example removed successfully',
      });
    } catch (error: any) {
      console.error('Error in removeExample controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove example',
      });
    }
  }

  /**
   * GET /api/ai/examples
   * Lista todos os exemplos de conversas da empresa
   */
  async getExamples(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in token',
        });
      }

      const examples = await conversationExampleService.getExamples(companyId);

      return res.status(200).json({
        success: true,
        data: examples,
      });
    } catch (error: any) {
      console.error('Error in getExamples controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get examples',
      });
    }
  }

  /**
   * GET /api/conversations/:id/is-example
   * Verifica se uma conversa está marcada como exemplo
   */
  async checkIsExample(req: Request, res: Response) {
    try {
      const { id: conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required',
        });
      }

      const isExample = await conversationExampleService.isMarkedAsExample(conversationId);

      return res.status(200).json({
        success: true,
        data: { isExample },
      });
    } catch (error: any) {
      console.error('Error in checkIsExample controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to check if conversation is example',
      });
    }
  }
}

export default new ConversationExampleController();
