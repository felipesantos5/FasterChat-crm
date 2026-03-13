/**
 * AI Debounce Service - Agrupamento inteligente de mensagens
 *
 * Quando o cliente envia várias mensagens seguidas (ex: "Oi", "Tudo bem?", "Queria saber o preço"),
 * este serviço aguarda 35 segundos de silêncio antes de processar todas as mensagens como um bloco único.
 *
 * Usa BullMQ com jobId por customerId para garantir apenas 1 timer ativo por cliente.
 * A cada nova mensagem, o job anterior é removido e um novo é criado com delay de 35s.
 */

import { Queue, Worker, Job } from 'bullmq';
import redisConnection from '../config/redis';
import { prisma } from '../utils/prisma';
import aiService from './ai.service';
import messageService from './message.service';
import conversationService from './conversation.service';
import whatsappService from './whatsapp.service';
import { websocketService } from './websocket.service';
import {
  detectDirectHandoffIntent,
  parseHandoffTokens,
  detectLoopAndRecord,
  clearLoopCache,
} from './handoff-detector.service';

// ==================================================================================
// TIPOS
// ==================================================================================

export interface AIResponseJobData {
  customerId: string;
  companyId: string;
  instanceId: string;
  customerPhone: string;
  isGroup: boolean;
}

// ==================================================================================
// CONFIGURAÇÃO
// ==================================================================================

const AI_DEBOUNCE_DELAY_MS = 35_000; // 35 segundos de silêncio antes de responder
const QUEUE_NAME = 'ai-response-queue';

// Dedup de fallback de erro para não enviar a mesma mensagem de erro em loop
const recentlyFallbackSent = new Map<string, number>();
const FALLBACK_DEDUP_TTL_MS = 300_000; // 5 minutos

// ==================================================================================
// SERVIÇO
// ==================================================================================

class AIDebounceService {
  private queue: Queue<AIResponseJobData>;
  private worker?: Worker<AIResponseJobData>;

