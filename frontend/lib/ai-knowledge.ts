import { api } from './api';
import {
  GetAIKnowledgeResponse,
  UpdateAIKnowledgeRequest,
  UpdateAIKnowledgeResponse,
  GenerateContextResponse,
  GetObjectivePresetsResponse,
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

  /**
   * Gera um contexto completo otimizado pela IA
   * Transforma as informações básicas em um contexto rico e estruturado
   */
  async generateContext(companyId: string): Promise<GenerateContextResponse> {
    const response = await api.post('/ai/knowledge/generate-context', { companyId });
    return response.data;
  },

  /**
   * Obtém a lista de objetivos pré-definidos
   */
  async getObjectivePresets(): Promise<GetObjectivePresetsResponse> {
    const response = await api.get('/ai/knowledge/objective-presets');
    return response.data;
  },

  /**
   * Upload de conhecimento customizado para RAG
   */
  async uploadCustomKnowledge(companyId: string, title: string, content: string): Promise<{
    success: boolean;
    data: { source: string; chunksProcessed: number };
  }> {
    const response = await api.post('/ai/knowledge/custom', { companyId, title, content });
    return response.data;
  },

  /**
   * Obtém estatísticas do RAG
   */
  async getRAGStats(companyId: string): Promise<{
    success: boolean;
    data: { totalVectors: number; byType: Record<string, number> };
  }> {
    const response = await api.get('/ai/knowledge/rag-stats', { params: { companyId } });
    return response.data;
  },

  /**
   * Remove conhecimento customizado por fonte
   */
  async deleteCustomKnowledge(source: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.delete(`/ai/knowledge/custom/${encodeURIComponent(source)}`);
    return response.data;
  },
};
