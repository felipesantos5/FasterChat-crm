import { Request, Response } from 'express';
import whatsappService from '../services/whatsapp.service';
import { CreateInstanceRequest, SendMessageRequest } from '../types/whatsapp';

class WhatsAppController {
  /**
   * POST /api/whatsapp/create-instance
   * Cria uma nova instância do WhatsApp
   */
  async createInstance(req: Request, res: Response) {
    try {
      const { companyId, instanceName } = req.body;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

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

      if (!instanceId) {
        return res.status(400).json({
          success: false,
          message: 'Instance ID is required',
        });
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

      if (!instanceId) {
        return res.status(400).json({
          success: false,
          message: 'Instance ID is required',
        });
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
        timestamp: new Date().toISOString(), // Força resposta única
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

      if (!instanceId || !to || !text) {
        return res.status(400).json({
          success: false,
          message: 'Instance ID, recipient phone number, and message text are required',
        });
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
   * Obtém todas as instâncias de uma empresa
   */
  async getInstances(req: Request, res: Response) {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

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

      if (!instanceId) {
        return res.status(400).json({
          success: false,
          message: 'Instance ID is required',
        });
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

      if (!instanceId) {
        return res.status(400).json({
          success: false,
          message: 'Instance ID is required',
        });
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
}

export default new WhatsAppController();
