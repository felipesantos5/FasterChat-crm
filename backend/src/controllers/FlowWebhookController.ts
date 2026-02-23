import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { FlowEngineService } from '../services/FlowEngineService';

export class FlowWebhookController {
  public async handleTrigger(req: Request, res: Response): Promise<Response> {
    const { slug } = req.params;
    
    // As variáveis podem vir do body ou da query
    const variables = { ...req.query, ...req.body };
    const contactPhone = variables.phone || variables.telefone || variables.contact;

    try {
      // Find the flow first
      const flow = await prisma.flow.findFirst({
        where: { webhookSlug: slug, status: 'ACTIVE' },
        include: { nodes: true, edges: true } 
      });

      if (!flow) {
        return res.status(404).json({ error: 'Flow not found or not active' });
      }

      // Automatically update the last webhook payload even if no phone is mapped (useful for admin panel variable extraction)
      await prisma.flow.update({
        where: { id: flow.id },
        data: {
          lastWebhookPayload: variables
        }
      });

      if (!contactPhone) {
        return res.status(200).json({ 
          message: 'Webhook received and variables mapped. No contact phone provided to execute flow automatically.',
          variablesMapped: true
        });
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
