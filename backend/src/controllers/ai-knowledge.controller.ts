import { Request, Response } from 'express';
import aiKnowledgeService from '../services/ai-knowledge.service';

/**
 * Parse JSON de forma segura, retornando valor padrão em caso de erro
 */
function safeJsonParse(value: any, defaultValue: any = []): any {
  if (!value) return defaultValue;

  // Se já é um objeto/array, retorna direto
  if (typeof value === 'object') return value;

  // Se é string, tenta fazer parse
  if (typeof value === 'string') {
    try {
      // Verifica se a string não está vazia
      const trimmed = value.trim();
      if (!trimmed || trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
        return defaultValue;
      }
      return JSON.parse(trimmed);
    } catch (e) {
      console.warn('Failed to parse JSON:', value, e);
      return defaultValue;
    }
  }

  return defaultValue;
}

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

      console.log(`[AI Knowledge Controller] Get knowledge - Products:`, JSON.stringify(knowledge?.products, null, 2));

      // O service já retorna os dados no formato correto
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
   *
   * NOTA: Campos removidos (hardcoded no sistema):
   * - aiPersonality, toneInstructions: Comportamento é fixo
   * - temperature, maxTokens: Valores otimizados fixos
   */
  async updateKnowledge(req: Request, res: Response) {
    try {
      const {
        companyId,
        // Informações da empresa
        companyName,
        companySegment,
        companyDescription,
        companyInfo,
        // Objetivo da IA
        objectiveType,
        aiObjective,
        // Políticas
        policies,
        workingHours,
        businessHoursStart,
        businessHoursEnd,
        paymentMethods,
        deliveryInfo,
        warrantyInfo,
        // Área de atendimento
        serviceArea,
        // Produtos
        productsServices,
        products,
        // Configurações adicionais
        negativeExamples,
        faq,
        // Status do onboarding
        setupCompleted,
        setupStep,
        // Configurações avançadas (apenas provider, model e autoReply)
        provider,
        model,
        autoReplyEnabled,
      } = req.body;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      console.log('[AI Knowledge Controller] Updating knowledge:', {
        companyId,
        companyName,
        companySegment,
        setupStep,
        setupCompleted,
        productsCount: products?.length,
      });

      const knowledge = await aiKnowledgeService.upsertKnowledge(companyId, {
        companyName,
        companySegment,
        companyDescription,
        companyInfo,
        objectiveType,
        aiObjective,
        policies,
        workingHours,
        businessHoursStart,
        businessHoursEnd,
        paymentMethods,
        deliveryInfo,
        warrantyInfo,
        serviceArea,
        productsServices,
        products,
        negativeExamples,
        faq,
        setupCompleted,
        setupStep,
        provider,
        model,
        autoReplyEnabled,
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

  /**
   * POST /api/ai/knowledge/generate-context
   * Gera um contexto completo usando IA
   */
  async generateContext(req: Request, res: Response) {
    try {
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      console.log('[AI Knowledge Controller] Generating context for company:', companyId);

      const result = await aiKnowledgeService.generateContext(companyId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in generateContext controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate context',
      });
    }
  }

  /**
   * GET /api/ai/knowledge/objective-presets
   * Retorna a lista de objetivos pré-definidos para o frontend
   */
  async getObjectivePresets(_req: Request, res: Response) {
    try {
      const presets = aiKnowledgeService.getObjectivePresets();

      return res.status(200).json({
        success: true,
        data: presets,
      });
    } catch (error: any) {
      console.error('Error in getObjectivePresets controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get objective presets',
      });
    }
  }
}

export default new AIKnowledgeController();
