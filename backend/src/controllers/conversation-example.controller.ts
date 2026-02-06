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
   * POST /api/ai/examples/synthetic
   * Cria um exemplo de conversa sintético
   */
  async createSyntheticExample(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const { customerName, messages, notes } = req.body;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in token',
        });
      }

      if (!customerName || !messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'customerName and messages array are required',
        });
      }

      const example = await conversationExampleService.createSyntheticExample(
        companyId,
        { customerName, messages, notes }
      );

      return res.status(201).json({
        success: true,
        data: example,
      });
    } catch (error: any) {
      console.error('Error in createSyntheticExample controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create synthetic example',
      });
    }
  }

  /**
   * DELETE /api/ai/examples/:id
   * Deleta um exemplo de conversa
   */
  async deleteSyntheticExample(req: Request, res: Response) {
    try {
      const { id: exampleId } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in token',
        });
      }

      if (!exampleId) {
        return res.status(400).json({
          success: false,
          message: 'Example ID is required',
        });
      }

      await conversationExampleService.deleteSyntheticExample(exampleId, companyId);

      return res.status(200).json({
        success: true,
        message: 'Example deleted successfully',
      });
    } catch (error: any) {
      console.error('Error in deleteSyntheticExample controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete example',
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
