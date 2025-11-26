import { Request, Response } from 'express';
import campaignService from '../services/campaign.service';
import { CampaignType } from '@prisma/client';

class CampaignController {
  /**
   * Cria uma nova campanha
   * POST /api/campaigns
   */
  async create(req: Request, res: Response) {
    try {
      console.log('[Campaign Controller] Create request body:', JSON.stringify(req.body, null, 2));

      const { companyId, name, messageTemplate, targetTags, type, scheduledAt } = req.body;

      // Validações
      if (!companyId || !name || !messageTemplate || !targetTags || !type) {
        console.log('[Campaign Controller] Missing fields:', { companyId, name, messageTemplate, targetTags, type });
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      if (!Array.isArray(targetTags)) {
        return res.status(400).json({
          success: false,
          message: 'targetTags must be an array',
        });
      }

      const validTypes = ['MANUAL', 'SCHEDULED'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid campaign type. Must be MANUAL or SCHEDULED',
        });
      }

      // Se for SCHEDULED, valida scheduledAt
      if (type === CampaignType.SCHEDULED && !scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'scheduledAt is required for SCHEDULED campaigns',
        });
      }

      const campaign = await campaignService.create({
        companyId,
        name,
        messageTemplate,
        targetTags,
        type,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      });

      return res.status(201).json({
        success: true,
        data: campaign,
      });
    } catch (error: any) {
      console.error('Error in create campaign:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Lista todas as campanhas de uma empresa
   * GET /api/campaigns?companyId=xxx&limit=20&offset=0
   */
  async findAll(req: Request, res: Response) {
    try {
      const { companyId, limit = '20', offset = '0' } = req.query;

      if (!companyId || typeof companyId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'companyId is required',
        });
      }

      const result = await campaignService.findAll(
        companyId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in findAll campaigns:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Busca uma campanha por ID
   * GET /api/campaigns/:id
   */
  async findById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const campaign = await campaignService.findById(id);

      return res.status(200).json({
        success: true,
        data: campaign,
      });
    } catch (error: any) {
      console.error('Error in findById campaign:', error);
      return res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Atualiza uma campanha
   * PUT /api/campaigns/:id
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const campaign = await campaignService.update(id, updateData);

      return res.status(200).json({
        success: true,
        data: campaign,
      });
    } catch (error: any) {
      console.error('Error in update campaign:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Deleta uma campanha
   * DELETE /api/campaigns/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await campaignService.delete(id);

      return res.status(200).json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error: any) {
      console.error('Error in delete campaign:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Estima o alcance de uma campanha (quantos clientes serão alcançados)
   * POST /api/campaigns/estimate
   */
  async estimateReach(req: Request, res: Response) {
    try {
      const { companyId, targetTags } = req.body;

      if (!companyId || !targetTags) {
        return res.status(400).json({
          success: false,
          message: 'companyId and targetTags are required',
        });
      }

      if (!Array.isArray(targetTags)) {
        return res.status(400).json({
          success: false,
          message: 'targetTags must be an array',
        });
      }

      const estimate = await campaignService.estimateReach(companyId, targetTags);

      return res.status(200).json({
        success: true,
        data: estimate,
      });
    } catch (error: any) {
      console.error('Error in estimateReach:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Dispara uma campanha imediatamente (Envio Manual)
   * POST /api/campaigns/:id/send-now
   */
  async sendNow(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Inicia o processamento em background (não bloqueia a resposta)
      campaignService
        .processCampaign(id)
        .then((result) => {
          console.log(`Campaign ${id} completed:`, result);
        })
        .catch((error) => {
          console.error(`Campaign ${id} failed:`, error);
        });

      return res.status(202).json({
        success: true,
        message: 'Campaign processing started',
      });
    } catch (error: any) {
      console.error('Error in sendNow campaign:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Cancela uma campanha
   * POST /api/campaigns/:id/cancel
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await campaignService.cancel(id);

      return res.status(200).json({
        success: true,
        message: 'Campaign canceled successfully',
      });
    } catch (error: any) {
      console.error('Error in cancel campaign:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }
}

export default new CampaignController();
