import { Request, Response } from 'express';
import { quickMessageService } from '../services/quick-message.service';
import { QuickMessageType } from '@prisma/client';

const VALID_TYPES: QuickMessageType[] = ['TEXT', 'MEDIA', 'AUDIO'];

const quickMessageController = {
  async findAll(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user!;
    const messages = await quickMessageService.findAll(companyId);
    return res.json(messages);
  },

  async create(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user!;
    const { title, type, content, caption } = req.body;

    if (!title || !type || !content) {
      return res.status(400).json({ error: 'title, type e content são obrigatórios.' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type inválido. Use: ${VALID_TYPES.join(', ')}` });
    }

    const message = await quickMessageService.create(companyId, { title, type, content, caption });
    return res.status(201).json(message);
  },

  async update(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user!;
    const { id } = req.params;
    const { title, content, caption } = req.body;

    const updated = await quickMessageService.update(id, companyId, { title, content, caption });
    if (!updated) {
      return res.status(404).json({ error: 'Mensagem rápida não encontrada.' });
    }

    return res.json(updated);
  },

  async delete(req: Request, res: Response): Promise<Response> {
    const { companyId } = req.user!;
    const { id } = req.params;

    const deleted = await quickMessageService.delete(id, companyId);
    if (!deleted) {
      return res.status(404).json({ error: 'Mensagem rápida não encontrada.' });
    }

    return res.status(204).send();
  },
};

export default quickMessageController;
