import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { FlowEngineService } from '../services/FlowEngineService';

export class FlowWebhookController {
  public async handleTrigger(req: Request, res: Response): Promise<Response> {
    const { slug } = req.params;
    
    // As variáveis podem vir do body ou da query
    const variables = { ...req.query, ...req.body };
    const contactPhone = variables.phone || variables.telefone || variables.contact;

    if (!contactPhone) {
      return res.status(400).json({ error: 'Missing contact phone (phone, telefone or contact)' });
    }

    try {
      const flow = await prisma.flow.update({
        where: { webhookSlug: slug, status: 'ACTIVE' },
        data: {
          lastWebhookPayload: variables
        },
        include: { nodes: true, edges: true } 
      });

      if (!flow) {
        return res.status(404).json({ error: 'Flow not found or not active' });
      }

      const flowEngine = new FlowEngineService();
      
      // Start the flow execution
      const execution = await flowEngine.startFlow(flow.id, contactPhone.toString(), variables);

      return res.status(200).json({ 
        message: 'Flow triggered successfully',
        executionId: execution.id 
      });
    } catch (error) {
      console.error('[FlowWebhook] Error triggering flow:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
