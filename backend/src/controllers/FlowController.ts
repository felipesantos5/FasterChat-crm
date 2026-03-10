import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { FlowExecutionStatus } from '@prisma/client';
import flowQueueService from '../services/flow-queue.service';
import { randomUUID } from 'crypto';
import ImageKit from 'imagekit';

export class FlowController {
  public async getFlows(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user!;

    const flows = await prisma.flow.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { executions: true } },
      }
    });

    return res.json(flows);
  }

  public async getFlowById(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;

    const flow = await prisma.flow.findUnique({
      where: { id, companyId },
      include: {
        nodes: true,
        edges: true,
      }
    });

    if (!flow) {
      throw new AppError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Flow not found',
        userMessage: 'Fluxo não encontrado',
        statusCode: 404
      });
    }

    return res.json(flow);
  }

  public async createFlow(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user!;
    const { name, description, triggerType = 'webhook', autoTags = [] } = req.body;

    if (!name) {
      throw new AppError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Name is required to create a flow',
        userMessage: 'Nome do fluxo é obrigatório',
        statusCode: 400
      });
    }

    // Generate unique webhook slug
    const webhookSlug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;

    const flow = await prisma.flow.create({
      data: {
        companyId,
        name,
        description,
        triggerType,
        webhookSlug,
        status: 'ACTIVE', // Inicia Ativo para facilitar teste imediato
        ...({ autoTags: autoTags } as any),
      },
    });

    return res.status(201).json(flow);
  }

  public async updateFlow(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;
    const { name, description, status, webhookSlug, autoTags, sendWindowEnabled, sendWindowStart, sendWindowEnd } = req.body;

    const flowExists = await prisma.flow.findUnique({
      where: { id, companyId },
    });

    if (!flowExists) {
      throw new AppError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Flow not found',
        userMessage: 'Fluxo não encontrado',
        statusCode: 404
      });
    }

    const flow = await prisma.flow.update({
      where: { id },
      data: {
        name,
        description,
        status,
        webhookSlug,
        ...((autoTags !== undefined ? { autoTags } : {}) as any),
        ...(sendWindowEnabled !== undefined ? { sendWindowEnabled: Boolean(sendWindowEnabled) } : {}),
        ...(sendWindowStart !== undefined ? { sendWindowStart: Number(sendWindowStart) } : {}),
        ...(sendWindowEnd !== undefined ? { sendWindowEnd: Number(sendWindowEnd) } : {}),
      },
    });

    return res.json(flow);
  }

  public async saveFlowNodes(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;
    const { nodes, edges } = req.body;

    const flowExists = await prisma.flow.findUnique({
      where: { id, companyId },
    });

    if (!flowExists) {
      throw new AppError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Flow not found',
        userMessage: 'Fluxo não encontrado',
        statusCode: 404
      });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Identificar nós e edges atuais
      const currentNodes = await tx.flowNode.findMany({ where: { flowId: id }, select: { id: true } });
      const currentEdges = await tx.flowEdge.findMany({ where: { flowId: id }, select: { id: true } });

      const incomingNodeIds = (nodes || []).map((n: any) => n.id);
      const incomingEdgeIds = (edges || []).map((e: any) => e.id);

      const nodesToDelete = currentNodes.filter(n => !incomingNodeIds.includes(n.id)).map(n => n.id);
      const edgesToDelete = currentEdges.filter(e => !incomingEdgeIds.includes(e.id)).map(e => e.id);

      // 2. Apagar apenas edges excluídos na tela (precisamos deletar edges antes dos nós para evitar violação de FK)
      if (edgesToDelete.length > 0) {
        await tx.flowEdge.deleteMany({
          where: { flowId: id, id: { in: edgesToDelete } },
        });
      }

      // 3. Apagar apenas os nós que foram excluídos na tela
      if (nodesToDelete.length > 0) {
        await tx.flowNode.deleteMany({
          where: { flowId: id, id: { in: nodesToDelete } },
        });
      }

      // 4. Inserir ou atualizar os nós (Upsert)
      if (nodes && nodes.length > 0) {
        for (const n of nodes) {
          await tx.flowNode.upsert({
            where: { id: n.id },
            create: {
              id: n.id,
              flowId: id,
              type: n.type,
              data: n.data || {},
              positionX: n.position?.x || 0,
              positionY: n.position?.y || 0,
            },
            update: {
              type: n.type,
              data: n.data || {},
              positionX: n.position?.x || 0,
              positionY: n.position?.y || 0,
              updatedAt: new Date(),
            },
          });
        }
      }

      // 5. Inserir ou atualizar edges (Upsert)
      if (edges && edges.length > 0) {
        for (const e of edges) {
          await tx.flowEdge.upsert({
            where: { id: e.id },
            create: {
              id: e.id,
              flowId: id,
              sourceNodeId: e.source,
              sourceHandle: e.sourceHandle,
              targetNodeId: e.target,
              targetHandle: e.targetHandle,
            },
            update: {
              sourceNodeId: e.source,
              sourceHandle: e.sourceHandle,
              targetNodeId: e.target,
              targetHandle: e.targetHandle,
            },
          });
        }
      }
    });

    return res.json({ message: 'Flow saved successfully' });
  }

  public async deleteFlow(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;

    const flowExists = await prisma.flow.findUnique({
      where: { id, companyId },
    });

    if (!flowExists) {
      throw new AppError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Flow not found',
        userMessage: 'Fluxo não encontrado',
        statusCode: 404
      });
    }

    await prisma.flow.delete({
      where: { id },
    });

    return res.status(204).send();
  }

  private static flattenObjectWithValues(obj: any, prefix = ''): { key: string, value: any }[] {
    let result: { key: string, value: any }[] = [];
    if (!obj || typeof obj !== 'object') return result;

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const path = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          result = result.concat(FlowController.flattenObjectWithValues(obj[key], path));
        } else if (Array.isArray(obj[key])) {
          result.push({ key: path, value: `Array(${obj[key].length})` });
        } else {
          result.push({ key: path, value: obj[key] });
        }
      }
    }
    return result;
  }

  public getFlowVariables = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user!;

    const flow = await prisma.flow.findUnique({
      where: { id, companyId },
      select: { lastWebhookPayload: true }
    });

    if (!flow) {
      throw new AppError({
        code: 'VALIDATION_ERROR' as any,
        message: 'Flow not found',
        userMessage: 'Fluxo não encontrado',
        statusCode: 404
      });
    }

    let variables: { key: string, value: any }[] = [];
    if (flow.lastWebhookPayload && typeof flow.lastWebhookPayload === 'object') {
      variables = FlowController.flattenObjectWithValues(flow.lastWebhookPayload);
      variables = variables.filter(v => v.key !== 'phone');
    }

    return res.json({ variables });
  }

  public async executeSingle(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Número de telefone é obrigatório.' });
    }

    const flow = await prisma.flow.findUnique({ where: { id, companyId } });
    if (!flow) {
      return res.status(404).json({ error: 'Fluxo não encontrado.' });
    }

    const { FlowEngineService } = await import('../services/FlowEngineService');
    const engine = new FlowEngineService();
    await engine.startFlow(id, phone.trim(), { _testDisparo: true });

    return res.json({ success: true });
  }

  public async getFlowExecutions(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;

    const where = { flowId: id, flow: { companyId } };

    const executions = await prisma.flowExecution.findMany({
      where,
      orderBy: { startedAt: 'desc' },
    });

    return res.json({ executions, total: executions.length });
  }

  public async cancelExecution(req: Request, res: Response): Promise<Response> {
    const { id: flowId, executionId } = req.params;
    const { companyId } = req.user!;

    const execution = await prisma.flowExecution.findFirst({
      where: { id: executionId, flowId, flow: { companyId } }
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execução não encontrada.' });
    }

    const cancellable: FlowExecutionStatus[] = [
      FlowExecutionStatus.RUNNING,
      FlowExecutionStatus.WAITING_REPLY,
      FlowExecutionStatus.DELAYED,
    ];

    if (!cancellable.includes(execution.status)) {
      return res.status(400).json({ error: 'Esta execução já foi concluída ou cancelada.' });
    }

    await prisma.flowExecution.update({
      where: { id: executionId },
      data: {
        status: FlowExecutionStatus.PAUSED,
        resumesAt: null,
        completedAt: new Date(),
        error: 'Cancelado pelo usuário',
      }
    });

    // Remove jobs BullMQ pendentes para esta execução
    await flowQueueService.removeJobsForExecution(executionId);

    return res.json({ success: true });
  }

  /**
   * GET /api/flows/customer/:customerId/active-execution
   * Retorna a execução ativa de fluxo para um customer (se existir)
   */
  public async getActiveExecutionByCustomer(req: Request, res: Response): Promise<Response> {
    const { customerId } = req.params;
    const { companyId } = req.user!;

    // Busca o customer para pegar o telefone
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: { phone: true, lidPhone: true },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    // Busca execução ativa pelo telefone do customer
    const activeStatuses: FlowExecutionStatus[] = [
      FlowExecutionStatus.RUNNING,
      FlowExecutionStatus.WAITING_REPLY,
      FlowExecutionStatus.DELAYED,
    ];

    const phoneVariants = [customer.phone];
    if (customer.lidPhone) phoneVariants.push(customer.lidPhone);

    const execution = await prisma.flowExecution.findFirst({
      where: {
        contactPhone: { in: phoneVariants },
        status: { in: activeStatuses },
        flow: { companyId },
      },
      include: {
        flow: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    return res.json({ execution });
  }

  /**
   * DELETE /api/flows/executions/:executionId/cancel
   * Cancela uma execução por ID (sem precisar do flowId)
   */
  public async cancelExecutionById(req: Request, res: Response): Promise<Response> {
    const { executionId } = req.params;
    const { companyId } = req.user!;

    const execution = await prisma.flowExecution.findFirst({
      where: { id: executionId, flow: { companyId } },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execução não encontrada.' });
    }

    const cancellable: FlowExecutionStatus[] = [
      FlowExecutionStatus.RUNNING,
      FlowExecutionStatus.WAITING_REPLY,
      FlowExecutionStatus.DELAYED,
    ];

    if (!cancellable.includes(execution.status)) {
      return res.status(400).json({ error: 'Esta execução já foi concluída ou cancelada.' });
    }

    await prisma.flowExecution.update({
      where: { id: executionId },
      data: {
        status: FlowExecutionStatus.PAUSED,
        resumesAt: null,
        completedAt: new Date(),
        error: 'Cancelado pelo usuário',
      },
    });

    // Remove jobs BullMQ pendentes para esta execução
    await flowQueueService.removeJobsForExecution(executionId);

    return res.json({ success: true });
  }

  /**
   * POST /api/flows/:id/duplicate
   * Duplica um fluxo existente (nodes + edges) como rascunho.
   */
  public async duplicateFlow(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;

    const original = await prisma.flow.findFirst({
      where: { id, companyId },
      include: { nodes: true, edges: true },
    });

    if (!original) {
      return res.status(404).json({ error: 'Fluxo não encontrado.' });
    }

    const webhookSlug = `${original.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-copy-${Math.random().toString(36).substring(2, 7)}`;

    const duplicate = await prisma.$transaction(async (tx) => {
      const newFlow = await tx.flow.create({
        data: {
          companyId,
          name: `Cópia de ${original.name}`,
          description: (original as any).description,
          triggerType: original.triggerType,
          webhookSlug,
          status: 'DRAFT',
          autoTags: (original as any).autoTags ?? [],
        },
      });

      // Mapeia IDs antigos → novos para recriar as edges corretamente
      const nodeIdMap = new Map<string, string>();

      for (const node of original.nodes) {
        const newId = randomUUID();
        await tx.flowNode.create({
          data: {
            id: newId,
            flowId: newFlow.id,
            type: node.type,
            data: node.data ?? {},
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        nodeIdMap.set(node.id, newId);
      }

      for (const edge of original.edges) {
        const newSource = nodeIdMap.get(edge.sourceNodeId);
        const newTarget = nodeIdMap.get(edge.targetNodeId);
        if (!newSource || !newTarget) continue;

        await tx.flowEdge.create({
          data: {
            id: randomUUID(),
            flowId: newFlow.id,
            sourceNodeId: newSource,
            sourceHandle: edge.sourceHandle,
            targetNodeId: newTarget,
            targetHandle: edge.targetHandle,
          },
        });
      }

      return newFlow;
    });

    return res.status(201).json(duplicate);
  }

  /**
   * Pré-gera áudio TTS e faz upload para o ImageKit.
   * Usado pelo nó TTS Audio no modo "estático" — gera uma vez, reutiliza sempre.
   * POST /flows/tts-preview
   * Body: { text, voice, model }
   */
  public async generateTtsPreview(req: Request, res: Response): Promise<Response> {
    const { text, voice = 'nova', model = 'tts-1' } = req.body as {
      text: string;
      voice?: string;
      model?: string;
    };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'O campo "text" é obrigatório.' });
    }

    if (text.trim().length > 4096) {
      return res.status(400).json({ error: 'O texto pode ter no máximo 4096 caracteres.' });
    }

    const openaiService = (await import('../services/ai-providers/openai.service')).default;

    if (!openaiService.isConfigured()) {
      return res.status(400).json({ error: 'OpenAI não está configurado. Adicione OPENAI_API_KEY nas variáveis de ambiente.' });
    }

    const mp3Buffer = await openaiService.generateSpeech(text.trim(), voice, model);

    const imagekitConfigured =
      process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT;

    if (!imagekitConfigured) {
      return res.status(500).json({ error: 'Serviço de upload não configurado (ImageKit).' });
    }

    const imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    });

    const fileName = `tts-${Date.now()}.mp3`;
    const uploadResponse = await imagekit.upload({
      file: mp3Buffer,
      fileName,
      folder: 'crm-ai/audios',
    });

    return res.status(200).json({
      url: uploadResponse.url,
      fileName,
    });
  }
}
