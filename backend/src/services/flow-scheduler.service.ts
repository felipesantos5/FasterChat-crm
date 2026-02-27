import { prisma } from '../utils/prisma';
import { FlowExecutionStatus } from '@prisma/client';
import { FlowEngineService } from './FlowEngineService';

class FlowSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private flowEngine: FlowEngineService;

  constructor() {
    this.flowEngine = new FlowEngineService();
  }

  start() {
    if (this.intervalId) {
      return;
    }

    
    this.checkPendingFlows();

    // Checks every 5 seconds
    this.intervalId = setInterval(() => {
      this.checkPendingFlows();
    }, 5000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkPendingFlows() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();

      // Find all executions that have a resumesAt <= now and are in WAITING_REPLY or DELAYED
      const pendingExecutions = await prisma.flowExecution.findMany({
        where: {
          resumesAt: { lte: now },
          status: { in: [FlowExecutionStatus.WAITING_REPLY, FlowExecutionStatus.DELAYED] }
        },
        include: { currentNode: true }
      });

      if (pendingExecutions.length > 0) {

        for (const execution of pendingExecutions) {
          try {

            if (execution.status === FlowExecutionStatus.WAITING_REPLY) {
              // Timeout reached without reply -> follow "nao_respondeu"
              await prisma.flowExecution.update({
                where: { id: execution.id },
                data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
              });

              if (execution.currentNodeId) {
                await this.flowEngine.processNextNodes(execution.id, execution.currentNodeId, 'nao_respondeu');
              }
            } else if (execution.status === FlowExecutionStatus.DELAYED) {
              // Delay passed -> follow default path
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
      }
    } catch (error: any) {
      console.error('[Flow Scheduler] Error checking pending flows:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
}

export default new FlowSchedulerService();
