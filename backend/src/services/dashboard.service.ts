import { prisma } from "../utils/prisma";
import { MessageDirection } from "@prisma/client";

interface PeriodStats {
  current: number;
  previous: number;
  percentageChange: number;
}

interface DashboardStats {
  totalCustomers: PeriodStats;
  activeConversations: PeriodStats;
  messagesReceived: PeriodStats;
  messagesWithAI: PeriodStats;
}

class DashboardService {
  /**
   * Calcula a porcentagem de mudança entre dois valores
   */
  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  /**
   * Obtém estatísticas do dashboard com comparação temporal
   */
  async getDashboardStats(
    companyId: string,
    period: "today" | "week" | "month" = "today"
  ): Promise<DashboardStats> {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    // Define os períodos baseado no filtro
    switch (period) {
      case "today":
        // Hoje vs Ontem
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;

      case "week":
        // Últimos 7 dias vs 7 dias anteriores
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;

      case "month":
        // Últimos 30 dias vs 30 dias anteriores
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
    }

    // Total de Clientes
    const [currentCustomers, previousCustomers] = await Promise.all([
      prisma.customer.count({
        where: {
          companyId,
          createdAt: { gte: currentStart },
        },
      }),
      prisma.customer.count({
        where: {
          companyId,
          createdAt: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    // Conversas Ativas (com mensagens no período)
    const [currentConversations, previousConversations] = await Promise.all([
      prisma.message.groupBy({
        by: ["customerId"],
        where: {
          customer: { companyId },
          timestamp: { gte: currentStart },
        },
      }).then((result) => result.length),
      prisma.message.groupBy({
        by: ["customerId"],
        where: {
          customer: { companyId },
          timestamp: { gte: previousStart, lt: previousEnd },
        },
      }).then((result) => result.length),
    ]);

    // Mensagens Recebidas
    const [currentMessagesReceived, previousMessagesReceived] = await Promise.all([
      prisma.message.count({
        where: {
          customer: { companyId },
          direction: MessageDirection.INBOUND,
          timestamp: { gte: currentStart },
        },
      }),
      prisma.message.count({
        where: {
          customer: { companyId },
          direction: MessageDirection.INBOUND,
          timestamp: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    // Mensagens Atendidas pela IA
    const [currentMessagesWithAI, previousMessagesWithAI] = await Promise.all([
      prisma.message.count({
        where: {
          customer: { companyId },
          direction: MessageDirection.OUTBOUND,
          senderType: "AI",
          timestamp: { gte: currentStart },
        },
      }),
      prisma.message.count({
        where: {
          customer: { companyId },
          direction: MessageDirection.OUTBOUND,
          senderType: "AI",
          timestamp: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    return {
      totalCustomers: {
        current: currentCustomers,
        previous: previousCustomers,
        percentageChange: this.calculatePercentageChange(currentCustomers, previousCustomers),
      },
      activeConversations: {
        current: currentConversations,
        previous: previousConversations,
        percentageChange: this.calculatePercentageChange(currentConversations, previousConversations),
      },
      messagesReceived: {
        current: currentMessagesReceived,
        previous: previousMessagesReceived,
        percentageChange: this.calculatePercentageChange(currentMessagesReceived, previousMessagesReceived),
      },
      messagesWithAI: {
        current: currentMessagesWithAI,
        previous: previousMessagesWithAI,
        percentageChange: this.calculatePercentageChange(currentMessagesWithAI, previousMessagesWithAI),
      },
    };
  }
}

export default new DashboardService();
