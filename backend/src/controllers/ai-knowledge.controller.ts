import { Request, Response } from 'express';
import aiKnowledgeService from '../services/ai-knowledge.service';

class AIKnowledgeController {
  /**
   * GET /api/ai/knowledge?companyId=X
   * Obtém a base de conhecimento da empresa
   */
  async getKnowledge(req: Request, res: Response) {
    try {
      const { companyId } = req.query;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const knowledge = await aiKnowledgeService.getKnowledge(companyId as string);

      return res.status(200).json({
        success: true,
        data: knowledge,
      });
    } catch (error: any) {
      console.error('Error in getKnowledge controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get AI knowledge',
      });
    }
  }

  /**
   * PUT /api/ai/knowledge
   * Atualiza a base de conhecimento
   */
  async updateKnowledge(req: Request, res: Response) {
    try {
      const { companyId, companyInfo, productsServices, toneInstructions, policies } = req.body;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const knowledge = await aiKnowledgeService.upsertKnowledge(companyId, {
        companyInfo,
        productsServices,
        toneInstructions,
        policies,
      });

      return res.status(200).json({
        success: true,
        data: knowledge,
      });
    } catch (error: any) {
      console.error('Error in updateKnowledge controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update AI knowledge',
      });
    }
  }
}

export default new AIKnowledgeController();
