import { prisma } from '../utils/prisma';
import whatsappService from './whatsapp.service';
import { FlowExecutionStatus, MessageDirection, MessageStatus } from '@prisma/client';
import messageService from './message.service';
import { websocketService } from './websocket.service';

export class FlowEngineService {
  constructor() {
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


    // Seleciona a instância WhatsApp UMA VEZ no início do fluxo (respeita estratégia RANDOM/SPECIFIC)
    // Trazido para cima para usar a instância para buscar a foto de perfil do contato (se aplicável)
    const selectedInstance = await this.getInstanceForCompany(flow.companyId);
    if (!selectedInstance) {
      console.error(`[FlowEngine] ❌ Nenhuma instância WhatsApp conectada para companyId ${flow.companyId}`);
      throw new Error(`Nenhuma instância WhatsApp conectada para iniciar o fluxo`);
    }

    // Add "automação" tag and flow autoTags to customer (creates customer if not present)
    let customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone, companyId: flow.companyId }
    });

    if (!customer) {
      // Try to extract name from variables if it's a new lead
      let custName = variables.name || variables.nome || variables.customer?.name || variables.customer?.nome || variables.data?.customer?.name || variables.data?.nome || variables.lead?.name;
      let profilePicUrl: string | null = null;

      // Buscar foto e nome na Evolution API via instância selecionada para disparo
      try {
        const profileInfo = await whatsappService.getContactProfileInfo(selectedInstance.instanceName, cleanPhone);
        if (profileInfo.profilePicUrl) profilePicUrl = profileInfo.profilePicUrl;
        if (!custName && profileInfo.name) custName = profileInfo.name;
      } catch (err: any) {
        console.warn(`[FlowEngine] ⚠️ Falha ao buscar perfil do contato na API:`, err.message);
      }

      if (!custName) custName = cleanPhone;
      
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
          profilePicUrl: profilePicUrl,
          tags: [],
          pipelineStageId: firstStage?.id || null,
        }
      });
      console.log(`[FlowEngine] 👤 New customer created automatically: ${cleanPhone} in stage ${firstStage?.name || 'Default'}`);
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
        console.log(`[FlowEngine] 🏷️ Tags updated for ${cleanPhone}:`, combinedTags);
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
      console.log(`[FlowEngine] 🛑 Flow ${executionId} completed (no edges)`);
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
    console.log(`[FlowEngine] 🎲 Instância selecionada aleatoriamente: ${selectedInstance.instanceName} (${randomIndex + 1}/${connectedInstances.length})`);
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

    
    const result = await whatsappService.sendMessage({
      instanceId: instance.id,
      to: execution.contactPhone,
      text
    });

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

        const result = await whatsappService.sendMedia({
          instanceId: instance.id,
          to: execution.contactPhone,
          mediaBase64: mediaSource,
          mediaType: node.type, // 'audio', 'image' or 'video'
          caption: caption
        });

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
        console.log(`[FlowEngine] 🤖 AI for customer ${customer.id} set to ${turnOn ? 'ON' : 'OFF'}`);
      } catch (err: any) {
        console.warn(`[FlowEngine] ⚠️ Error toggling AI for customer ${customer.id}:`, err.message);
      }
    }
  }

  /**
   * Called by the Webhook (Evolution API) when a message is received
   */
  public async handleIncomingMessage(contactPhone: string, companyId: string, messageText: string = ''): Promise<boolean> {
    const cleanPhone = contactPhone.replace(/\D/g, '');
    const rightDigits = cleanPhone.length > 8 ? cleanPhone.slice(-8) : cleanPhone;

    // Find if there's any active execution waiting for a reply for this contact
    const executions = await prisma.flowExecution.findMany({
      where: {
        contactPhone: { endsWith: rightDigits },
        status: FlowExecutionStatus.WAITING_REPLY,
        flow: { companyId }
      },
      include: {
        currentNode: true
      }
    });

    if (executions.length === 0) {
      console.log(`[FlowEngine] ⚪ No active WAITING_REPLY executions found for ${cleanPhone}`);
      return false;
    }

    console.log(`[FlowEngine] 🟢 Found ${executions.length} active execution(s) waiting reply for ${cleanPhone}`);

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
    console.log(`[FlowEngine] 🛡️ Validation: ${variableTemplate} ("${actualValue}") ${operator} "${compareValue}" → ${result ? '✅ TRUE' : '❌ FALSE'}`);

    await this.processNextNodes(execution.id, node.id, handle);
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

      console.log(`[FlowEngine] 💾 Mensagem salva na conversa do customer ${customer.id} (messageId: ${message.id})`);
    } catch (err: any) {
      // Não falha o fluxo se não conseguir salvar na conversa
      console.warn(`[FlowEngine] ⚠️ Falha ao salvar mensagem na conversa (não crítico):`, err.message);
    }
  }
}
