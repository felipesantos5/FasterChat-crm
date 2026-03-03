import { prisma } from '../utils/prisma';
import { FlowExecutionStatus, MessageDirection } from '@prisma/client';
import { FlowEngineService } from './FlowEngineService';

class FlowSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private replyCheckIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isReplyChecking: boolean = false;
  private flowEngine: FlowEngineService;

  constructor() {
    this.flowEngine = new FlowEngineService();
  }

  start() {
    if (this.intervalId) {
      return;
    }

    // Recupera execuções RUNNING órfãs de um restart/deploy anterior
    this.recoverOrphanedExecutions();

    // Verifica timeouts expirados a cada 5 segundos (nao_respondeu + delays)
    this.checkPendingFlows();
    this.intervalId = setInterval(() => {
      this.checkPendingFlows();
    }, 5000);

    // Polling de respostas a cada 60 segundos — safety net para quando o webhook falha
    this.checkWaitingReplies();
    this.replyCheckIntervalId = setInterval(() => {
      this.checkWaitingReplies();
    }, 60000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.replyCheckIntervalId) {
      clearInterval(this.replyCheckIntervalId);
      this.replyCheckIntervalId = null;
    }
  }

  /**
   * Verifica execuções com timeout expirado (nao_respondeu) ou delays vencidos.
   * Roda a cada 5 segundos.
   */
  private async checkPendingFlows() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();

      const pendingExecutions = await prisma.flowExecution.findMany({
        where: {
          resumesAt: { lte: now },
          status: { in: [FlowExecutionStatus.WAITING_REPLY, FlowExecutionStatus.DELAYED] }
        },
        include: { currentNode: true },
        // Processa em lotes para evitar sobrecarregar memória e CPU de uma vez
        take: 50,
        orderBy: { resumesAt: 'asc' },
      });

      for (const execution of pendingExecutions) {
        try {
          if (execution.status === FlowExecutionStatus.WAITING_REPLY) {
            await prisma.flowExecution.update({
              where: { id: execution.id },
              data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
            });

            if (execution.currentNodeId) {
              await this.flowEngine.processNextNodes(execution.id, execution.currentNodeId, 'nao_respondeu');
            }
          } else if (execution.status === FlowExecutionStatus.DELAYED) {
            await prisma.flowExecution.update({
              where: { id: execution.id },
              data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
            });

            if (execution.currentNodeId) {
              await this.flowEngine.processNextNodes(execution.id, execution.currentNodeId);
            }
          }
        } catch (error: any) {
          console.error(`[Flow Scheduler] ❌ Failed to resume flow ${execution.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('[Flow Scheduler] Error checking pending flows:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Polling de segurança: verifica se clientes em WAITING_REPLY já responderam,
   * mesmo que o webhook não tenha disparado corretamente.
   * Roda a cada 60 segundos.
   */
  private async checkWaitingReplies() {
    if (this.isReplyChecking) return;
    this.isReplyChecking = true;

    try {
      const now = new Date();

      // Busca execuções aguardando resposta que ainda NÃO expiraram
      const waitingExecutions = await prisma.flowExecution.findMany({
        where: {
          status: FlowExecutionStatus.WAITING_REPLY,
          resumesAt: { gt: now }
        },
        include: {
          currentNode: true,
          flow: { select: { companyId: true } }
        },
        take: 100,
        orderBy: { updatedAt: 'asc' },
      });

      if (waitingExecutions.length === 0) return;

      for (const execution of waitingExecutions) {
        try {
          const cleanPhone = execution.contactPhone.replace(/\D/g, '');

          // Considera mensagens recebidas desde que a execução entrou em WAITING_REPLY
          // Buffer de 30s para capturar mensagens que chegaram perto do momento da transição
          const checkFrom = new Date(execution.updatedAt.getTime() - 30000);

          // Try exact match first, then fallback with 10+ digit suffix (includes DDD)
          let recentMessage = await prisma.message.findFirst({
            where: {
              direction: MessageDirection.INBOUND,
              timestamp: { gt: checkFrom },
              customer: {
                companyId: execution.flow.companyId,
                phone: cleanPhone
              }
            },
            orderBy: { timestamp: 'desc' }
          });

          if (!recentMessage && cleanPhone.length >= 10) {
            const suffixDigits = cleanPhone.slice(-(Math.min(cleanPhone.length, 11)));
            // SAFETY: Only accept suffix match if it resolves to exactly 1 customer
            // to prevent batch cross-contamination between different contacts
            const suffixCustomers = await prisma.customer.findMany({
              where: {
                companyId: execution.flow.companyId,
                phone: { endsWith: suffixDigits },
              },
              select: { id: true },
              take: 2, // Only need to know if there's more than 1
            });

            if (suffixCustomers.length === 1) {
              recentMessage = await prisma.message.findFirst({
                where: {
                  direction: MessageDirection.INBOUND,
                  timestamp: { gt: checkFrom },
                  customerId: suffixCustomers[0].id,
                },
                orderBy: { timestamp: 'desc' }
              });
            }
          }

          if (!recentMessage) continue;

          // Cliente respondeu! Retoma via "respondeu" (mesmo que o webhook já tenha tratado,
          // a verificação de status garante que não processamos duas vezes)
          const updated = await prisma.flowExecution.updateMany({
            where: {
              id: execution.id,
              status: FlowExecutionStatus.WAITING_REPLY // garante idempotência
            },
            data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
          });

          if (updated.count === 0) continue; // Já foi tratado pelo webhook

          // Determina qual handle seguir (mesmo comportamento do handleIncomingMessage)
          const text = (recentMessage.content || '').toLowerCase().trim();
          let handle = 'respondeu';

          const nodeData = typeof execution.currentNode?.data === 'string'
            ? JSON.parse(execution.currentNode.data)
            : (execution.currentNode?.data || {});

          const keyword = nodeData?.keyword as string | undefined;
          if (keyword) {
            const keywords = keyword.toLowerCase().split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
            if (keywords.some((k: string) => text.includes(k) || text === k)) {
              handle = 'palavra_chave';
            }
          }

          if (execution.currentNodeId) {
            await this.flowEngine.processNextNodes(execution.id, execution.currentNodeId, handle);
          }
        } catch (error: any) {
          console.error(`[Flow Scheduler] ❌ Erro ao verificar resposta para execução ${execution.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('[Flow Scheduler] Erro no polling de respostas:', error.message);
    } finally {
      this.isReplyChecking = false;
    }
  }

  /**
   * Recupera execuções que ficaram com status RUNNING após um restart/deploy.
   * Uma execução RUNNING que não atualizou há mais de 5 minutos está "órfã" —
   * o processo que a executava morreu no deploy.
   *
   * Estratégia: retoma do nó atual (currentNodeId) para continuar de onde parou.
   */
  private async recoverOrphanedExecutions() {
    try {
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutos sem update

      const orphaned = await prisma.flowExecution.findMany({
        where: {
          status: FlowExecutionStatus.RUNNING,
          updatedAt: { lt: staleThreshold },
        },
        include: { currentNode: true },
        take: 100,
        orderBy: { updatedAt: 'asc' },
      });

      if (orphaned.length === 0) return;

      console.log(`[Flow Scheduler] 🔄 Recuperando ${orphaned.length} execução(ões) RUNNING órfã(s) após restart...`);

      for (const execution of orphaned) {
        try {
          if (!execution.currentNodeId) {
            // Sem nó atual — não tem como retomar, marca como falha
            await prisma.flowExecution.update({
              where: { id: execution.id },
              data: {
                status: FlowExecutionStatus.FAILED,
                error: 'Execução interrompida por restart do servidor (sem nó atual para retomar)',
                completedAt: new Date(),
              },
            });
            console.log(`[Flow Scheduler] ❌ Execução ${execution.id} sem currentNode — marcada como FAILED`);
            continue;
          }

          // Retoma do nó atual
          console.log(`[Flow Scheduler] ▶️ Retomando execução ${execution.id} (phone: ${execution.contactPhone}) do nó ${execution.currentNodeId}`);
          await this.flowEngine.processNextNodes(execution.id, execution.currentNodeId);
        } catch (error: any) {
          console.error(`[Flow Scheduler] ❌ Falha ao recuperar execução ${execution.id}:`, error.message);
          // Marca como falha para não tentar de novo infinitamente
          await prisma.flowExecution.update({
            where: { id: execution.id },
            data: {
              status: FlowExecutionStatus.FAILED,
              error: `Falha ao recuperar após restart: ${error.message}`,
              completedAt: new Date(),
            },
          }).catch(() => {});
        }
      }

      console.log(`[Flow Scheduler] ✅ Recuperação de execuções órfãs concluída`);
    } catch (error: any) {
      console.error('[Flow Scheduler] Erro ao recuperar execuções órfãs:', error.message);
    }
  }
}

export default new FlowSchedulerService();
