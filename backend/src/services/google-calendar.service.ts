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
    console.log('[GoogleCalendar] 🔑 Carregando tokens para company:', companyId);

    const calendar = await prisma.googleCalendar.findUnique({
      where: { companyId },
    });

    if (!calendar) {
      console.error('[GoogleCalendar] ❌ Nenhum registro encontrado na tabela GoogleCalendar');
      throw new Error('Google Calendar não configurado para esta empresa');
    }

    console.log('[GoogleCalendar] 📋 Registro encontrado:');
    console.log('[GoogleCalendar]   - Email:', calendar.email);
    console.log('[GoogleCalendar]   - Calendar ID:', calendar.calendarId || 'primary');
    console.log('[GoogleCalendar]   - Token Expiry:', calendar.tokenExpiry.toISOString());
    console.log('[GoogleCalendar]   - Has Access Token:', calendar.accessToken ? 'SIM ✅' : 'NÃO ❌');
    console.log('[GoogleCalendar]   - Has Refresh Token:', calendar.refreshToken ? 'SIM ✅' : 'NÃO ❌');

    // Verifica se tem refresh token (essencial para renovação)
    if (!calendar.refreshToken) {
      console.error('[GoogleCalendar] ❌ CRÍTICO: Não há refresh token! Reconecte o Google Calendar.');
      throw new Error('Refresh token ausente. Reconecte o Google Calendar na página de Calendário.');
    }

    // Verifica se token expirou
    const now = new Date();
    const tokenExpiry = new Date(calendar.tokenExpiry);
    const isExpired = tokenExpiry <= now;
    const expiresInMinutes = Math.round((tokenExpiry.getTime() - now.getTime()) / 60000);

    console.log('[GoogleCalendar]   - Token expirado:', isExpired ? 'SIM ⚠️' : 'NÃO ✅');
    if (!isExpired) {
      console.log('[GoogleCalendar]   - Expira em:', expiresInMinutes, 'minutos');
    }

    if (isExpired) {
      console.log('[GoogleCalendar] 🔄 Token expirado, tentando renovar...');

      // Configura apenas o refresh token para renovação
      this.oauth2Client.setCredentials({
        refresh_token: calendar.refreshToken,
      });

      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        if (!credentials.access_token) {
          throw new Error('Google retornou credenciais sem access_token');
        }

        console.log('[GoogleCalendar] ✅ Token renovado com sucesso!');
        console.log('[GoogleCalendar]   - Novo expiry:', new Date(credentials.expiry_date || Date.now() + 3600000).toISOString());

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
        console.error('[GoogleCalendar] ❌ FALHA ao renovar token:');
        console.error('[GoogleCalendar]   - Erro:', error.message);

        // Verifica se é erro de revogação
        if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired or revoked')) {
          console.error('[GoogleCalendar] ⚠️ O refresh token foi revogado ou expirou permanentemente.');
          console.error('[GoogleCalendar] ⚠️ O usuário precisa reconectar o Google Calendar.');
          throw new Error('Conexão com Google Calendar perdida. Reconecte na página de Calendário.');
        }

        throw new Error(`Falha ao renovar token: ${error.message}`);
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
   * Retorna APENAS os slots LIVRES (brechas de tempo sem conflitos)
   */
