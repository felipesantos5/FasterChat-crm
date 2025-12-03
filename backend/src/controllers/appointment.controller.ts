import { Request, Response } from 'express';
import { appointmentService } from '../services/appointment.service';
import { AppointmentStatus, AppointmentType } from '@prisma/client';
import { z } from 'zod';

const createAppointmentSchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(AppointmentType),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  duration: z.number().int().positive().default(60),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateAppointmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.nativeEnum(AppointmentType).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

class AppointmentController {
  /**
   * POST /api/appointments
   * Cria um agendamento
   */
  async create(req: Request, res: Response) {
    try {
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const data = createAppointmentSchema.parse(req.body);

      const appointment = await appointmentService.create(companyId, {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      });

      return res.status(201).json({
        success: true,
        data: appointment,
      });
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao criar agendamento',
      });
    }
  }

  /**
   * GET /api/appointments
   * Lista agendamentos
   */
  async list(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;
      const customerId = req.query.customerId as string | undefined;
      const status = req.query.status as AppointmentStatus | undefined;
      const type = req.query.type as AppointmentType | undefined;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const appointments = await appointmentService.findAll(companyId, {
        customerId,
        status,
        type,
        startDate,
        endDate,
      });

      return res.status(200).json({
        success: true,
        data: appointments,
      });
    } catch (error: any) {
      console.error('Error listing appointments:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao listar agendamentos',
      });
    }
  }

  /**
   * GET /api/appointments/:id
   * Busca agendamento por ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const appointment = await appointmentService.findById(id, companyId);

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Agendamento não encontrado',
        });
      }

      return res.status(200).json({
        success: true,
        data: appointment,
      });
    } catch (error: any) {
      console.error('Error getting appointment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar agendamento',
      });
    }
  }

  /**
   * PATCH /api/appointments/:id
   * Atualiza agendamento
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const data = updateAppointmentSchema.parse(req.body);

      const updates: any = { ...data };
      if (data.startTime) updates.startTime = new Date(data.startTime);
      if (data.endTime) updates.endTime = new Date(data.endTime);

      const appointment = await appointmentService.update(id, companyId, updates);

      return res.status(200).json({
        success: true,
        data: appointment,
      });
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao atualizar agendamento',
      });
    }
  }

  /**
   * POST /api/appointments/:id/cancel
   * Cancela agendamento
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.body.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const appointment = await appointmentService.cancel(id, companyId);

      return res.status(200).json({
        success: true,
        data: appointment,
        message: 'Agendamento cancelado com sucesso',
      });
    } catch (error: any) {
      console.error('Error canceling appointment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao cancelar agendamento',
      });
    }
  }

  /**
   * DELETE /api/appointments/:id
   * Deleta agendamento
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      await appointmentService.delete(id, companyId);

      return res.status(200).json({
        success: true,
        message: 'Agendamento deletado com sucesso',
      });
    } catch (error: any) {
      console.error('Error deleting appointment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao deletar agendamento',
      });
    }
  }

  /**
   * GET /api/appointments/available-slots
   * Retorna horários disponíveis
   */
  async getAvailableSlots(req: Request, res: Response) {
    try {
      const companyId = req.query.companyId as string;
      const dateStr = req.query.date as string;
      const duration = parseInt(req.query.duration as string) || 60;

      console.log('[AppointmentController] GET /api/appointments/available-slots');
      console.log('[AppointmentController] Query params:', req.query);
      console.log('[AppointmentController] Company ID:', companyId);
      console.log('[AppointmentController] Date string:', dateStr);
      console.log('[AppointmentController] Duration:', duration);

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

      // Converte a string de data para um objeto Date
      // Suporta formatos: "2024-01-15" ou "2024-01-15T00:00:00.000Z"
      const date = new Date(dateStr);

      // Valida se a data é válida
      if (isNaN(date.getTime())) {
        console.error('[AppointmentController] Data inválida:', dateStr);
        return res.status(400).json({
          success: false,
          message: 'Data inválida. Use o formato YYYY-MM-DD',
        });
      }

      console.log('[AppointmentController] Data parseada:', date);
      console.log('[AppointmentController] Data ISO:', date.toISOString());
      console.log('[AppointmentController] Data local:', date.toLocaleString('pt-BR'));

      const slots = await appointmentService.getAvailableSlots(companyId, date, duration);

      console.log(`[AppointmentController] Retornando ${slots.length} slots disponíveis`);

      return res.status(200).json({
        success: true,
        data: slots,
      });
    } catch (error: any) {
      console.error('[AppointmentController] Error getting available slots:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar horários disponíveis',
      });
    }
  }

  /**
   * GET /api/appointments/customer/:customerId/upcoming
   * Lista próximos agendamentos do cliente
   */
  async getCustomerUpcoming(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID é obrigatório',
        });
      }

      const appointments = await appointmentService.getCustomerUpcoming(
        customerId,
        companyId
      );

      return res.status(200).json({
        success: true,
        data: appointments,
      });
    } catch (error: any) {
      console.error('Error getting customer appointments:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Erro ao buscar agendamentos do cliente',
      });
    }
  }
}

export default new AppointmentController();
