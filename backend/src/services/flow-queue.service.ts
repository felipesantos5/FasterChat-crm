/**
 * Flow Queue Service - Sistema de filas BullMQ para execução de fluxos
 *
 * 2 Filas:
 * - flow-orchestration: Inicia fluxos (valida phone, cria customer, cria FlowExecution)
 * - flow-step: Executa cada nó do fluxo (message, media, condition, delay, etc.)
 *
 * Cada nó vira um job discreto. Após executar um nó, enfileira o próximo com delay anti-spam.
 * BullMQ controla concorrência globalmente via Redis.
 */

import { Queue, Worker, Job } from 'bullmq';
import redisConnection from '../config/redis';

// ==================================================================================
// TIPOS
// ==================================================================================

export interface FlowStartJobData {
  flowId: string;
  contactPhone: string;
  variables: Record<string, unknown>;
  companyId: string;
}

export interface FlowStepJobData {
  executionId: string;
  nodeId: string;
  sourceHandle?: string;
}

// ==================================================================================
// SERVIÇO
// ==================================================================================

class FlowQueueService {
  private orchestrationQueue: Queue<FlowStartJobData>;
  private stepQueue: Queue<FlowStepJobData>;
  private orchestrationWorker?: Worker<FlowStartJobData>;
  private stepWorker?: Worker<FlowStepJobData>;

  constructor() {
    this.orchestrationQueue = new Queue<FlowStartJobData>('flow-orchestration', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // 7 dias
        },
        removeOnFail: {
          age: 30 * 24 * 3600, // 30 dias
        },
      },
    });

    this.stepQueue = new Queue<FlowStepJobData>('flow-step', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          age: 3 * 24 * 3600, // 3 dias
        },
        removeOnFail: {
          age: 14 * 24 * 3600, // 14 dias
        },
      },
    });
  }

  // ==================================================================================
  // MÉTODOS PÚBLICOS DE ENQUEUE
  // ==================================================================================

  /**
   * Enfileira o início de um fluxo para um contato.
   * O worker de orchestration vai chamar flowEngine.startFlowDirect().
   */
  async enqueueFlowStart(data: FlowStartJobData, options?: { delay?: number }): Promise<void> {
    // Para disparos de planilha, usa jobId determinístico por phone+batch para evitar enfileiramento duplo.
    // Para disparos avulsos (sem batchId), inclui timestamp para permitir re-disparo.
    const batchId = data.variables?._batchId as string | undefined;
    const jobId = batchId
      ? `start_${data.flowId}_${data.contactPhone}_${batchId}`
      : `start_${data.flowId}_${data.contactPhone}_${Date.now()}`;
    await this.orchestrationQueue.add('start-flow', data, {
      jobId,
      delay: options?.delay || 0,
    });
  }

  /**
   * Enfileira a execução de um step (nó) do fluxo.
   * O worker de step vai chamar flowEngine.executeStepFromQueue().
   */
  async enqueueFlowStep(
    data: FlowStepJobData,
    options?: { delay?: number; jobId?: string }
  ): Promise<void> {
    const jobId = options?.jobId || `step_${data.executionId}_${data.nodeId}_${Date.now()}`;
    try {
      await this.stepQueue.add('execute-step', data, {
        jobId,
        delay: options?.delay || 0,
      });
    } catch (err: unknown) {
      // BullMQ pode lançar erro se o jobId já existir em versões antigas.
      // Neste caso, o job já está enfileirado — comportamento idempotente esperado.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already') || message.includes('exists')) {
        return;
      }
      throw err;
    }
  }

  // ==================================================================================
  // MÉTODOS DE CANCELAMENTO
  // ==================================================================================

  /**
   * Remove o job de timeout de um nó condition (quando o cliente responde antes do timeout).
   */
  async removeTimeoutJob(executionId: string, nodeId: string): Promise<void> {
    const jobId = `timeout_${executionId}_${nodeId}`;
    try {
      const job = await this.stepQueue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'delayed' || state === 'waiting') {
          await job.remove();
        }
      }
    } catch { /* falha ao remover timeout job */ }
  }

  /**
   * Remove todos os jobs pendentes de uma execução (quando o fluxo é cancelado ou substituído).
   */
  async removeJobsForExecution(executionId: string): Promise<void> {
    try {
      // Remove delayed jobs da fila de steps
      const delayed = await this.stepQueue.getDelayed();
      for (const job of delayed) {
        if (job.data.executionId === executionId) {
          await job.remove();
        }
      }

      // Remove waiting jobs da fila de steps
      const waiting = await this.stepQueue.getWaiting();
      for (const job of waiting) {
        if (job.data.executionId === executionId) {
          await job.remove();
        }
      }
    } catch { /* falha ao remover jobs da execução */ }
  }

  /**
   * Remove todos os jobs de disparo em massa de um batch pendente (usado no cancelamento).
   */
  async removeOrchestrationJobsForBatch(batchId: string): Promise<void> {
    try {
      const delayed = await this.orchestrationQueue.getDelayed();
      for (const job of delayed) {
        if (job.data.variables?._batchId === batchId) {
          await job.remove();
        }
      }

      const waiting = await this.orchestrationQueue.getWaiting();
      for (const job of waiting) {
        if (job.data.variables?._batchId === batchId) {
          await job.remove();
        }
      }
    } catch { /* falha ao remover jobs do batch */ }
  }

  // ==================================================================================
  // WORKERS
  // ==================================================================================

  /**
   * Inicia os workers de processamento das filas.
   * Deve ser chamado uma vez no startup do servidor.
   */
  startWorkers(): void {
    // Lazy import para evitar circular dependency
    const getFlowEngine = async () => {
      const { FlowEngineService } = await import('./FlowEngineService');
      return new FlowEngineService();
    };

    // Worker de orchestration: inicia fluxos
    this.orchestrationWorker = new Worker<FlowStartJobData>(
      'flow-orchestration',
      async (job: Job<FlowStartJobData>) => {
        const flowEngine = await getFlowEngine();
        await flowEngine.startFlowDirect(job.data);
      },
      {
        connection: redisConnection,
        concurrency: 3,
      }
    );

    // Worker de step: executa nós individuais
    this.stepWorker = new Worker<FlowStepJobData>(
      'flow-step',
      async (job: Job<FlowStepJobData>) => {
        const flowEngine = await getFlowEngine();
        await flowEngine.executeStepFromQueue(
          job.data.executionId,
          job.data.nodeId,
          job.data.sourceHandle
        );
      },
      {
        connection: redisConnection,
        concurrency: 3,
        limiter: {
          max: 20,        // Máximo 20 mensagens
          duration: 60000, // Por minuto (evita ban do WhatsApp)
        },
      }
    );

    // Event listeners
    this.orchestrationWorker.on('failed', (job, err) => {
      console.error(`[FlowQueue] ❌ Orchestration job failed (${job?.data.flowId}): ${err.message}`);
    });

    this.stepWorker.on('failed', (job, err) => {
      console.error(`[FlowQueue] ❌ Step job failed (exec: ${job?.data.executionId}, node: ${job?.data.nodeId}): ${err.message}`);
    });

  }

  /**
   * Para os workers gracefully.
   */
  async stopWorkers(): Promise<void> {
    if (this.orchestrationWorker) {
      await this.orchestrationWorker.close();
    }
    if (this.stepWorker) {
      await this.stepWorker.close();
    }
  }
}

const flowQueueService = new FlowQueueService();
export default flowQueueService;
