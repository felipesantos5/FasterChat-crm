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
      { name: 'Lead', color: '#3B82F6', order: 0, description: 'Novos contatos entrantes', isFixed: true },
      { name: 'Qualificado', color: '#06B6D4', order: 1, description: 'Lead com potencial confirmado', isFixed: true },
      { name: 'Proposta Enviada', color: '#8B5CF6', order: 2, description: 'Proposta ou orçamento enviado', isFixed: false },
      { name: 'Negociação', color: '#F59E0B', order: 3, description: 'Em processo de negociação', isFixed: false },
      { name: 'Perdido', color: '#EF4444', order: 4, description: 'Negociação não convertida', isFixed: true },
      { name: 'Ganho', color: '#22C55E', order: 5, description: 'Venda concluída com sucesso', isFixed: true },
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

    // Estágios fixos permitem alterar o nome agora, mas mantêm sua funcionalidade base no sistema


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

    if (stage.isFixed) {
      throw new Error('Este estágio não pode ser excluído');
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

  /**
   * Registra o valor de uma venda fechada
   */
  async createDealValue(
    companyId: string,
    customerId: string,
    stageId: string,
    value: number,
    notes?: string
  ) {
    return prisma.dealValue.create({
      data: {
        companyId,
        customerId,
        stageId,
        value,
        notes,
      },
    });
  }

  /**
   * Retorna o lucro total e quantidade de vendas em um período
   */
  async getDealValueStats(
    companyId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = { companyId };
    if (startDate && endDate) {
      where.closedAt = { gte: startDate, lte: endDate };
    }

    const [aggregate, count, previousAggregate, previousCount] = await Promise.all([
      prisma.dealValue.aggregate({
        where,
        _sum: { value: true },
      }),
      prisma.dealValue.count({ where }),
      // Período anterior para comparação
      startDate && endDate
        ? prisma.dealValue.aggregate({
            where: {
              companyId,
              closedAt: {
                gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
                lt: startDate,
              },
            },
            _sum: { value: true },
          })
        : prisma.dealValue.aggregate({
            where: { companyId, closedAt: { lt: new Date() } },
            _sum: { value: true },
          }),
      startDate && endDate
        ? prisma.dealValue.count({
            where: {
              companyId,
              closedAt: {
                gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
                lt: startDate,
              },
            },
          })
        : 0,
    ]);

    const currentTotal = Number(aggregate._sum.value || 0);
    const previousTotal = Number(previousAggregate._sum.value || 0);
    const percentageChange =
      previousTotal === 0
        ? currentTotal > 0 ? 100 : 0
        : Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1));

    return {
      totalRevenue: currentTotal,
      dealsCount: count,
      previousRevenue: previousTotal,
      previousDealsCount: previousCount,
      percentageChange,
    };
  }

  /**
   * Lista os deal values recentes de uma empresa
   */
  async listDealValues(companyId: string, limit: number = 10) {
    return prisma.dealValue.findMany({
      where: { companyId },
      orderBy: { closedAt: 'desc' },
      take: limit,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        stage: {
          select: { id: true, name: true, color: true },
        },
      },
    });
  }

  async getDealValuesByCustomer(companyId: string, customerId: string) {
    return prisma.dealValue.findMany({
      where: { companyId, customerId },
      orderBy: { closedAt: 'desc' },
      include: {
        stage: {
          select: { id: true, name: true, color: true },
        },
      },
    });
  }

  async updateDealValue(
    companyId: string,
    dealId: string,
    data: { stageId?: string; value?: number; notes?: string }
  ) {
    return prisma.dealValue.update({
      where: { id: dealId, companyId },
      data,
      include: {
        stage: {
          select: { id: true, name: true, color: true },
        },
      },
    });
  }

  async deleteDealValue(companyId: string, dealId: string) {
    return prisma.dealValue.delete({
      where: { id: dealId, companyId },
    });
  }
}

export const pipelineService = new PipelineService();
