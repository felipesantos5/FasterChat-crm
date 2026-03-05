import { prisma } from '../utils/prisma';
import whatsappService from './whatsapp.service';
import { FlowExecutionStatus, MessageDirection, MessageStatus } from '@prisma/client';
import messageService from './message.service';
import { websocketService } from './websocket.service';
import { customerService } from './customer.service';
import flowQueueService from './flow-queue.service';
import type { FlowStartJobData } from './flow-queue.service';
import geminiService from './ai-providers/gemini.service';
import redisConnection from '../config/redis';
import { Errors } from '../utils/errors';

// ==================================================================================
// 🛡️ CIRCUIT BREAKER: Protege a Evolution API contra sobrecarga.
// Se muitos erros consecutivos ocorrerem, pausa os envios temporariamente.
// Estado compartilhado entre todas as instâncias do FlowEngineService.
// ==================================================================================
interface CircuitBreakerState {
  consecutiveErrors: number;
  lastErrorTime: number;
  isOpen: boolean;        // true = circuito aberto (parado), false = funcionando
  cooldownUntil: number;  // timestamp até quando o circuito fica aberto
  totalErrors: number;    // total de erros acumulados (para logging)
}

const circuitBreaker: CircuitBreakerState = {
  consecutiveErrors: 0,
  lastErrorTime: 0,
  isOpen: false,
  cooldownUntil: 0,
  totalErrors: 0,
};

// Delay anti-spam entre nós de mensagem (aplicado via BullMQ delay no próximo job)
const MSG_SEND_DELAY_MIN_MS = 35_000;    // 35s mínimo
const MSG_SEND_DELAY_MAX_MS = 60_000;    // 60s máximo

// Configurações do circuit breaker
const CB_MAX_CONSECUTIVE_ERRORS = 5;     // Abre o circuito após 5 erros seguidos
const CB_INITIAL_COOLDOWN_MS = 30_000;   // 30s de pausa inicial
const CB_MAX_COOLDOWN_MS = 5 * 60_000;   // Máximo 5 minutos de pausa
const CB_MAX_RETRIES = 2;                // Tentativas por mensagem (1 original + 2 retries)
const CB_RETRY_BASE_DELAY_MS = 3_000;    // 3s base para retry (exponencial)

// 🔄 ROUND ROBIN: Índice global para alternar entre instâncias conectadas
// Mantido em memória para garantir distribuição exata e justa em disparos em massa.
let nextInstanceIndex = 0;

export class FlowEngineService {
  constructor() {
  }

  /**
   * 🛡️ Verifica se o circuit breaker está aberto e deve bloquear envios.
   * Se o cooldown expirou, reseta para half-open (permite 1 tentativa).
   */
  private checkCircuitBreaker(): { blocked: boolean; reason?: string } {
    if (!circuitBreaker.isOpen) {
      return { blocked: false };
    }

    const now = Date.now();
    if (now >= circuitBreaker.cooldownUntil) {
      circuitBreaker.isOpen = false;
      circuitBreaker.consecutiveErrors = 0; // Reseta para dar chance
      return { blocked: false };
    }

    const remainingSec = Math.ceil((circuitBreaker.cooldownUntil - now) / 1000);
    return {
      blocked: true,
      reason: `Circuit breaker aberto: ${circuitBreaker.totalErrors} erros acumulados. Próxima tentativa em ${remainingSec}s`,
    };
  }

  /**
   * 🛡️ Registra sucesso no circuit breaker (reseta erros consecutivos)
   */
  private recordSuccess(): void {
    circuitBreaker.consecutiveErrors = 0;
    circuitBreaker.isOpen = false;
  }

  /**
   * 🛡️ Registra erro no circuit breaker. Se ultrapassar o limite, abre o circuito.
   */
  private recordError(error: string): void {
    circuitBreaker.consecutiveErrors++;
    circuitBreaker.totalErrors++;
    circuitBreaker.lastErrorTime = Date.now();

    console.warn(`[FlowEngine:CircuitBreaker] ⚠️ Erro #${circuitBreaker.consecutiveErrors} consecutivo (total: ${circuitBreaker.totalErrors}): ${error}`);

    if (circuitBreaker.consecutiveErrors >= CB_MAX_CONSECUTIVE_ERRORS) {
      // Calcula cooldown com backoff exponencial baseado no total de erros
      const backoffFactor = Math.min(circuitBreaker.totalErrors / CB_MAX_CONSECUTIVE_ERRORS, 5);
      const cooldownMs = Math.min(
        CB_INITIAL_COOLDOWN_MS * Math.pow(2, backoffFactor - 1),
        CB_MAX_COOLDOWN_MS
      );

      circuitBreaker.isOpen = true;
      circuitBreaker.cooldownUntil = Date.now() + cooldownMs;

      console.error(`[FlowEngine:CircuitBreaker] 🔴 CIRCUITO ABERTO! ${circuitBreaker.consecutiveErrors} erros consecutivos. Pausando envios por ${(cooldownMs / 1000).toFixed(0)}s`);
    }
  }

  /**
   * 🛡️ Envia mensagem com retry, circuit breaker e FAILOVER automático.
   * Se o chip atual estiver desconectado, tenta pegar outro chip da empresa e continuar.
   */
  private async sendWithRetry(
    sendFn: (instanceId: string) => Promise<Record<string, unknown>>,
    context: string,
    failoverConfig?: { executionId: string; companyId: string; currentInstanceId: string }
  ): Promise<Record<string, unknown>> {
    // Verifica circuit breaker antes de tentar
    const cbCheck = this.checkCircuitBreaker();
    if (cbCheck.blocked) {
      throw new Error(`[CircuitBreaker] ${cbCheck.reason}`);
    }

    let lastError: Error | undefined;
    let activeInstanceId = failoverConfig?.currentInstanceId || '';

    for (let attempt = 0; attempt <= CB_MAX_RETRIES; attempt++) {
      try {
        const result = await sendFn(activeInstanceId);
        this.recordSuccess();
        return result;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        const isLastAttempt = attempt === CB_MAX_RETRIES;

        // 🔄 FAILOVER LOGIC: Se o chip desconectou, tentamos trocar por outro AGORA
        // Se conseguirmos uma nova instância, o loop de retry tentará com ela.
        if (failoverConfig && (error as any).code === 'WHATSAPP_DISCONNECTED' && !isLastAttempt) {
          const newInstance = await this.handleFailover(
            failoverConfig.executionId,
            failoverConfig.companyId,
            activeInstanceId
          );
          if (newInstance) {
            activeInstanceId = (newInstance as any).id as string;
            console.log(`[FlowEngine:Failover] 🚀 Recuperando envio "${context}" com nova instância: ${activeInstanceId}`);
            // Continua para o próximo retry com o novo chip
          }
        }

        // Identifica se é erro de rede/API (retentável) vs erro de dados (não retentável)
        const isRetryable = this.isRetryableError(err);

        if (!isRetryable || isLastAttempt) {
          this.recordError(error.message || 'Erro desconhecido');
          if (!isLastAttempt) {
            console.warn(`[FlowEngine] ❌ ${context}: Erro não retentável: ${error.message}`);
          } else {
            console.error(`[FlowEngine] ❌ ${context}: Falhou após ${CB_MAX_RETRIES + 1} tentativas: ${error.message}`);
          }
          break;
        }

        // Backoff exponencial: 3s, 6s
        const delayMs = CB_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[FlowEngine] ⏳ ${context}: Tentativa ${attempt + 1}/${CB_MAX_RETRIES + 1} falhou (${error.message}). Retry em ${(delayMs / 1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Re-verifica circuit breaker antes do retry
        const cbRecheck = this.checkCircuitBreaker();
        if (cbRecheck.blocked) {
          throw new Error(`[CircuitBreaker] ${cbRecheck.reason}`);
        }
      }
    }

    throw lastError;
  }

  /**
   * 🛡️ Tenta trocar a instância de WhatsApp de uma execução se a atual estiver desconectada.
   * Retorna a nova instância selecionada ou null se não houver alternativa.
   */
  private async handleFailover(executionId: string, companyId: string, currentInstanceId: string): Promise<Record<string, unknown> | null> {
    try {
      // Busca uma nova instância disponível
      const newInstance = await this.getInstanceForCompany(companyId);

      if (newInstance && (newInstance as any).id !== currentInstanceId) {
        console.log(`[FlowEngine:Failover] 🔄 Trocando instância da execução ${executionId}: ${currentInstanceId} -> ${(newInstance as any).id}`);

        // Atualiza no banco para que futuros passos deste fluxo já usem o novo chip
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: { whatsappInstanceId: (newInstance as any).id }
        });

        return newInstance as unknown as Record<string, unknown>;
      }
    } catch (err) {
      console.warn(`[FlowEngine:Failover] ⚠️ Falha ao tentar encontrar chip de failover para ${executionId}:`, err);
    }
    return null;
  }

