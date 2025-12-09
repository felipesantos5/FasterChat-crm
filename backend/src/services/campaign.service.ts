import { prisma } from '../utils/prisma';
import { CampaignStatus, CampaignType } from '@prisma/client';
import {
  CreateCampaignDTO,
  UpdateCampaignDTO,
  CampaignEstimate,
  CampaignResult,
} from '../types/campaign';
import messageService from './message.service';
import campaignExecutionService from './campaign-execution.service';

class CampaignService {
  /**
   * Cria uma nova campanha
   * Para campanhas SCHEDULED, também agenda automaticamente a execução
   */
  async create(data: CreateCampaignDTO) {
    try {
      // Define o status inicial baseado no tipo
      const initialStatus =
        data.type === CampaignType.MANUAL
          ? CampaignStatus.DRAFT
          : CampaignStatus.PENDING;

      const campaign = await prisma.campaign.create({
        data: {
          companyId: data.companyId,
          name: data.name,
          messageTemplate: data.messageTemplate,
          targetTags: data.targetTags,
          type: data.type,
          status: initialStatus,
          scheduledAt: data.scheduledAt,
        },
        include: {
          company: true,
        },
      });

      // Se for campanha SCHEDULED com data definida, agenda automaticamente
      if (data.type === CampaignType.SCHEDULED && data.scheduledAt) {
        try {
          await campaignExecutionService.scheduleCampaign(campaign.id, data.scheduledAt);
          console.log(`[Campaign] Campanha ${campaign.id} agendada para ${data.scheduledAt.toISOString()}`);
        } catch (scheduleError: any) {
          console.error(`[Campaign] Erro ao agendar campanha ${campaign.id}:`, scheduleError.message);
          // Não lança erro aqui para não falhar a criação da campanha
          // A campanha foi criada, mas o agendamento falhou
        }
      }

      return campaign;
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  }

  /**
   * Busca todas as campanhas de uma empresa com paginação
   */
  async findAll(companyId: string, limit = 20, offset = 0) {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const total = await prisma.campaign.count({
        where: { companyId },
      });

      return {
        campaigns,
        total,
        limit,
        offset,
      };
    } catch (error: any) {
      console.error('Error finding campaigns:', error);
      throw new Error(`Failed to find campaigns: ${error.message}`);
    }
  }

