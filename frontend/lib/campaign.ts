import { api } from './api';
import {
  Campaign,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignEstimate,
  CampaignListResponse,
} from '@/types/campaign';

export const campaignApi = {
  async getAll(companyId: string, limit = 20, offset = 0): Promise<CampaignListResponse> {
    const response = await api.get<{ data: CampaignListResponse }>('/campaigns', {
      params: { companyId, limit, offset },
    });
    return response.data.data;
  },

  async getById(id: string): Promise<Campaign> {
    const response = await api.get<{ data: Campaign }>(`/campaigns/${id}`);
    return response.data.data;
  },

  async create(data: CreateCampaignRequest): Promise<Campaign> {
    const response = await api.post<{ data: Campaign }>('/campaigns', data);
    return response.data.data;
  },

  async update(id: string, data: UpdateCampaignRequest): Promise<Campaign> {
    const response = await api.put<{ data: Campaign }>(`/campaigns/${id}`, data);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/campaigns/${id}`);
  },

  async estimateReach(companyId: string, targetTags: string[]): Promise<CampaignEstimate> {
    const response = await api.post<{ data: CampaignEstimate }>('/campaigns/estimate', {
      companyId,
      targetTags,
    });
    return response.data.data;
  },

  async sendNow(id: string): Promise<void> {
    await api.post(`/campaigns/${id}/send-now`);
  },

  async cancel(id: string): Promise<void> {
    await api.post(`/campaigns/${id}/cancel`);
  },
};
