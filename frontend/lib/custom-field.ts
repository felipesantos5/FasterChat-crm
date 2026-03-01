import { api } from './api';
import { CustomFieldDefinition } from '@/types/custom-field';

export const customFieldApi = {
  async getDefinitions(): Promise<CustomFieldDefinition[]> {
    const response = await api.get('/custom-fields');
    return response.data.data;
  },

  async createDefinition(data: {
    label: string;
    name: string;
    type: 'text' | 'number' | 'date';
    required?: boolean;
    order?: number;
  }): Promise<CustomFieldDefinition> {
    const response = await api.post('/custom-fields', data);
    return response.data.data;
  },

  async updateDefinition(
    id: string,
    data: { label?: string; required?: boolean; order?: number }
  ): Promise<CustomFieldDefinition> {
    const response = await api.put(`/custom-fields/${id}`, data);
    return response.data.data;
  },

  async deleteDefinition(id: string): Promise<void> {
    await api.delete(`/custom-fields/${id}`);
  },
};
