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
    console.log('[Appointment] ============================================');
    console.log('[Appointment] 🆕 CRIANDO NOVO AGENDAMENTO');
    console.log('[Appointment] ============================================');
    console.log('[Appointment] Company ID:', companyId);
    console.log('[Appointment] Customer ID:', data.customerId);
    console.log('[Appointment] Title:', data.title);
    console.log('[Appointment] Type:', data.type);
    console.log('[Appointment] Start (ISO):', data.startTime.toISOString());
    console.log('[Appointment] Start (BR):', data.startTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    console.log('[Appointment] End (ISO):', data.endTime.toISOString());
    console.log('[Appointment] End (BR):', data.endTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    console.log('[Appointment] Duration:', data.duration, 'minutos');
    console.log('[Appointment] Location:', data.location || 'Não informado');

    // Busca informações do cliente
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
    });

    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    console.log('[Appointment] Cliente:', customer.name, '- Email:', customer.email || 'Não informado');

    // Verifica se horário está disponível
    const isAvailable = await this.checkAvailability(
      companyId,
      data.startTime,
      data.endTime
    );

    if (!isAvailable) {
      throw new Error('Horário não disponível');
    }

    console.log('[Appointment] ✅ Horário disponível confirmado');

    // 🔥 CRÍTICO: Cria evento no Google Calendar com validação rigorosa
    let googleEventId: string | undefined;
    let googleCalendarSynced = false;
    let googleCalendarError: string | undefined;

    // Primeiro, verifica se o Google Calendar está configurado
    const isGoogleCalendarConfigured = await googleCalendarService.isConfigured(companyId);
    console.log('[Appointment] Google Calendar configurado:', isGoogleCalendarConfigured ? 'SIM ✅' : 'NÃO ❌');

    if (isGoogleCalendarConfigured) {
      try {
        console.log('[Appointment] 🔄 Tentando criar evento no Google Calendar...');
        console.log('[Appointment] Dados do evento:');
        console.log('[Appointment]   - Summary:', data.title);
        console.log('[Appointment]   - Start:', data.startTime.toISOString());
        console.log('[Appointment]   - End:', data.endTime.toISOString());
        console.log('[Appointment]   - Location:', data.location || 'N/A');
        console.log('[Appointment]   - Attendees:', customer.email || 'Nenhum');

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
          console.log('[Appointment] ✅ SUCESSO! Evento criado no Google Calendar');
          console.log('[Appointment]   - Event ID:', googleEventId);
          console.log('[Appointment]   - Event Link:', googleEvent.htmlLink);
          console.log('[Appointment]   - Status:', googleEvent.status);
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
    console.log('[Appointment] 💾 Salvando agendamento no banco de dados...');
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

    console.log('[Appointment] ============================================');
    console.log('[Appointment] 📋 RESUMO DA CRIAÇÃO');
    console.log('[Appointment] ============================================');
    console.log('[Appointment] ✅ Agendamento criado no banco: ID', appointment.id);
    console.log('[Appointment] 📅 Google Calendar sincronizado:', googleCalendarSynced ? 'SIM ✅' : 'NÃO ❌');
    if (googleEventId) {
      console.log('[Appointment] 📎 Google Event ID:', googleEventId);
    }
    if (googleCalendarError) {
      console.log('[Appointment] ⚠️ Erro Google Calendar:', googleCalendarError);
    }
    console.log('[Appointment] ============================================');

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
        console.log('[Appointment] Erro ao atualizar Google Calendar:', error.message);
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
        console.log('[Appointment] Erro ao cancelar no Google Calendar:', error.message);
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
        console.log('[Appointment] Erro ao deletar do Google Calendar:', error.message);
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
    console.log('[Appointment] 🔍 Verificando disponibilidade...');
    console.log('[Appointment]   - Início:', startTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    console.log('[Appointment]   - Fim:', endTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

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
      console.log('[Appointment] ❌ Conflito encontrado no banco local:', conflictingAppointments.length, 'agendamentos');
      return false;
    }

    console.log('[Appointment] ✅ Banco local: sem conflitos');

    // 2. Verifica no Google Calendar (se configurado)
    try {
      const isGoogleConfigured = await googleCalendarService.isConfigured(companyId);

      if (!isGoogleConfigured) {
        console.log('[Appointment] ⚠️ Google Calendar não configurado, usando apenas banco local');
        return true;
      }

      // Busca eventos no período no Google Calendar
      const events = await googleCalendarService.listEventsInRange(companyId, startTime, endTime);

      // Verifica se algum evento conflita com o horário desejado
      const hasConflict = events.some((event) => {
        // Pula eventos cancelados
        if (event.status === 'cancelled') return false;

        // Pula eventos marcados como "Livre" (Transparency)
        if (event.transparency === 'transparent') return false;

        // Normaliza datas do evento
        let eventStart: Date;
        let eventEnd: Date;

        if (event.start?.dateTime) {
          eventStart = new Date(event.start.dateTime);
          eventEnd = new Date(event.end?.dateTime || event.start.dateTime);
        } else if (event.start?.date) {
          // Evento de Dia Inteiro
          const dateString = event.start.date;
          eventStart = new Date(`${dateString}T00:00:00-03:00`);
          const endDateString = event.end?.date || dateString;
          eventEnd = new Date(`${endDateString}T23:59:59-03:00`);
        } else {
          return false;
        }

        // Verifica sobreposição: (StartA < EndB) and (EndA > StartB)
        const hasOverlap = (startTime < eventEnd && endTime > eventStart);

        if (hasOverlap) {
          console.log('[Appointment] ❌ Conflito com evento do Google Calendar:', event.summary);
          console.log('[Appointment]   - Evento:', eventStart.toLocaleString('pt-BR'), '-', eventEnd.toLocaleString('pt-BR'));
        }

        return hasOverlap;
      });

      if (hasConflict) {
        console.log('[Appointment] ❌ Google Calendar: conflito encontrado');
        return false;
      }

      console.log('[Appointment] ✅ Google Calendar: sem conflitos');
      return true;
    } catch (error: any) {
      console.log('[Appointment] ⚠️ Erro ao verificar Google Calendar:', error.message);
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
    console.log('[Appointment] ============================================');
    console.log('[Appointment] Buscando BRECHAS DE TEMPO (slots livres)');
    console.log('[Appointment] Data recebida:', date.toISOString());
    console.log('[Appointment] Data formatada:', date.toLocaleDateString('pt-BR'));
    console.log('[Appointment] Duração do slot:', slotDuration, 'minutos');
    console.log('[Appointment] ============================================');

    // Busca horário de funcionamento configurado no sistema
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: {
        workingHours: true,
        businessHoursStart: true,
        businessHoursEnd: true,
      },
    });

    console.log('[Appointment] Horário de funcionamento:');
    console.log('[Appointment]   - Texto (legado):', aiKnowledge?.workingHours || 'NÃO CONFIGURADO');
    console.log('[Appointment]   - Início (estruturado):', aiKnowledge?.businessHoursStart ?? 'NÃO CONFIGURADO');
    console.log('[Appointment]   - Fim (estruturado):', aiKnowledge?.businessHoursEnd ?? 'NÃO CONFIGURADO');

    // Prioriza campos estruturados, faz fallback para texto legado
    let businessHours: { start: number; end: number } | null = null;

    // Se tem os campos estruturados preenchidos, usa eles
    if (aiKnowledge?.businessHoursStart != null && aiKnowledge?.businessHoursEnd != null) {
      businessHours = {
        start: aiKnowledge.businessHoursStart,
        end: aiKnowledge.businessHoursEnd,
      };
      console.log('[Appointment] ✅ Usando horário estruturado:', businessHours.start, 'h às', businessHours.end, 'h');
    } else {
      // Fallback: tenta parsear do texto legado
      businessHours = this.parseWorkingHoursConfig(aiKnowledge?.workingHours || null);
      if (businessHours) {
        console.log('[Appointment] ✅ Usando horário parseado do texto:', businessHours.start, 'h às', businessHours.end, 'h');
      }
    }

    if (!businessHours) {
      // Último fallback: usa horário padrão comercial (9h às 18h)
      businessHours = { start: 9, end: 18 };
      console.log('[Appointment] ⚠️ Horário não configurado, usando padrão:', businessHours.start, 'h às', businessHours.end, 'h');
    }

    // Tenta buscar do Google Calendar primeiro
    try {
      console.log('[Appointment] 🔍 Verificando se Google Calendar está configurado...');
      const isGoogleConfigured = await googleCalendarService.isConfigured(companyId);

      if (!isGoogleConfigured) {
        console.log('[Appointment] ⚠️ Google Calendar NÃO está configurado');
        console.log('[Appointment] Usando fallback: geração local baseada no banco de dados');
        throw new Error('Google Calendar não configurado - usando fallback');
      }

      console.log('[Appointment] ✅ Google Calendar está configurado');
      console.log('[Appointment] 📅 Buscando slots REAIS do Google Calendar...');

      const slots = await googleCalendarService.getAvailableSlots(
        companyId,
        date,
        businessHours,
        slotDuration
      );

      console.log(`[Appointment] ✅ Google Calendar retornou ${slots.length} BRECHAS DE TEMPO (slots livres)`);

      if (slots.length > 0) {
        console.log('[Appointment] Primeiros slots encontrados:');
        slots.slice(0, 3).forEach((slot, i) => {
          console.log(`[Appointment]   ${i + 1}. ${slot.start.toLocaleString('pt-BR')} - ${slot.end.toLocaleString('pt-BR')}`);
        });
      }

      return slots.map((slot) => ({
        start: slot.start,
        end: slot.end,
      }));
    } catch (error: any) {
      console.log('[Appointment] ⚠️ Erro ao buscar do Google Calendar:', error.message);
      console.log('[Appointment] 🔄 Usando fallback: geração local com banco de dados');

      // Fallback: gera slots baseado apenas no banco local
      // Extrai ano, mês e dia da data recebida (UTC)
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();

      // Cria datas no fuso horário local usando horários do sistema
      const dayStart = new Date(year, month, day, businessHours.start, 0, 0, 0);
      const dayEnd = new Date(year, month, day, businessHours.end, 0, 0, 0);

      console.log('[Appointment] Data original:', date.toISOString());
      console.log('[Appointment] Ano:', year, 'Mês:', month, 'Dia:', day);
      console.log('[Appointment] Horário comercial:', dayStart.toISOString(), 'até', dayEnd.toISOString());
      console.log('[Appointment] Horário local:', dayStart.toLocaleString('pt-BR'), 'até', dayEnd.toLocaleString('pt-BR'));

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

      console.log(`[Appointment] ${slots.length} slots disponíveis (fallback)`);

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
