import { prisma } from '../utils/prisma';
import { FlowExecutionStatus, MessageDirection } from '@prisma/client';
import flowQueueService from './flow-queue.service';

class FlowSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private replyCheckIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isReplyChecking: boolean = false;

  constructor() {
  }

  start(): void {
    if (this.intervalId) {
      return;
    }

    // Recupera execuções RUNNING órfãs de um restart/deploy anterior
    this.recoverOrphanedExecutions();

    // Safety net: verifica timeouts expirados a cada 30 segundos
    // (BullMQ é o mecanismo primário, este é apenas backup)
    this.checkPendingFlows();
    this.intervalId = setInterval(() => {
      this.checkPendingFlows();
    }, 30000);

    // Polling de respostas a cada 60 segundos — safety net para quando o webhook falha
    this.checkWaitingReplies();
    this.replyCheckIntervalId = setInterval(() => {
      this.checkWaitingReplies();
    }, 60000);
  }

  stop(): void {
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
   * Safety net: verifica execuções com timeout expirado ou delays vencidos.
   * BullMQ é o mecanismo primário — este polling é backup para jobs que falharam/perderam.
   * Roda a cada 30 segundos.
   */
  private async checkPendingFlows(): Promise<void> {
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
        take: 50,
        orderBy: { resumesAt: 'asc' },
      });

      for (const execution of pendingExecutions) {
        try {
          if (execution.status === FlowExecutionStatus.WAITING_REPLY) {
            if (!execution.currentNodeId) {
              await prisma.flowExecution.update({
                where: { id: execution.id },
                data: {
                  status: FlowExecutionStatus.FAILED,
                  error: 'Execução interrompida: nó atual deletado do fluxo',
                  completedAt: new Date()
                }
              });
              continue;
            }

            // Check atômico para evitar execução dupla com o BullMQ timeout job
            const updated = await prisma.flowExecution.updateMany({
              where: { id: execution.id, status: FlowExecutionStatus.WAITING_REPLY },
              data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
            });

            if (updated.count === 0) continue; // Já processado pelo BullMQ ou webhook

            await flowQueueService.enqueueFlowStep({
              executionId: execution.id,
              nodeId: execution.currentNodeId,
              sourceHandle: 'nao_respondeu',
            });
          } else if (execution.status === FlowExecutionStatus.DELAYED) {
            if (!execution.currentNodeId) {
              await prisma.flowExecution.update({
                where: { id: execution.id },
                data: {
                  status: FlowExecutionStatus.FAILED,
                  error: 'Execução interrompida: nó atual deletado do fluxo',
                  completedAt: new Date()
                }
              });
              continue;
            }

            // Check atômico para evitar execução dupla
            const updated = await prisma.flowExecution.updateMany({
              where: { id: execution.id, status: FlowExecutionStatus.DELAYED },
              data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
            });

            if (updated.count === 0) continue; // Já processado pelo BullMQ

            await flowQueueService.enqueueFlowStep({
              executionId: execution.id,
              nodeId: execution.currentNodeId,
            });
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`[Flow Scheduler] ❌ Failed to resume flow ${execution.id}:`, err.message);
        }
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Flow Scheduler] Error checking pending flows:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Polling de segurança: verifica se clientes em WAITING_REPLY já responderam,
   * mesmo que o webhook não tenha disparado corretamente.
   * Roda a cada 60 segundos.
   */
  private async checkWaitingReplies(): Promise<void> {
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
            const suffixCustomers = await prisma.customer.findMany({
              where: {
                companyId: execution.flow.companyId,
                phone: { endsWith: suffixDigits },
              },
              select: { id: true },
              take: 2,
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

          // Remove timeout job do BullMQ antes de retomar
          if (execution.currentNodeId) {
            await flowQueueService.removeTimeoutJob(execution.id, execution.currentNodeId);
          }

          // Check atômico para evitar execução dupla
          const updated = await prisma.flowExecution.updateMany({
            where: {
              id: execution.id,
              status: FlowExecutionStatus.WAITING_REPLY
            },
            data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
          });

          if (updated.count === 0) continue; // Já foi tratado pelo webhook ou BullMQ

          // Determina qual handle seguir (mesmo comportamento do handleIncomingMessage)
          const text = (recentMessage.content || '').toLowerCase().trim();
          let handle = 'respondeu';

          const nodeData = typeof execution.currentNode?.data === 'string'
            ? JSON.parse(execution.currentNode.data)
            : (execution.currentNode?.data || {});

          const keyword = (nodeData as Record<string, unknown>)?.keyword as string | undefined;
          if (keyword) {
            const keywords = keyword.toLowerCase().split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
            if (keywords.some((k: string) => text.includes(k) || text === k)) {
              handle = 'palavra_chave';
            }
          }

          if (execution.currentNodeId) {
            await flowQueueService.enqueueFlowStep({
              executionId: execution.id,
              nodeId: execution.currentNodeId,
              sourceHandle: handle,
            });
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`[Flow Scheduler] ❌ Erro ao verificar resposta para execução ${execution.id}:`, err.message);
        }
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Flow Scheduler] Erro no polling de respostas:', err.message);
    } finally {
      this.isReplyChecking = false;
    }
  }

  /**
   * Recupera execuções que ficaram com status RUNNING após um restart/deploy.
   * Uma execução RUNNING que não atualizou há mais de 5 minutos está "órfã" —
   * o processo que a executava morreu no deploy.
   *
   * Estratégia inteligente usando lastCompletedNodeId:
   * - Se lastCompletedNodeId === currentNodeId → nó atual JÁ foi processado (msg enviada),
   *   enfileira processNextNodes para ir ao PRÓXIMO nó (não re-envia a mensagem).
   * - Se lastCompletedNodeId !== currentNodeId → nó atual NÃO terminou de processar,
   *   enfileira processNextNodes a PARTIR DO lastCompletedNodeId (ou currentNodeId se não há lastCompleted).
   *   Isso pode re-enviar uma mensagem em caso de crash no meio do envio — preferimos
   *   at-least-once delivery a perder mensagens.
   */
  private async recoverOrphanedExecutions(): Promise<void> {
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

          // 🛡️ Determina de qual nó retomar usando lastCompletedNodeId
          // Se o nó atual já foi completado (mensagem enviada + próximo enfileirado),
          // o recovery vai para o PRÓXIMO nó. Caso contrário, re-processa o atual.
          const resumeFromNodeId = (execution.lastCompletedNodeId === execution.currentNodeId)
            ? execution.currentNodeId   // Nó completo → processNextNodes encontra o próximo
            : (execution.lastCompletedNodeId || execution.currentNodeId); // Nó incompleto → tenta de onde o último completou

          const wasCompleted = execution.lastCompletedNodeId === execution.currentNodeId;
          console.log(
            `[Flow Scheduler] ▶️ Re-enfileirando execução ${execution.id} (phone: ${execution.contactPhone}) ` +
            `do nó ${resumeFromNodeId} (currentNode: ${execution.currentNodeId}, ` +
            `lastCompleted: ${execution.lastCompletedNodeId || 'null'}, ` +
            `strategy: ${wasCompleted ? 'NEXT_NODE' : 'RE_PROCESS'})`
          );

          await flowQueueService.enqueueFlowStep({
            executionId: execution.id,
            nodeId: resumeFromNodeId,
          });
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`[Flow Scheduler] ❌ Falha ao recuperar execução ${execution.id}:`, err.message);
          await prisma.flowExecution.update({
            where: { id: execution.id },
            data: {
              status: FlowExecutionStatus.FAILED,
              error: `Falha ao recuperar após restart: ${err.message}`,
              completedAt: new Date(),
            },
          }).catch(() => {});
        }
      }

      console.log(`[Flow Scheduler] ✅ Recuperação de execuções órfãs concluída`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Flow Scheduler] Erro ao recuperar execuções órfãs:', err.message);
    }
  }
}

export default new FlowSchedulerService();
