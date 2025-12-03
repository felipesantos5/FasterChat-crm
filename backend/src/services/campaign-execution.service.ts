/**
 * Campaign Execution Service - Sistema de Disparos em Massa com BullMQ
 *
 * Features:
 * - ✅ Disparo manual (Black Friday, promoções)
 * - ✅ Disparo agendado (manutenção preventiva, follow-up)
 * - ✅ Throttling inteligente (evita ban do WhatsApp)
 * - ✅ Retry automático em caso de falha
 * - ✅ Logs detalhados por destinatário
 * - ✅ Monitoramento em tempo real
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../utils/prisma';
import redisConnection from '../config/redis';
import messageService from './message.service';
import { CampaignStatus, CampaignLogStatus } from '@prisma/client';

// Tipos
interface CampaignJobData {
  campaignId: string;
  companyId: string;
}

interface SendMessageJobData {
  campaignId: string;
  companyId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  message: string;
}

class CampaignExecutionService {
  private campaignQueue: Queue<CampaignJobData>;
  private messageQueue: Queue<SendMessageJobData>;
  private campaignWorker?: Worker<CampaignJobData>;
  private messageWorker?: Worker<SendMessageJobData>;

  constructor() {
    // Fila para processar campanhas (cria os jobs de envio)
    this.campaignQueue = new Queue<CampaignJobData>('campaign-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // Mantém por 7 dias
        },
        removeOnFail: {
          age: 30 * 24 * 3600, // Mantém por 30 dias
        },
      },
    });

    // Fila para enviar mensagens individuais (com rate limiting)
    this.messageQueue = new Queue<SendMessageJobData>('campaign-messages', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600,
        },
        removeOnFail: {
          age: 30 * 24 * 3600,
        },
      },
    });

    console.log('✅ Campaign queues initialized');
  }

  /**
   * Inicia os workers para processar as filas
   */
  startWorkers() {
    // Worker para processar campanhas (gera jobs de envio)
    this.campaignWorker = new Worker<CampaignJobData>(
      'campaign-processing',
      async (job: Job<CampaignJobData>) => {
        return this.processCampaign(job);
      },
      {
        connection: redisConnection,
        concurrency: 2, // Processa 2 campanhas simultaneamente
      }
    );

    // Worker para enviar mensagens (com throttling)
    this.messageWorker = new Worker<SendMessageJobData>(
      'campaign-messages',
      async (job: Job<SendMessageJobData>) => {
        return this.sendCampaignMessage(job);
      },
      {
        connection: redisConnection,
        concurrency: 5, // Envia até 5 mensagens simultaneamente
        limiter: {
          max: 20, // Máximo 20 mensagens
          duration: 60000, // Por minuto (evita ban do WhatsApp)
        },
      }
    );

    // Event listeners
    this.campaignWorker.on('completed', (job) => {
      console.log(`✅ Campaign ${job.data.campaignId} processed successfully`);
    });

    this.campaignWorker.on('failed', (job, err) => {
      console.error(`❌ Campaign ${job?.data.campaignId} processing failed:`, err.message);
    });

    this.messageWorker.on('completed', (job) => {
      console.log(`📤 Message sent to ${job.data.customerName}`);
    });

    this.messageWorker.on('failed', (job, err) => {
      console.error(`❌ Failed to send to ${job?.data.customerName}:`, err.message);
    });

    console.log('✅ Campaign workers started');
  }

  /**
   * Para os workers (para shutdown graceful)
   */
  async stopWorkers() {
    if (this.campaignWorker) {
      await this.campaignWorker.close();
    }
    if (this.messageWorker) {
      await this.messageWorker.close();
    }
    console.log('Workers stopped');
  }

  /**
   * Executa uma campanha (disparo manual ou agendado)
   */
  async executeCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === CampaignStatus.PROCESSING) {
      throw new Error('Campaign is already processing');
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new Error('Campaign already completed');
    }

    // Atualiza status para PENDING (aguardando processamento)
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.PENDING,
      },
    });

    // Adiciona job na fila de processamento
    await this.campaignQueue.add(
      'process-campaign',
      {
        campaignId: campaign.id,
        companyId: campaign.companyId,
      },
      {
        jobId: `campaign-${campaignId}`, // Evita duplicatas
      }
    );

    console.log(`📋 Campaign ${campaignId} queued for execution`);
  }

  /**
   * Processa uma campanha: busca destinatários e cria jobs de envio
   */
  private async processCampaign(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId, companyId } = job.data;

    console.log(`📋 Processing campaign ${campaignId}`);

    // Atualiza status para PROCESSING
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Busca destinatários baseado nas tags
      let customers;

      if (campaign.targetTags.length === 0) {
        // Se não tem tags, envia para todos os clientes (exceto grupos)
        customers = await prisma.customer.findMany({
          where: {
            companyId,
            isGroup: false,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            tags: true,
          },
        });
      } else {
        // Busca clientes que têm QUALQUER uma das tags especificadas
        customers = await prisma.customer.findMany({
          where: {
            companyId,
            isGroup: false,
            OR: campaign.targetTags.map(tag => ({
              tags: {
                has: tag,
              },
            })),
          },
          select: {
            id: true,
            name: true,
            phone: true,
            tags: true,
          },
        });
      }

      console.log(`👥 Found ${customers.length} recipients for campaign ${campaignId}`);

      // Atualiza total de destinatários
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          totalTarget: customers.length,
        },
      });

      // Cria logs e jobs para cada destinatário
      for (const customer of customers) {
        // Personaliza mensagem (substitui variáveis)
        const personalizedMessage = this.personalizeMessage(
          campaign.messageTemplate,
          customer
        );

        // Cria log no banco
        await prisma.campaignLog.create({
          data: {
            campaignId,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            message: personalizedMessage,
            status: CampaignLogStatus.PENDING,
          },
        });

        // Adiciona job na fila de mensagens com delay variável (throttling)
        const randomDelay = this.getRandomDelay();

        await this.messageQueue.add(
          'send-message',
          {
            campaignId,
            companyId,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            message: personalizedMessage,
          },
          {
            jobId: `campaign-${campaignId}-customer-${customer.id}`,
            delay: randomDelay,
          }
        );
      }

      console.log(`✅ Campaign ${campaignId}: ${customers.length} messages queued`);
    } catch (error: any) {
      console.error(`❌ Error processing campaign ${campaignId}:`, error);

      // Marca campanha como FAILED
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.FAILED,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Envia uma mensagem individual da campanha
   */
  private async sendCampaignMessage(job: Job<SendMessageJobData>): Promise<void> {
    const { campaignId, companyId, customerId, customerName, customerPhone, message } = job.data;

    try {
      console.log(`📤 Sending campaign message to ${customerName} (${customerPhone})`);

      // Busca instância WhatsApp da empresa
      const whatsappInstance = await prisma.whatsAppInstance.findFirst({
        where: {
          companyId,
          status: 'CONNECTED',
        },
      });

      if (!whatsappInstance) {
        throw new Error('No connected WhatsApp instance found');
      }

      // Envia mensagem via messageService
      await messageService.sendMessage(customerId, message, 'HUMAN');

      // Atualiza log como SENT
      await prisma.campaignLog.updateMany({
        where: {
          campaignId,
          customerId,
        },
        data: {
          status: CampaignLogStatus.SENT,
          sentAt: new Date(),
        },
      });

      // Incrementa contador de enviados
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          sentCount: {
            increment: 1,
          },
        },
      });

      // Verifica se a campanha terminou
      await this.checkCampaignCompletion(campaignId);
    } catch (error: any) {
      console.error(`❌ Failed to send message to ${customerName}:`, error);

      // Atualiza log como FAILED
      await prisma.campaignLog.updateMany({
        where: {
          campaignId,
          customerId,
        },
        data: {
          status: CampaignLogStatus.FAILED,
          error: error.message,
        },
      });

      // Incrementa contador de falhas
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          failedCount: {
            increment: 1,
          },
        },
      });

      // Verifica se a campanha terminou (mesmo com falha)
      await this.checkCampaignCompletion(campaignId);

      throw error;
    }
  }

  /**
   * Verifica se a campanha terminou (todos enviados ou falharam)
   */
  private async checkCampaignCompletion(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) return;

    const totalProcessed = campaign.sentCount + campaign.failedCount;

    if (totalProcessed >= campaign.totalTarget) {
      console.log(`✅ Campaign ${campaignId} completed: ${campaign.sentCount} sent, ${campaign.failedCount} failed`);

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Personaliza mensagem com variáveis do cliente
   */
  private personalizeMessage(template: string, customer: { name: string; phone: string }): string {
    return template
      .replace(/\{\{nome\}\}/gi, customer.name || '')
      .replace(/\{\{name\}\}/gi, customer.name || '')
      .replace(/\{\{telefone\}\}/gi, customer.phone || '')
      .replace(/\{\{phone\}\}/gi, customer.phone || '');
  }

  /**
   * Retorna delay aleatório para throttling (evita ban)
   * Varia entre 3 e 8 segundos
   */
  private getRandomDelay(): number {
    return Math.floor(Math.random() * 5000) + 3000; // 3-8 segundos
  }

  /**
   * Agenda uma campanha para execução futura
   */
  async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Atualiza campanha com data agendada
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        type: 'SCHEDULED',
        scheduledAt,
        status: CampaignStatus.PENDING,
      },
    });

    // Calcula delay até o horário agendado
    const delay = scheduledAt.getTime() - Date.now();

    if (delay < 0) {
      throw new Error('Scheduled time must be in the future');
    }

    // Adiciona job com delay
    await this.campaignQueue.add(
      'process-campaign',
      {
        campaignId: campaign.id,
        companyId: campaign.companyId,
      },
      {
        jobId: `campaign-${campaignId}`,
        delay,
      }
    );

    console.log(`📅 Campaign ${campaignId} scheduled for ${scheduledAt.toISOString()}`);
  }

  /**
   * Cancela uma campanha em execução ou agendada
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new Error('Cannot cancel completed campaign');
    }

    // Remove job da fila (se existir)
    const jobId = `campaign-${campaignId}`;
    const job = await this.campaignQueue.getJob(jobId);

    if (job) {
      await job.remove();
    }

    // Atualiza status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.CANCELED,
        completedAt: new Date(),
      },
    });

    console.log(`🚫 Campaign ${campaignId} canceled`);
  }

  /**
   * Retorna estatísticas de uma campanha
   */
  async getCampaignStats(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        logs: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const stats = {
      total: campaign.totalTarget,
      sent: campaign.sentCount,
      failed: campaign.failedCount,
      pending: campaign.totalTarget - (campaign.sentCount + campaign.failedCount),
      successRate: campaign.totalTarget > 0
        ? ((campaign.sentCount / campaign.totalTarget) * 100).toFixed(2) + '%'
        : '0%',
      status: campaign.status,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
    };

    return stats;
  }

  /**
   * Retorna logs detalhados de uma campanha
   */
  async getCampaignLogs(campaignId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.campaignLog.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.campaignLog.count({
        where: { campaignId },
      }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export default new CampaignExecutionService();