  /**
   * 🛡️ Determina se um erro é retentável (falha de rede/API) ou permanente (dados inválidos)
   */
  private isRetryableError(err: unknown): boolean {
    const error = err as Record<string, unknown>;
    const message = (error?.message as string || '').toLowerCase();
    const response = error?.response as Record<string, unknown> | undefined;
    const status = response?.status as number | undefined;
    const code = error?.code as string | undefined;

    // Erros de rede são retentáveis
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
      return true;
    }

    // HTTP 429 (rate limit), 500, 502, 503, 504 são retentáveis
    if (status && (status === 429 || status >= 500)) {
      return true;
    }

    // Timeout
    if (message.includes('timeout') || message.includes('timed out')) {
      return true;
    }

    // Erros de conexão genéricos
    if (message.includes('socket hang up') || message.includes('network') || message.includes('connection')) {
      return true;
    }

    // 🔄 WhatsApp Desconectado é retentável para permitir Failover (trocar de chip)
    if ((err as any)?.code === 'WHATSAPP_DISCONNECTED') {
      return true;
    }

    // Erros 400, 401, 403, 404 NÃO são retentáveis (problema nos dados)
    if (status && status >= 400 && status < 500) {
      return false;
    }

    // Default: não retentável (melhor falhar rápido do que ficar tentando)
    return false;
  }

  /**
   * Normaliza telefone para formato brasileiro completo (55 + DDD + número).
   * Garante que o número salvo no banco seja igual ao que o WhatsApp envia via webhook.
   */
  private normalizePhone(phone: string): string {
    const hasPlus = phone.trim().startsWith('+');
    const digits = phone.replace(/\D/g, '');
    
    // Se digitou com '+', respeita o código do país que o usuário colocou (ex: +1 415 555-2671)
    if (hasPlus) {
      return digits;
    }

    // Já tem código do país (55) + DDD + número = 12-13 dígitos
    if (digits.length >= 12 && digits.startsWith('55')) {
      return digits;
    }
    // Tem DDD + número mas sem código do país = 10-11 dígitos → adiciona 55
    if (digits.length >= 10 && digits.length <= 11) {
      return `55${digits}`;
    }
    return digits;
  }

  // ==================================================================================
  // MÉTODOS PÚBLICOS — Interface com o sistema de filas
  // ==================================================================================

  /**
   * 📉 Executa nó de alteração de estágio no funil.
   * Muda o pipelineStageId do cliente de forma instantânea.
   */
  private async executeUpdateStageNode(
    execution: Record<string, unknown>,
    node: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<void> {
    const stageId = data.stageId as string;
    const customerId = execution.customerId as string;

    if (!stageId) {
      console.warn(`[FlowEngine] ⚠️ Nó ${node.id} de alterar estágio sem ID de destino.`);
      return;
    }

    if (!customerId) {
      console.warn(`[FlowEngine] ⚠️ Execução ${execution.id} sem customerId associado.`);
      return;
    }

    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: { pipelineStageId: stageId }
      });

      console.log(`[FlowEngine] ✅ Cliente ${customerId} movido para estágio ${stageId} pelo fluxo.`);
    } catch (err: any) {
      console.error(`[FlowEngine] ❌ Erro ao mover cliente ${customerId} para estágio ${stageId}:`, err.message);
      throw new Error(`Falha ao alterar estágio no funil: ${err.message}`);
    }
  }

  /**
   * Enfileira o início de um fluxo para um contato.
   * Este é o ponto de entrada público — apenas enfileira, não executa.
   */
  public async startFlow(flowId: string, contactPhone: string, variables: Record<string, unknown>): Promise<void> {
    // Busca o companyId do fluxo
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: { companyId: true },
    });

    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    await flowQueueService.enqueueFlowStart({
      flowId,
      contactPhone,
      variables,
      companyId: flow.companyId,
    });
  }

  /**
   * Execução real do início do fluxo — chamado pelo worker de orchestration.
   * Contém toda a lógica que antes estava em startFlow().
   */
  public async startFlowDirect(data: FlowStartJobData): Promise<void> {
    const { flowId, contactPhone, variables } = data;

    // Normaliza para formato WhatsApp, preservando códigos internacionais se tiver '+'
    const cleanPhone = this.normalizePhone(contactPhone);

    // Find the flow and its nodes/edges
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: { nodes: true, edges: true }
    });

    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    // Find the trigger node (type = 'webhook' or similar)
    const triggerNode = flow.nodes.find(n => n.type === 'trigger' || n.type === 'webhook');
    if (!triggerNode) {
      throw new Error(`Flow ${flowId} has no trigger node`);
    }

    // Busca pelo telefone normalizado usando índice único e cobrindo variantes do 9º dígito
    let customer = await customerService.findByPhoneWithVariant(cleanPhone, flow.companyId);

    // Se o cliente existe mas seu número salvo não é o 'cleanPhone' (ex: formato antigo sem 55),
    // vamos tentar atualizá-lo e normalizá-lo para evitar duplicidade posterior
    if (customer && customer.phone !== cleanPhone && !customer.isGroup) {
      try {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { phone: cleanPhone }
        });
      } catch (e: unknown) {
        const error = e as Record<string, unknown>;
        if (error.code === 'P2002') {
          console.warn(`[FlowEngine] ⚠️ Conflito ao normalizar telefone ${customer.phone} para ${cleanPhone}`);
        }
      }
    }

    if (!customer) {
      // Usa o telefone como nome — o nome real vem do pushName quando o contato responder
      const firstStage = await prisma.pipelineStage.findFirst({
        where: { companyId: flow.companyId },
        orderBy: { order: 'asc' },
      });

      customer = await prisma.customer.create({
        data: {
          companyId: flow.companyId,
          phone: cleanPhone,
          name: cleanPhone,
          tags: [],
          pipelineStageId: firstStage?.id || null,
        }
      });
    }

    if (customer) {
      const existingTags = customer.tags || [];
      const tagsToAdd = ['automação', ...((flow as Record<string, unknown>).autoTags as string[] || [])];

      // Usa Set para unificar as tags e remover duplicatas
      const combinedTags = Array.from(new Set([...existingTags, ...tagsToAdd]));

      if (combinedTags.length > existingTags.length) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { tags: combinedTags }
        });

        // Registrar as tags recém-adicionadas na tabela Tag para aparecer nos filtros do chat
        try {
          const { default: tagService } = await import('./tag.service');
          await tagService.createOrGetMany(flow.companyId, combinedTags);
        } catch (tagErr: unknown) {
          const error = tagErr instanceof Error ? tagErr : new Error(String(tagErr));
          console.warn(`[FlowEngine] ⚠️ Error creating tags in DB for customer ${customer.id}:`, error.message);
        }
      }

      // Desativar a IA quando entra em um fluxo vindo de webhook
      try {
        const { default: conversationService } = await import('./conversation.service');
        await conversationService.getOrCreateConversation(customer.id, flow.companyId);
        await conversationService.toggleAI(customer.id, false);

        if (websocketService.isInitialized()) {
          websocketService.emitConversationUpdate(flow.companyId, customer.id, {
            aiEnabled: false,
          });
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn(`[FlowEngine] ⚠️ Error disabling AI for customer ${customer.id}:`, error.message);
      }
    }

    // Seleciona a instância WhatsApp UMA VEZ no início do fluxo (respeita estratégia RANDOM/SPECIFIC)
    const selectedInstance = await this.getInstanceForCompany(flow.companyId);
    if (!selectedInstance) {
      console.error(`[FlowEngine] ❌ Nenhuma instância WhatsApp conectada para companyId ${flow.companyId}`);
      throw new Error(`Nenhuma instância WhatsApp conectada para iniciar o fluxo`);
    }

    // Coleta execuções ativas para cancelar depois de criar a nova (precisamos do novo ID)
    const activeStatuses: FlowExecutionStatus[] = [
      FlowExecutionStatus.RUNNING,
      FlowExecutionStatus.WAITING_REPLY,
      FlowExecutionStatus.DELAYED,
    ];
    const activeExecs = await prisma.flowExecution.findMany({
      where: {
        contactPhone: cleanPhone,
        status: { in: activeStatuses },
        flow: { companyId: flow.companyId },
      },
      select: { id: true },
    });

    // 🛡️ CRIA A EXECUÇÃO ANTES DA VALIDAÇÃO para que o progresso do batch registre o erro se falhar
    const execution = await prisma.flowExecution.create({
      data: {
        flowId,
        contactPhone: cleanPhone,
        variables: variables as unknown as import('@prisma/client').Prisma.InputJsonValue,
        currentNodeId: triggerNode.id,
        whatsappInstanceId: selectedInstance.id,
        status: FlowExecutionStatus.RUNNING,
        history: [triggerNode.id],
      }
    });

    // ✅ Valida se o número existe no WhatsApp
    try {
      const numberOnWhatsApp = await whatsappService.numberExists(selectedInstance.instanceName, cleanPhone);
      if (!numberOnWhatsApp) {
        console.warn(`[FlowEngine] ⚠️ Número ${cleanPhone} NÃO está no WhatsApp. Descartando execução ${execution.id}`);
        await prisma.flowExecution.update({
          where: { id: execution.id },
          data: { 
            status: FlowExecutionStatus.FAILED, 
            error: `O número ${cleanPhone} não possui WhatsApp ou é inválido.`,
            completedAt: new Date()
          }
        });
        return; // Interrompe o fluxo sem erro fatal no worker
      }
    } catch (err: any) {
      console.error(`[FlowEngine] ❌ Erro ao validar número ${cleanPhone} na Evolution:`, err.message);
      // Se a API cair, falhamos a execução para que apareça no relatório
      await prisma.flowExecution.update({
        where: { id: execution.id },
        data: { 
          status: FlowExecutionStatus.FAILED, 
          error: `Falha técnica ao validar número: ${err.message}`,
          completedAt: new Date()
        }
      });
      return;
    }

    // Cancela execuções anteriores agora que temos o ID da nova
    if (activeExecs.length > 0) {
      await prisma.flowExecution.updateMany({
        where: { id: { in: activeExecs.map(e => e.id) } },
        data: {
          status: FlowExecutionStatus.FORCE_CANCELLED,
          resumesAt: null,
          completedAt: new Date(),
          error: `Cancelamento forçado: novo fluxo iniciado para o mesmo contato`,
          replacedByExecutionId: execution.id,
          replacedByFlowId: flowId,
        },
      });

      // Remove jobs BullMQ pendentes das execuções canceladas
      for (const exec of activeExecs) {
        await flowQueueService.removeJobsForExecution(exec.id);
      }
    }

    // Enfileira o primeiro step (trigger → próximo nó)
    await flowQueueService.enqueueFlowStep({
      executionId: execution.id,
      nodeId: triggerNode.id,
    });
  }

  /**
   * Executa um step do fluxo a partir da fila — chamado pelo worker de step.
   * Carrega a execução do DB, verifica status, e processa o nó.
   *
   * PROTEÇÃO CONTRA EXECUÇÃO DUPLA:
   * - DELAYED / WAITING_REPLY: updateMany atômico com WHERE status — só 1 ganha
   * - RUNNING: verifica se o fluxo já passou deste nó (stale BullMQ retry guard)
   */
  public async executeStepFromQueue(executionId: string, nodeId: string, sourceHandle?: string): Promise<void> {
    const execution = await prisma.flowExecution.findUnique({
      where: { id: executionId },
      include: {
        flow: { include: { nodes: true, edges: true } },
        whatsappInstance: true,
        currentNode: true,
      }
    });

    if (!execution) {
      console.warn(`[FlowEngine] ⚠️ Execução ${executionId} não encontrada (já removida?)`);
      return;
    }

    // Verifica se a execução ainda está em um status válido para continuar
    const validStatuses: FlowExecutionStatus[] = [
      FlowExecutionStatus.RUNNING,
      FlowExecutionStatus.DELAYED,
      FlowExecutionStatus.WAITING_REPLY,
    ];

    if (!validStatuses.includes(execution.status)) {
      return;
    }

    if (sourceHandle === 'INTERNAL_EXECUTE') {
      const targetNode = execution.flow.nodes.find(n => n.id === nodeId);
      if (targetNode) {
        await this.executeNode(execution, targetNode);
        return;
      }
    }

    // Para DELAYED e WAITING_REPLY, usa check atômico para evitar execução dupla
    if (execution.status === FlowExecutionStatus.DELAYED || execution.status === FlowExecutionStatus.WAITING_REPLY) {
      const updated = await prisma.flowExecution.updateMany({
        where: { id: executionId, status: execution.status },
        data: { status: FlowExecutionStatus.RUNNING, resumesAt: null },
      });
      if (updated.count === 0) {
        // Já processado pelo scheduler ou webhook
        return;
      }
    }

    // 🛡️ STALE RETRY GUARD para execuções RUNNING:
    // Se o fluxo já avançou além deste nó, o job é um BullMQ stale retry (server caiu e
    // o worker novo re-processou o job antigo). Neste caso, o fluxo já progrediu
    // via recoverOrphanedExecutions ou outro mecanismo — devemos ignorar.
    //
    // Lógica: se o nodeId deste job NÃO é o currentNodeId da execução,
    // e o nodeId já está no history (= já foi processado), este job é stale.
    if (execution.status === FlowExecutionStatus.RUNNING) {
      const history = Array.isArray(execution.history) ? execution.history as string[] : [];
      const currentNodeId = execution.currentNodeId;

      // O job é para um nodeId que não é o nó atual da execução
      if (currentNodeId && currentNodeId !== nodeId) {
        // Verifica se o nodeId deste job já foi processado (está no history)
        // E se o nó atual da execução é POSTERIOR ao nodeId (= fluxo avançou)
        const nodeIdxInHistory = history.lastIndexOf(nodeId);
        const currentIdxInHistory = history.lastIndexOf(currentNodeId);

        if (nodeIdxInHistory >= 0 && currentIdxInHistory > nodeIdxInHistory) {
          console.warn(
            `[FlowEngine] 🛡️ Stale retry guard: job para nó "${nodeId}" ignorado. ` +
            `Execução ${executionId} já está no nó "${currentNodeId}" (posição ${currentIdxInHistory} vs ${nodeIdxInHistory} no history).`
          );
          return;
        }
      }
    }

    // Processa os próximos nós a partir deste
    await this.processNextNodes(executionId, nodeId, sourceHandle);
  }

  /**
   * Processes the next nodes in the flow based on edges.
   * Em vez de executar diretamente, enfileira o próximo step.
   */
  public async processNextNodes(executionId: string, currentNodeId: string, sourceHandle?: string): Promise<void> {
    const execution = await prisma.flowExecution.findUnique({
      where: { id: executionId },
      include: { flow: { include: { nodes: true, edges: true } }, whatsappInstance: true }
    });

    if (!execution || execution.status !== FlowExecutionStatus.RUNNING) {
      return;
    }

    const { flow } = execution;

    // Find edges coming from the current node
    let edges = flow.edges.filter(e => e.sourceNodeId === currentNodeId);

    // If a specific handle was provided (e.g., 'respondeu', 'true', 'false'), filter by it
    if (sourceHandle) {
      const exactMatch = edges.filter(e => e.sourceHandle === sourceHandle);
      if (exactMatch.length > 0) {
        edges = exactMatch;
      } else {
        // Fallback: se não encontrou edge com o handle exato, tenta edges sem handle definido
        const noHandleEdges = edges.filter(e => !e.sourceHandle || e.sourceHandle === "" || e.sourceHandle === "default");
        if (noHandleEdges.length > 0) {
          console.warn(`[FlowEngine] ⚠️ Nenhuma edge com handle "${sourceHandle}" encontrada em ${currentNodeId}. Usando ${noHandleEdges.length} edge(s) de fallback.`);
          edges = noHandleEdges;
        } else {
          // Se não há match exato nem fallback, edges fica vazio para que o fluxo termine ou não bifurque erroneamente
          edges = [];
        }
      }
    }

    if (edges.length === 0) {
      // Flow ended
      await prisma.flowExecution.update({
        where: { id: executionId },
        data: { status: FlowExecutionStatus.COMPLETED, completedAt: new Date() }
      });
      return;
    }

    // Para cada edge, encontra o nó alvo e executa
    const outboundTypes = ['message', 'audio', 'image', 'video', 'ai_image'];

    for (const edge of edges) {
      const targetNode = flow.nodes.find(n => n.id === edge.targetNodeId);
      if (targetNode) {
        const isOutbound = outboundTypes.includes(targetNode.type);
        
        if (isOutbound) {
          // 🛡️ METRÔNOMO DE INSTÂNCIA: Garante que este CHIP não mande mensagens rápido demais
          // para contatos diferentes. O delay agora é calculado baseado no último envio agendado para o chip.
          const instanceId = (execution.whatsappInstanceId as string) || (execution.whatsappInstance as any)?.id;
          const delay = await this.reserveSendSlot(instanceId);
          
          await flowQueueService.enqueueFlowStep(
            { executionId: execution.id, nodeId: targetNode.id, sourceHandle: 'INTERNAL_EXECUTE' },
            { delay }
          );
        } else {
          // Se é lógica ou espera, executa agora sem delay para fluxo instantâneo
          await this.executeNode(execution, targetNode);
        }
      }
    }
  }

  /**
   * 🛡️ Reserva um "slot" de tempo para envio em uma instância de WhatsApp.
   * Garante o espaçamento anti-spam Global por CHIP, mesmo que 1000 fluxos comecem ao mesmo tempo.
   * Retorna o delay (ms) que o job deve aguardar.
   */
  private async reserveSendSlot(instanceId: string): Promise<number> {
    if (!instanceId) return 0;
    
    const key = `flow:instance_busy_until:${instanceId}`;
    const now = Date.now();
    
    try {
      // Busca até quando este chip está "comprometido" com envios anteriores
      const currentBusyUntilRaw = await redisConnection.get(key);
      let currentBusyUntil = Number(currentBusyUntilRaw || 0);

      // Se o chip está livre ou o tempo já passou, começamos do "agora"
      if (currentBusyUntil < now) {
        currentBusyUntil = now;
      }

      // Calcula o próximo horário livre sorteando um gap entre 35s e 60s
      const gap = Math.floor(Math.random() * (MSG_SEND_DELAY_MAX_MS - MSG_SEND_DELAY_MIN_MS)) + MSG_SEND_DELAY_MIN_MS;
      const nextBusyUntil = currentBusyUntil + gap;

      // Salva o novo bloqueio no Redis (expira em 10min para segurança)
      await redisConnection.set(key, nextBusyUntil, 'PX', 10 * 60 * 1000);

      // O delay é a diferença entre quando o chip estará livre e o agora
      const delay = currentBusyUntil - now;
      
      if (delay > 0) {
        console.log(`[FlowEngine:Metronome] ⏳ Chip ${instanceId} ocupado. Enfileirando envio com delay de ${(delay / 1000).toFixed(1)}s`);
      }
      
      return delay;
    } catch (err) {
      console.warn(`[FlowEngine:Metronome] ⚠️ Falha ao acessar Redis para metronomo:`, err);
      // Fallback: usa delay aleatório padrão se o Redis falhar
      return Math.floor(Math.random() * (MSG_SEND_DELAY_MAX_MS - MSG_SEND_DELAY_MIN_MS)) + MSG_SEND_DELAY_MIN_MS;
    }
  }

  /**
   * Executes a specific node's action
   */
  private replaceVariables(text: string, variables: Record<string, unknown>): string {
    if (!text) return '';

    // Recursive helper to resolve nested paths (e.g., "data.customer.name")
    const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
      return path.split('.').reduce((acc: unknown, part: string) => {
        if (acc && typeof acc === 'object') {
          return (acc as Record<string, unknown>)[part];
        }
        return undefined;
      }, obj);
    };

    // Replace variables using regex to find all {{path.to.var}} patterns
    const variableRegex = /{{(.*?)}}/g;
    return text.replace(variableRegex, (match: string, path: string) => {
      const val = getNestedValue(variables, path.trim());
      return val !== undefined ? String(val) : match;
    });
  }

  private async executeNode(execution: Record<string, unknown>, node: Record<string, unknown>): Promise<void> {
    // Update current node and history
    const currentHistory = Array.isArray(execution.history) ? execution.history as string[] : [];
    const newHistory = [...currentHistory, node.id as string];

    await prisma.flowExecution.update({
      where: { id: execution.id as string },
      data: {
        currentNodeId: node.id as string,
        history: newHistory
      }
    });

    // Update local object for this cycle
    execution.history = newHistory;

    try {
      const data = node.data as Record<string, unknown>;
      const rawVars = execution.variables;
      const variables: Record<string, unknown> = typeof rawVars === 'string' ? JSON.parse(rawVars) : (rawVars || {});

      switch (node.type) {
        case 'message':
          await this.executeMessageNode(execution, data, variables);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;

        case 'condition':
        case 'ai_condition':
          await this.executeConditionNode(execution, node, data);
          // condition/ai_condition muda status para WAITING_REPLY — não precisa de markNodeCompleted
          break;

        case 'delay':
          await this.executeDelayNode(execution, node, data);
          // delay muda status para DELAYED — não precisa de markNodeCompleted
          break;

        case 'audio':
        case 'image':
        case 'video':
          await this.executeMediaNode(execution, node, data, variables);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;

        case 'ai_action':
          await this.executeAiActionNode(execution, node, data);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;

        case 'validation':
          await this.executeValidationNode(execution, node, data, variables);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;

        case 'random':
          await this.executeRandomNode(execution, node, data);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          // executeRandomNode já chama processNextNodes internamente
          break;

        case 'ai_image':
          await this.executeAiImageNode(execution, node, data, variables);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;

        case 'update_stage':
          await this.executeUpdateStageNode(execution, node, data);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;

        default:
          console.warn(`[FlowEngine] Unknown node type: ${node.type}`);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[FlowEngine] Error executing node ${node.id}:`, err);
      await prisma.flowExecution.update({
        where: { id: execution.id as string },
        data: { status: FlowExecutionStatus.FAILED, error: err.message }
      });
    }
  }

  /**
   * 🛡️ Marca um nó como completamente processado (ação executada + próximo job enfileirado).
   * O campo lastCompletedNodeId é usado pelo recoverOrphanedExecutions para saber que
   * o nó atual já foi processado e o recovery deve ir para o PRÓXIMO nó (processNextNodes),
   * em vez de re-executar o nó atual (o que causaria mensagem duplicada).
   *
   * Atualiza updatedAt para que o stale threshold do orphan recovery funcione corretamente.
   */
  private async markNodeCompleted(executionId: string, nodeId: string): Promise<void> {
    await prisma.flowExecution.update({
      where: { id: executionId },
      data: {
        lastCompletedNodeId: nodeId,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Enfileira o próximo step com delay anti-spam (25-35s) para nós de mensagem/mídia.
   * @deprecated - Agora o delay é tratado dentro de processNextNodes.
   */
  private async enqueueNextStepWithDelay(executionId: string, nodeId: string): Promise<void> {
    const delay = Math.floor(Math.random() * (MSG_SEND_DELAY_MAX_MS - MSG_SEND_DELAY_MIN_MS)) + MSG_SEND_DELAY_MIN_MS;
    await flowQueueService.enqueueFlowStep(
      { executionId, nodeId },
      { delay }
    );
  }

  /**
   * Seleciona a instância WhatsApp respeitando a estratégia da empresa (RANDOM ou SPECIFIC)
   */
  private async getInstanceForCompany(companyId: string) {
    // Busca a empresa para verificar a estratégia configurada
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { whatsappStrategy: true, defaultWhatsappInstanceId: true }
    });

    // Busca TODAS as instâncias conectadas da empresa
    const connectedInstances = await prisma.whatsAppInstance.findMany({
      where: { companyId, status: { in: ['CONNECTED', 'CONNECTING'] } }
    });

    if (connectedInstances.length === 0) {
      return null;
    }

    // SPECIFIC: Usa a instância padrão configurada
    if (company?.whatsappStrategy === 'SPECIFIC' && company.defaultWhatsappInstanceId) {
      const specificInstance = connectedInstances.find(i => i.id === company.defaultWhatsappInstanceId);
      if (specificInstance) {
        return specificInstance;
      }
      // Se a instância específica não está conectada, faz fallback para random
      console.warn(`[FlowEngine] ⚠️ Instância padrão ${company.defaultWhatsappInstanceId} não está conectada, usando random`);
    }

    // ROUND ROBIN (padrão): Seleciona as instâncias em ordem fixa para distribuição exata
    const selectedInstance = connectedInstances[nextInstanceIndex % connectedInstances.length];
    
    // Incrementa o índice para a próxima chamada (usa módulo para evitar overflow)
    nextInstanceIndex = (nextInstanceIndex + 1) % connectedInstances.length;
    
    return selectedInstance;
  }

  private async executeMessageNode(execution: Record<string, unknown>, data: Record<string, unknown>, variables: Record<string, unknown>): Promise<void> {
    let text = (data.text || data.message || data.content || '') as string;

    text = this.replaceVariables(text, variables);

    if (!text || text.trim() === '') {
      console.warn(`[FlowEngine] ⚠️ Texto da mensagem está vazio! Verifique o nó de mensagem no fluxo.`);
    }

    // Usa a instância que foi selecionada no início do fluxo (persistida na execução)
    const instance = execution.whatsappInstance as Record<string, unknown> | null;

    if (!instance) {
      throw new Error(`Nenhuma instância WhatsApp associada à execução do fluxo (executionId: ${execution.id})`);
    }

    const contactPhone = execution.contactPhone as string;

    // Typing presence antes de enviar (fire-and-forget, sem delay blocking)
    try {
      await whatsappService.sendPresence(instance.id as string, contactPhone, 5000, "composing");
    } catch (presenceErr: unknown) {
      const error = presenceErr instanceof Error ? presenceErr : new Error(String(presenceErr));
      console.warn(`[FlowEngine] ⚠️ Falha ao enviar presença (não crítico):`, error.message);
    }

    const result = await this.sendWithRetry(
      (instanceId) => whatsappService.sendMessage({
        instanceId,
        to: contactPhone,
        text
      }),
      `sendMessage(${contactPhone})`,
      {
        executionId: execution.id as string,
        companyId: (execution.flow as any).companyId as string,
        currentInstanceId: instance.id as string
      }
    );

    // 🔗 Captura o LID retornado pela Evolution API para mapeamento futuro
    await this.storeLidMapping(execution, result?.remoteJid as string | undefined);

    // 💾 Salvar a mensagem no banco para aparecer na aba de conversas
    await this.saveFlowMessageToConversation(execution, instance, text, result?.messageId as string | undefined, 'text');
  }

  private async executeMediaNode(execution: Record<string, unknown>, node: Record<string, unknown>, data: Record<string, unknown>, variables: Record<string, unknown>): Promise<void> {
    // Usa a instância que foi selecionada no início do fluxo (persistida na execução)
    const instance = execution.whatsappInstance as Record<string, unknown> | null;

    if (!instance) {
      throw new Error('Nenhuma instância do WhatsApp conectada para enviar mídia');
    }

    const contactPhone = execution.contactPhone as string;
    const nodeType = node.type as string;
    const isAudio = nodeType === 'audio';
    const presenceType = isAudio ? "recording" : "composing";

    // Presence fire-and-forget (sem delay blocking)
    try {
      await whatsappService.sendPresence(instance.id as string, contactPhone, 5000, presenceType);
    } catch (presenceErr: unknown) {
      const error = presenceErr instanceof Error ? presenceErr : new Error(String(presenceErr));
      console.warn(`[FlowEngine] ⚠️ Falha ao enviar presença de mídia (não crítico):`, error.message);
    }

    // Aceita mediaUrl (link público para MP3/OGG/IMG) ou mediaBase64
    const mediaSource = (data.mediaUrl || data.mediaBase64) as string | undefined;

    if (mediaSource) {
      let caption = (data.caption || undefined) as string | undefined;
      if (caption) {
        caption = this.replaceVariables(caption, variables);
      }

      const result = await this.sendWithRetry(
        (instanceId) => whatsappService.sendMedia({
          instanceId,
          to: contactPhone,
          mediaBase64: mediaSource,
          mediaType: nodeType, // 'audio', 'image' or 'video'
          caption: caption
        }),
        `sendMedia(${contactPhone}, ${nodeType})`,
        {
          executionId: execution.id as string,
          companyId: (execution.flow as any).companyId as string,
          currentInstanceId: (instance as any).id as string
        }
      );

      // 🔗 Captura o LID retornado pela Evolution API para mapeamento futuro
      await this.storeLidMapping(execution, result?.remoteJid as string | undefined);

      // 💾 Salvar mídia na conversa
      await this.saveFlowMessageToConversation(
        execution, instance,
        caption || `[${nodeType}]`,
        result?.messageId as string | undefined,
        nodeType, // 'audio', 'image', 'video'
        mediaSource
      );
    } else {
      console.warn(`[FlowEngine] Sem mídia informada no nó ${node.id} do fluxo.`);
    }
  }

  /**
   * 🎨 Executa nó de geração de imagem com IA (Gemini).
   * Combina: imagens de referência (upload) + imagem do CSV (link) + prompt
   * Gera a imagem via Gemini e envia pelo WhatsApp.
   */
  private async executeAiImageNode(
    execution: Record<string, unknown>,
    node: Record<string, unknown>,
    data: Record<string, unknown>,
    variables: Record<string, unknown>
  ): Promise<void> {
    const instance = execution.whatsappInstance as Record<string, unknown> | null;
    if (!instance) {
      throw new Error('Nenhuma instância do WhatsApp conectada para enviar imagem IA');
    }

    const contactPhone = execution.contactPhone as string;

    // 1. Resolve o prompt com variáveis do CSV
    let prompt = (data.aiPrompt || data.prompt || '') as string;
    prompt = this.replaceVariables(prompt, variables);

    if (!prompt || prompt.trim() === '') {
      console.warn(`[FlowEngine] ⚠️ Prompt de geração de imagem está vazio no nó ${(node as any).id}`);
      throw new Error('Prompt de geração de imagem não pode estar vazio');
    }

    // 2. Coleta imagens de referência (uploads estáticos do nó)
    const referenceImages: Array<{ data: string; mimeType?: string }> = [];

    const staticRefs = (data.referenceImages || []) as Array<{ url: string; mimeType?: string }>;
    for (const ref of staticRefs) {
      if (ref.url) {
        referenceImages.push({ data: ref.url, mimeType: ref.mimeType });
      }
    }

    // 3. Resolve imagem do CSV (variável com link)
    const csvImageVar = (data.csvImageVariable || '') as string;
    if (csvImageVar) {
      const resolvedUrl = this.replaceVariables(csvImageVar, variables);
      // Só adiciona se a variável foi resolvida para uma URL válida
      if (resolvedUrl && (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://'))) {
        referenceImages.push({ data: resolvedUrl });
      } else if (resolvedUrl && resolvedUrl !== csvImageVar) {
        // Pode ser base64 direto
        referenceImages.push({ data: resolvedUrl });
      }
    }

    console.log(`[FlowEngine] 🎨 Gerando imagem IA | prompt="${prompt.substring(0, 80)}..." | refs=${referenceImages.length}`);

    // 4. Presence (composing) enquanto gera
    try {
      await whatsappService.sendPresence(instance.id as string, contactPhone, 5000, 'composing');
    } catch (presenceErr: unknown) {
      const error = presenceErr instanceof Error ? presenceErr : new Error(String(presenceErr));
      console.warn(`[FlowEngine] ⚠️ Falha ao enviar presença (não crítico):`, error.message);
    }

    // 5. Gera a imagem via Gemini
    const generated = await geminiService.generateImage(prompt, referenceImages);

    // 6. Converte para o formato base64 que a Evolution API aceita
    const mediaBase64 = `data:${generated.mimeType};base64,${generated.base64}`;

    // 7. Resolve caption opcional
    let caption = (data.aiCaption || undefined) as string | undefined;
    if (caption) {
      caption = this.replaceVariables(caption, variables);
    }

    // 8. Envia pelo WhatsApp com Failover
    const result = await this.sendWithRetry(
      (instanceId) => whatsappService.sendMedia({
        instanceId,
        to: contactPhone,
        mediaBase64: mediaBase64,
        mediaType: 'image',
        caption: caption,
      }),
      `sendAiImage(${contactPhone})`,
      {
        executionId: execution.id as string,
        companyId: (execution.flow as any).companyId as string,
        currentInstanceId: instance.id as string
      }
    );

    // 🔗 Captura LID
    await this.storeLidMapping(execution, result?.remoteJid as string | undefined);

    // 💾 Salvar na conversa
    await this.saveFlowMessageToConversation(
      execution, instance,
      caption || '[Imagem gerada por IA]',
      result?.messageId as string | undefined,
      'image',
      mediaBase64
    );

    console.log(`[FlowEngine] 🎨 Imagem IA enviada com sucesso para ${contactPhone}`);
  }

  private async executeConditionNode(execution: Record<string, unknown>, node: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    // For a "wait for reply" condition, we pause the execution

    const value = (data.waitValue || data.waitHours || 24) as number;
    const unit = (data.waitUnit || (data.waitHours ? 'hours' : 'hours')) as string;

    let delaySeconds = 0;
    if (unit === 'seconds') delaySeconds = Number(value);
    else if (unit === 'minutes') delaySeconds = Number(value) * 60;
    else if (unit === 'hours') delaySeconds = Number(value) * 3600;
    else if (unit === 'days') delaySeconds = Number(value) * 86400;
    else delaySeconds = Number(value) * 3600; // Default hours

    const resumesAt = new Date();
    resumesAt.setSeconds(resumesAt.getSeconds() + delaySeconds);

    await prisma.flowExecution.update({
      where: { id: execution.id as string },
      data: {
        status: FlowExecutionStatus.WAITING_REPLY,
        resumesAt
      }
    });

    // Agenda job de timeout: quando expirar, segue pelo handle "nao_respondeu"
    const timeoutMs = delaySeconds * 1000;
    const executionId = execution.id as string;
    const nodeId = node.id as string;

    await flowQueueService.enqueueFlowStep(
      { executionId, nodeId, sourceHandle: 'nao_respondeu' },
      { delay: timeoutMs, jobId: `timeout_${executionId}_${nodeId}` }
    );
  }

  private async executeDelayNode(execution: Record<string, unknown>, node: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    const value = (data.delayValue || data.minutes || 60) as number;
    const unit = (data.delayUnit || 'minutes') as string;

    let delaySeconds = 0;
    if (unit === 'seconds') delaySeconds = Number(value);
    else if (unit === 'minutes') delaySeconds = Number(value) * 60;
    else if (unit === 'hours') delaySeconds = Number(value) * 3600;
    else if (unit === 'days') delaySeconds = Number(value) * 86400;
    else delaySeconds = Number(value) * 60; // Default minutes

    const resumesAt = new Date();
    resumesAt.setSeconds(resumesAt.getSeconds() + delaySeconds);

    await prisma.flowExecution.update({
      where: { id: execution.id as string },
      data: {
        status: FlowExecutionStatus.DELAYED,
        resumesAt
      }
    });

    // Enfileira job BullMQ para retomar após o delay
    const delayMs = delaySeconds * 1000;
    await flowQueueService.enqueueFlowStep(
      { executionId: execution.id as string, nodeId: node.id as string },
      { delay: delayMs }
    );
  }

  private async executeAiActionNode(execution: Record<string, unknown>, node: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    const action = (data.aiAction || 'enable') as string;
    const turnOn = action === 'enable'; // 'enable' or 'disable'

    const flow = execution.flow as Record<string, unknown>;
    const customer = await prisma.customer.findUnique({
      where: { companyId_phone: { companyId: flow.companyId as string, phone: execution.contactPhone as string } }
    });

    if (customer) {
      try {
        const { default: conversationService } = await import('./conversation.service');
        await conversationService.getOrCreateConversation(customer.id, flow.companyId as string);
        await conversationService.toggleAI(customer.id, turnOn);

        if (websocketService.isInitialized()) {
          websocketService.emitConversationUpdate(flow.companyId as string, customer.id, {
            aiEnabled: turnOn,
            ...(turnOn ? { needsHelp: false } : {})
          });
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn(`[FlowEngine] ⚠️ Error toggling AI for customer ${customer.id}:`, error.message);
      }
    }
  }

  /**
   * Called by the Webhook (Evolution API) when a message is received
   */
  public async handleIncomingMessage(contactPhone: string, companyId: string, messageText: string = '', whatsappInstanceId?: string | null): Promise<boolean> {
    const cleanPhone = contactPhone.replace(/\D/g, '');

    // Find if there's any active execution waiting for a reply for this contact
    // 1) Try exact match first
    let executions = await prisma.flowExecution.findMany({
      where: {
        contactPhone: cleanPhone,
        status: FlowExecutionStatus.WAITING_REPLY,
        flow: { companyId }
      },
      include: {
        currentNode: true
      }
    });

    // 2) Fallback: match by last 10+ digits (DDD + number) to handle country code differences
    //    SAFETY: Only accept if exactly 1 execution matches to prevent cross-contamination in batches
    if (executions.length === 0 && cleanPhone.length >= 10) {
      const suffixDigits = cleanPhone.slice(-(Math.min(cleanPhone.length, 11)));
      const suffixMatches = await prisma.flowExecution.findMany({
        where: {
          contactPhone: { endsWith: suffixDigits },
          status: FlowExecutionStatus.WAITING_REPLY,
          flow: { companyId }
        },
        include: {
          currentNode: true
        }
      });
      if (suffixMatches.length === 1) {
        executions = suffixMatches;
      } else if (suffixMatches.length > 1) {
        console.warn(`[FlowEngine:handleIncomingMessage] ⚠️ Suffix "${suffixDigits}" matched ${suffixMatches.length} executions — skipping to prevent cross-contamination. IDs: ${suffixMatches.map(e => e.id).join(', ')}`);
      }
    }

    // 🔗 FALLBACK POR LID: Se não encontrou pelo telefone, tenta pelo mapeamento LID.
    if (executions.length === 0) {
      const execsByLid = await prisma.flowExecution.findMany({
        where: {
          contactLid: cleanPhone,
          status: FlowExecutionStatus.WAITING_REPLY,
          flow: { companyId },
          startedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        include: { currentNode: true },
      });

      if (execsByLid.length > 0) {
        executions = execsByLid;
      }
    }

    // 🔗 FALLBACK POR CUSTOMER LID: Busca o customer pelo lidPhone e usa o phone real
    if (executions.length === 0) {
      const customerByLid = await prisma.customer.findFirst({
        where: {
          companyId,
          lidPhone: cleanPhone,
        },
        select: { phone: true },
      });

      if (customerByLid) {
        const realCleanPhone = customerByLid.phone.replace(/\D/g, '');
        let execsByRealPhone = await prisma.flowExecution.findMany({
          where: {
            contactPhone: realCleanPhone,
            status: FlowExecutionStatus.WAITING_REPLY,
            flow: { companyId },
          },
          include: { currentNode: true },
        });

        if (execsByRealPhone.length === 0 && realCleanPhone.length >= 10) {
          const realSuffix = realCleanPhone.slice(-(Math.min(realCleanPhone.length, 11)));
          const realSuffixMatches = await prisma.flowExecution.findMany({
            where: {
              contactPhone: { endsWith: realSuffix },
              status: FlowExecutionStatus.WAITING_REPLY,
              flow: { companyId },
            },
            include: { currentNode: true },
          });
          if (realSuffixMatches.length === 1) {
            execsByRealPhone = realSuffixMatches;
          } else if (realSuffixMatches.length > 1) {
            console.warn(`[FlowEngine:handleIncomingMessage] ⚠️ LID suffix "${realSuffix}" matched ${realSuffixMatches.length} executions — skipping.`);
          }
        }

        if (execsByRealPhone.length > 0) {
          executions = execsByRealPhone;
        }
      }
    }

    if (executions.length === 0) {
      return false;
    }

    for (const execution of executions) {
      if (execution.currentNode?.type === 'condition') {
        // The user replied! Remove timeout job e retoma fluxo
        await flowQueueService.removeTimeoutJob(execution.id, execution.currentNode.id);

        // Check atômico para evitar execução dupla com o timeout job
        const updated = await prisma.flowExecution.updateMany({
          where: { id: execution.id, status: FlowExecutionStatus.WAITING_REPLY },
          data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
        });

        if (updated.count === 0) {
          // Já processado pelo timeout job
          continue;
        }

        if (!execution.currentNode) {
          console.warn(`[FlowEngine] ⚠️ Execução ${execution.id} sem currentNode (nó deletado?). Marcando como FAILED.`);
          await prisma.flowExecution.update({
            where: { id: execution.id },
            data: { 
              status: FlowExecutionStatus.FAILED, 
              error: 'Nó atual não encontrado (provavelmente deletado)',
              completedAt: new Date(),
            }
          });
          continue;
        }

        // Determine which handle to follow based on message content
        const text = messageText.toLowerCase().trim();
        let handle = 'respondeu'; // Default: any response

        // Verifica se o nó tem uma palavra-chave configurada
        const nodeData = typeof execution.currentNode.data === 'string'
          ? JSON.parse(execution.currentNode.data)
          : (execution.currentNode.data || {});

        const keyword = (nodeData as Record<string, unknown>)?.keyword as string | undefined;

        if (keyword) {
          // Permite múltiplas palavras-chave separadas por vírgula (Ex: "sim, claro, quero")
          const keywords = keyword.toLowerCase().split(',').map(k => k.trim()).filter(k => k.length > 0);

          if (keywords.some(k => text.includes(k) || text === k)) {
            handle = 'palavra_chave';
          }
        }

        // Enfileira próximo step via BullMQ (sem delay — resposta humana deve ser processada rápido)
        await flowQueueService.enqueueFlowStep({
          executionId: execution.id,
          nodeId: execution.currentNode.id,
          sourceHandle: handle,
        });
      } else if (execution.currentNode?.type === 'ai_condition') {
        // AI condition processing
        await flowQueueService.removeTimeoutJob(execution.id, execution.currentNode.id);

        const updated = await prisma.flowExecution.updateMany({
          where: { id: execution.id, status: FlowExecutionStatus.WAITING_REPLY },
          data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
        });

        if (updated.count === 0) {
          continue;
        }

        const nodeData = typeof execution.currentNode.data === 'string'
          ? JSON.parse(execution.currentNode.data)
          : (execution.currentNode.data || {});
          
        const aiPrompt = (nodeData as Record<string, unknown>)?.aiPrompt as string || 'Classifique a intenção do usuário.';
        
        let handle = 'other'; // Default se a IA falhar ou não souber

        // 🧠 BUSCA DE CONTEXTO: Encontra a última mensagem enviada para este cliente
        // Isso ajuda a IA a entender o que o cliente está respondendo (ex: se disse "sim", sim para o que?)
        let contextMessage = '';
        try {
          const customer = await prisma.customer.findUnique({
            where: {
              companyId_phone: {
                companyId,
                phone: execution.contactPhone,
              }
            },
            select: { id: true }
          });

          if (customer) {
            const lastOutbound = await prisma.message.findFirst({
              where: {
                customerId: customer.id,
                direction: MessageDirection.OUTBOUND,
              },
              orderBy: { timestamp: 'desc' },
              select: { content: true }
            });
            if (lastOutbound) {
              contextMessage = lastOutbound.content;
            }
          }
        } catch (ctxErr) {
          console.warn(`[FlowEngine] ⚠️ Erro ao buscar contexto para AI Condition execution ${execution.id}:`, ctxErr);
        }
        
        try {
          // Usa o geminiService já importado no topo do arquivo
          const systemPrompt = `Você é um classificador de intenções especializado em atendimento via WhatsApp.
Sua tarefa é analisar a resposta de um cliente e determinar sua intenção baseando-se no contexto da última mensagem enviada pela empresa.

CONTEXTO (O que a empresa perguntou ou disse por último):
"${contextMessage || 'Sem contexto disponível'}"

MENSAGEM DO CLIENTE (A resposta que você deve classificar):
"${messageText}"

INSTRUÇÃO DE CLASSIFICAÇÃO ADICIONAL:
"${aiPrompt}"

Classifique a intenção do cliente em APENAS UMA das categorias abaixo:
- "interested": O cliente demonstra interesse, aceita uma proposta, quer agendar, quer saber preços, diz que sim, ou respondeu positivamente ao contexto.
- "not_interested": O cliente recusa, diz que não quer, pede para parar de enviar mensagens, ou demonstra desinteresse claro.
- "already_has": O cliente informa que já possui o produto/serviço, já é cliente da empresa, ou já resolveu sua necessidade.
- "other": Dúvidas que não indicam claramente interesse ou desinteresse, mensagens neutras, ou assuntos fora do contexto.

Responda APENAS a palavra-chave da categoria em letras minúsculas.`;

          const classification = await geminiService.generateResponse({
            systemPrompt,
            userPrompt: "Classifique a intenção do cliente com base no contexto fornecido.",
            temperature: 0.1,
            maxTokens: 15,
            enableTools: false,
          });
          
          const cleanClassification = classification.toLowerCase().trim();
          
          // Mapeamento robusto para garantir que o handle seja válido
          if (cleanClassification.includes('not_interested') || cleanClassification.includes('não interessado') || cleanClassification.includes('nao interessado')) {
             handle = 'not_interested';
          } else if (cleanClassification.includes('already_has') || cleanClassification.includes('já possui') || cleanClassification.includes('ja possui') || cleanClassification.includes('já tem')) {
             handle = 'already_has';
          } else if (cleanClassification.includes('interested') || cleanClassification.includes('interessado')) {
             handle = 'interested';
          } else if (cleanClassification.includes('other') || cleanClassification.includes('outros')) {
             handle = 'other';
          }
          
          console.log(`[FlowEngine] 🧠 AI Condition | context="${contextMessage.substring(0, 50)}..." | user="${messageText}" | handle=${handle} (Raw: ${cleanClassification})`);
          
        } catch (error) {
           console.error(`[FlowEngine] ❌ Erro ao classificar resposta na AI Condition. Fallback para 'other'.`, error);
        }

        await flowQueueService.enqueueFlowStep({
          executionId: execution.id,
          nodeId: execution.currentNode.id,
          sourceHandle: handle,
        });
      }
    }

    return true;
  }

  private async executeRandomNode(execution: Record<string, unknown>, node: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    const paths = (data.paths || [
      { id: 'path_a', percent: 50 },
      { id: 'path_b', percent: 50 },
    ]) as Array<{ id: string; percent: number }>;
    const enabledPaths = (data.enabledPaths || 2) as number;
    const activePaths = paths.slice(0, enabledPaths);

    const rand = Math.random() * 100;
    let cumulative = 0;
    let selectedHandle = activePaths[0].id;

    for (const path of activePaths) {
      cumulative += path.percent;
      if (rand <= cumulative) {
        selectedHandle = path.id;
        break;
      }
    }

    // Random é um nó de roteamento — processa imediatamente
    await this.processNextNodes(execution.id as string, node.id as string, selectedHandle);
  }

  private async executeValidationNode(execution: Record<string, unknown>, node: Record<string, unknown>, data: Record<string, unknown>, variables: Record<string, unknown>): Promise<void> {
    const variableTemplate = (data.variable || '') as string;
    const operator = (data.operator || 'equals') as string;
    const compareValue = (data.compareValue || '') as string;

    // Resolve the variable value from the execution variables
    const resolvedValue = this.replaceVariables(variableTemplate, variables);

    // If the template didn't resolve (still has {{}}), treat as empty
    const actualValue = resolvedValue === variableTemplate && variableTemplate.includes('{{')
      ? ''
      : resolvedValue;

    let result = false;

    const valLower = String(actualValue).toLowerCase().trim();
    const compareLower = String(compareValue).toLowerCase().trim();

    switch (operator) {
      case 'equals':
        result = valLower === compareLower;
        break;
      case 'not_equals':
        result = valLower !== compareLower;
        break;
      case 'contains':
        result = valLower.includes(compareLower);
        break;
      case 'not_contains':
        result = !valLower.includes(compareLower);
        break;
      case 'starts_with':
        result = valLower.startsWith(compareLower);
        break;
      case 'ends_with':
        result = valLower.endsWith(compareLower);
        break;
      case 'greater_than':
        result = parseFloat(actualValue) > parseFloat(compareValue);
        break;
      case 'less_than':
        result = parseFloat(actualValue) < parseFloat(compareValue);
        break;
      case 'is_empty':
        result = !actualValue || actualValue.trim() === '';
        break;
      case 'is_not_empty':
        result = !!actualValue && actualValue.trim() !== '';
        break;
      default:
        result = valLower === compareLower;
    }

    const handle = result ? 'true' : 'false';

    // Validation é um nó de roteamento — enfileira diretamente sem delay
    await flowQueueService.enqueueFlowStep({
      executionId: execution.id as string,
      nodeId: node.id as string,
      sourceHandle: handle,
    });
  }

  /**
   * 🔗 Captura o LID retornado pela Evolution API e armazena no FlowExecution e no Customer.
   */
  private async storeLidMapping(execution: Record<string, unknown>, responseRemoteJid?: string): Promise<void> {
    console.log(`[FlowEngine] 🔗 storeLidMapping chamado | execId="${execution.id}" contactPhone="${execution.contactPhone}" responseRemoteJid="${responseRemoteJid || 'UNDEFINED'}"`);

    if (!responseRemoteJid) {
      console.warn(`[FlowEngine] ⚠️ storeLidMapping: responseRemoteJid é undefined/null — Evolution API não retornou o JID na resposta do envio`);
      return;
    }

    try {
      const responsePhone = responseRemoteJid
        .replace("@s.whatsapp.net", "")
        .replace("@lid", "")
        .replace(/\D/g, "");

      const cleanContactPhone = (execution.contactPhone as string).replace(/\D/g, "");

      console.log(`[FlowEngine] 🔗 storeLidMapping | responsePhone="${responsePhone}" (${responsePhone.length} dígitos) cleanContactPhone="${cleanContactPhone}" (${cleanContactPhone.length} dígitos) match=${responsePhone === cleanContactPhone}`);

      // Se o JID retornado é diferente do telefone que enviamos, é um LID
      if (responsePhone && responsePhone !== cleanContactPhone) {
        // Determina qual é o LID e qual é o phone real
        const responseLooksLikeLid = responsePhone.length >= 14;
        const contactLooksLikeLid = cleanContactPhone.length >= 14;

        console.log(`[FlowEngine] 🔗 storeLidMapping | responseLooksLikeLid=${responseLooksLikeLid} contactLooksLikeLid=${contactLooksLikeLid}`);

        // Só armazena se um deles parece LID e o outro parece phone real
        if (responseLooksLikeLid || contactLooksLikeLid) {
          const lidValue = responseLooksLikeLid ? responsePhone : cleanContactPhone;
          const realPhone = responseLooksLikeLid ? cleanContactPhone : responsePhone;

          console.log(`[FlowEngine] ✅ storeLidMapping SALVANDO | lidValue="${lidValue}" realPhone="${realPhone}" execId="${execution.id}"`);

          // Salva no FlowExecution para matching de respostas
          await prisma.flowExecution.update({
            where: { id: execution.id as string },
            data: { contactLid: lidValue },
          });

          // Salva no Customer para matching futuro permanente
          const flow = await prisma.flow.findUnique({
            where: { id: execution.flowId as string },
            select: { companyId: true },
          });

          if (flow) {
            const updateResult = await prisma.customer.updateMany({
              where: { companyId: flow.companyId, phone: realPhone, lidPhone: null },
              data: { lidPhone: lidValue },
            });
            console.log(`[FlowEngine] 🔗 storeLidMapping | Customer.lidPhone atualizado: ${updateResult.count} registro(s) para phone="${realPhone}"`);
          }
        } else {
          // Ambos parecem telefones normais (< 14 dígitos) mas são diferentes
          // Isso pode acontecer quando a Evolution API retorna um número diferente
          // (ex: 2500068408 para o nosso 5548996917435)
          console.warn(`[FlowEngine] ⚠️ storeLidMapping | Números diferentes mas nenhum parece LID: response="${responsePhone}" contact="${cleanContactPhone}". Possível número interno do WhatsApp Business.`);
        }
      } else {
        console.log(`[FlowEngine] 🔗 storeLidMapping | responsePhone === contactPhone — sem LID para mapear (mesmo número retornado)`);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn(`[FlowEngine] ⚠️ Falha ao armazenar LID mapping (não crítico):`, error.message);
    }
  }

  /**
   * 💾 Salva a mensagem enviada pelo fluxo na conversa do CRM
   */
  private async saveFlowMessageToConversation(
    execution: Record<string, unknown>,
    instance: Record<string, unknown>,
    content: string,
    externalMessageId?: string,
    mediaType: string = 'text',
    mediaUrl?: string
  ): Promise<void> {
    try {
      // Busca o companyId do fluxo
      const flow = await prisma.flow.findUnique({
        where: { id: execution.flowId as string },
        select: { companyId: true }
      });

      if (!flow) return;

      // Busca o customer usando a busca por variantes
      const customer = await customerService.findByPhoneWithVariant(execution.contactPhone as string, flow.companyId);

      if (!customer) {
        console.warn(`[FlowEngine] ⚠️ Customer não encontrado para salvar mensagem na conversa: ${execution.contactPhone}`);
        return;
      }

      // Salva a mensagem na tabela de mensagens
      await messageService.createMessage({
        customerId: customer.id,
        whatsappInstanceId: instance.id as string,
        direction: MessageDirection.OUTBOUND,
        content: content,
        timestamp: new Date(),
        status: MessageStatus.SENT,
        messageId: externalMessageId || undefined,
        mediaType: mediaType,
        mediaUrl: mediaUrl || null,
      });

    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Não falha o fluxo se não conseguir salvar na conversa
      console.warn(`[FlowEngine] ⚠️ Falha ao salvar mensagem na conversa (não crítico):`, error.message);
    }
  }
}
