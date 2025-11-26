import { api } from './api';

export interface Tag {
  id: string;
  companyId: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export const tagApi = {
  async create(name: string, color?: string): Promise<Tag> {
    const response = await api.post<{ data: Tag }>('/tags', { name, color });
    return response.data.data;
  },

  async getAll(): Promise<Tag[]> {
    const response = await api.get<{ data: Tag[] }>('/tags');
    return response.data.data;
  },

  async getAllNames(): Promise<string[]> {
    const response = await api.get<{ data: string[] }>('/tags/names');
    return response.data.data;
  },

  async sync(): Promise<{ tagsCount: number }> {
    const response = await api.post<{ data: { tagsCount: number } }>('/tags/sync');
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/tags/${id}`);
  },
};
