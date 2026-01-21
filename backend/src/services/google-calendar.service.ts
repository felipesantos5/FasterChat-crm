import { google, calendar_v3 } from 'googleapis';
import { prisma } from '../utils/prisma';
import { OAuth2Client } from 'google-auth-library';

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface CreateEventDTO {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: string[];
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor() {
    // Validação das credenciais
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Credenciais do Google Calendar não configuradas no .env');
    }

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback'
    );
  }

  /**
   * Gera URL para autenticação OAuth2
   */
  getAuthUrl(companyId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: companyId, // Passa companyId no state para recuperar no callback
      prompt: 'consent', // Força exibir tela de consentimento para garantir refresh_token
    });
  }

  /**
   * Troca código de autorização por tokens
   */
  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Salva tokens no banco de dados
   */
  async saveTokens(companyId: string, tokens: any) {
    try {
      // VALIDAÇÃO: Verificar se a company existe
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });

      if (!company) {
        throw new Error(`Company com ID '${companyId}' não existe no banco de dados.`);
      }

      const tokenExpiry = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

      // Busca email da conta Google
      this.oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      await prisma.googleCalendar.upsert({
        where: { companyId },
        create: {
          companyId,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token!,
          tokenExpiry,
          email: userInfo.data.email || undefined,
          calendarId: 'primary',
        },
        update: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiry,
          email: userInfo.data.email || undefined,
        },
      });
    } catch (error: any) {
      console.error('[GoogleCalendar] Erro ao salvar tokens:', error.message);
      throw error;
    }
  }

  /**
   * Verifica se o Google Calendar está configurado para uma empresa
   */
  async isConfigured(companyId: string): Promise<boolean> {
    try {
      const calendar = await prisma.googleCalendar.findUnique({
        where: { companyId },
      });

      return !!calendar && !!calendar.accessToken && !!calendar.refreshToken;
    } catch (error) {
      console.error('[GoogleCalendar] Erro ao verificar configuração:', error);
      return false;
    }
  }

  /**
   * Carrega tokens do banco e configura OAuth2 client
   */
  private async loadTokens(companyId: string) {
    const calendar = await prisma.googleCalendar.findUnique({
      where: { companyId },
    });

    if (!calendar) {
      throw new Error('Google Calendar não configurado para esta empresa');
    }

    // Verifica se tem refresh token (essencial para renovação)
    if (!calendar.refreshToken) {
      throw new Error('Refresh token ausente. Reconecte o Google Calendar na página de Calendário.');
    }

    // Verifica se token expirou
    const now = new Date();
    const tokenExpiry = new Date(calendar.tokenExpiry);
    const isExpired = tokenExpiry <= now;

    if (isExpired) {
      // Configura apenas o refresh token para renovação
      this.oauth2Client.setCredentials({
        refresh_token: calendar.refreshToken,
      });

      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        if (!credentials.access_token) {
          throw new Error('Google retornou credenciais sem access_token');
        }

        // Atualiza no banco
        await prisma.googleCalendar.update({
          where: { companyId },
          data: {
            accessToken: credentials.access_token,
            tokenExpiry: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
          },
        });

        this.oauth2Client.setCredentials(credentials);
      } catch (error: any) {
        // Verifica se é erro de revogação
        if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired or revoked')) {
          throw new Error('Conexão com Google Calendar perdida. Reconecte na página de Calendário.');
        }

        throw new Error(`Falha ao renovar token: ${error.message}`);
      }
    } else {
      this.oauth2Client.setCredentials({
        access_token: calendar.accessToken,
        refresh_token: calendar.refreshToken,
      });
    }

    return calendar;
  }

  /**
   * Verifica disponibilidade em um período
   */
  async checkAvailability(
    companyId: string,
    startDate: Date,
    endDate: Date,
    slotDuration: number = 60 // duração em minutos
  ): Promise<TimeSlot[]> {
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // Busca eventos no período
    const response = await calendar.events.list({
      calendarId: calendarConfig.calendarId || 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const slots: TimeSlot[] = [];

    // Gera slots de tempo
    let currentTime = new Date(startDate);
    while (currentTime < endDate) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);

      // Verifica se o slot está livre
      const isAvailable = !events.some((event) => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date || '');
        const eventEnd = new Date(event.end?.dateTime || event.end?.date || '');

        return (
          (currentTime >= eventStart && currentTime < eventEnd) ||
          (slotEnd > eventStart && slotEnd <= eventEnd) ||
          (currentTime <= eventStart && slotEnd >= eventEnd)
        );
      });

      slots.push({
        start: new Date(currentTime),
        end: new Date(slotEnd),
        available: isAvailable,
      });

      currentTime = slotEnd;
    }

    return slots;
  }

  /**
   * Arredonda a data para o próximo intervalo de 15 minutos
   */
  private roundToNext15Minutes(date: Date): Date {
    const minutes = date.getUTCMinutes();
    const remainder = minutes % 15;

    if (remainder === 0) {
      return new Date(date);
    }

    const roundedDate = new Date(date);
    roundedDate.setUTCMinutes(minutes + (15 - remainder));
    roundedDate.setUTCSeconds(0);
    roundedDate.setUTCMilliseconds(0);

    return roundedDate;
  }

  /**
   * Lista horários disponíveis em um dia específico
   * Retorna APENAS os slots LIVRES (brechas de tempo sem conflitos)
   */
