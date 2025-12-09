/**
 * Campaign Execution Controller - Endpoints para disparos
 */

import { Request, Response } from 'express';
import campaignExecutionService from '../services/campaign-execution.service';
import { prisma } from '../utils/prisma';

class CampaignExecutionController {
  /**
   * POST /api/campaigns/:id/execute
   * Executa campanha imediatamente (disparo manual)
   */
  async executeCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Valida se a campanha pertence à empresa
      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Executa campanha
      await campaignExecutionService.executeCampaign(id);

      return res.json({
        message: 'Campaign execution started',
        campaignId: id,
        status: 'PENDING',
      });
    } catch (error: any) {
      console.error('[Campaign Execution] Error executing campaign:', error);
      return res.status(500).json({
        error: 'Failed to execute campaign',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/campaigns/:id/schedule
   * Agenda campanha para execução futura
   */
  async scheduleCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { scheduledAt } = req.body;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!scheduledAt) {
        return res.status(400).json({ error: 'scheduledAt is required' });
      }

      // Valida se a campanha pertence à empresa
      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const scheduledDate = new Date(scheduledAt);

      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }

      // Agenda campanha
      await campaignExecutionService.scheduleCampaign(id, scheduledDate);

      return res.json({
        message: 'Campaign scheduled successfully',
        campaignId: id,
        scheduledAt: scheduledDate.toISOString(),
        status: 'PENDING',
      });
    } catch (error: any) {
      console.error('[Campaign Execution] Error scheduling campaign:', error);
      return res.status(500).json({
        error: 'Failed to schedule campaign',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/campaigns/:id/cancel
   * Cancela campanha em execução ou agendada
   */
  async cancelCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Valida se a campanha pertence à empresa
      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Cancela campanha
      await campaignExecutionService.cancelCampaign(id);

      return res.json({
        message: 'Campaign canceled successfully',
        campaignId: id,
        status: 'CANCELED',
      });
    } catch (error: any) {
      console.error('[Campaign Execution] Error canceling campaign:', error);
      return res.status(500).json({
        error: 'Failed to cancel campaign',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/campaigns/:id/stats
   * Retorna estatísticas de execução da campanha
   */
  async getCampaignStats(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Valida se a campanha pertence à empresa
      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Busca estatísticas
      const stats = await campaignExecutionService.getCampaignStats(id);

      return res.json(stats);
    } catch (error: any) {
      console.error('[Campaign Execution] Error getting stats:', error);
      return res.status(500).json({
        error: 'Failed to get campaign stats',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/campaigns/:id/logs
   * Retorna logs detalhados da campanha
   */
  async getCampaignLogs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Valida se a campanha pertence à empresa
      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Busca logs
      const result = await campaignExecutionService.getCampaignLogs(id, page, limit);

      return res.json(result);
    } catch (error: any) {
      console.error('[Campaign Execution] Error getting logs:', error);
      return res.status(500).json({
        error: 'Failed to get campaign logs',
        message: error.message,
      });
    }
  }

  /**
   * POST /api/campaigns/:id/reexecute
   * Reexecuta uma campanha (reseta e executa novamente)
   */
  async reexecuteCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Valida se a campanha pertence à empresa
      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Reexecuta campanha
      await campaignExecutionService.reexecuteCampaign(id);

      return res.json({
        message: 'Campaign reexecution started',
        campaignId: id,
        status: 'PENDING',
      });
    } catch (error: any) {
      console.error('[Campaign Execution] Error reexecuting campaign:', error);
      return res.status(500).json({
        error: 'Failed to reexecute campaign',
        message: error.message,
      });
    }
  }
}

export default new CampaignExecutionController();
