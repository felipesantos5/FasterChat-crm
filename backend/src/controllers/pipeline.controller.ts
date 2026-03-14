import { Request, Response } from 'express';
import { pipelineService } from '../services/pipeline.service';
import { z } from 'zod';

const createStageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  color: z.string().optional(),
});

const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  order: z.number().optional(),
});

const moveCustomerSchema = z.object({
  stageId: z.string().nullable(),
});

const reorderSchema = z.object({
  stageIds: z.array(z.string()),
});

class PipelineController {
  /**
   * GET /api/pipeline/stages
   * Lista todos os estágios da empresa
   */
  async getStages(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const stages = await pipelineService.findAll(companyId);

      return res.status(200).json({
        success: true,
        data: stages,
      });
    } catch (error: any) {
      console.error('Error getting stages:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar estágios',
      });
    }
  }

  /**
   * POST /api/pipeline/stages
   * Cria um novo estágio
   */
  async createStage(req: Request, res: Response) {
    try {
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const data = createStageSchema.parse(req.body);
      const stage = await pipelineService.create(companyId, data);

      return res.status(201).json({
        success: true,
        data: stage,
      });
    } catch (error: any) {
      console.error('Error creating stage:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao criar estágio',
      });
    }
  }

  /**
   * PATCH /api/pipeline/stages/:id
   * Atualiza um estágio
   */
  async updateStage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const data = updateStageSchema.parse(req.body);
      const stage = await pipelineService.update(id, companyId, data);

      return res.status(200).json({
        success: true,
        data: stage,
      });
    } catch (error: any) {
      console.error('Error updating stage:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao atualizar estágio',
      });
    }
  }

  /**
   * DELETE /api/pipeline/stages/:id
   * Deleta um estágio
   */
  async deleteStage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      await pipelineService.delete(id, companyId);

      return res.status(200).json({
        success: true,
        message: 'Estágio deletado com sucesso',
      });
    } catch (error: any) {
      console.error('Error deleting stage:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao deletar estágio',
      });
    }
  }

  /**
   * POST /api/pipeline/stages/reorder
   * Reordena os estágios
   */
  async reorderStages(req: Request, res: Response) {
    try {
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const { stageIds } = reorderSchema.parse(req.body);
      const stages = await pipelineService.reorder(companyId, stageIds);

      return res.status(200).json({
        success: true,
        data: stages,
      });
    } catch (error: any) {
      console.error('Error reordering stages:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao reordenar estágios',
      });
    }
  }

  /**
   * GET /api/pipeline/board
   * Obtém o board do pipeline com clientes por estágio
   */
  async getBoard(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const board = await pipelineService.getCustomersByStage(companyId);

      return res.status(200).json({
        success: true,
        data: board,
      });
    } catch (error: any) {
      console.error('Error getting board:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar board',
      });
    }
  }

  /**
   * PATCH /api/pipeline/customers/:customerId/stage
   * Move um cliente para um estágio
   */
  async moveCustomer(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const { stageId } = moveCustomerSchema.parse(req.body);
      await pipelineService.moveCustomerToStage(customerId, stageId, companyId);

      return res.status(200).json({
        success: true,
        message: 'Cliente movido com sucesso',
      });
    } catch (error: any) {
      console.error('Error moving customer:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao mover cliente',
      });
    }
  }

  /**
   * POST /api/pipeline/init
   * Cria os estágios padrão para uma empresa
   */
  async initPipeline(req: Request, res: Response) {
    try {
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const stages = await pipelineService.createDefaultStages(companyId);

      return res.status(201).json({
        success: true,
        data: stages,
        message: 'Pipeline inicializado com sucesso',
      });
    } catch (error: any) {
      console.error('Error initializing pipeline:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao inicializar pipeline',
      });
    }
  }

  /**
   * POST /api/pipeline/deal-values
   * Registra o valor de uma venda fechada
   */
  async createDealValue(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const companyId = req.user.companyId;

      const schema = z.object({
        customerId: z.string().min(1),
        stageId: z.string().min(1),
        value: z.number().positive(),
        notes: z.string().optional(),
      });

      const { customerId, stageId, value, notes } = schema.parse(req.body);
      const dealValue = await pipelineService.createDealValue(companyId, customerId, stageId, value, notes);

      return res.status(201).json({
        success: true,
        data: dealValue,
      });
    } catch (error: any) {
      console.error('Error creating deal value:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao registrar valor da venda',
      });
    }
  }

  /**
   * GET /api/pipeline/deal-values/stats
   * Retorna estatísticas de lucro/receita
   */
  async getDealValueStats(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const companyId = req.user.companyId;
      const preset = (req.query.preset as string) || '30days';
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (preset === 'custom' && startDateStr && endDateStr) {
        startDate = new Date(startDateStr);
        endDate = new Date(endDateStr);
      } else {
        const now = new Date();
        endDate = now;
        switch (preset) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'yesterday':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case '7days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '3months':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          case 'all':
            startDate = undefined;
            endDate = undefined;
            break;
          default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
      }

      const stats = await pipelineService.getDealValueStats(companyId, startDate, endDate);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting deal value stats:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar estatísticas de vendas',
      });
    }
  }

  /**
   * GET /api/pipeline/deal-values
   * Lista os deal values recentes
   */
  async listDealValues(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const companyId = req.user.companyId;
      const limit = parseInt(req.query.limit as string) || 10;

      const dealValues = await pipelineService.listDealValues(companyId, limit);

      return res.status(200).json({
        success: true,
        data: dealValues,
      });
    } catch (error: any) {
      console.error('Error listing deal values:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao listar valores de vendas',
      });
    }
  }

  /**
   * PUT /api/pipeline/deal-values/:dealId
   * Atualiza uma venda
   */
  async updateDealValue(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const companyId = req.user.companyId;
      const { dealId } = req.params;

      const schema = z.object({
        stageId: z.string().optional(),
        value: z.number().positive().optional(),
        notes: z.string().optional().nullable(),
      });

      const data = schema.parse(req.body);
      const updated = await pipelineService.updateDealValue(companyId, dealId, {
        ...data,
        notes: data.notes ?? undefined,
      });

      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      console.error('Error updating deal value:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao atualizar venda',
      });
    }
  }

  /**
   * DELETE /api/pipeline/deal-values/:dealId
   * Remove uma venda
   */
  async deleteDealValue(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const companyId = req.user.companyId;
      const { dealId } = req.params;

      await pipelineService.deleteDealValue(companyId, dealId);

      return res.status(200).json({ success: true, message: 'Venda removida com sucesso' });
    } catch (error: any) {
      console.error('Error deleting deal value:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao remover venda',
      });
    }
  }

  /**
   * GET /api/pipeline/deal-values/customer/:customerId
   * Lista todas as vendas de um cliente específico
   */
  async getDealValuesByCustomer(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }

      const companyId = req.user.companyId;
      const { customerId } = req.params;

      const dealValues = await pipelineService.getDealValuesByCustomer(companyId, customerId);

      return res.status(200).json({
        success: true,
        data: dealValues,
      });
    } catch (error: any) {
      console.error('Error fetching customer deal values:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar vendas do cliente',
      });
    }
  }
}

export default new PipelineController();
