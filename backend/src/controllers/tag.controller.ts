import { Request, Response } from 'express';
import tagService from '../services/tag.service';

class TagController {
  /**
   * Cria uma nova tag
   * POST /api/tags
   */
  async create(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
      }

      const { name, color } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Nome da tag é obrigatório',
        });
      }

      console.log('[Tag Controller] Creating tag:', { name, color, companyId: req.user.companyId });

      const tag = await tagService.createOrGet(req.user.companyId, name, color);

      return res.status(201).json({
        success: true,
        data: tag,
      });
    } catch (error: any) {
      console.error('Error in create tag:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Lista todas as tags da empresa
   * GET /api/tags
   */
  async findAll(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
      }

      const tags = await tagService.findAll(req.user.companyId);

      return res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error: any) {
      console.error('Error in findAll tags:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Lista apenas os nomes das tags
   * GET /api/tags/names
   */
  async findAllNames(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
      }

      const tags = await tagService.findAllNames(req.user.companyId);

      return res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error: any) {
      console.error('Error in findAllNames tags:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Sincroniza tags dos clientes
   * POST /api/tags/sync
   */
  async syncFromCustomers(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
      }

      const result = await tagService.syncFromCustomers(req.user.companyId);

      return res.status(200).json({
        success: true,
        message: `${result.tagsCount} tags sincronizadas com sucesso`,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in syncFromCustomers:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Deleta uma tag
   * DELETE /api/tags/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await tagService.delete(id);

      return res.status(200).json({
        success: true,
        message: 'Tag deletada com sucesso',
      });
    } catch (error: any) {
      console.error('Error in delete tag:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }
}

export default new TagController();
