import { Request, Response } from 'express';
import { collaboratorService } from '../services/collaborator.service';
import {
  validateInviteCollaborator,
  validateAcceptInvite,
  validateUpdatePermissions,
} from '../utils/validation.collaborator';
import { ZodError } from 'zod';

export class CollaboratorController {
  async invite(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Apenas administradores podem convidar colaboradores',
        });
        return;
      }

      const validatedData = validateInviteCollaborator(req.body);
      const invite = await collaboratorService.inviteCollaborator(
        req.user.companyId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        message: 'Convite enviado com sucesso',
        data: invite,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: error.errors,
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }

      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  }

  async acceptInvite(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const validatedData = validateAcceptInvite(req.body);

      const result = await collaboratorService.acceptInvite(token, validatedData.password);

      res.status(200).json({
        success: true,
        message: 'Convite aceito com sucesso',
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: error.errors,
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }

      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Apenas administradores podem listar colaboradores',
        });
        return;
      }

      const data = await collaboratorService.listCollaborators(req.user.companyId);

      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  }

  async updatePermissions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Apenas administradores podem atualizar permissões',
        });
        return;
      }

      const { id } = req.params;
      const validatedData = validateUpdatePermissions(req.body);

      await collaboratorService.updatePermissions(
        id,
        req.user.companyId,
        validatedData.permissions
      );

      res.status(200).json({
        success: true,
        message: 'Permissões atualizadas com sucesso',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: error.errors,
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }

      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Apenas administradores podem remover colaboradores',
        });
        return;
      }

      const { id } = req.params;
      await collaboratorService.removeCollaborator(id, req.user.companyId);

      res.status(200).json({
        success: true,
        message: 'Colaborador removido com sucesso',
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }

      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  }

  async cancelInvite(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Apenas administradores podem cancelar convites',
        });
        return;
      }

      const { id } = req.params;
      await collaboratorService.cancelInvite(id, req.user.companyId);

      res.status(200).json({
        success: true,
        message: 'Convite cancelado com sucesso',
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }

      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  }

  async getPermissions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const permissions = await collaboratorService.getUserPermissions(req.user.userId);

      res.status(200).json({ success: true, data: permissions });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  }
}

export const collaboratorController = new CollaboratorController();
