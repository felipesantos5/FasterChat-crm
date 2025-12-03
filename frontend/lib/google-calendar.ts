import { api } from './api';

export interface GoogleCalendarStatus {
  connected: boolean;
  email?: string;
  calendarId?: string;
  connectedAt?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  status?: string;
  htmlLink?: string;
}

export const googleCalendarApi = {
  /**
   * Obtém URL de autenticação OAuth
   */
  async getAuthUrl(companyId: string): Promise<string> {
    const response = await api.get('/google/auth-url', {
      params: { companyId },
    });
    return response.data.data.authUrl;
  },

  /**
   * Verifica status da conexão
   */
  async getStatus(companyId: string): Promise<GoogleCalendarStatus> {
    const response = await api.get('/google/status', {
      params: { companyId },
    });
    return response.data.data;
  },

  /**
   * Desconecta Google Calendar
   */
  async disconnect(companyId: string): Promise<void> {
    await api.post('/google/disconnect', { companyId });
  },

  /**
   * Busca horários disponíveis no Google Calendar
   */
  async getAvailableSlots(
    companyId: string,
    date: string,
    duration: number = 60
  ): Promise<Array<{ start: Date; end: Date; available: boolean }>> {
    const response = await api.get('/google/available-slots', {
      params: { companyId, date, duration },
    });
    return response.data.data;
  },

  /**
   * Lista eventos do Google Calendar em um intervalo de datas
   */
  async getEvents(
    companyId: string,
    startDate?: string,
    endDate?: string
  ): Promise<GoogleCalendarEvent[]> {
    const response = await api.get('/google/events', {
      params: { companyId, startDate, endDate },
    });
    return response.data.data;
  },
};
