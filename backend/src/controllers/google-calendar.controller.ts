import { Request, Response } from 'express';
import { googleCalendarService } from '../services/google-calendar.service';

class GoogleCalendarController {
  /**
   * GET /api/google/auth-url
   * Retorna URL para autenticação OAuth2
   */
  async getAuthUrl(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const authUrl = googleCalendarService.getAuthUrl(companyId);

      return res.status(200).json({
        success: true,
        data: { authUrl },
      });
    } catch (error: any) {
      console.error('Error getting auth URL:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao gerar URL de autenticação',
      });
    }
  }

  /**
   * GET /api/google/callback
   * Callback do OAuth2
   */
  async handleCallback(req: Request, res: Response) {
    try {
      const { code } = req.query;
      const companyId = req.query.state as string; // companyId passado no state

      if (!code || typeof code !== 'string') {
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendario?google_error=${encodeURIComponent('Código de autorização não fornecido')}`
        );
      }

      if (!companyId) {
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendario?google_error=${encodeURIComponent('Company ID não fornecido')}`
        );
      }

      // Troca código por tokens
      const tokens = await googleCalendarService.getTokensFromCode(code);

      // Salva tokens
      await googleCalendarService.saveTokens(companyId, tokens);

      // Redireciona para o frontend com sucesso
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendario?google_connected=true`
      );
    } catch (error: any) {
      console.error('Error handling OAuth callback:', error);
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/calendario?google_error=${encodeURIComponent(error.message)}`
      );
    }
  }

  /**
   * GET /api/google/status
   * Verifica se Google Calendar está conectado
   */
  async getStatus(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const { prisma } = await import('../utils/prisma');
      const calendar = await prisma.googleCalendar.findUnique({
        where: { companyId },
        select: {
          email: true,
          calendarId: true,
          createdAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          connected: !!calendar,
          email: calendar?.email,
          calendarId: calendar?.calendarId,
          connectedAt: calendar?.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Error getting calendar status:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao verificar status',
      });
    }
  }

  /**
   * POST /api/google/disconnect
   * Desconecta Google Calendar
   */
  async disconnect(req: Request, res: Response) {
    try {
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      await googleCalendarService.disconnect(companyId);

      return res.status(200).json({
        success: true,
        message: 'Google Calendar desconectado com sucesso',
      });
    } catch (error: any) {
      console.error('Error disconnecting calendar:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao desconectar',
      });
    }
  }

  /**
   * GET /api/google/available-slots
   * Retorna horários disponíveis
   */
  async getAvailableSlots(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;
      const dateStr = req.query.date as string;
      const duration = parseInt(req.query.duration as string) || 60;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      if (!dateStr) {
        return res.status(400).json({
          success: false,
          message: 'Data é obrigatória',
        });
      }

      const date = new Date(dateStr);
      const slots = await googleCalendarService.getAvailableSlots(
        companyId,
        date,
        { start: 9, end: 18 },
        duration
      );

      return res.status(200).json({
        success: true,
        data: slots,
      });
    } catch (error: any) {
      console.error('Error getting available slots:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar horários disponíveis',
      });
    }
  }

  /**
   * GET /api/google/events
   * Lista eventos do Google Calendar
   */
  async getEvents(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const events = await googleCalendarService.listEventsInRange(
        companyId,
        startDate ? new Date(startDate) : new Date(),
        endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      );

      return res.status(200).json({
        success: true,
        data: events,
      });
    } catch (error: any) {
      console.error('Error getting calendar events:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar eventos',
      });
    }
  }
}

export default new GoogleCalendarController();
