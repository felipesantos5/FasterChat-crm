import api from './api';
import { QuickMessage, CreateQuickMessageData, UpdateQuickMessageData } from '@/types/quick-message';

export const quickMessageApi = {
  async findAll(): Promise<QuickMessage[]> {
    const res = await api.get<QuickMessage[]>('/quick-messages');
    return res.data;
  },

  async create(data: CreateQuickMessageData): Promise<QuickMessage> {
    const res = await api.post<QuickMessage>('/quick-messages', data);
    return res.data;
  },

  async update(id: string, data: UpdateQuickMessageData): Promise<QuickMessage> {
    const res = await api.put<QuickMessage>(`/quick-messages/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/quick-messages/${id}`);
  },
};