  constructor() {
    this.queue = new Queue<AIResponseJobData>(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600 }, // 1 hora
        removeOnFail: { age: 86400 }, // 1 dia
      },
    });
  }

  /**
   * Agenda (ou reagenda) uma resposta de IA para o cliente.
   * Se já existe um job pendente, remove e cria um novo com delay resetado.
   */
  async scheduleResponse(data: AIResponseJobData): Promise<void> {
    const jobId = `ai-debounce:${data.customerId}`;

    // Remove job pendente anterior (se existir) para resetar o timer
    try {
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'delayed' || state === 'waiting') {
          await existingJob.remove();
        }
      }
    } catch {
      // Job pode não existir mais — seguro ignorar
    }

    // Agenda novo job com delay de 35 segundos
    await this.queue.add('process-ai-response', data, {
      jobId,
      delay: AI_DEBOUNCE_DELAY_MS,
    });
  }

  /**
   * Cancela qualquer job pendente para um customer (ex: atendente assumiu).
   */
  async cancelPending(customerId: string): Promise<void> {
    const jobId = `ai-debounce:${customerId}`;
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'delayed' || state === 'waiting') {
          await job.remove();
        }
      }
    } catch {
      // Seguro ignorar
    }
  }

  /**
   * Busca todas as mensagens INBOUND não respondidas do cliente
   * (todas enviadas após a última OUTBOUND).
   */
  private async getUnprocessedMessages(customerId: string): Promise<string[]> {
    // Busca a última mensagem OUTBOUND (resposta anterior)
    const lastOutbound = await prisma.message.findFirst({
      where: {
        customerId,
        direction: 'OUTBOUND',
      },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    // Busca todas as INBOUND depois da última OUTBOUND
    const inboundMessages = await prisma.message.findMany({
      where: {
        customerId,
        direction: 'INBOUND',
        ...(lastOutbound ? { timestamp: { gt: lastOutbound.timestamp } } : {}),
      },
      orderBy: { timestamp: 'asc' },
      select: { content: true },
    });

    return inboundMessages
      .map((m) => m.content)
      .filter((c): c is string => !!c && c.trim().length > 0);
  }

  /**
   * Processa o job: agrupa mensagens e gera resposta da IA.
   */
  private async processJob(job: Job<AIResponseJobData>): Promise<void> {
    const { customerId, companyId, instanceId, customerPhone } = job.data;

    // Verifica se a IA ainda está habilitada para esta conversa
    const conversation = await prisma.conversation.findUnique({
      where: { customerId },
      select: { aiEnabled: true },
    });

    if (!conversation || !conversation.aiEnabled) {
      return;
    }

    // Verifica se auto-reply ainda está ativo
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: { autoReplyEnabled: true },
    });

    if (!aiKnowledge?.autoReplyEnabled) {
      return;
    }

    // Busca todas as mensagens não respondidas
    const messages = await this.getUnprocessedMessages(customerId);

    if (messages.length === 0) {
      return;
    }

    // Concatena as mensagens em um bloco único
    const consolidatedMessage = messages.length === 1
      ? messages[0]
      : messages.map((m, i) => `[Mensagem ${i + 1}]: ${m}`).join('\n');

    try {
      // 📅 PRIORITY CHECK: Verifica se está em fluxo de agendamento ativo
      const { aiAppointmentService } = await import('./ai-appointment.service');
      const hasActiveFlow = await aiAppointmentService.hasActiveAppointmentFlow(customerId);

      if (hasActiveFlow) {
        const appointmentResult = await aiAppointmentService.processAppointmentMessage(
          customerId,
          companyId,
          consolidatedMessage
        );

        if (appointmentResult.shouldContinue && appointmentResult.response) {
          await messageService.sendMessage(customerId, appointmentResult.response, 'AI');
        }
        return;
      }

      // 🛡️ CAMADA 1: Detecção de intenção direta de handoff
      // Verifica na última mensagem (mais recente) se pede atendente
      const lastMessage = messages[messages.length - 1];
      if (detectDirectHandoffIntent(lastMessage)) {
        const handoffMessage = 'Entendi! Vou te transferir para um atendente agora. Aguarde um momento, por favor. 🙏';
        await messageService.sendMessage(customerId, handoffMessage, 'AI');
        await conversationService.toggleAI(customerId, false);
        await prisma.conversation.update({
          where: { customerId },
          data: { needsHelp: true },
        });
        clearLoopCache(customerId);
        websocketService.emitTypingIndicator(companyId, customerId, false);
        websocketService.emitConversationUpdate(companyId, customerId, {
          aiEnabled: false,
          needsHelp: true,
          handoffReason: 'Solicitação direta do cliente para falar com humano',
        });
        return;
      }

      // ⏱️ Gera resposta da IA
      websocketService.emitTypingIndicator(companyId, customerId, true);
      whatsappService.sendPresence(instanceId, customerPhone, 25_000, 'composing').catch(() => {});

      const aiResponse = await aiService.generateResponse(customerId, consolidatedMessage);

      websocketService.emitTypingIndicator(companyId, customerId, false);

      // COMANDO ESPECIAL: Agendamento
      if (aiResponse.startsWith('[INICIAR_AGENDAMENTO]')) {
        const aiMessage = aiResponse.replace('[INICIAR_AGENDAMENTO]', '').trim();
        if (aiMessage) {
          await messageService.sendMessage(customerId, aiMessage, 'AI');
        }

        const appointmentResult = await aiAppointmentService.startAppointmentFlow(
          customerId,
          companyId,
          consolidatedMessage
        );

        if (appointmentResult.response) {
          await messageService.sendMessage(customerId, appointmentResult.response, 'AI');
        }
      } else {
        // 🛡️ CAMADA 2: Tokens de handoff na resposta da IA
        const handoff = parseHandoffTokens(aiResponse);

        // 🛡️ CAMADA 3: Detecção de loop semântico
        const isLoop = !handoff.shouldHandoff && detectLoopAndRecord(customerId, handoff.cleanMessage);

        if (handoff.shouldHandoff || isLoop) {
          const reason = isLoop ? 'Loop de IA detectado — respostas repetitivas' : handoff.reason;

          const messageToSend = isLoop && !handoff.shouldHandoff
            ? 'Percebi que não estou conseguindo resolver sua dúvida da melhor forma. Vou transferir você para um atendente que poderá te ajudar. Aguarde um momento! 🙏'
            : handoff.cleanMessage;

          await messageService.sendMessage(customerId, messageToSend, 'AI');
          await conversationService.toggleAI(customerId, false);
          await prisma.conversation.update({
            where: { customerId },
            data: { needsHelp: true },
          });
          clearLoopCache(customerId);
          websocketService.emitTypingIndicator(companyId, customerId, false);
          websocketService.emitConversationUpdate(companyId, customerId, {
            aiEnabled: false,
            needsHelp: true,
            handoffReason: reason,
          });
        } else {
          // Resposta normal da IA
          await messageService.sendMessage(customerId, handoff.cleanMessage, 'AI');
        }
      }

      // IA respondeu → marca mensagens inbound como lidas
      messageService.markAsRead(customerId, instanceId).catch(() => {});

    } catch (aiError: unknown) {
      const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);

      // Erros de regra de negócio: não enviar fallback ao cliente
      const isSilentError =
        errorMessage.includes('FREE plan') ||
        errorMessage.includes('Auto-reply is disabled') ||
        errorMessage.includes('AI is disabled') ||
        errorMessage.includes('not configured');

      if (isSilentError) {
        console.error('AI skipped (business rule):', errorMessage);
      } else {
        console.error('Error processing AI debounce response:', errorMessage);
        const fallbackKey = customerId;
        const lastFallback = recentlyFallbackSent.get(fallbackKey);
        const nowFallback = Date.now();
        if (!lastFallback || nowFallback - lastFallback > FALLBACK_DEDUP_TTL_MS) {
          recentlyFallbackSent.set(fallbackKey, nowFallback);
          try {
            await messageService.sendMessage(
              customerId,
              'Desculpe, tive um problema técnico momentâneo. Pode repetir sua mensagem? 🙏',
              'AI'
            );
          } catch (fallbackSendError: unknown) {
            const fallbackMsg = fallbackSendError instanceof Error ? fallbackSendError.message : String(fallbackSendError);
            console.error('Failed to send AI fallback message:', fallbackMsg);
          }
        }
      }
    }
  }

  /**
   * Inicia o worker que processa os jobs da fila.
   */
  startWorker(): void {
    if (this.worker) return;

    this.worker = new Worker<AIResponseJobData>(
      QUEUE_NAME,
      async (job: Job<AIResponseJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 10,
      }
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[AIDebounce] Job ${job?.id} failed:`, err.message);
    });
  }

  /**
   * Para o worker e fecha a fila.
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = undefined;
    }
    await this.queue.close();
  }
}

// Singleton
export const aiDebounceService = new AIDebounceService();
export default aiDebounceService;
