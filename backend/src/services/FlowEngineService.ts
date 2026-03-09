import { prisma } from '../utils/prisma';
import whatsappService from './whatsapp.service';
import { FlowExecutionStatus, MessageDirection, MessageStatus, PlanTier } from '@prisma/client';
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

// Tempo de "digitando..." antes de enviar mensagem de texto e áudio
const TYPING_DELAY_TEXT_MS = 15_000;  // 15s para mensagem de texto
const TYPING_DELAY_AUDIO_MS = 30_000; // 30s para áudio (gravando...)

// Limite a partir do qual um nó de delay é considerado "pausa longa" para o batch.
// Abaixo disso, o contato atual ainda está "em progresso" e o próximo não é disparado.
const BATCH_LONG_DELAY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

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
            // Continua para o próximo retry com o novo chip
          }
        }

        // Identifica se é erro de rede/API (retentável) vs erro de dados (não retentável)
        const isRetryable = this.isRetryableError(err);

        if (!isRetryable || isLastAttempt) {
          this.recordError(error.message || 'Erro desconhecido');
          if (isLastAttempt) {
            console.error(`[FlowEngine] ❌ ${context}: Falhou após ${CB_MAX_RETRIES + 1} tentativas: ${error.message}`);
          }
          break;
        }

        // Backoff exponencial: 3s, 6s
        const delayMs = CB_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
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

        // Atualiza no banco para que futuros passos deste fluxo já usem o novo chip
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: { whatsappInstanceId: (newInstance as any).id }
        });

        return newInstance as unknown as Record<string, unknown>;
      }
    } catch {
      // ignorado — falha de failover não é crítica
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

    if (!stageId) return;
    if (!customerId) return;

    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: { pipelineStageId: stageId }
      });

    } catch (err: any) {
      console.error(`[FlowEngine] ❌ Erro ao mover cliente ${customerId} para estágio ${stageId}:`, err.message);
      throw new Error(`Falha ao alterar estágio no funil: ${err.message}`);
    }
  }

  /**
   * Envia uma reação emoji para a última mensagem recebida do contato.
   * Reage à mensagem inbound mais recente encontrada no banco.
   */
  private async executeReactionNode(
    execution: Record<string, unknown>,
    _node: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<void> {
    const emoji = (data.emoji as string) || '👍';
    const contactPhone = execution.contactPhone as string;
    const instanceId = (execution.whatsappInstanceId as string) || (execution.whatsappInstance as any)?.id;
    const flow = execution.flow as Record<string, unknown>;
    const companyId = flow.companyId as string;

    // Busca a última mensagem recebida (inbound) do contato para saber o messageId
    const lastInbound = await prisma.message.findFirst({
      where: {
        direction: MessageDirection.INBOUND,
        customer: { companyId, phone: contactPhone },
        messageId: { not: null },
      },
      orderBy: { timestamp: 'desc' },
      select: { messageId: true },
    });

    if (!lastInbound?.messageId) {
      // Sem mensagem inbound para reagir — encerra silenciosamente
      return;
    }

    await whatsappService.sendReaction({
      instanceId,
      remoteJid: contactPhone,
      messageId: lastInbound.messageId,
      fromMe: false,
      emoji,
    });
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
        if (error.code === 'P2002') { /* conflito de normalização de telefone — ignorado */ }
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
        } catch { /* falha ao registrar tags — não crítico */ }
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
      } catch { /* falha ao desativar IA — não crítico */ }
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
        await prisma.flowExecution.update({
          where: { id: execution.id },
          data: {
            status: FlowExecutionStatus.FAILED,
            error: `O número ${cleanPhone} não possui WhatsApp ou é inválido.`,
            completedAt: new Date()
          }
        });
        // 🔗 Número inválido: avança o próximo contato do batch
        await this.advanceBatchQueue(variables, flowId, data.companyId);
        return;
      }
    } catch (err: any) {
      console.error(`[FlowEngine] ❌ Erro ao validar número ${cleanPhone} na Evolution:`, err.message);
      await prisma.flowExecution.update({
        where: { id: execution.id },
        data: {
          status: FlowExecutionStatus.FAILED,
          error: `Falha técnica ao validar número: ${err.message}`,
          completedAt: new Date()
        }
      });
      // 🔗 Erro técnico: avança o próximo contato do batch
      await this.advanceBatchQueue(variables, flowId, data.companyId);
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
        flow: { include: { nodes: true, edges: true, company: true } },
        whatsappInstance: true,
        currentNode: true,
      }
    });

    if (!execution) return;

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
    //
    // ⚠️ Em fluxos com branches paralelas (_activeBranches > 1), o history não é linear —
    // múltiplas branches gravam no mesmo history. O stale guard não se aplica nesse caso.
    if (execution.status === FlowExecutionStatus.RUNNING) {
      const execVarsRaw = execution.variables;
      const execVars = (typeof execVarsRaw === 'string' ? JSON.parse(execVarsRaw) : (execVarsRaw || {})) as Record<string, unknown>;
      const activeBranches = typeof execVars._activeBranches === 'number' ? execVars._activeBranches : 1;

      if (activeBranches <= 1) {
        const history = Array.isArray(execution.history) ? execution.history as string[] : [];
        const currentNodeId = execution.currentNodeId;

        // O job é para um nodeId que não é o nó atual da execução
        if (currentNodeId && currentNodeId !== nodeId) {
          // Verifica se o nodeId deste job já foi processado (está no history)
          // E se o nó atual da execução é POSTERIOR ao nodeId (= fluxo avançou)
          const nodeIdxInHistory = history.lastIndexOf(nodeId);
          const currentIdxInHistory = history.lastIndexOf(currentNodeId);

          if (nodeIdxInHistory >= 0 && currentIdxInHistory > nodeIdxInHistory) {
            return;
          }
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
      include: { flow: { include: { nodes: true, edges: true, company: true } }, whatsappInstance: true }
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
          edges = noHandleEdges;
        } else {
          // Se não há match exato nem fallback, edges fica vazio para que o fluxo termine ou não bifurque erroneamente
          edges = [];
        }
      }
    }

    if (edges.length === 0) {
      // Branch terminal — decrementa contador de branches paralelas atomicamente.
      // Só marca COMPLETED quando todas as branches tiverem terminado.
      const countResult = await prisma.$queryRaw<Array<{ new_count: number }>>`
        UPDATE flow_executions
        SET variables = jsonb_set(
          COALESCE(variables, '{}')::jsonb,
          '{_activeBranches}',
          to_jsonb(GREATEST(COALESCE((variables->>'_activeBranches')::int, 1) - 1, 0))
        )
        WHERE id = ${executionId}
        RETURNING (variables->>'_activeBranches')::int as new_count
      `;
      const remaining = countResult[0]?.new_count ?? 0;
      if (remaining > 0) {
        // Outras branches ainda ativas — não encerra o fluxo
        return;
      }

      await prisma.flowExecution.update({
        where: { id: executionId },
        data: { status: FlowExecutionStatus.COMPLETED, completedAt: new Date() }
      });
      // 🔗 Avança o próximo contato do batch (se houver)
      const vars = typeof execution.variables === 'string'
        ? JSON.parse(execution.variables)
        : (execution.variables as Record<string, unknown> || {});
      await this.advanceBatchQueue(vars, execution.flowId as string, (execution.flow as any).companyId);
      return;
    }

    // Quando há múltiplas edges saindo (branches paralelas), incrementa o contador
    // para que nenhuma branch individual encerre o fluxo prematuramente.
    if (edges.length > 1) {
      await prisma.$executeRaw`
        UPDATE flow_executions
        SET variables = jsonb_set(
          COALESCE(variables, '{}')::jsonb,
          '{_activeBranches}',
          to_jsonb(COALESCE((variables->>'_activeBranches')::int, 1) + ${edges.length - 1})
        )
        WHERE id = ${executionId}
      `;
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

          // 🛡️ IDEMPOTÊNCIA: jobId determinístico evita que retries do BullMQ enfileirem
          // o mesmo nó duas vezes (causando envio duplo de mensagem).
          const stepJobId = `step_${execution.id}_${targetNode.id}`;
          await flowQueueService.enqueueFlowStep(
            { executionId: execution.id, nodeId: targetNode.id, sourceHandle: 'INTERNAL_EXECUTE' },
            { delay, jobId: stepJobId }
          );
        } else {
          // Se é lógica ou espera, executa agora sem delay para fluxo instantâneo
          await this.executeNode(execution, targetNode);
        }
      }
    }
  }

  /**
   * 🔗 Avança a fila Redis de um batch: dispara o próximo contato pendente.
   * Chamado quando uma execução termina (COMPLETED/FAILED) ou entra em pausa longa
   * (WAITING_REPLY ou DELAYED > BATCH_LONG_DELAY_THRESHOLD_MS).
   */
  private async advanceBatchQueue(
    variables: Record<string, unknown>,
    flowId: string,
    companyId: string,
  ): Promise<void> {
    const batchId = variables._batchId as string | undefined;
    if (!batchId) return;

    const { FlowBatchController } = await import('../controllers/FlowBatchController');
    const queueKey = FlowBatchController.batchQueueKey(batchId);

    try {
      const nextJson = await redisConnection.lpop(queueKey);
      if (!nextJson) return; // fila esgotada
      const nextContact = JSON.parse(nextJson) as FlowStartJobData;

      // Verifica janela de envio por fuso horário
      let windowDelay = 0;
      try {
        const configJson = await redisConnection.get(FlowBatchController.batchConfigKey(batchId));
        if (configJson) {
          const config = JSON.parse(configJson) as { enabled: boolean; start: number; end: number };
          if (config.enabled) {
            const { getTimezoneFromPhone, getDelayUntilWindow } = await import('../utils/phone-timezone');
            const tz = getTimezoneFromPhone(nextContact.contactPhone);
            windowDelay = getDelayUntilWindow(tz, config.start, config.end);
          }
        }
      } catch { /* falha na verificação de janela — envia sem delay de janela */ }

      await flowQueueService.enqueueFlowStart(nextContact, { delay: windowDelay });
    } catch { /* falha ao avançar fila do batch — não crítico */ }
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
    const gap = Math.floor(Math.random() * (MSG_SEND_DELAY_MAX_MS - MSG_SEND_DELAY_MIN_MS)) + MSG_SEND_DELAY_MIN_MS;
    const ttl = 10 * 60 * 1000; // 10 minutos em ms

    // Script Lua atômico: GET → compara → SET em uma única operação.
    // Evita race condition onde múltiplos workers leem o mesmo valor antes do SET.
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local gap = tonumber(ARGV[2])
      local ttl = tonumber(ARGV[3])
      local current = tonumber(redis.call('GET', key) or '0')
      if current < now then current = now end
      local next_slot = current + gap
      redis.call('SET', key, tostring(next_slot), 'PX', ttl)
      return current - now
    `;

    try {
      const delay = await redisConnection.eval(
        luaScript, 1, key,
        now.toString(), gap.toString(), ttl.toString()
      ) as number;

      const safeDelay = Math.max(0, delay);

      return safeDelay;
    } catch {
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
      const company = (execution.flow as any).company;
      if (!company) {
        throw new Error('Empresa associada ao fluxo não encontrada.');
      }

      // 1. Verificar status da assinatura
      if (company.subscriptionStatus !== 'active' && company.subscriptionStatus !== 'trailing') {
        throw new Error(`Assinatura da empresa '${company.name}' está inativa ou pendente (${company.subscriptionStatus}).`);
      }

      // 2. Verificar se o plano permite fluxos (WORKFLOW)
      const plan = company.plan as PlanTier;
      if (plan === PlanTier.INICIAL) {
        throw new Error(`Fluxos de automação não estão disponíveis no plano INICIAL.`);
      }

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

        case 'validation': {
          const validationHandle = await this.executeValidationNode(execution, node, data, variables);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string, validationHandle);
          break;
        }

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

        case 'reaction':
          await this.executeReactionNode(execution, node, data);
          await this.markNodeCompleted(execution.id as string, node.id as string);
          await this.processNextNodes(execution.id as string, node.id as string);
          break;

        default:
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
      // 🔗 Avança o próximo contato do batch mesmo em caso de erro
      const vars = typeof execution.variables === 'string'
        ? JSON.parse(execution.variables)
        : (execution.variables as Record<string, unknown> || {});
      await this.advanceBatchQueue(vars, (execution.flow as any).id, (execution.flow as any).companyId);
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


    // Usa a instância que foi selecionada no início do fluxo (persistida na execução)
    const instance = execution.whatsappInstance as Record<string, unknown> | null;

    if (!instance) {
      throw new Error(`Nenhuma instância WhatsApp associada à execução do fluxo (executionId: ${execution.id})`);
    }

    const contactPhone = execution.contactPhone as string;

    // Exibe "digitando..." por 15s antes de enviar
    try {
      await whatsappService.sendPresence(instance.id as string, contactPhone, TYPING_DELAY_TEXT_MS, "composing");
      await new Promise(resolve => setTimeout(resolve, TYPING_DELAY_TEXT_MS));
    } catch { /* presença não crítica */ }

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
    const presenceDelay = isAudio ? TYPING_DELAY_AUDIO_MS : TYPING_DELAY_TEXT_MS;

    // Exibe "gravando..." (áudio) ou "digitando..." (imagem/vídeo) antes de enviar
    try {
      await whatsappService.sendPresence(instance.id as string, contactPhone, presenceDelay, presenceType);
      await new Promise(resolve => setTimeout(resolve, presenceDelay));
    } catch { /* presença não crítica */ }

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
    const company = (execution.flow as any).company;
    const plan = company?.plan as PlanTier;

    if (plan !== PlanTier.ESCALA_TOTAL) {
      throw new Error('Geração de imagem via IA disponível apenas no plano ESCALA_TOTAL.');
    }

    const instance = execution.whatsappInstance as Record<string, unknown> | null;
    if (!instance) {
      throw new Error('Nenhuma instância do WhatsApp conectada para enviar imagem IA');
    }

    const contactPhone = execution.contactPhone as string;

    // 1. Resolve o prompt com variáveis do CSV
    let prompt = (data.aiPrompt || data.prompt || '') as string;
    prompt = this.replaceVariables(prompt, variables);

    if (!prompt || prompt.trim() === '') {
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

    // Logging omitted

    // 4. Presence (composing) enquanto gera
    try {
      await whatsappService.sendPresence(instance.id as string, contactPhone, 5000, 'composing');
    } catch { /* presença não crítica */ }

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

    // Logging omitted
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

    // 🔗 Contato está aguardando resposta — libera o próximo contato do batch
    const condVars = typeof execution.variables === 'string'
      ? JSON.parse(execution.variables)
      : (execution.variables as Record<string, unknown> || {});
    await this.advanceBatchQueue(condVars, (execution.flow as any).id, (execution.flow as any).companyId);

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

    // 🔗 Delay longo (> 5 min): libera o próximo contato do batch enquanto este espera
    if (delayMs >= BATCH_LONG_DELAY_THRESHOLD_MS) {
      const delayVars = typeof execution.variables === 'string'
        ? JSON.parse(execution.variables)
        : (execution.variables as Record<string, unknown> || {});
      await this.advanceBatchQueue(delayVars, (execution.flow as any).id, (execution.flow as any).companyId);
    }
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
      } catch { /* falha ao ativar IA — não crítico */ }
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
        } catch { /* contexto não disponível */ }
        
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

  private async executeValidationNode(execution: Record<string, unknown>, node: Record<string, unknown>, data: Record<string, unknown>, variables: Record<string, unknown>): Promise<string> {
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

    // Retorna o handle correto para quem chamou rotear via processNextNodes
    return result ? 'true' : 'false';
  }

  /**
   * 🔗 Captura o LID retornado pela Evolution API e armazena no FlowExecution e no Customer.
   */
  private async storeLidMapping(execution: Record<string, unknown>, responseRemoteJid?: string): Promise<void> {
    if (!responseRemoteJid) return;

    try {
      const responsePhone = responseRemoteJid
        .replace("@s.whatsapp.net", "")
        .replace("@lid", "")
        .replace(/\D/g, "");

      const cleanContactPhone = (execution.contactPhone as string).replace(/\D/g, "");


      // Se o JID retornado é diferente do telefone que enviamos, é um LID
      if (responsePhone && responsePhone !== cleanContactPhone) {
        // Determina qual é o LID e qual é o phone real
        const responseLooksLikeLid = responsePhone.length >= 14;
        const contactLooksLikeLid = cleanContactPhone.length >= 14;


        // Só armazena se um deles parece LID e o outro parece phone real
        if (responseLooksLikeLid || contactLooksLikeLid) {
          const lidValue = responseLooksLikeLid ? responsePhone : cleanContactPhone;
          const realPhone = responseLooksLikeLid ? cleanContactPhone : responsePhone;


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
            await prisma.customer.updateMany({
              where: { companyId: flow.companyId, phone: realPhone, lidPhone: null },
              data: { lidPhone: lidValue },
            });
          }
        }
      }
    } catch { /* falha ao armazenar LID mapping — não crítico */ }
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

      if (!customer) return;

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

    } catch { /* falha ao salvar mensagem na conversa — não falha o fluxo */ }
  }
}
