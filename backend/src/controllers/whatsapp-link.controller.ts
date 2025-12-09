import { Request, Response } from 'express';
import whatsappLinkService from '../services/whatsapp-link.service';
import { z } from 'zod';

// Schemas de validação
const createLinkSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  slug: z
    .string()
    .min(1, 'Slug é obrigatório')
    .max(50, 'Slug muito longo')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  phoneNumber: z
    .string()
    .regex(/^\d{10,15}$/, 'Número deve conter apenas dígitos (10-15 caracteres)'),
  message: z.string().max(1000, 'Mensagem muito longa').optional(),
  autoTag: z.string().max(50, 'Tag muito longa').optional(),
});

const updateLinkSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
    .optional(),
  phoneNumber: z.string().regex(/^\d{10,15}$/, 'Número inválido').optional(),
  message: z.string().max(1000).optional(),
  autoTag: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

class WhatsAppLinkController {
  /**
   * POST /api/whatsapp-links
   * Cria um novo link de WhatsApp
   */
  async create(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const data = createLinkSchema.parse(req.body);

      const link = await whatsappLinkService.create(companyId, data);

      // Monta a URL completa
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/l/${link.slug}`;

      return res.status(201).json({
        success: true,
        data: {
          ...link,
          url: fullUrl,
        },
      });
    } catch (error: any) {
      console.error('[WhatsAppLinkController] Error creating link:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/whatsapp-links
   * Lista todos os links da empresa
   */
  async findAll(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const links = await whatsappLinkService.findAll(companyId);

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      const linksWithUrl = links.map((link) => ({
        ...link,
        url: `${baseUrl}/l/${link.slug}`,
        clicks: link._count.clicks,
      }));

      return res.json({ success: true, data: linksWithUrl });
    } catch (error: any) {
      console.error('[WhatsAppLinkController] Error fetching links:', error);
      return res.status(500).json({ error: 'Erro ao buscar links' });
    }
  }

  /**
   * GET /api/whatsapp-links/:id
   * Busca um link específico
   */
  async findById(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const { id } = req.params;

      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const link = await whatsappLinkService.findById(id, companyId);

      if (!link) {
        return res.status(404).json({ error: 'Link não encontrado' });
      }

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      return res.json({
        success: true,
        data: {
          ...link,
          url: `${baseUrl}/l/${link.slug}`,
        },
      });
    } catch (error: any) {
      console.error('[WhatsAppLinkController] Error fetching link:', error);
      return res.status(500).json({ error: 'Erro ao buscar link' });
    }
  }

  /**
   * PUT /api/whatsapp-links/:id
   * Atualiza um link
   */
  async update(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const { id } = req.params;

      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const data = updateLinkSchema.parse(req.body);

      const link = await whatsappLinkService.update(id, companyId, data);

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      return res.json({
        success: true,
        data: {
          ...link,
          url: `${baseUrl}/l/${link.slug}`,
        },
      });
    } catch (error: any) {
      console.error('[WhatsAppLinkController] Error updating link:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors,
        });
      }

      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/whatsapp-links/:id
   * Deleta um link
   */
  async delete(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const { id } = req.params;

      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      await whatsappLinkService.delete(id, companyId);

      return res.json({
        success: true,
        message: 'Link deletado com sucesso',
      });
    } catch (error: any) {
      console.error('[WhatsAppLinkController] Error deleting link:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/whatsapp-links/:id/analytics
   * Obtém analytics de um link
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      const companyId = req.user?.companyId;
      const { id } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const analytics = await whatsappLinkService.getAnalytics(id, companyId, days);

      return res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      console.error('[WhatsAppLinkController] Error fetching analytics:', error);
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/whatsapp-links/generate-slug
   * Gera um slug a partir de um nome
   */
  async generateSlug(req: Request, res: Response) {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
      }

      const slug = whatsappLinkService.generateSlug(name);

      return res.json({
        success: true,
        data: { slug },
      });
    } catch (error: any) {
      console.error('[WhatsAppLinkController] Error generating slug:', error);
      return res.status(500).json({ error: 'Erro ao gerar slug' });
    }
  }
}

export default new WhatsAppLinkController();