  /**
   * Busca uma campanha por ID
   */
  async findById(id: string) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
          company: true,
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      return campaign;
    } catch (error: any) {
      console.error('Error finding campaign:', error);
      throw new Error(`Failed to find campaign: ${error.message}`);
    }
  }

  /**
   * Atualiza uma campanha
   */
  async update(id: string, data: UpdateCampaignDTO) {
    try {
      const campaign = await prisma.campaign.update({
        where: { id },
        data,
        include: {
          company: true,
        },
      });

      return campaign;
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
  }

  /**
   * Deleta uma campanha
   */
  async delete(id: string) {
    try {
      await prisma.campaign.delete({
        where: { id },
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      throw new Error(`Failed to delete campaign: ${error.message}`);
    }
  }

  /**
   * Estima quantos clientes serão alcançados pela campanha
   */
  async estimateReach(companyId: string, targetTags: string[]): Promise<CampaignEstimate> {
    try {
      if (targetTags.length === 0) {
        return {
          totalCustomers: 0,
          estimatedDuration: 0,
        };
      }

      // Conta clientes que possuem PELO MENOS UMA das tags alvo (lógica OR)
      const totalCustomers = await prisma.customer.count({
        where: {
          companyId,
          tags: {
            hasSome: targetTags,
          },
        },
      });

      // Estima duração: entre 2-5 segundos por mensagem (média de 3.5s)
      const estimatedDuration = Math.ceil(totalCustomers * 3.5);

      return {
        totalCustomers,
        estimatedDuration,
      };
    } catch (error: any) {
      console.error('Error estimating reach:', error);
      throw new Error(`Failed to estimate reach: ${error.message}`);
    }
  }

  /**
   * Processa uma campanha (envia mensagens para todos os clientes alvo)
   */
  async processCampaign(campaignId: string): Promise<CampaignResult> {
    const startTime = Date.now();
    let sentCount = 0;
    let failedCount = 0;

    try {
      // Busca a campanha
      const campaign = await this.findById(campaignId);

      // Valida status
      if (campaign.status === CampaignStatus.PROCESSING) {
        throw new Error('Campaign is already being processed');
      }

      // Campanhas MANUAL podem ser disparadas múltiplas vezes
      // Apenas campanhas SCHEDULED não podem ser re-disparadas após conclusão
      if (
        campaign.type === CampaignType.SCHEDULED &&
        campaign.status === CampaignStatus.COMPLETED
      ) {
        throw new Error('Scheduled campaign has already been completed');
      }

      if (campaign.status === CampaignStatus.CANCELED) {
        throw new Error('Campaign has been canceled');
      }

      // Atualiza status para PROCESSING
      await this.update(campaignId, { status: CampaignStatus.PROCESSING });

      // Busca todos os clientes que possuem pelo menos uma das tags alvo
      const customers = await prisma.customer.findMany({
        where: {
          companyId: campaign.companyId,
          tags: {
            hasSome: campaign.targetTags,
          },
        },
      });

      console.log(`[Campaign ${campaignId}] Processing ${customers.length} customers...`);

      // Itera sobre os clientes e envia as mensagens
      for (const customer of customers) {
        try {
          // Envia a mensagem
          await messageService.sendMessage(
            customer.id,
            campaign.messageTemplate,
            'HUMAN' // Campanhas são enviadas como HUMAN (não IA)
          );

          sentCount++;
          console.log(
            `[Campaign ${campaignId}] Message sent to ${customer.name} (${sentCount}/${customers.length})`
          );

          // Delay artificial entre 2 e 5 segundos para evitar banimento
          const delay = Math.floor(Math.random() * 3000) + 2000; // 2000-5000ms
          await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (error: any) {
          failedCount++;
          console.error(
            `[Campaign ${campaignId}] Failed to send message to ${customer.name}:`,
            error.message
          );
        }
      }

      // Atualiza a campanha com os resultados
      // Campanhas MANUAL voltam para DRAFT para poderem ser disparadas novamente
      // Campanhas SCHEDULED ficam como COMPLETED
      const finalStatus =
        campaign.type === CampaignType.MANUAL
          ? CampaignStatus.DRAFT
          : CampaignStatus.COMPLETED;

      await this.update(campaignId, {
        status: finalStatus,
        sentCount,
        failedCount,
      });

      const duration = Date.now() - startTime;

      console.log(
        `[Campaign ${campaignId}] Completed! Sent: ${sentCount}, Failed: ${failedCount}, Duration: ${Math.round(duration / 1000)}s`
      );

      return {
        campaignId,
        totalSent: sentCount,
        totalFailed: failedCount,
        duration,
      };
    } catch (error: any) {
      console.error(`[Campaign ${campaignId}] Processing failed:`, error);

      // Atualiza status para FAILED
      await this.update(campaignId, {
        status: CampaignStatus.FAILED,
        sentCount,
        failedCount,
      });

      throw new Error(`Failed to process campaign: ${error.message}`);
    }
  }

  /**
   * Cancela uma campanha
   */
  async cancel(id: string) {
    try {
      const campaign = await this.findById(id);

      if (campaign.status === CampaignStatus.PROCESSING) {
        throw new Error('Cannot cancel a campaign that is currently being processed');
      }

      if (campaign.status === CampaignStatus.COMPLETED) {
        throw new Error('Cannot cancel a completed campaign');
      }

      await this.update(id, { status: CampaignStatus.CANCELED });

      return { success: true };
    } catch (error: any) {
      console.error('Error canceling campaign:', error);
      throw new Error(`Failed to cancel campaign: ${error.message}`);
    }
  }
}

export default new CampaignService();
