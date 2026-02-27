import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { FlowEngineService } from '../services/FlowEngineService';

export class FlowWebhookController {
  public async handleTrigger(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    
    // As variáveis podem vir do body ou da query
    const variables = { ...req.query, ...req.body };
    
    // Busca exaustiva pelo telefone no payload (suporte a Cakto, Hotmart, Kiwify, etc)
    let contactPhone = 
      variables.phone || 
      variables.telefone || 
      variables.contact || 
      variables.data?.phone || 
      variables.data?.telefone ||
      variables.data?.customer?.phone || 
      variables.data?.customer?.telefone ||
      variables.customer?.phone ||
      variables.customer?.telefone ||
      variables.lead?.phone ||
      variables.lead?.telefone;


    try {
      // Find the flow first - allow DRAFT or ACTIVE for variable mapping
      const flow = await prisma.flow.findFirst({
        where: { 
          webhookSlug: slug,
          status: { in: ['ACTIVE', 'DRAFT'] }
        },
        include: { nodes: true, edges: true } 
      });

      if (!flow) {
        console.error(`[FlowWebhook] ❌ Flow não encontrado para slug: "${slug}"`);
        res.status(404).json({ error: 'Flow not found or not active' });
        return;
      }


      // Automatically update the last webhook payload even if no phone is mapped (useful for admin panel variable extraction)
      await prisma.flow.update({
        where: { id: flow.id },
        data: {
          lastWebhookPayload: variables
        }
      });

      if (!contactPhone) {
        console.warn(`[FlowWebhook] ⚠️ Nenhum "phone" encontrado no payload. Variáveis mapeadas, fluxo NÃO será disparado.`);
        res.status(200).json({
          message: 'Webhook received and variables mapped. No contact phone provided to execute flow automatically.',
          variablesMapped: true,
          tip: 'Send a "phone" field in the body or query string to trigger the flow execution.'
        });
        return;
      }

      const flowEngine = new FlowEngineService();

      // Responde imediatamente — o flow roda em background para não bloquear o request
      res.status(202).json({ message: 'Flow triggered successfully' });

      // Fire-and-forget: executa o fluxo sem bloquear o request
      flowEngine.startFlow(flow.id, String(contactPhone), variables).catch((err: any) => {
        console.error('[FlowWebhook] ❌ Erro na execução do flow em background:', err?.message || err);
      });
    } catch (error: any) {
      console.error('[FlowWebhook] ❌ Erro ao disparar o flow:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          details: error?.message || 'Unknown error'
        });
      }
    }
  }
}
