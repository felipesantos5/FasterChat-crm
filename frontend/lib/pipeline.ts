import { api } from './api';
import {
  PipelineStage,
  PipelineBoard,
  CreateStageData,
  UpdateStageData,
  MoveCustomerData,
  ReorderStagesData,
} from '@/types/pipeline';

export const pipelineApi = {
  /**
   * Lista todos os estágios
   */
  async getStages(companyId: string): Promise<PipelineStage[]> {
    const response = await api.get('/pipeline/stages', {
      params: { companyId },
    });
    return response.data.data;
  },

  /**
   * Cria um novo estágio
   */
  async createStage(companyId: string, data: CreateStageData): Promise<PipelineStage> {
    const response = await api.post('/pipeline/stages', {
      companyId,
      ...data,
    });
    return response.data.data;
  },

  /**
   * Atualiza um estágio
   */
  async updateStage(
    stageId: string,
    companyId: string,
    data: UpdateStageData
  ): Promise<PipelineStage> {
    const response = await api.patch(`/pipeline/stages/${stageId}`, {
      companyId,
      ...data,
    });
    return response.data.data;
  },

  /**
   * Deleta um estágio
   */
  async deleteStage(stageId: string, companyId: string): Promise<void> {
    await api.delete(`/pipeline/stages/${stageId}`, {
      params: { companyId },
    });
  },

  /**
   * Reordena os estágios
   */
  async reorderStages(
    companyId: string,
    data: ReorderStagesData
  ): Promise<PipelineStage[]> {
    const response = await api.post('/pipeline/stages/reorder', {
      companyId,
      ...data,
    });
    return response.data.data;
  },

  /**
   * Obtém o board do pipeline
   */
  async getBoard(companyId: string): Promise<PipelineBoard> {
    const response = await api.get('/pipeline/board', {
      params: { companyId },
    });
    return response.data.data;
  },

  /**
   * Move um cliente para um estágio
   */
  async moveCustomer(
    customerId: string,
    companyId: string,
    data: MoveCustomerData
  ): Promise<void> {
    await api.patch(`/pipeline/customers/${customerId}/stage`, {
      companyId,
      ...data,
    });
  },

  /**
   * Inicializa o pipeline com estágios padrão
   */
  async initPipeline(companyId: string): Promise<PipelineStage[]> {
    const response = await api.post('/pipeline/init', { companyId });
    return response.data.data;
  },

  /**
   * Registra o valor de uma venda fechada
   */
  async createDealValue(
    companyId: string,
    data: { customerId: string; stageId: string; value: number; notes?: string }
  ): Promise<any> {
    const response = await api.post('/pipeline/deal-values', {
      companyId,
      ...data,
    });
    return response.data.data;
  },

  /**
   * Lista todas as vendas de um cliente específico
   */
  async getDealValuesByCustomer(customerId: string): Promise<DealValueItem[]> {
    const response = await api.get(`/pipeline/deal-values/customer/${customerId}`);
    return response.data.data;
  },

  /**
   * Atualiza uma venda
   */
  async updateDealValue(
    dealId: string,
    data: { stageId?: string; value?: number; notes?: string | null }
  ): Promise<DealValueItem> {
    const response = await api.put(`/pipeline/deal-values/${dealId}`, data);
    return response.data.data;
  },

  /**
   * Remove uma venda
   */
  async deleteDealValue(dealId: string): Promise<void> {
    await api.delete(`/pipeline/deal-values/${dealId}`);
  },

  /**
   * Obtém estatísticas de lucro/receita
   */
  async getDealValueStats(
    preset: string = '30days',
    customRange?: { from: Date; to: Date }
  ): Promise<DealValueStats> {
    const params: Record<string, string> = { preset };
    if (preset === 'custom' && customRange) {
      params.startDate = customRange.from.toISOString();
      params.endDate = customRange.to.toISOString();
    }
    const response = await api.get<{ data: DealValueStats }>('/pipeline/deal-values/stats', { params });
    return response.data.data;
  },
};

export interface DealValueStats {
  totalRevenue: number;
  dealsCount: number;
  previousRevenue: number;
  previousDealsCount: number;
  percentageChange: number;
}

export interface DealValueItem {
  id: string;
  value: string | number;
  notes: string | null;
  closedAt: string;
  createdAt: string;
  stage: {
    id: string;
    name: string;
    color: string;
  };
}