async getAvailableSlots(
    companyId: string,
    date: Date,
    businessHours: { start: number; end: number } = { start: 9, end: 18 },
    slotDuration: number = 60
  ): Promise<TimeSlot[]> {
    console.log('[GoogleCalendar] ============================================');
    console.log('[GoogleCalendar] Buscando brechas de tempo no Google Calendar');
    console.log('[GoogleCalendar] Data:', date.toLocaleDateString('pt-BR'));
    console.log('[GoogleCalendar] Horário de funcionamento:', businessHours.start, 'h às', businessHours.end, 'h');
    console.log('[GoogleCalendar] Duração do slot:', slotDuration, 'minutos');
    console.log('[GoogleCalendar] ============================================');

    // 1. Configuração de Datas (Fuso Horário BR)
    // Força o timezone para evitar bugs em servidores UTC (Docker)
    const timeZone = 'America/Sao_Paulo';

    // Cria o início e fim do dia comercial baseados na data fornecida
    const startOfDay = new Date(date);
    startOfDay.setHours(businessHours.start, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(businessHours.end, 0, 0, 0);

    console.log('[GoogleCalendar] Período de busca:', startOfDay.toLocaleString('pt-BR'), 'até', endOfDay.toLocaleString('pt-BR'));

    // Carrega tokens
    const calendarConfig = await this.loadTokens(companyId);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // 2. Busca Eventos (Expande recorrentes e filtra deletados)
    console.log('[GoogleCalendar] 📅 Buscando eventos agendados no Google Calendar...');
    const response = await calendar.events.list({
      calendarId: calendarConfig.calendarId || 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true, // Expande eventos recorrentes (ex: reunião toda seg-feira)
      orderBy: 'startTime',
      timeZone, // Importante pedir no timezone correto
    });

    const events = response.data.items || [];
    console.log(`[GoogleCalendar] Encontrados ${events.length} eventos agendados para este dia`);

    if (events.length > 0) {
      console.log('[GoogleCalendar] Eventos ocupados:');
      events.slice(0, 5).forEach((event, i) => {
        const start = event.start?.dateTime || event.start?.date || 'N/A';
        const end = event.end?.dateTime || event.end?.date || 'N/A';
        console.log(`[GoogleCalendar]   ${i + 1}. ${event.summary} (${start} - ${end})`);
      });
      if (events.length > 5) {
        console.log(`[GoogleCalendar]   ... e mais ${events.length - 5} eventos`);
      }
    }

    // 3. Geração de Slots
    console.log('[GoogleCalendar] 🔍 Procurando brechas de tempo...');
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

    console.log(`[GoogleCalendar] ✅ Encontradas ${slots.length} BRECHAS DE TEMPO (slots livres)`);
    if (slots.length > 0) {
      console.log('[GoogleCalendar] Primeiros slots disponíveis:');
      slots.slice(0, 5).forEach((slot, i) => {
        console.log(`[GoogleCalendar]   ${i + 1}. ${slot.start.toLocaleString('pt-BR')}`);
      });
    } else {
      console.log('[GoogleCalendar] ⚠️ Nenhum horário disponível encontrado para este dia');
    }
    console.log('[GoogleCalendar] ============================================');

    return slots;
  }

  /**
   * Cria um evento no calendário
   */
  async createEvent(companyId: string, eventData: CreateEventDTO): Promise<calendar_v3.Schema$Event> {
    console.log('[GoogleCalendar] 🔄 Iniciando criação de evento...');
    console.log('[GoogleCalendar] Company ID:', companyId);
    console.log('[GoogleCalendar] Event summary:', eventData.summary);
    console.log('[GoogleCalendar] Start (UTC):', eventData.start.toISOString());
    console.log('[GoogleCalendar] End (UTC):', eventData.end.toISOString());

    try {
      // Carrega e valida tokens
      console.log('[GoogleCalendar] 🔑 Carregando tokens do Google Calendar...');
      const calendarConfig = await this.loadTokens(companyId);
      console.log('[GoogleCalendar] ✅ Tokens carregados com sucesso');
      console.log('[GoogleCalendar] Calendar ID:', calendarConfig.calendarId || 'primary');
      console.log('[GoogleCalendar] Email:', calendarConfig.email);

      // Cria cliente do Google Calendar
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // 🔥 SOLUÇÃO DEFINITIVA DE TIMEZONE:
      // Usa Intl.DateTimeFormat nativo do JavaScript
      // Funciona corretamente independente do timezone do servidor!

      const formatForGoogleCalendar = (date: Date): string => {
        // Usa Intl.DateTimeFormat para formatar no timezone de São Paulo
        // Isso funciona mesmo se o servidor estiver em UTC, AWS, Docker, etc.
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

        const formatter = new Intl.DateTimeFormat('sv-SE', options); // sv-SE usa formato ISO
        const parts = formatter.formatToParts(date);

        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';

        const year = getPart('year');
        const month = getPart('month');
        const day = getPart('day');
        const hour = getPart('hour');
        const minute = getPart('minute');
        const second = getPart('second');

        // Retorna no formato que Google Calendar espera
        // SEM offset, porque já especificamos timeZone no objeto
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      };

      const startDateTime = formatForGoogleCalendar(eventData.start);
      const endDateTime = formatForGoogleCalendar(eventData.end);

      console.log('[GoogleCalendar] 🕐 Datas formatadas para Google Calendar:');
      console.log('[GoogleCalendar]   Input Start (UTC):', eventData.start.toISOString());
      console.log('[GoogleCalendar]   Input End (UTC):', eventData.end.toISOString());
      console.log('[GoogleCalendar]   Output Start (São Paulo):', startDateTime);
      console.log('[GoogleCalendar]   Output End (São Paulo):', endDateTime);

      // Monta o evento
      const event: calendar_v3.Schema$Event = {
        summary: eventData.summary,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: startDateTime, // Formato: "2025-01-02T08:00:00" (SEM o 'Z'!)
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: endDateTime, // Formato: "2025-01-02T09:00:00" (SEM o 'Z'!)
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
