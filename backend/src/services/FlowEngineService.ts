import { prisma } from '../utils/prisma';
import whatsappService from './whatsapp.service';
import { FlowExecutionStatus, MessageDirection, MessageStatus } from '@prisma/client';
import messageService from './message.service';
import { websocketService } from './websocket.service';

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

// Configurações do circuit breaker
const CB_MAX_CONSECUTIVE_ERRORS = 5;     // Abre o circuito após 5 erros seguidos
const CB_INITIAL_COOLDOWN_MS = 30_000;   // 30s de pausa inicial
const CB_MAX_COOLDOWN_MS = 5 * 60_000;   // Máximo 5 minutos de pausa
const CB_MAX_RETRIES = 2;                // Tentativas por mensagem (1 original + 2 retries)
const CB_RETRY_BASE_DELAY_MS = 3_000;    // 3s base para retry (exponencial)

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
      // Cooldown expirou — entra em half-open (permite tentar novamente)
      console.log(`[FlowEngine:CircuitBreaker] ⏰ Cooldown expirou. Tentando reabrir (half-open)...`);
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
  private recordSuccess() {
    if (circuitBreaker.consecutiveErrors > 0) {
      console.log(`[FlowEngine:CircuitBreaker] ✅ Envio bem-sucedido após ${circuitBreaker.consecutiveErrors} erro(s). Resetando contador.`);
    }
    circuitBreaker.consecutiveErrors = 0;
    circuitBreaker.isOpen = false;
  }

  /**
   * 🛡️ Registra erro no circuit breaker. Se ultrapassar o limite, abre o circuito.
   */
  private recordError(error: string) {
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
   * 🛡️ Envia mensagem com retry e circuit breaker.
   * Retorna o resultado do envio ou lança erro após todas as tentativas.
   */
  private async sendWithRetry(
    sendFn: () => Promise<any>,
    context: string
  ): Promise<any> {
    // Verifica circuit breaker antes de tentar
    const cbCheck = this.checkCircuitBreaker();
    if (cbCheck.blocked) {
      throw new Error(`[CircuitBreaker] ${cbCheck.reason}`);
    }

    let lastError: any;

    for (let attempt = 0; attempt <= CB_MAX_RETRIES; attempt++) {
      try {
        const result = await sendFn();
        this.recordSuccess();
        return result;
      } catch (err: any) {
        lastError = err;
        const isLastAttempt = attempt === CB_MAX_RETRIES;

        // Identifica se é erro de rede/API (retentável) vs erro de dados (não retentável)
        const isRetryable = this.isRetryableError(err);

        if (!isRetryable || isLastAttempt) {
          this.recordError(err.message || 'Erro desconhecido');
          if (!isLastAttempt) {
            console.warn(`[FlowEngine] ❌ ${context}: Erro não retentável: ${err.message}`);
          } else {
            console.error(`[FlowEngine] ❌ ${context}: Falhou após ${CB_MAX_RETRIES + 1} tentativas: ${err.message}`);
          }
          break;
        }

        // Backoff exponencial: 3s, 6s
        const delayMs = CB_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[FlowEngine] ⏳ ${context}: Tentativa ${attempt + 1}/${CB_MAX_RETRIES + 1} falhou (${err.message}). Retry em ${(delayMs / 1000).toFixed(1)}s...`);
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
   * 🛡️ Determina se um erro é retentável (falha de rede/API) ou permanente (dados inválidos)
   */
  private isRetryableError(err: any): boolean {
    const message = (err.message || '').toLowerCase();
    const status = err.response?.status;

    // Erros de rede são retentáveis
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
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

    // Erros 400, 401, 403, 404 NÃO são retentáveis (problema nos dados)
    if (status && status >= 400 && status < 500) {
      return false;
    }

    // Default: não retentável (melhor falhar rápido do que ficar tentando)
    return false;
  }

  /**
   * Starts a flow execution for a given contact
   */
  public async startFlow(flowId: string, contactPhone: string, variables: any) {
    // Limpa o número de telefone (remove formatações)
    const cleanPhone = contactPhone.replace(/\D/g, '');

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


    // Add "automação" tag and flow autoTags to customer (creates customer if not present)
    let customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone, companyId: flow.companyId }
    });

    if (!customer) {
      // Try to extract name from variables if it's a new lead
      const custName = variables.name || variables.nome || variables.customer?.name || variables.customer?.nome || variables.data?.customer?.name || variables.data?.nome || variables.lead?.name || cleanPhone;
      
      // Busca o primeiro estágio do pipeline para atribuir ao novo lead
      const firstStage = await prisma.pipelineStage.findFirst({
        where: { companyId: flow.companyId },
        orderBy: { order: 'asc' },
      });

      customer = await prisma.customer.create({
        data: {
          companyId: flow.companyId,
          phone: cleanPhone,
          name: String(custName),
          tags: [],
          pipelineStageId: firstStage?.id || null,
        }
      });
    }

    if (customer) {
      const existingTags = customer.tags || [];
      const tagsToAdd = ['automação', ...((flow as any).autoTags || [])];
      
      // Usa Set para unificar as tags e remover duplicatas
      const combinedTags = Array.from(new Set([...existingTags, ...tagsToAdd]));
      
      if (combinedTags.length > existingTags.length) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { tags: combinedTags } // Mais seguro do que { push: xxx }
        });

        // Registrar as tags recém-adicionadas na tabela Tag para aparecer nos filtros do chat
        try {
          const { default: tagService } = await import('./tag.service');
          await tagService.createOrGetMany(flow.companyId, combinedTags);
        } catch (tagErr: any) {
          console.warn(`[FlowEngine] ⚠️ Error creating tags in DB for customer ${customer.id}:`, tagErr.message);
        }
      }

      // Desativar a IA quando entra em um fluxo vindo de webhook
      try {
        const { default: conversationService } = await import('./conversation.service');
        await conversationService.getOrCreateConversation(customer.id, flow.companyId);
        await conversationService.toggleAI(customer.id, false);
        
        const { websocketService } = await import('./websocket.service');
        if (websocketService.isInitialized()) {
          websocketService.emitConversationUpdate(flow.companyId, customer.id, {
            aiEnabled: false,
          });
        }
      } catch (err: any) {
        console.warn(`[FlowEngine] ⚠️ Error disabling AI for customer ${customer.id}:`, err.message);
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

    // Create execution (usa o phone limpo + instância selecionada)
    const execution = await prisma.flowExecution.create({
      data: {
        flowId,
        contactPhone: cleanPhone,
        variables,
        currentNodeId: triggerNode.id,
        whatsappInstanceId: selectedInstance.id,
        status: FlowExecutionStatus.RUNNING,
        history: [triggerNode.id],
      }
    });


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
      console.log(`[FlowEngine] ⚡ ${activeExecs.length} execução(ões) cancelada(s) para ${cleanPhone} → substituída por ${execution.id}`);
    }

    // Start processing from the next node
    await this.processNextNodes(execution.id, triggerNode.id);

    return execution;
  }

  /**
   * Processes the next nodes in the flow based on edges
   */
  public async processNextNodes(executionId: string, currentNodeId: string, sourceHandle?: string) {
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
        // Isso cobre o caso de edges criadas antes do nó ter handles específicos
        const noHandleEdges = edges.filter(e => !e.sourceHandle);
        if (noHandleEdges.length > 0) {
          console.warn(`[FlowEngine] ⚠️ Nenhuma edge com handle "${sourceHandle}" encontrada. Usando ${noHandleEdges.length} edge(s) sem handle definido como fallback.`);
          edges = noHandleEdges;
        }
        // Se nem edges sem handle existem, edges fica vazio → flow completed
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

    // Process all target nodes (usually just one, unless branching without conditions)
    for (const edge of edges) {
      const targetNode = flow.nodes.find(n => n.id === edge.targetNodeId);
      if (targetNode) {
        await this.executeNode(execution, targetNode);
      }
    }
  }

  /**
   * Executes a specific node's action
   */
  private replaceVariables(text: string, variables: any): string {
    if (!text) return '';
    
    // Recursive helper to resolve nested paths (e.g., "data.customer.name")
    const getNestedValue = (obj: any, path: string) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    // Replace variables using regex to find all {{path.to.var}} patterns
    const variableRegex = /{{(.*?)}}/g;
    return text.replace(variableRegex, (match: string, path: string) => {
      const val = getNestedValue(variables, path.trim());
      return val !== undefined ? String(val) : match;
    });
  }

  private async executeNode(execution: any, node: any) {
    // Update current node and history
    const currentHistory = Array.isArray(execution.history) ? execution.history : [];
    const newHistory = [...currentHistory, node.id];

    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: { 
        currentNodeId: node.id,
        history: newHistory
      }
    });
    
    // Update local object for this cycle
    execution.history = newHistory;

    try {
      const data = node.data as any;
      const variables = typeof execution.variables === 'string' ? JSON.parse(execution.variables) : (execution.variables || {});

      switch (node.type) {
        case 'message':
          await this.executeMessageNode(execution, data, variables);
          // Move to next node immediately
          await this.processNextNodes(execution.id, node.id);
          break;

        case 'condition':
          await this.executeConditionNode(execution, node, data);
          break;

        case 'delay':
          await this.executeDelayNode(execution, node, data);
          break;
          
        case 'audio':
        case 'image':
        case 'video':
          await this.executeMediaNode(execution, node, data, variables);
          await this.processNextNodes(execution.id, node.id);
          break;

        case 'ai_action':
          await this.executeAiActionNode(execution, node, data);
          await this.processNextNodes(execution.id, node.id);
          break;

        case 'validation':
          await this.executeValidationNode(execution, node, data, variables);
          break;

        case 'random':
          await this.executeRandomNode(execution, node, data);
          break;

        default:
          console.warn(`[FlowEngine] Unknown node type: ${node.type}`);
          await this.processNextNodes(execution.id, node.id);
          break;
      }
    } catch (error: any) {
      console.error(`[FlowEngine] Error executing node ${node.id}:`, error);
      await prisma.flowExecution.update({
        where: { id: execution.id },
        data: { status: FlowExecutionStatus.FAILED, error: error.message }
      });
    }
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

    // RANDOM (padrão): Seleciona aleatoriamente entre as instâncias conectadas
    const randomIndex = Math.floor(Math.random() * connectedInstances.length);
    const selectedInstance = connectedInstances[randomIndex];
    return selectedInstance;
  }

  private async executeMessageNode(execution: any, data: any, variables: any) {
    let text = data.text || data.message || data.content || '';

    text = this.replaceVariables(text, variables);

    if (!text || text.trim() === '') {
      console.warn(`[FlowEngine] ⚠️ Texto da mensagem está vazio! Verifique o nó de mensagem no fluxo.`);
    }

    // Usa a instância que foi selecionada no início do fluxo (persistida na execução)
    const instance = execution.whatsappInstance;

    if (!instance) {
      throw new Error(`Nenhuma instância WhatsApp associada à execução do fluxo (executionId: ${execution.id})`);
    }

    // Typing presence for 2 seconds before sending message
    const delayMs = 2000;
    try {
      await whatsappService.sendPresence(instance.id, execution.contactPhone, delayMs, "composing");
    } catch (presenceErr: any) {
      console.warn(`[FlowEngine] ⚠️ Falha ao enviar presença (não crítico):`, presenceErr.message);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));


    const result = await this.sendWithRetry(
      () => whatsappService.sendMessage({
        instanceId: instance.id,
        to: execution.contactPhone,
        text
      }),
      `sendMessage(${execution.contactPhone})`
    );

    // 🔗 Captura o LID retornado pela Evolution API para mapeamento futuro
    await this.storeLidMapping(execution, result?.remoteJid);

    // 💾 Salvar a mensagem no banco para aparecer na aba de conversas
    await this.saveFlowMessageToConversation(execution, instance, text, result?.messageId, 'text');
  }

  private async executeMediaNode(execution: any, node: any, data: any, variables: any) {
    // Usa a instância que foi selecionada no início do fluxo (persistida na execução)
    const instance = execution.whatsappInstance;

    if (instance) {
      const isAudio = node.type === 'audio';
      // Manda status "gravando..." (recording) se for áudio, senão "digitando..."
      const presenceType = isAudio ? "recording" : "composing";
      const delayMs = isAudio ? 4000 : 2000;
      
      await whatsappService.sendPresence(instance.id, execution.contactPhone, delayMs, presenceType);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Aceita mediaUrl (link público para MP3/OGG/IMG) ou mediaBase64
      const mediaSource = data.mediaUrl || data.mediaBase64;

      if (mediaSource) {
        let caption = data.caption || undefined;
        if (caption) {
          caption = this.replaceVariables(caption, variables);
        }

        const result = await this.sendWithRetry(
          () => whatsappService.sendMedia({
            instanceId: instance.id,
            to: execution.contactPhone,
            mediaBase64: mediaSource,
            mediaType: node.type, // 'audio', 'image' or 'video'
            caption: caption
          }),
          `sendMedia(${execution.contactPhone}, ${node.type})`
        );

        // 🔗 Captura o LID retornado pela Evolution API para mapeamento futuro
        await this.storeLidMapping(execution, result?.remoteJid);

        // 💾 Salvar mídia na conversa
        await this.saveFlowMessageToConversation(
          execution, instance,
          caption || `[${node.type}]`,
          result?.messageId,
          node.type, // 'audio', 'image', 'video'
          mediaSource
        );
      } else {
        console.warn(`[FlowEngine] Sem mídia informada no nó ${node.id} do fluxo.`);
      }
    } else {
      throw new Error('Nenhuma instância do WhatsApp conectada para enviar mídia');
    }
  }

  private async executeConditionNode(execution: any, node: any, data: any) {
    // For a "wait for reply" condition, we pause the execution
    
    // Calculate the timeout date based on data
    
    const value = data.waitValue || data.waitHours || 24;
    const unit = data.waitUnit || (data.waitHours ? 'hours' : 'hours');

    let delaySeconds = 0;
    if (unit === 'seconds') delaySeconds = Number(value);
    else if (unit === 'minutes') delaySeconds = Number(value) * 60;
    else if (unit === 'hours') delaySeconds = Number(value) * 3600;
    else if (unit === 'days') delaySeconds = Number(value) * 86400;
    else delaySeconds = Number(value) * 3600; // Default hours

    const resumesAt = new Date();
    resumesAt.setSeconds(resumesAt.getSeconds() + delaySeconds);

    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: { 
        status: FlowExecutionStatus.WAITING_REPLY,
        resumesAt
      }
    });

  }

  private async executeDelayNode(execution: any, node: any, data: any) {
    
    const value = data.delayValue || data.minutes || 60;
    const unit = data.delayUnit || 'minutes';

    let delaySeconds = 0;
    if (unit === 'seconds') delaySeconds = Number(value);
    else if (unit === 'minutes') delaySeconds = Number(value) * 60;
    else if (unit === 'hours') delaySeconds = Number(value) * 3600;
    else if (unit === 'days') delaySeconds = Number(value) * 86400;
    else delaySeconds = Number(value) * 60; // Default minutes

    const resumesAt = new Date();
    resumesAt.setSeconds(resumesAt.getSeconds() + delaySeconds);

    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: { 
        status: FlowExecutionStatus.DELAYED,
        resumesAt
      }
    });

    // Here we would enqueue a job in BullMQ to wake up after `delayMinutes`
  }

  private async executeAiActionNode(execution: any, node: any, data: any) {
    const action = data.aiAction || 'enable';
    const turnOn = action === 'enable'; // 'enable' or 'disable'
    
    const customer = await prisma.customer.findFirst({
      where: { phone: execution.contactPhone, companyId: execution.flow.companyId }
    });

    if (customer) {
      try {
        const { default: conversationService } = await import('./conversation.service');
        await conversationService.getOrCreateConversation(customer.id, execution.flow.companyId);
        await conversationService.toggleAI(customer.id, turnOn);
        
        const { websocketService } = await import('./websocket.service');
        if (websocketService.isInitialized()) {
          websocketService.emitConversationUpdate(execution.flow.companyId, customer.id, {
            aiEnabled: turnOn,
            ...(turnOn ? { needsHelp: false } : {})
          });
        }
      } catch (err: any) {
        console.warn(`[FlowEngine] ⚠️ Error toggling AI for customer ${customer.id}:`, err.message);
      }
    }
  }

  /**
   * Called by the Webhook (Evolution API) when a message is received
   */
  public async handleIncomingMessage(contactPhone: string, companyId: string, messageText: string = '', whatsappInstanceId?: string | null): Promise<boolean> {
    const cleanPhone = contactPhone.replace(/\D/g, '');
    const rightDigits = cleanPhone.length > 8 ? cleanPhone.slice(-8) : cleanPhone;

    console.log(`[FlowEngine:handleIncomingMessage] contactPhone="${contactPhone}" cleanPhone="${cleanPhone}" rightDigits="${rightDigits}" companyId="${companyId}" instanceId="${whatsappInstanceId}"`);

    // Find if there's any active execution waiting for a reply for this contact
    let executions = await prisma.flowExecution.findMany({
      where: {
        contactPhone: { endsWith: rightDigits },
        status: FlowExecutionStatus.WAITING_REPLY,
        flow: { companyId }
      },
      include: {
        currentNode: true
      }
    });

    console.log(`[FlowEngine:handleIncomingMessage] Found ${executions.length} WAITING_REPLY executions for rightDigits="${rightDigits}"`);
    if (executions.length > 0) {
      executions.forEach(e => console.log(`  -> execution id=${e.id} contactPhone="${e.contactPhone}" nodeType="${e.currentNode?.type}" resumesAt=${e.resumesAt}`));
    }

    // 🔗 FALLBACK POR LID: Se não encontrou pelo telefone, tenta pelo mapeamento LID.
    // Quando o fluxo envia mensagem e a Evolution API retorna um LID diferente,
    // armazenamos o LID no campo contactLid. Aqui buscamos execuções cujo contactLid
    // corresponde ao telefone que está respondendo (ou vice-versa).
    if (executions.length === 0) {
      // Busca pelo LID armazenado na execução (caso o phone que responde É o LID)
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
        console.log(`[FlowEngine:handleIncomingMessage] 🔗 Matched by contactLid: reply from "${cleanPhone}" matched ${execsByLid.length} execution(s)`);
        executions = execsByLid;
      }
    }

    // 🔗 FALLBACK POR CUSTOMER LID: Busca o customer pelo lidPhone e usa o phone real
    // para encontrar a execução.
    if (executions.length === 0) {
      const customerByLid = await prisma.customer.findFirst({
        where: {
          companyId,
          lidPhone: cleanPhone,
        },
        select: { phone: true },
      });

      if (customerByLid) {
        const realRightDigits = customerByLid.phone.length > 8 ? customerByLid.phone.slice(-8) : customerByLid.phone;
        const execsByRealPhone = await prisma.flowExecution.findMany({
          where: {
            contactPhone: { endsWith: realRightDigits },
            status: FlowExecutionStatus.WAITING_REPLY,
            flow: { companyId },
          },
          include: { currentNode: true },
        });

        if (execsByRealPhone.length > 0) {
          console.log(`[FlowEngine:handleIncomingMessage] 🔗 Matched by customer lidPhone: LID "${cleanPhone}" → real phone "${customerByLid.phone}", found ${execsByRealPhone.length} execution(s)`);
          executions = execsByRealPhone;
        }
      }
    }

    if (executions.length === 0) {
      // Debug: check if there are executions for this phone in any status
      const anyExec = await prisma.flowExecution.findMany({
        where: { contactPhone: { endsWith: rightDigits } },
        select: { id: true, status: true, contactPhone: true, resumesAt: true },
        take: 5,
      });
      console.log(`[FlowEngine:handleIncomingMessage] No WAITING_REPLY found. All executions for this phone:`, JSON.stringify(anyExec));
      return false;
    }


    for (const execution of executions) {
      if (execution.currentNode?.type === 'condition') {
        // The user replied!
        await prisma.flowExecution.update({
          where: { id: execution.id },
          data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
        });

        // Determine which handle to follow based on message content
        const text = messageText.toLowerCase().trim();
        let handle = 'respondeu'; // Default: any response

        // Verifica se o nó tem uma palavra-chave configurada
        const nodeData = typeof execution.currentNode.data === 'string' 
          ? JSON.parse(execution.currentNode.data) 
          : (execution.currentNode.data || {});
          
        const keyword = nodeData?.keyword as string | undefined;

        if (keyword) {
          // Permite múltiplas palavras-chave separadas por vírgula (Ex: "sim, claro, quero")
          const keywords = keyword.toLowerCase().split(',').map(k => k.trim()).filter(k => k.length > 0);
          
          if (keywords.some(k => text.includes(k) || text === k)) {
            handle = 'palavra_chave';
          }
        }

        // Continue flow through the identified handle
        await this.processNextNodes(execution.id, execution.currentNode.id, handle);
        
        // Note: The BullMQ timeout job should be cancelled here if possible
      }
    }

    return true;
  }

  private async executeRandomNode(execution: any, node: any, data: any) {
    const paths = data.paths || [
      { id: 'path_a', percent: 50 },
      { id: 'path_b', percent: 50 },
    ];
    const enabledPaths = data.enabledPaths || 2;
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

    await this.processNextNodes(execution.id, node.id, selectedHandle);
  }

  private async executeValidationNode(execution: any, node: any, data: any, variables: any) {
    const variableTemplate = data.variable || ''; // e.g. "{{name}}"
    const operator = data.operator || 'equals';
    const compareValue = data.compareValue || '';

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

    await this.processNextNodes(execution.id, node.id, handle);
  }

  /**
   * 🔗 Captura o LID retornado pela Evolution API e armazena no FlowExecution e no Customer.
   * Quando enviamos uma mensagem para um telefone real, a Evolution API pode retornar um
   * remoteJid diferente (LID). Armazenamos esse mapeamento para que quando o cliente
   * responder com o LID, possamos identificá-lo corretamente.
   */
  private async storeLidMapping(execution: any, responseRemoteJid?: string) {
    if (!responseRemoteJid) return;

    try {
      const responsePhone = responseRemoteJid
        .replace("@s.whatsapp.net", "")
        .replace("@lid", "")
        .replace(/\D/g, "");

      const cleanContactPhone = execution.contactPhone.replace(/\D/g, "");

      // Se o JID retornado é diferente do telefone que enviamos, é um LID
      if (responsePhone && responsePhone !== cleanContactPhone) {
        // Determina qual é o LID e qual é o phone real
        const responseLooksLikeLid = responsePhone.length >= 14;
        const contactLooksLikeLid = cleanContactPhone.length >= 14;

        // Só armazena se um deles parece LID e o outro parece phone real
        if (responseLooksLikeLid || contactLooksLikeLid) {
          const lidValue = responseLooksLikeLid ? responsePhone : cleanContactPhone;
          const realPhone = responseLooksLikeLid ? cleanContactPhone : responsePhone;

          console.log(`[FlowEngine] 🔗 LID mapping detectado: LID=${lidValue} → phone=${realPhone}`);

          // Salva no FlowExecution para matching de respostas
          await prisma.flowExecution.update({
            where: { id: execution.id },
            data: { contactLid: lidValue },
          });

          // Salva no Customer para matching futuro permanente
          const flow = await prisma.flow.findUnique({
            where: { id: execution.flowId },
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
    } catch (err: any) {
      console.warn(`[FlowEngine] ⚠️ Falha ao armazenar LID mapping (não crítico):`, err.message);
    }
  }

  /**
   * 💾 Salva a mensagem enviada pelo fluxo na conversa do CRM
   * Isso faz com que a mensagem apareça na aba de conversas/chat
   */
  private async saveFlowMessageToConversation(
    execution: any,
    instance: any,
    content: string,
    externalMessageId?: string,
    mediaType: string = 'text',
    mediaUrl?: string
  ) {
    try {
      // Busca o companyId do fluxo
      const flow = await prisma.flow.findUnique({
        where: { id: execution.flowId },
        select: { companyId: true }
      });

      if (!flow) return;

      // Busca o customer pelo telefone + companyId
      const customer = await prisma.customer.findFirst({
        where: {
          phone: execution.contactPhone,
          companyId: flow.companyId
        }
      });

      if (!customer) {
        console.warn(`[FlowEngine] ⚠️ Customer não encontrado para salvar mensagem na conversa: ${execution.contactPhone}`);
        return;
      }

      // Salva a mensagem na tabela de mensagens
      const message = await messageService.createMessage({
        customerId: customer.id,
        whatsappInstanceId: instance.id,
        direction: MessageDirection.OUTBOUND,
        content: content,
        timestamp: new Date(),
        status: MessageStatus.SENT,
        messageId: externalMessageId || undefined,
        mediaType: mediaType,
        mediaUrl: mediaUrl || null,
      });

    } catch (err: any) {
      // Não falha o fluxo se não conseguir salvar na conversa
      console.warn(`[FlowEngine] ⚠️ Falha ao salvar mensagem na conversa (não crítico):`, err.message);
    }
  }
}
