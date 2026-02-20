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

    // Add "automação" tag to customer if not present
    const customer = await prisma.customer.findFirst({
      where: { phone: contactPhone, companyId: flow.companyId }
    });

    if (customer && !customer.tags.includes('automação')) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { tags: { push: 'automação' } }
      });
    }

    // Create execution
    const execution = await prisma.flowExecution.create({
      data: {
        flowId,
        contactPhone,
        variables,
        currentNodeId: triggerNode.id,
        status: FlowExecutionStatus.RUNNING,
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
      include: { flow: { include: { nodes: true, edges: true } } }
    });

    if (!execution || execution.status !== FlowExecutionStatus.RUNNING) {
      return;
    }

    const { flow } = execution;
    
    // Find edges coming from the current node
    let edges = flow.edges.filter(e => e.sourceNodeId === currentNodeId);
    
    // If a specific handle was provided (e.g., 'respondeu' or 'nao_respondeu'), filter by it
    if (sourceHandle) {
      edges = edges.filter(e => e.sourceHandle === sourceHandle);
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
  private async executeNode(execution: any, node: any) {
    // Update current node
    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: { currentNodeId: node.id }
    });

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
    let text = data.text || '';
    
    // Replace variables (e.g., {{nome}})
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'gi');
      text = text.replace(regex, String(value));
    }

    // We need to find an active WhatsApp instance for this company
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { companyId: execution.flow.companyId, status: 'CONNECTED' }
    });

    if (instance) {
      // Typing presence for 3 seconds before sending message
      const delayMs = 3000;
      await whatsappService.sendPresence(instance.id, execution.contactPhone, delayMs, "composing");
      await new Promise(resolve => setTimeout(resolve, delayMs));

      await whatsappService.sendMessage({
        instanceId: instance.id,
        to: execution.contactPhone,
        text
      });
    } else {
      throw new Error('No connected WhatsApp instance found to send message');
    }
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
    // and ideally schedule a BullMQ job for the "timeout" (e.g. 24 hours)
    
    // Let's calculate the timeout date based on data
    const delayMinutes = data.waitMinutes || 60 * 24; // Default 24h
    const resumesAt = new Date();
    resumesAt.setMinutes(resumesAt.getMinutes() + delayMinutes);

    await prisma.flowExecution.update({
      where: { id: execution.id },
      data: { 
        status: FlowExecutionStatus.WAITING_REPLY,
        resumesAt
      }
    });

    // Here we would enqueue a job in BullMQ to wake up after `delayMinutes`
    // queue.add('flow-timeout', { executionId: execution.id, nodeId: node.id }, { delay: delayMinutes * 60 * 1000 });
    console.log(`[FlowEngine] Flow paused at condition node, waiting for reply until ${resumesAt}`);
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
