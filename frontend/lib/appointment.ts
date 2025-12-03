import { api } from './api';
import {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentData,
  AppointmentFilters,
  TimeSlot,
} from '@/types/appointment';

export const appointmentApi = {
  /**
   * Lista agendamentos
   */
  async getAll(companyId: string, filters?: AppointmentFilters): Promise<Appointment[]> {
    const params: any = { companyId, ...filters };
    const response = await api.get('/appointments', { params });
    return response.data.data;
  },

  /**
   * Busca agendamento por ID
   */
  async getById(id: string, companyId: string): Promise<Appointment> {
    const response = await api.get(`/appointments/${id}`, {
      params: { companyId },
    });
    return response.data.data;
  },

  /**
   * Cria agendamento
   */
  async create(companyId: string, data: CreateAppointmentData): Promise<Appointment> {
    const response = await api.post('/appointments', {
      companyId,
      ...data,
    });
    return response.data.data;
  },

  /**
   * Atualiza agendamento
   */
  async update(
    id: string,
    companyId: string,
    data: UpdateAppointmentData
  ): Promise<Appointment> {
    const response = await api.patch(`/appointments/${id}`, {
      companyId,
      ...data,
    });
    return response.data.data;
  },

  /**
   * Cancela agendamento
   */
  async cancel(id: string, companyId: string): Promise<Appointment> {
    const response = await api.post(`/appointments/${id}/cancel`, { companyId });
    return response.data.data;
  },

  /**
   * Deleta agendamento
   */
  async delete(id: string, companyId: string): Promise<void> {
    await api.delete(`/appointments/${id}`, {
      params: { companyId },
    });
  },

  /**
   * Busca horários disponíveis
   */
  async getAvailableSlots(
    companyId: string,
    date: string,
    duration: number = 60
  ): Promise<TimeSlot[]> {
    const response = await api.get('/appointments/available-slots', {
      params: { companyId, date, duration },
    });
    return response.data.data;
  },

  /**
   * Lista próximos agendamentos do cliente
   */
  async getCustomerUpcoming(customerId: string, companyId: string): Promise<Appointment[]> {
    const response = await api.get(`/appointments/customer/${customerId}/upcoming`, {
      params: { companyId },
    });
    return response.data.data;
  },
};
