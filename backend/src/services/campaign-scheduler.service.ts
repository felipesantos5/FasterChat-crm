/**
 * Campaign Scheduler Service
 *
 * Serviço de backup para verificar e executar campanhas agendadas
 * que podem ter falhado no BullMQ ou foram criadas sem agendamento no Redis.
 *
 * Este serviço roda periodicamente (a cada minuto) e verifica:
 * 1. Campanhas SCHEDULED com status PENDING
 * 2. Cujo scheduledAt já passou
 * 3. E que ainda não foram processadas
 *
 * Fuso horário: America/Sao_Paulo (Brasília)
 */

import { prisma } from '../utils/prisma';
import { CampaignStatus, CampaignType } from '@prisma/client';
import campaignExecutionService from './campaign-execution.service';

class CampaignSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Inicia o scheduler que roda a cada minuto
   */
  start() {
    if (this.intervalId) {
      return;
    }


    // Executa imediatamente na inicialização
    this.checkPendingCampaigns();

    // Configura intervalo de 1 minuto (60000ms)
    this.intervalId = setInterval(() => {
      this.checkPendingCampaigns();
    }, 60000);
  }

  /**
   * Para o scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Verifica campanhas pendentes que deveriam ser executadas
   */
  private async checkPendingCampaigns() {
    // Evita execuções simultâneas
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();

      // Busca campanhas SCHEDULED com status PENDING cujo scheduledAt já passou
      const pendingCampaigns = await prisma.campaign.findMany({
        where: {
          type: CampaignType.SCHEDULED,
          status: CampaignStatus.PENDING,
          scheduledAt: {
            lte: now, // scheduledAt <= agora
          },
        },
        orderBy: {
          scheduledAt: 'asc', // Processa as mais antigas primeiro
        },
      });

      if (pendingCampaigns.length > 0) {

        for (const campaign of pendingCampaigns) {
          try {

            // Executa a campanha via BullMQ
            await campaignExecutionService.executeCampaign(campaign.id);

          } catch (error: any) {
            console.error(`[Campaign Scheduler] ❌ Failed to execute campaign ${campaign.id}:`, error.message);

            // Se a campanha já está processando ou foi completada, não é um erro real
            if (error.message.includes('already processing') || error.message.includes('already completed')) {
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[Campaign Scheduler] Error checking pending campaigns:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Força verificação manual (útil para testes)
   */
  async forceCheck() {
    await this.checkPendingCampaigns();
  }

  /**
   * Retorna estatísticas do scheduler
   */
  async getStats() {
    const now = new Date();

    const [pending, upcoming, completed, processing] = await Promise.all([
      // Campanhas pendentes que deveriam ter sido executadas
      prisma.campaign.count({
        where: {
          type: CampaignType.SCHEDULED,
          status: CampaignStatus.PENDING,
          scheduledAt: { lte: now },
        },
      }),
      // Campanhas agendadas para o futuro
      prisma.campaign.count({
        where: {
          type: CampaignType.SCHEDULED,
          status: CampaignStatus.PENDING,
          scheduledAt: { gt: now },
        },
      }),
      // Campanhas completadas hoje
      prisma.campaign.count({
        where: {
          type: CampaignType.SCHEDULED,
          status: CampaignStatus.COMPLETED,
          completedAt: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
          },
        },
      }),
      // Campanhas em processamento
      prisma.campaign.count({
        where: {
          status: CampaignStatus.PROCESSING,
        },
      }),
    ]);

    return {
      pendingOverdue: pending,
      upcomingScheduled: upcoming,
      completedToday: completed,
      currentlyProcessing: processing,
      schedulerRunning: !!this.intervalId,
      lastCheck: new Date().toISOString(),
    };
  }
}

export default new CampaignSchedulerService();
