import { api } from './api';

export interface WhatsAppLink {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  phoneNumber: string;
  message?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  url: string;
  clicks: number;
}

export interface CreateWhatsAppLinkDTO {
  name: string;
  slug: string;
  phoneNumber: string;
  message?: string;
}

export interface UpdateWhatsAppLinkDTO {
  name?: string;
  slug?: string;
  phoneNumber?: string;
  message?: string;
  isActive?: boolean;
}

export interface LinkAnalytics {
  totalClicks: number;
  uniqueVisitors: number;
  clicksByCountry: { country: string; count: number }[];
  clicksByDevice: { deviceType: string; count: number }[];
  clicksByDay: { date: string; count: number }[];
  topReferers: { referer: string; count: number }[];
}

export const whatsappLinkService = {
  /**
   * Lista todos os links
   */
  async getAll(): Promise<WhatsAppLink[]> {
    const response = await api.get('/whatsapp-links');
    return response.data.data;
  },

  /**
   * Busca um link por ID
   */
  async getById(id: string): Promise<WhatsAppLink> {
    const response = await api.get(`/whatsapp-links/${id}`);
    return response.data.data;
  },

  /**
   * Cria um novo link
   */
  async create(data: CreateWhatsAppLinkDTO): Promise<WhatsAppLink> {
    const response = await api.post('/whatsapp-links', data);
    return response.data.data;
  },

  /**
   * Atualiza um link
   */
  async update(id: string, data: UpdateWhatsAppLinkDTO): Promise<WhatsAppLink> {
    const response = await api.put(`/whatsapp-links/${id}`, data);
    return response.data.data;
  },

  /**
   * Deleta um link
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/whatsapp-links/${id}`);
  },

  /**
   * Obtém analytics de um link
   */
  async getAnalytics(id: string, days: number = 30): Promise<LinkAnalytics> {
    const response = await api.get(`/whatsapp-links/${id}/analytics?days=${days}`);
    return response.data.data;
  },

  /**
   * Gera um slug a partir de um nome
   */
  async generateSlug(name: string): Promise<string> {
    const response = await api.post('/whatsapp-links/generate-slug', { name });
    return response.data.data.slug;
  },
};
