import { Request, Response } from 'express';
import whatsappService from '../services/whatsapp.service';
import { CreateInstanceRequest, SendMessageRequest } from '../types/whatsapp';
import { prisma } from '../utils/prisma';

/**
 * Garante que a instância pertence à empresa do usuário autenticado.
 * Retorna null se não existir ou não pertencer à empresa.
 */
async function getOwnedInstance(instanceId: string, companyId: string) {
  return prisma.whatsAppInstance.findFirst({
    where: { id: instanceId, companyId },
  });
}

class WhatsAppController {
  /**
   * POST /api/whatsapp/create-instance
   * Cria uma nova instância do WhatsApp
   */
  async createInstance(req: Request, res: Response) {
    try {
      const companyId = req.user!.companyId;
      const { instanceName } = req.body;

      const data: CreateInstanceRequest = {
        companyId,
        instanceName,
      };

      const instance = await whatsappService.createInstance(data);

      return res.status(201).json({
        success: true,
        data: instance,
      });
    } catch (error: any) {
      console.error('Error in createInstance controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create WhatsApp instance',
      });
    }
  }

  /**
   * GET /api/whatsapp/qr/:instanceId
   * Obtém o QR Code de uma instância
   */
  async getQRCode(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const companyId = req.user!.companyId;

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      const result = await whatsappService.getQRCode(instanceId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in getQRCode controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get QR code',
      });
    }
  }

  /**
   * GET /api/whatsapp/status/:instanceId
   * Verifica o status de conexão de uma instância
   */
  async getStatus(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const companyId = req.user!.companyId;

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      const result = await whatsappService.getStatus(instanceId);

      // Headers para evitar cache HTTP 304
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      return res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error in getStatus controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get connection status',
      });
    }
  }

  /**
   * POST /api/whatsapp/send-message
   * Envia uma mensagem via WhatsApp
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { instanceId, to, text } = req.body;
      const companyId = req.user!.companyId;

      if (!instanceId || !to || !text) {
        return res.status(400).json({
          success: false,
          message: 'Instance ID, recipient phone number, and message text are required',
        });
      }

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      const data: SendMessageRequest = {
        instanceId,
        to,
        text,
      };

      const result = await whatsappService.sendMessage(data);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in sendMessage controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send message',
      });
    }
  }

  /**
   * GET /api/whatsapp/instances/:companyId
   * Obtém todas as instâncias da empresa autenticada
   * O :companyId no path é ignorado — sempre usa o companyId do token JWT
   */
  async getInstances(req: Request, res: Response) {
    try {
      const companyId = req.user!.companyId;

      const instances = await whatsappService.getInstancesByCompany(companyId);

      return res.status(200).json({
        success: true,
        data: instances,
      });
    } catch (error: any) {
      console.error('Error in getInstances controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get instances',
      });
    }
  }

  /**
   * DELETE /api/whatsapp/instance/:instanceId
   * Deleta uma instância
   */
  async deleteInstance(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const companyId = req.user!.companyId;

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      const result = await whatsappService.deleteInstance(instanceId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in deleteInstance controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete instance',
      });
    }
  }

  /**
   * POST /api/whatsapp/disconnect/:instanceId
   * Desconecta uma instância (logout)
   */
  async disconnectInstance(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const companyId = req.user!.companyId;

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      const result = await whatsappService.disconnectInstance(instanceId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in disconnectInstance controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to disconnect instance',
      });
    }
  }

  /**
   * POST /api/whatsapp/sync/:instanceId
   * Força sincronização de status com Evolution API
   */
  async syncStatus(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const companyId = req.user!.companyId;

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }


      const result = await whatsappService.getStatus(instanceId);


      return res.status(200).json({
        success: true,
        data: result,
        message: 'Status synchronized successfully',
      });
    } catch (error: any) {
      console.error('Error in syncStatus controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to sync status',
      });
    }
  }

  /**
   * PATCH /api/whatsapp/instance/:instanceId/name
   * Atualiza o nome de uma instância
   */
  async updateInstanceName(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const { instanceName } = req.body;
      const companyId = req.user!.companyId;

      if (!instanceName || !instanceName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Instance name is required',
        });
      }

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      await whatsappService.updateInstanceName(instanceId, instanceName.trim());

      return res.status(200).json({
        success: true,
        message: 'Instance name updated successfully',
      });
    } catch (error: any) {
      console.error('Error in updateInstanceName controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update instance name',
      });
    }
  }

  /**
   * POST /api/whatsapp/reconfigure-webhook/:instanceId
   * Reconfigura o webhook de uma instância para incluir novos eventos
   */
  async reconfigureWebhook(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const companyId = req.user!.companyId;

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      const result = await whatsappService.reconfigureWebhook(instanceId);

      return res.status(200).json({
        success: true,
        data: result,
        message: 'Webhook reconfigured successfully',
      });
    } catch (error: any) {
      console.error('Error in reconfigureWebhook controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to reconfigure webhook',
      });
    }
  }

  /**
   * GET /api/whatsapp/presence/:instanceId/:phone
   * Verifica se um contato está online no WhatsApp
   */
  async getContactPresence(req: Request, res: Response) {
    try {
      const { instanceId, phone } = req.params;
      const companyId = req.user!.companyId;

      if (!instanceId || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Instance ID and phone number are required',
        });
      }

      const owned = await getOwnedInstance(instanceId, companyId);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }

      const result = await whatsappService.getContactPresence(instanceId, phone);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error in getContactPresence controller:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get contact presence',
      });
    }
  }

  /**
   * GET /api/whatsapp/strategy
   * Obtem a configuração da estratégia atual da empresa
   */
  async getCompanyStrategy(req: Request, res: Response) {
    try {
      const companyId = req.user!.companyId;

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { whatsappStrategy: true, defaultWhatsappInstanceId: true, plan: true },
      });

      return res.status(200).json({
        success: true,
        data: company || { whatsappStrategy: 'RANDOM', defaultWhatsappInstanceId: null },
      });
    } catch (error: any) {
      console.error('Error fetching company strategy:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error fetching strategy',
      });
    }
  }

  /**
   * PATCH /api/whatsapp/strategy
   * Atualiza a estratégia de uso de instâncias de WhatsApp
   */
  async updateCompanyStrategy(req: Request, res: Response) {
    try {
      const companyId = req.user!.companyId;
      const { whatsappStrategy, defaultWhatsappInstanceId } = req.body;

      // Se defaultWhatsappInstanceId fornecido, valida que pertence à empresa
      if (defaultWhatsappInstanceId) {
        const owned = await getOwnedInstance(defaultWhatsappInstanceId, companyId);
        if (!owned) {
          return res.status(403).json({ success: false, message: 'Instância padrão não pertence à empresa' });
        }
      }

      await prisma.company.update({
        where: { id: companyId },
        data: {
          whatsappStrategy,
          defaultWhatsappInstanceId: defaultWhatsappInstanceId || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Strategy updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating company strategy:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error updating strategy',
      });
    }
  }
}

export default new WhatsAppController();
