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
      console.error('❌ ERRO: Credenciais do Google Calendar não configuradas!');
      console.error('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Configurado ✓' : 'FALTANDO ✗');
      console.error('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Configurado ✓' : 'FALTANDO ✗');
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

    console.log('🔗 Gerando URL de autenticação...');
    console.log('  - Company ID:', companyId);
    console.log('  - Escopos solicitados:', scopes.length);

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
      console.log('📝 Salvando tokens do Google Calendar...');
      console.log('  - Company ID recebido:', companyId);
      console.log('  - Access Token:', tokens.access_token ? 'Presente ✓' : 'FALTANDO ✗');
      console.log('  - Refresh Token:', tokens.refresh_token ? 'Presente ✓' : 'FALTANDO ✗');

      // VALIDAÇÃO: Verificar se a company existe
      console.log('🔍 Verificando se a company existe...');
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });

      if (!company) {
        console.error('❌ ERRO: Company não encontrada!');
        console.error('  - Company ID procurado:', companyId);

        // Lista todas as companies disponíveis
        const allCompanies = await prisma.company.findMany({
          select: { id: true, name: true },
        });
        console.error('  - Companies disponíveis no banco:');
        allCompanies.forEach(c => {
          console.error(`    * ${c.name} (ID: ${c.id})`);
        });

        throw new Error(`Company com ID '${companyId}' não existe no banco de dados. Verifique se o ID está correto.`);
      }

      console.log('✓ Company encontrada:', company.name);

      const tokenExpiry = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

      // Busca email da conta Google
      this.oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });

      console.log('🔍 Buscando informações do usuário Google...');
      const userInfo = await oauth2.userinfo.get();
      console.log('  - Email:', userInfo.data.email);

      console.log('💾 Salvando no banco de dados...');
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

      console.log('✅ Tokens salvos com sucesso para a company:', company.name);
    } catch (error: any) {
      console.error('❌ Erro ao salvar tokens:', error.message);
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
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
    console.log('[GoogleCalendar] Carregando tokens para company:', companyId);

    const calendar = await prisma.googleCalendar.findUnique({
      where: { companyId },
    });

    if (!calendar) {
      console.error('[GoogleCalendar] Nenhum registro encontrado na tabela GoogleCalendar');
      throw new Error('Google Calendar não configurado para esta empresa');
    }

    console.log('[GoogleCalendar] Registro encontrado:');
    console.log('[GoogleCalendar] - Email:', calendar.email);
    console.log('[GoogleCalendar] - Calendar ID:', calendar.calendarId);
    console.log('[GoogleCalendar] - Token Expiry:', calendar.tokenExpiry);
    console.log('[GoogleCalendar] - Has Access Token:', !!calendar.accessToken);
    console.log('[GoogleCalendar] - Has Refresh Token:', !!calendar.refreshToken);

    // Verifica se token expirou
    const now = new Date();
    if (calendar.tokenExpiry <= now) {
      console.log('[GoogleCalendar] ⚠️ Token expirado, renovando...');

      // Renova token
      this.oauth2Client.setCredentials({
        refresh_token: calendar.refreshToken,
      });

      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        console.log('[GoogleCalendar] ✅ Token renovado com sucesso');

        // Atualiza no banco
        await prisma.googleCalendar.update({
          where: { companyId },
          data: {
            accessToken: credentials.access_token!,
            tokenExpiry: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
          },
        });

        this.oauth2Client.setCredentials(credentials);
      } catch (error: any) {
        console.error('[GoogleCalendar] ❌ Erro ao renovar token:', error.message);
        throw new Error('Não foi possível renovar o token do Google Calendar. Reautorize a integração.');
      }
    } else {
      console.log('[GoogleCalendar] ✅ Token válido, configurando credenciais...');
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
   * Lista horários disponíveis em um dia específico
   */
async getAvailableSlots(
    companyId: string,
    date: Date,
    businessHours: { start: number; end: number } = { start: 9, end: 18 },
    slotDuration: number = 60
  ): Promise<TimeSlot[]> {
    // 1. Configuração de Datas (Fuso Horário BR)
    // Força o timezone para evitar bugs em servidores UTC (Docker)
    const timeZone = 'America/Sao_Paulo';
    
    // Cria o início e fim do dia comercial baseados na data fornecida
    const startOfDay = new Date(date);
    startOfDay.setHours(businessHours.start, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(businessHours.end, 0, 0, 0);

    // Carrega tokens
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // 2. Busca Eventos (Expande recorrentes e filtra deletados)
    const response = await calendar.events.list({
      calendarId: calendarConfig.calendarId || 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true, // Expande eventos recorrentes (ex: reunião toda seg-feira)
      orderBy: 'startTime',
      timeZone, // Importante pedir no timezone correto
    });

    const events = response.data.items || [];

    // 3. Geração de Slots
    const slots: TimeSlot[] = [];
    let currentTime = this.roundToNext15Minutes(startOfDay);

    // Loop para criar slots de tempo
    while (currentTime < endOfDay) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);

      // Se o slot terminar depois do expediente, para o loop
      if (slotEnd > endOfDay) {
        break;
      }

      // 4. Verificação de Conflitos (A Lógica Crítica)
      const conflictingEvent = events.find((event) => {
        // Pula eventos cancelados
        if (event.status === 'cancelled') return false;

        // Pula eventos marcados como "Livre" (Transparency)
        // 'transparent' = Livre, 'opaque' = Ocupado (ou null/undefined = Ocupado)
        if (event.transparency === 'transparent') return false;

        // Normaliza datas do evento
        let eventStart: Date;
        let eventEnd: Date;

        if (event.start?.dateTime) {
          // Evento comum com hora marcada
          eventStart = new Date(event.start.dateTime);
          eventEnd = new Date(event.end?.dateTime || event.start.dateTime);
        } else if (event.start?.date) {
          // Evento de Dia Inteiro (All Day)
          // Tratamento especial para evitar bugs de fuso horário
          const dateString = event.start.date; // "2024-12-25"
          // Cria data ao meio-dia para garantir que caia no dia certo independente do offset UTC
          eventStart = new Date(`${dateString}T00:00:00-03:00`); 
          const endDateString = event.end?.date || dateString;
          eventEnd = new Date(`${endDateString}T23:59:59-03:00`);
        } else {
          return false; // Evento inválido
        }

        // Verifica sobreposição (Overlap)
        // (StartA < EndB) and (EndA > StartB)
        const hasOverlap = (currentTime < eventEnd && slotEnd > eventStart);

        return hasOverlap;
      });

      // Se não encontrou conflito, está disponível
      const isAvailable = !conflictingEvent;

      if (isAvailable) {
         slots.push({
          start: new Date(currentTime),
          end: new Date(slotEnd),
          available: true,
        });
      }

      // Avança intervalo (ex: slots a cada 30 min ou 60 min)
      // Dica: Se quiser slots começando a cada hora cheia, use 60. 
      // Se quiser flexibilidade (9:00, 9:15, 9:30), use 15 ou 30.
      currentTime = new Date(currentTime.getTime() + 30 * 60000); // Avança 30 min para dar mais opções
    }

    return slots;
  }

  /**
   * Cria um evento no calendário
   */
  async createEvent(companyId: string, eventData: CreateEventDTO): Promise<calendar_v3.Schema$Event> {
    console.log('[GoogleCalendar] 🔄 Iniciando criação de evento...');
    console.log('[GoogleCalendar] Company ID:', companyId);
    console.log('[GoogleCalendar] Event summary:', eventData.summary);
    console.log('[GoogleCalendar] Start:', eventData.start.toISOString());
    console.log('[GoogleCalendar] End:', eventData.end.toISOString());

    try {
      // Carrega e valida tokens
      console.log('[GoogleCalendar] 🔑 Carregando tokens do Google Calendar...');
      const calendarConfig = await this.loadTokens(companyId);
      console.log('[GoogleCalendar] ✅ Tokens carregados com sucesso');
      console.log('[GoogleCalendar] Calendar ID:', calendarConfig.calendarId || 'primary');
      console.log('[GoogleCalendar] Email:', calendarConfig.email);

      // Cria cliente do Google Calendar
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Monta o evento
      const event: calendar_v3.Schema$Event = {
        summary: eventData.summary,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: eventData.start.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: eventData.end.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        attendees: eventData.attendees?.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 dia antes
            { method: 'popup', minutes: 60 }, // 1 hora antes
          ],
        },
      };

      console.log('[GoogleCalendar] 📤 Enviando evento para Google Calendar API...');
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

      console.log('[GoogleCalendar] ✅ Evento criado com sucesso!');
      console.log('[GoogleCalendar] Event ID:', response.data.id);
      console.log('[GoogleCalendar] Event Link:', response.data.htmlLink);
      console.log('[GoogleCalendar] Status:', response.data.status);

      return response.data;
    } catch (error: any) {
      console.error('[GoogleCalendar] ❌ ERRO ao criar evento:');
      console.error('[GoogleCalendar] Tipo de erro:', error.constructor.name);
      console.error('[GoogleCalendar] Mensagem:', error.message);

      if (error.response) {
        console.error('[GoogleCalendar] Status HTTP:', error.response.status);
        console.error('[GoogleCalendar] Response data:', JSON.stringify(error.response.data, null, 2));
      }

      if (error.stack) {
        console.error('[GoogleCalendar] Stack trace:', error.stack);
      }

      // Re-lança o erro com mensagem mais clara
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

    const updates: calendar_v3.Schema$Event = {
      summary: eventData.summary,
      description: eventData.description,
      location: eventData.location,
    };

    if (eventData.start) {
      updates.start = {
        dateTime: eventData.start.toISOString(),
        timeZone: 'America/Sao_Paulo',
      };
    }

    if (eventData.end) {
      updates.end = {
        dateTime: eventData.end.toISOString(),
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
