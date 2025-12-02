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
}

export default new PipelineController();
