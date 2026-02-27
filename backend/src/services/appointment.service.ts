import { Appointment, AppointmentStatus, AppointmentType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { googleCalendarService } from './google-calendar.service';

export interface CreateAppointmentDTO {
  customerId: string;
  title: string;
  description?: string;
  type: AppointmentType;
  startTime: Date;
  endTime: Date;
  duration: number; // Duração em minutos
  location?: string;
  notes?: string;
}

export interface UpdateAppointmentDTO {
  title?: string;
  description?: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // Duração em minutos
  location?: string;
  notes?: string;
}

export class AppointmentService {
  /**
   * Cria um agendamento e sincroniza com Google Calendar
   * @returns Appointment com metadata sobre sucesso da sincronização
   */
  async create(companyId: string, data: CreateAppointmentDTO): Promise<Appointment & { googleCalendarSynced?: boolean; googleCalendarError?: string }> {

    // Busca informações do cliente
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
    });

    if (!customer) {
      throw new Error('Cliente não encontrado');
    }


    // Verifica se horário está disponível
    const isAvailable = await this.checkAvailability(
      companyId,
      data.startTime,
      data.endTime
    );

    if (!isAvailable) {
      throw new Error('Horário não disponível');
    }


    // 🔥 CRÍTICO: Cria evento no Google Calendar com validação rigorosa
    let googleEventId: string | undefined;
    let googleCalendarSynced = false;
    let googleCalendarError: string | undefined;

    // Primeiro, verifica se o Google Calendar está configurado
    const isGoogleCalendarConfigured = await googleCalendarService.isConfigured(companyId);

    if (isGoogleCalendarConfigured) {
      try {

        const googleEvent = await googleCalendarService.createEvent(companyId, {
          summary: data.title,
          description: data.description || `${data.type} - ${customer.name}`,
          start: data.startTime,
          end: data.endTime,
          location: data.location,
          attendees: customer.email ? [customer.email] : undefined,
        });

        if (googleEvent && googleEvent.id) {
          googleEventId = googleEvent.id;
          googleCalendarSynced = true;
        } else {
          throw new Error('Google Calendar retornou resposta sem ID de evento');
        }
      } catch (error: any) {
        googleCalendarError = error.message;
        console.error('[Appointment] ❌ FALHA ao criar evento no Google Calendar:');
        console.error('[Appointment]   - Erro:', error.message);

        if (error.response?.data) {
          console.error('[Appointment]   - Response:', JSON.stringify(error.response.data));
        }

        // Classifica o tipo de erro
        if (error.message.includes('não configurado') || error.message.includes('not found')) {
          googleCalendarError = 'Google Calendar não configurado';
        } else if (error.message.includes('expired') || error.message.includes('invalid') || error.message.includes('401')) {
          googleCalendarError = 'Credenciais do Google Calendar expiradas - reconecte na página de Calendário';
        } else if (error.message.includes('403') || error.message.includes('permission')) {
          googleCalendarError = 'Sem permissão para criar eventos no Google Calendar';
        }

        console.warn('[Appointment] ⚠️ Agendamento será criado apenas no sistema local');
      }
    } else {
      googleCalendarError = 'Google Calendar não está conectado para esta empresa';
      console.warn('[Appointment] ⚠️ Google Calendar não configurado - criando apenas no banco local');
    }

    // Cria appointment no banco
    const appointment = await prisma.appointment.create({
      data: {
        companyId,
        customerId: data.customerId,
        title: data.title,
        description: data.description,
        type: data.type,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        location: data.location,
        notes: data.notes,
        googleEventId,
        status: AppointmentStatus.SCHEDULED,
      },
      include: {
        customer: true,
      },
    });

    if (googleEventId) {
    }
    if (googleCalendarError) {
    }

    // Retorna appointment com metadata de sincronização
    return {
      ...appointment,
      googleCalendarSynced,
      googleCalendarError,
    };
  }

  /**
   * Lista agendamentos
   */
  async findAll(
    companyId: string,
    filters?: {
      customerId?: string;
      status?: AppointmentStatus;
      type?: AppointmentType;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Appointment[]> {
    const where: any = { companyId };

    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = filters.startDate;
      if (filters.endDate) where.startTime.lte = filters.endDate;
    }

    return prisma.appointment.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  /**
   * Busca agendamento por ID
   */
  async findById(id: string, companyId: string): Promise<Appointment | null> {
    return prisma.appointment.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Atualiza agendamento
   */
  async update(
    id: string,
    companyId: string,
    data: UpdateAppointmentDTO
  ): Promise<Appointment> {
    const appointment = await this.findById(id, companyId);
    if (!appointment) {
      throw new Error('Agendamento não encontrado');
    }

    // Se mudou horário, verifica disponibilidade
    if (data.startTime || data.endTime) {
      const newStart = data.startTime || appointment.startTime;
      const newEnd = data.endTime || appointment.endTime;

      const isAvailable = await this.checkAvailability(
        companyId,
        newStart,
        newEnd,
        id // Ignora o próprio agendamento
      );

      if (!isAvailable) {
        throw new Error('Horário não disponível');
      }
    }

    // Atualiza no Google Calendar
    if (appointment.googleEventId) {
      try {
        await googleCalendarService.updateEvent(
          companyId,
          appointment.googleEventId,
          {
            summary: data.title,
            description: data.description,
            start: data.startTime,
            end: data.endTime,
            location: data.location,
          }
        );
      } catch (error: any) {
      }
    }

    // Atualiza no banco
    return prisma.appointment.update({
      where: { id },
      data,
      include: {
        customer: true,
      },
    });
  }

  /**
   * Cancela agendamento
   */
  async cancel(id: string, companyId: string): Promise<Appointment> {
    const appointment = await this.findById(id, companyId);
    if (!appointment) {
      throw new Error('Agendamento não encontrado');
    }

    // Cancela no Google Calendar
    if (appointment.googleEventId) {
      try {
        await googleCalendarService.cancelEvent(companyId, appointment.googleEventId);
      } catch (error: any) {
      }
    }

    // Atualiza status
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Deleta agendamento
   */
  async delete(id: string, companyId: string): Promise<void> {
    const appointment = await this.findById(id, companyId);
    if (!appointment) {
      throw new Error('Agendamento não encontrado');
    }

    // Remove do Google Calendar
    if (appointment.googleEventId) {
      try {
        await googleCalendarService.cancelEvent(companyId, appointment.googleEventId);
      } catch (error: any) {
      }
    }

    await prisma.appointment.delete({
      where: { id },
    });
  }

  /**
   * Verifica se horário está disponível
   * Verifica tanto no banco de dados local quanto no Google Calendar
   */
  async checkAvailability(
    companyId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string
  ): Promise<boolean> {

    // 1. Verifica no banco de dados local
    const where: any = {
      companyId,
      status: {
        not: AppointmentStatus.CANCELLED,
      },
      OR: [
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } },
          ],
        },
        {
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gte: endTime } },
          ],
        },
        {
          AND: [
            { startTime: { gte: startTime } },
            { endTime: { lte: endTime } },
          ],
        },
      ],
    };

    if (excludeAppointmentId) {
      where.id = { not: excludeAppointmentId };
    }

    const conflictingAppointments = await prisma.appointment.findMany({ where });

    if (conflictingAppointments.length > 0) {
      return false;
    }


    // 2. Verifica no Google Calendar (se configurado)
    try {
      const isGoogleConfigured = await googleCalendarService.isConfigured(companyId);

      if (!isGoogleConfigured) {
        return true;
      }

      // Busca eventos no período no Google Calendar

      const events = await googleCalendarService.listEventsInRange(companyId, startTime, endTime);


      // Verifica se algum evento conflita com o horário desejado
      const hasConflict = events.some((event) => {

        // Pula eventos cancelados
        if (event.status === 'cancelled') {
          return false;
        }

        // Pula eventos marcados como "Livre" (Transparency)
        if (event.transparency === 'transparent') {
          return false;
        }

        // Normaliza datas do evento
        let eventStart: Date;
        let eventEnd: Date;

        if (event.start?.dateTime) {
          // Evento com horário específico - o dateTime já vem com timezone
          eventStart = new Date(event.start.dateTime);
          eventEnd = new Date(event.end?.dateTime || event.start.dateTime);

          // Verifica se o evento é muito longo (provavelmente marcador de expediente)
          const durationHours = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
          if (durationHours >= 6) {
            return false;
          }
        } else if (event.start?.date) {
          // Evento de Dia Inteiro - NÃO deve bloquear agendamentos específicos
          return false;
        } else {
          return false;
        }


        // Verifica sobreposição: (StartA < EndB) and (EndA > StartB)
        const hasOverlap = (startTime < eventEnd && endTime > eventStart);

        if (hasOverlap) {
        } else {
        }

        return hasOverlap;
      });

      if (hasConflict) {
        return false;
      }

      return true;
    } catch (error: any) {
      // Se erro no Google Calendar, considera apenas banco local
      return true;
    }
  }

  /**
   * Arredonda a data para o próximo intervalo de 15 minutos
   */
  private roundToNext15Minutes(date: Date): Date {
    const minutes = date.getMinutes();
    const remainder = minutes % 15;

    if (remainder === 0) {
      return new Date(date);
    }

    const roundedDate = new Date(date);
    roundedDate.setMinutes(minutes + (15 - remainder));
    roundedDate.setSeconds(0);
    roundedDate.setMilliseconds(0);

    return roundedDate;
  }

  /**
   * Busca horários disponíveis para um dia
   * Usa horários configurados no sistema (AIKnowledge.workingHours)
   * Retorna APENAS as brechas de tempo (slots livres) dentro do horário de funcionamento
   */
  async getAvailableSlots(
    companyId: string,
    date: Date,
    slotDuration: number = 60
  ): Promise<Array<{ start: Date; end: Date }>> {

    // Busca horário de funcionamento configurado no sistema
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: {
        workingHours: true,
        businessHoursStart: true,
        businessHoursEnd: true,
      },
    });


    // Prioriza campos estruturados, faz fallback para texto legado
    let businessHours: { start: number; end: number } | null = null;

    // Se tem os campos estruturados preenchidos, usa eles
    if (aiKnowledge?.businessHoursStart != null && aiKnowledge?.businessHoursEnd != null) {
      businessHours = {
        start: aiKnowledge.businessHoursStart,
        end: aiKnowledge.businessHoursEnd,
      };
    } else {
      // Fallback: tenta parsear do texto legado
      businessHours = this.parseWorkingHoursConfig(aiKnowledge?.workingHours || null);
      if (businessHours) {
      }
    }

    if (!businessHours) {
      // Último fallback: usa horário padrão comercial (9h às 18h)
      businessHours = { start: 9, end: 18 };
    }

    // Tenta buscar do Google Calendar primeiro
    try {
      const isGoogleConfigured = await googleCalendarService.isConfigured(companyId);

      if (!isGoogleConfigured) {
        throw new Error('Google Calendar não configurado - usando fallback');
      }


      const slots = await googleCalendarService.getAvailableSlots(
        companyId,
        date,
        businessHours,
        slotDuration
      );


      if (slots.length > 0) {
        slots.slice(0, 3).forEach((slot, i) => {
        });
      }

      return slots.map((slot) => ({
        start: slot.start,
        end: slot.end,
      }));
    } catch (error: any) {

      // Fallback: gera slots baseado apenas no banco local
      // Extrai ano, mês e dia da data recebida (UTC)
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();

      // Cria datas no fuso horário local usando horários do sistema
      const dayStart = new Date(year, month, day, businessHours.start, 0, 0, 0);
      const dayEnd = new Date(year, month, day, businessHours.end, 0, 0, 0);


      const slots: Array<{ start: Date; end: Date }> = [];
      let current = this.roundToNext15Minutes(dayStart);

      while (current < dayEnd) {
        const slotEnd = new Date(current.getTime() + slotDuration * 60000);

        // Verifica se o slot ultrapassa o horário comercial
        if (slotEnd > dayEnd) {
          break;
        }

        const isAvailable = await this.checkAvailability(companyId, current, slotEnd);

        if (isAvailable) {
          slots.push({
            start: new Date(current),
            end: new Date(slotEnd),
          });
        }

        // Avança 15 minutos
        current = new Date(current.getTime() + 15 * 60000);
      }


      return slots;
    }
  }

  /**
   * Parse do texto de horário de funcionamento
   * Retorna null se não configurado
   */
  private parseWorkingHoursConfig(workingHoursText: string | null): { start: number; end: number } | null {
    if (!workingHoursText || workingHoursText.trim() === '') {
      return null;
    }

    try {
      const text = workingHoursText.toLowerCase();
      // Regex para capturar "8h as 18h", "08:00 - 18:00", "8 às 18", etc.
      const match = text.match(/(\d{1,2})[h:]?.*(?:às|as|a|-).+?(\d{1,2})[h:]?/);

      if (match) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);

        // Validação básica
        if (start >= 0 && start <= 23 && end >= 0 && end <= 23 && start < end) {
          return { start, end };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Lista próximos agendamentos de um cliente
   */
  async getCustomerUpcoming(customerId: string, companyId: string): Promise<Appointment[]> {
    return prisma.appointment.findMany({
      where: {
        customerId,
        companyId,
        startTime: {
          gte: new Date(),
        },
        status: {
          not: AppointmentStatus.CANCELLED,
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 5,
    });
  }
}

export const appointmentService = new AppointmentService();