async getAvailableSlots(
    companyId: string,
    date: Date,
    businessHours: { start: number; end: number } = { start: 9, end: 18 },
    slotDuration: number = 60
  ): Promise<TimeSlot[]> {
    // Configuração de Datas (Fuso Horário BR)
    const timeZone = 'America/Sao_Paulo';
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    // São Paulo é UTC-3
    const BRT_OFFSET_HOURS = 3;

    const createUTCDate = (y: number, m: number, d: number, hourBRT: number): Date => {
      const hourUTC = hourBRT + BRT_OFFSET_HOURS;
      return new Date(Date.UTC(y, m, d, hourUTC, 0, 0, 0));
    };

    const startOfDay = createUTCDate(year, month, day, businessHours.start);
    const endOfDay = createUTCDate(year, month, day, businessHours.end);

    // Carrega tokens
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // Busca Eventos
    const response = await calendar.events.list({
      calendarId: calendarConfig.calendarId || 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone,
    });

    const events = response.data.items || [];

    // Geração de Slots
    const slots: TimeSlot[] = [];
    let currentTime = this.roundToNext15Minutes(startOfDay);

    while (currentTime < endOfDay) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);

      if (slotEnd > endOfDay) {
        break;
      }

      // Verificação de Conflitos
      const conflictingEvent = events.find((event) => {
        if (event.status === 'cancelled') return false;
        if (event.transparency === 'transparent') return false;

        let eventStart: Date;
        let eventEnd: Date;

        if (event.start?.dateTime) {
          eventStart = new Date(event.start.dateTime);
          eventEnd = new Date(event.end?.dateTime || event.start.dateTime);

          const durationHours = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);

          if (durationHours >= 8) {
            const eventTitle = (event.summary || '').toLowerCase();
            const workingHoursKeywords = ['expediente', 'horário de trabalho', 'working hours', 'horario comercial', 'disponível', 'available'];
            if (workingHoursKeywords.some(keyword => eventTitle.includes(keyword))) {
              return false;
            }
          }
        } else if (event.start?.date) {
          return false;
        } else {
          return false;
        }

        const hasOverlap = (currentTime < eventEnd && slotEnd > eventStart);
        return hasOverlap;
      });

      const isAvailable = !conflictingEvent;

      if (isAvailable) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(slotEnd),
          available: true,
        });
      }

      currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }

    return slots;
  }

  /**
   * Cria um evento no calendário
   */
  async createEvent(companyId: string, eventData: CreateEventDTO): Promise<calendar_v3.Schema$Event> {
    try {
      const calendarConfig = await this.loadTokens(companyId);
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const formatForGoogleCalendar = (date: Date): string => {
        const options: Intl.DateTimeFormatOptions = {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        };

        const formatter = new Intl.DateTimeFormat('sv-SE', options);
        const parts = formatter.formatToParts(date);

        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';

        return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
      };

      const startDateTime = formatForGoogleCalendar(eventData.start);
      const endDateTime = formatForGoogleCalendar(eventData.end);

      const event: calendar_v3.Schema$Event = {
        summary: eventData.summary,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: startDateTime,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/Sao_Paulo',
        },
        attendees: eventData.attendees?.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: calendarConfig.calendarId || 'primary',
        requestBody: event,
      });

      if (!response.data) {
        throw new Error('Google Calendar API retornou resposta vazia');
      }

      if (!response.data.id) {
        throw new Error('Google Calendar API retornou evento sem ID');
      }

      return response.data;
    } catch (error: any) {
      console.error('[GoogleCalendar] Erro ao criar evento:', error.message);

      if (error.message.includes('not found')) {
        throw new Error('Google Calendar não configurado para esta empresa');
      } else if (error.message.includes('invalid') || error.message.includes('expired')) {
        throw new Error('Credenciais do Google Calendar expiradas ou inválidas');
      } else if (error.response?.status === 401) {
        throw new Error('Não autorizado: credenciais do Google Calendar inválidas');
      } else if (error.response?.status === 403) {
        throw new Error('Acesso negado: verifique as permissões do Google Calendar');
      } else {
        throw error;
      }
    }
  }

  /**
   * Lista eventos próximos
   */
  async listUpcomingEvents(companyId: string, maxResults: number = 10) {
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.list({
      calendarId: calendarConfig.calendarId || 'primary',
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  }

  /**
   * Lista eventos em um intervalo de datas
   */
  async listEventsInRange(companyId: string, startDate: Date, endDate: Date) {
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.list({
      calendarId: calendarConfig.calendarId || 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Sao_Paulo',
    });

    return response.data.items || [];
  }

  /**
   * Atualiza um evento
   */
  async updateEvent(
    companyId: string,
    eventId: string,
    eventData: Partial<CreateEventDTO>
  ): Promise<calendar_v3.Schema$Event> {
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // Função helper usando Intl.DateTimeFormat
    const formatForGoogleCalendar = (date: Date): string => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('sv-SE', options);
      const parts = formatter.formatToParts(date);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
      return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
    };

    const updates: calendar_v3.Schema$Event = {
      summary: eventData.summary,
      description: eventData.description,
      location: eventData.location,
    };

    if (eventData.start) {
      updates.start = {
        dateTime: formatForGoogleCalendar(eventData.start),
        timeZone: 'America/Sao_Paulo',
      };
    }

    if (eventData.end) {
      updates.end = {
        dateTime: formatForGoogleCalendar(eventData.end),
        timeZone: 'America/Sao_Paulo',
      };
    }

    const response = await calendar.events.patch({
      calendarId: calendarConfig.calendarId || 'primary',
      eventId,
      requestBody: updates,
    });

    return response.data;
  }

  /**
   * Cancela um evento
   */
  async cancelEvent(companyId: string, eventId: string): Promise<void> {
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    await calendar.events.delete({
      calendarId: calendarConfig.calendarId || 'primary',
      eventId,
    });
  }

  /**
   * Desconecta o Google Calendar
   */
  async disconnect(companyId: string): Promise<void> {
    await prisma.googleCalendar.delete({
      where: { companyId },
    });
  }
}

export const googleCalendarService = new GoogleCalendarService();
