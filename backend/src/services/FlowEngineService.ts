import { prisma } from '../utils/prisma';
import whatsappService from './whatsapp.service';
import { FlowExecutionStatus } from '@prisma/client';

export class FlowEngineService {
  constructor() {
  }

  /**
   * Starts a flow execution for a given contact
   */
  public async startFlow(flowId: string, contactPhone: string, variables: any) {
    // Limpa o número de telefone (remove formatações)
    const cleanPhone = contactPhone.replace(/\D/g, '');
    console.log(`[FlowEngine] 🚀 startFlow - flowId: ${flowId}, phone: "${contactPhone}" -> "${cleanPhone}"`);
    console.log(`[FlowEngine] Variables recebidas:`, JSON.stringify(variables));

    // Find the flow and its nodes/edges
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: { nodes: true, edges: true }
    });

    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    console.log(`[FlowEngine] Flow encontrado: "${flow.name}" - ${flow.nodes.length} nó(s) e ${flow.edges.length} aresta(s)`);

    // Find the trigger node (type = 'webhook' or similar)
    const triggerNode = flow.nodes.find(n => n.type === 'trigger' || n.type === 'webhook');
    if (!triggerNode) {
      throw new Error(`Flow ${flowId} has no trigger node`);
    }

    console.log(`[FlowEngine] Nó trigger encontrado: ${triggerNode.id} (tipo: ${triggerNode.type})`);

    // Add "automação" tag to customer if not present
    const customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone, companyId: flow.companyId }
    });

    if (customer && !customer.tags.includes('automação')) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { tags: { push: 'automação' } }
      });
    }

    // Create execution (usa o phone limpo)
    const execution = await prisma.flowExecution.create({
      data: {
        flowId,
        contactPhone: cleanPhone,
        variables,
        currentNodeId: triggerNode.id,
        status: FlowExecutionStatus.RUNNING,
        history: [triggerNode.id],
      }
    });

    console.log(`[FlowEngine] Execução criada: ${execution.id}`);

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
      include: { flow: { include: { nodes: true, edges: true } } }
    });

    if (!execution || execution.status !== FlowExecutionStatus.RUNNING) {
      console.log(`[FlowEngine] processNextNodes abortado - status: ${execution?.status}`);
      return;
    }

    const { flow } = execution;
    
    // Find edges coming from the current node
    let edges = flow.edges.filter(e => e.sourceNodeId === currentNodeId);
    
    // If a specific handle was provided (e.g., 'respondeu' or 'nao_respondeu'), filter by it
    if (sourceHandle) {
      edges = edges.filter(e => e.sourceHandle === sourceHandle);
    }

    console.log(`[FlowEngine] processNextNodes - nó atual: ${currentNodeId}, arestas encontradas: ${edges.length}`);

    if (edges.length === 0) {
      // Flow ended
      await prisma.flowExecution.update({
        where: { id: executionId },
        data: { status: FlowExecutionStatus.COMPLETED, completedAt: new Date() }
      });
      console.log(`[FlowEngine] ✅ Fluxo concluído (sem próximos nós)`);
      return;
    }

    // Process all target nodes (usually just one, unless branching without conditions)
    for (const edge of edges) {
      const targetNode = flow.nodes.find(n => n.id === edge.targetNodeId);
      if (targetNode) {
        console.log(`[FlowEngine] ➡️ Executando nó: ${targetNode.id} (tipo: ${targetNode.type})`);
        await this.executeNode(execution, targetNode);
      }
    }
  }

  /**
   * Executes a specific node's action
   */
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
          await this.executeMediaNode(execution, node, data, variables);
          await this.processNextNodes(execution.id, node.id);
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

  private async executeMessageNode(execution: any, data: any, variables: any) {
    let text = data.text || data.message || data.content || '';
    
    console.log(`[FlowEngine] executeMessageNode - texto base: "${text}"`);
    console.log(`[FlowEngine] executeMessageNode - variáveis disponíveis:`, JSON.stringify(variables));
    console.log(`[FlowEngine] executeMessageNode - data do nó:`, JSON.stringify(data));

    // Replace variables (e.g., {{nome}}, {{phone}}, etc.)
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'gi');
      text = text.replace(regex, String(value));
    }
    
    console.log(`[FlowEngine] executeMessageNode - texto final após substituição: "${text}"`);

    if (!text || text.trim() === '') {
      console.warn(`[FlowEngine] ⚠️ Texto da mensagem está vazio! Verifique o nó de mensagem no fluxo.`);
    }

    // Busca instância CONNECTED ou CONNECTING para a empresa
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { 
        companyId: execution.flow.companyId, 
        status: { in: ['CONNECTED', 'CONNECTING'] }
      }
    });

    console.log(`[FlowEngine] companyId: ${execution.flow.companyId}, instância encontrada: ${instance?.instanceName || 'NENHUMA'}`);

    if (!instance) {
      // Loga todas as instâncias disponíveis para diagnóstico
      const allInstances = await prisma.whatsAppInstance.findMany({
        where: { companyId: execution.flow.companyId },
        select: { id: true, instanceName: true, status: true }
      });
      console.error(`[FlowEngine] ❌ Instâncias para companyId ${execution.flow.companyId}:`, JSON.stringify(allInstances));
      throw new Error(`Nenhuma instância WhatsApp conectada encontrada para enviar mensagem (companyId: ${execution.flow.companyId})`);
    }

    // Typing presence for 2 seconds before sending message
    const delayMs = 2000;
    try {
      await whatsappService.sendPresence(instance.id, execution.contactPhone, delayMs, "composing");
    } catch (presenceErr: any) {
      console.warn(`[FlowEngine] ⚠️ Falha ao enviar presença (não crítico):`, presenceErr.message);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));

    console.log(`[FlowEngine] 📤 Enviando mensagem para ${execution.contactPhone} via instância ${instance.instanceName}...`);
    
    await whatsappService.sendMessage({
      instanceId: instance.id,
      to: execution.contactPhone,
      text
    });

    console.log(`[FlowEngine] ✅ Mensagem enviada com sucesso para ${execution.contactPhone}`);
  }

  private async executeMediaNode(execution: any, node: any, data: any, variables: any) {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { companyId: execution.flow.companyId, status: 'CONNECTED' }
    });

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
        await whatsappService.sendMedia({
          instanceId: instance.id,
          to: execution.contactPhone,
          mediaBase64: mediaSource,
          mediaType: isAudio ? "audio" : "image",
          caption: data.caption || undefined
        });
      } else {
        console.warn(`[FlowEngine] Sem mídia informada no nó ${node.id} do fluxo.`);
      }
    } else {
      throw new Error('Nenhuma instância do WhatsApp conectada para enviar mídia');
    }
  }

  private async executeConditionNode(execution: any, node: any, data: any) {
    // For a "wait for reply" condition, we pause the execution
    
    // Let's calculate the timeout date based on data
    const delayMinutes = data.waitHours ? Number(data.waitHours) * 60 : (data.waitMinutes || 60 * 24); // Default 24h
    const resumesAt = new Date();
    resumesAt.setMinutes(resumesAt.getMinutes() + delayMinutes);

    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: { 
        status: FlowExecutionStatus.WAITING_REPLY,
        resumesAt
      }
    });

    console.log(`[FlowEngine] Flow paused at condition node, waiting for reply until ${resumesAt} (limit: ${delayMinutes} mins)`);
  }

  private async executeDelayNode(execution: any, node: any, data: any) {
    const delayMinutes = data.minutes || 60;
    const resumesAt = new Date();
    resumesAt.setMinutes(resumesAt.getMinutes() + delayMinutes);

    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: { 
        status: FlowExecutionStatus.DELAYED,
        resumesAt
      }
    });

    // Here we would enqueue a job in BullMQ to wake up after `delayMinutes`
    console.log(`[FlowEngine] Flow delayed at delay node, will resume at ${resumesAt}`);
  }

  /**
   * Called by the Webhook (Evolution API) when a message is received
   */
  public async handleIncomingMessage(contactPhone: string, companyId: string) {
    // Find if there's any active execution waiting for a reply for this contact
    const executions = await prisma.flowExecution.findMany({
      where: {
        contactPhone,
        status: FlowExecutionStatus.WAITING_REPLY,
        flow: { companyId }
      },
      include: {
        currentNode: true
      }
    });

    for (const execution of executions) {
      if (execution.currentNode?.type === 'condition') {
        // The user replied!
        await prisma.flowExecution.update({
          where: { id: execution.id },
          data: { status: FlowExecutionStatus.RUNNING, resumesAt: null }
        });

        // Continue flow through the 'respondeu' handle
        await this.processNextNodes(execution.id, execution.currentNode.id, 'respondeu');
        
        // Note: The BullMQ timeout job should be cancelled here if possible
      }
    }
  }
}
