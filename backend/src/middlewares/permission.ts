import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export const checkPermission = (page: string, requireEdit: boolean = false) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      if (req.user.role === 'ADMIN') {
        next();
        return;
      }

      const permission = await prisma.permission.findUnique({
        where: {
          userId_page: {
            userId: req.user.userId,
            page: page as any,
          },
        },
      });

      if (!permission || !permission.canView) {
        res.status(403).json({
          success: false,
          message: 'Você não tem permissão para acessar este recurso',
        });
        return;
      }

      if (requireEdit && !permission.canEdit) {
        res.status(403).json({
          success: false,
          message: 'Você não tem permissão para editar este recurso',
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  };
};
