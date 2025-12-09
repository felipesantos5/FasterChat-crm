import { PipelineStage } from '@prisma/client';
import { prisma } from '../utils/prisma';

export interface CreateStageDTO {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateStageDTO {
  name?: string;
  description?: string;
  color?: string;
  order?: number;
}

export class PipelineService {
  /**
   * Cria os estágios padrão para uma empresa
   */
  async createDefaultStages(companyId: string): Promise<PipelineStage[]> {
    const defaultStages = [
      { name: 'Novo Lead', color: '#94A3B8', order: 0, description: 'Novos contatos' },
      { name: 'Qualificado', color: '#3B82F6', order: 1, description: 'Leads qualificados' },
      { name: 'Proposta Enviada', color: '#F59E0B', order: 2, description: 'Aguardando resposta' },
      { name: 'Negociação', color: '#8B5CF6', order: 3, description: 'Em negociação' },
      { name: 'Fechado - Ganho', color: '#10B981', order: 4, description: 'Vendas concluídas' },
      { name: 'Fechado - Perdido', color: '#EF4444', order: 5, description: 'Vendas perdidas' },
    ];

    const stages: PipelineStage[] = [];

    for (const stage of defaultStages) {
      const created = await prisma.pipelineStage.create({
        data: {
          companyId,
          ...stage,
        },
      });
      stages.push(created);
    }

    return stages;
  }

  /**
   * Lista todos os estágios de uma empresa
   */
  async findAll(companyId: string): Promise<PipelineStage[]> {
    return prisma.pipelineStage.findMany({
      where: { companyId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Busca um estágio por ID
   */
  async findById(id: string, companyId: string): Promise<PipelineStage | null> {
    return prisma.pipelineStage.findFirst({
      where: { id, companyId },
    });
  }

  /**
   * Cria um novo estágio
   */
  async create(companyId: string, data: CreateStageDTO): Promise<PipelineStage> {
    // Pega o último order para adicionar no final
    const lastStage = await prisma.pipelineStage.findFirst({
      where: { companyId },
      orderBy: { order: 'desc' },
    });

    const order = lastStage ? lastStage.order + 1 : 0;

    return prisma.pipelineStage.create({
      data: {
        companyId,
        ...data,
        order,
      },
    });
  }

  /**
   * Atualiza um estágio
   */
  async update(
    id: string,
    companyId: string,
    data: UpdateStageDTO
  ): Promise<PipelineStage> {
    const stage = await this.findById(id, companyId);
    if (!stage) {
      throw new Error('Estágio não encontrado');
    }

    return prisma.pipelineStage.update({
      where: { id },
      data,
    });
  }

  /**
   * Deleta um estágio
   */
  async delete(id: string, companyId: string): Promise<void> {
    const stage = await this.findById(id, companyId);
    if (!stage) {
      throw new Error('Estágio não encontrado');
    }

    await prisma.pipelineStage.delete({
      where: { id },
    });
  }

  /**
   * Reordena os estágios
   */
  async reorder(_companyId: string, stageIds: string[]): Promise<PipelineStage[]> {
    const updates: Promise<PipelineStage>[] = [];

    for (let i = 0; i < stageIds.length; i++) {
      const update = prisma.pipelineStage.update({
        where: { id: stageIds[i] },
        data: { order: i },
      });
      updates.push(update);
    }

    return Promise.all(updates);
  }

  /**
   * Move um cliente para um estágio
   */
  async moveCustomerToStage(
    customerId: string,
    stageId: string | null,
    companyId: string
  ): Promise<void> {
    // Verifica se o cliente pertence à empresa
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });

    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    // Se stageId for null, remove do pipeline
    if (stageId === null) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { pipelineStageId: null },
      });
      return;
    }

    // Verifica se o estágio existe e pertence à empresa
    const stage = await this.findById(stageId, companyId);
    if (!stage) {
      throw new Error('Estágio não encontrado');
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { pipelineStageId: stageId },
    });
  }

  /**
   * Obtém clientes por estágio
   */
  async getCustomersByStage(companyId: string) {
    const stages = await this.findAll(companyId);

    const result = await Promise.all(
      stages.map(async (stage) => {
        const customers = await prisma.customer.findMany({
          where: {
            companyId,
            pipelineStageId: stage.id,
            isGroup: false, // Não incluir grupos no pipeline
          },
          orderBy: { updatedAt: 'desc' },
        });

        return {
          stage,
          customers,
        };
      })
    );

    // Também busca clientes sem estágio
    const customersWithoutStage = await prisma.customer.findMany({
      where: {
        companyId,
        pipelineStageId: null,
        isGroup: false,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      stages: result,
      customersWithoutStage,
    };
  }
}

export const pipelineService = new PipelineService();
