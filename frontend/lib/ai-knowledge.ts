import { api } from './api';
import {
  GetAIKnowledgeResponse,
  UpdateAIKnowledgeRequest,
  UpdateAIKnowledgeResponse,
} from '@/types/ai-knowledge';

export const aiKnowledgeApi = {
  /**
   * Obtém a base de conhecimento da empresa
   */
  async getKnowledge(companyId: string): Promise<GetAIKnowledgeResponse> {
    const response = await api.get('/ai/knowledge', {
      params: { companyId },
    });
    return response.data;
  },

  /**
   * Atualiza a base de conhecimento
   */
  async updateKnowledge(data: UpdateAIKnowledgeRequest): Promise<UpdateAIKnowledgeResponse> {
    const response = await api.put('/ai/knowledge', data);
    return response.data;
  },
};
