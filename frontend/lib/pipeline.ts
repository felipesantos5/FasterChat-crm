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
};
