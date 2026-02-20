import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../errors/AppError';

export class FlowController {
  public async getFlows(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user;

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
    const { companyId } = req.user;

    const flow = await prisma.flow.findUnique({
      where: { id, companyId },
      include: {
        nodes: true,
        edges: true,
      }
    });

    if (!flow) {
      throw new AppError('Flow not found', 404);
    }

    return res.json(flow);
  }

  public async createFlow(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user;
    const { name, description, triggerType = 'webhook' } = req.body;

    // Generate unique webhook slug
    const webhookSlug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;

    const flow = await prisma.flow.create({
      data: {
        companyId,
        name,
        description,
        triggerType,
        webhookSlug,
      },
    });

    return res.status(201).json(flow);
  }

  public async updateFlow(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user;
    const { name, description, status, webhookSlug } = req.body;

    const flowExists = await prisma.flow.findUnique({
      where: { id, companyId },
    });

    if (!flowExists) {
      throw new AppError('Flow not found', 404);
    }

    const flow = await prisma.flow.update({
      where: { id },
      data: {
        name,
        description,
        status,
        webhookSlug,
      },
    });

    return res.json(flow);
  }

  public async saveFlowNodes(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user;
    const { nodes, edges } = req.body;

    const flowExists = await prisma.flow.findUnique({
      where: { id, companyId },
    });

    if (!flowExists) {
      throw new AppError('Flow not found', 404);
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
    const { companyId } = req.user;

    const flowExists = await prisma.flow.findUnique({
      where: { id, companyId },
    });

    if (!flowExists) {
      throw new AppError('Flow not found', 404);
    }

    await prisma.flow.delete({
      where: { id },
    });

    return res.status(204).send();
  }
}
