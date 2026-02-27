import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { FlowExecutionStatus } from '@prisma/client';

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
    const { name, description, status, webhookSlug, autoTags } = req.body;

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
        ...((autoTags !== undefined ? { autoTags } : {}) as any)
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

    // Using a transaction to clear existing nodes/edges and insert the new ones
    await prisma.$transaction(async (tx) => {
      // 1. Delete all edges
      await tx.flowEdge.deleteMany({ where: { flowId: id } });
      
      // 2. Delete all nodes
      await tx.flowNode.deleteMany({ where: { flowId: id } });

      // 3. Create nodes
      if (nodes && nodes.length > 0) {
        await tx.flowNode.createMany({
          data: nodes.map((n: any) => ({
            id: n.id,
            flowId: id,
            type: n.type,
            data: n.data || {},
            positionX: n.position?.x || 0,
            positionY: n.position?.y || 0,
          }))
        });
      }

      // 4. Create edges
      if (edges && edges.length > 0) {
        await tx.flowEdge.createMany({
          data: edges.map((e: any) => ({
            id: e.id,
            flowId: id,
            sourceNodeId: e.source,
            sourceHandle: e.sourceHandle,
            targetNodeId: e.target,
            targetHandle: e.targetHandle,
          }))
        });
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
    }

    return res.json({ variables });
  }

  public async getFlowExecutions(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user!;

    const executions = await prisma.flowExecution.findMany({
      where: { flowId: id, flow: { companyId } },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    return res.json(executions);
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

    return res.json({ success: true });
  }
}
