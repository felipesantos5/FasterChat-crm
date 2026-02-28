import { prisma } from "../utils/prisma";
import { MessageDirection, AppointmentStatus, AppointmentType } from "@prisma/client";

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
  handoffConversations: PeriodStats;
  totalAppointments: PeriodStats;
  todayAppointments: PeriodStats;
  upcomingAppointments: PeriodStats;
  confirmedAppointments: PeriodStats;
}

interface PipelineFunnelData {
  stageId: string;
  stageName: string;
  stageColor: string;
  count: number;
  order: number;
}

interface MessagesOverTimeData {
  date: string;
  inbound: number;
  outbound: number;
  aiResponses: number;
}

interface AppointmentsOverTimeData {
  date: string;
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

interface AppointmentsByStatusData {
  status: string;
  count: number;
  label: string;
  color: string;
}

interface CustomerActivityData {
  active: number;
  inactive: number;
  total: number;
}

interface HourlyMessageData {
  hour: string;
  count: number;
}

interface AvgResponseTimeData {
  avgSeconds: number;
  percentageChange: number;
}

interface ActiveAppointmentsData {
  active: number;
  percentageChange: number;
  avgDurationMinutes: number;
  completed: number;
}

interface AgentStatsData {
  agentName: string;
  humanCount: number;
  aiCount: number;
}

interface OverallConversionData {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

interface BatchEngagementData {
  hasBatchExecutions: boolean;
  totalCalls: number;
  attemptedCalls: number;
  replies: number;
  responseRate: number;
}

interface DashboardChartsData {
  pipelineFunnel: PipelineFunnelData[];
  messagesOverTime: MessagesOverTimeData[];
  appointmentsOverTime: AppointmentsOverTimeData[];
  appointmentsByStatus: AppointmentsByStatusData[];
  customerActivity: CustomerActivityData;
  messagesByHour: HourlyMessageData[];
  avgResponseTime: AvgResponseTimeData;
  activeAppointments: ActiveAppointmentsData;
  messagesByAgent: AgentStatsData[];
  overallConversion: OverallConversionData;
  batchEngagement: BatchEngagementData;
}

const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  VISIT: "Visita",
  INSTALLATION: "Instalação",
  MAINTENANCE: "Manutenção",
  CONSULTATION: "Consulta",
  OTHER: "Outro",
};

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não Compareceu",
};

const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "#86EFAC", // light green
  CONFIRMED: "#4ADE80", // green
  COMPLETED: "#22C55E", // green
  CANCELLED: "#EF4444", // red
  NO_SHOW: "#F59E0B", // amber
};

class DashboardService {
  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private getDateRangeFromPreset(preset: string, startDate?: string, endDate?: string): {
    currentStart: Date;
    currentEnd: Date;
    previousStart: Date;
    previousEnd: Date;
  } {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date = now;
    let previousStart: Date;
    let previousEnd: Date;

    // Se for custom, usa as datas fornecidas
    if (preset === 'custom' && startDate && endDate) {
      currentStart = new Date(startDate);
      currentEnd = new Date(endDate);

      const diff = currentEnd.getTime() - currentStart.getTime();
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd.getTime() - diff);

      return { currentStart, currentEnd, previousStart, previousEnd };
    }

    // Presets padrão
    switch (preset) {
      case "today":
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        previousEnd = currentStart;
        break;

      case "yesterday":
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
        previousEnd = currentStart;
        break;

      case "7days":
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        currentEnd = now;
        previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;

      case "30days":
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        currentEnd = now;
        previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;

      case "3months":
        currentStart = new Date(now);
        currentStart.setMonth(currentStart.getMonth() - 3);
        currentEnd = now;
        previousStart = new Date(currentStart);
        previousStart.setMonth(previousStart.getMonth() - 3);
        previousEnd = currentStart;
        break;

      case "all":
        // Define "all" como 1 ano atrás
        currentStart = new Date(now);
        currentStart.setFullYear(currentStart.getFullYear() - 1);
        currentEnd = now;
        previousStart = new Date(currentStart);
        previousStart.setFullYear(previousStart.getFullYear() - 1);
        previousEnd = currentStart;
        break;

      default:
        // Fallback para 7 dias
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        currentEnd = now;
        previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  }

  async getDashboardStats(
    companyId: string,
    preset: string = "7days",
    startDate?: string,
    endDate?: string
  ): Promise<DashboardStats> {
    const now = new Date();
    const { currentStart, currentEnd, previousStart, previousEnd } = this.getDateRangeFromPreset(preset, startDate, endDate);

    const [currentCustomers, previousCustomers] = await Promise.all([
      prisma.customer.count({
        where: {
          companyId,
          createdAt: { gte: currentStart, lte: currentEnd },
        },
      }),
      prisma.customer.count({
        where: {
          companyId,
          createdAt: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    const [currentConversations, previousConversations] = await Promise.all([
      prisma.message.groupBy({
        by: ["customerId"],
        where: {
          customer: { companyId },
          timestamp: { gte: currentStart, lte: currentEnd },
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

    const [currentMessagesReceived, previousMessagesReceived] = await Promise.all([
      prisma.message.count({
        where: {
          customer: { companyId },
          direction: MessageDirection.INBOUND,
          timestamp: { gte: currentStart, lte: currentEnd },
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

    const [currentMessagesWithAI, previousMessagesWithAI] = await Promise.all([
      prisma.message.count({
        where: {
          customer: { companyId },
          direction: MessageDirection.OUTBOUND,
          senderType: "AI",
          timestamp: { gte: currentStart, lte: currentEnd },
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

    // Handoff stats (transbordos)
    const [currentHandoffs, previousHandoffs] = await Promise.all([
      prisma.conversation.count({
        where: {
          companyId,
          needsHelp: true,
          updatedAt: { gte: currentStart, lte: currentEnd },
        },
      }),
      prisma.conversation.count({
        where: {
          companyId,
          needsHelp: true,
          updatedAt: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    // Appointment stats
    const [currentTotalAppointments, previousTotalAppointments] = await Promise.all([
      prisma.appointment.count({
        where: {
          companyId,
          startTime: { gte: currentStart, lte: currentEnd },
        },
      }),
      prisma.appointment.count({
        where: {
          companyId,
          startTime: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    const [currentTodayAppointments, previousTodayAppointments] = await Promise.all([
      prisma.appointment.count({
        where: {
          companyId,
          startTime: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.appointment.count({
        where: {
          companyId,
          startTime: { gte: yesterdayStart, lt: todayStart },
        },
      }),
    ]);

    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const previous7DaysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [currentUpcomingAppointments, previousUpcomingAppointments] = await Promise.all([
      prisma.appointment.count({
        where: {
          companyId,
          startTime: { gte: now, lt: next7Days },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
      }),
      prisma.appointment.count({
        where: {
          companyId,
          startTime: { gte: previous7DaysStart, lt: now },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
      }),
    ]);

    const [currentConfirmedAppointments, previousConfirmedAppointments] = await Promise.all([
      prisma.appointment.count({
        where: {
          companyId,
          status: AppointmentStatus.CONFIRMED,
          startTime: { gte: currentStart },
        },
      }),
      prisma.appointment.count({
        where: {
          companyId,
          status: AppointmentStatus.CONFIRMED,
          startTime: { gte: previousStart, lt: previousEnd },
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
      handoffConversations: {
        current: currentHandoffs,
        previous: previousHandoffs,
        percentageChange: this.calculatePercentageChange(currentHandoffs, previousHandoffs),
      },
      totalAppointments: {
        current: currentTotalAppointments,
        previous: previousTotalAppointments,
        percentageChange: this.calculatePercentageChange(currentTotalAppointments, previousTotalAppointments),
      },
      todayAppointments: {
        current: currentTodayAppointments,
        previous: previousTodayAppointments,
        percentageChange: this.calculatePercentageChange(currentTodayAppointments, previousTodayAppointments),
      },
      upcomingAppointments: {
        current: currentUpcomingAppointments,
        previous: previousUpcomingAppointments,
        percentageChange: this.calculatePercentageChange(currentUpcomingAppointments, previousUpcomingAppointments),
      },
      confirmedAppointments: {
        current: currentConfirmedAppointments,
        previous: previousConfirmedAppointments,
        percentageChange: this.calculatePercentageChange(currentConfirmedAppointments, previousConfirmedAppointments),
      },
    };
  }

  async getOnboardingStatus(companyId: string, _userId: string) {
    const [whatsappCount, aiKnowledgeCount, calendarCount, customerCount] = await Promise.all([
      prisma.whatsAppInstance.count({
        where: { companyId, status: "CONNECTED" },
      }),
      prisma.aIKnowledge.count({
        where: { companyId },
      }),
      prisma.googleCalendar.count({
        where: { companyId },
      }),
      prisma.customer.count({
        where: { companyId },
      }),
    ]);

    return {
      whatsappConnected: whatsappCount > 0,
      aiConfigured: aiKnowledgeCount > 0,
      calendarConnected: calendarCount > 0,
      customersImported: customerCount > 0,
      isComplete: whatsappCount > 0 && aiKnowledgeCount > 0 && calendarCount > 0 && customerCount > 0,
    };
  }

  async getChartsData(
    companyId: string,
    preset: string = "7days",
    customStartDate?: string,
    customEndDate?: string
  ): Promise<DashboardChartsData> {
    const { currentStart, currentEnd, previousStart, previousEnd } = this.getDateRangeFromPreset(preset, customStartDate, customEndDate);

    // Calcula o número de dias para agrupamento dos gráficos
    const daysCount = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));

    const [
      pipelineFunnel,
      messagesOverTime,
      appointmentsOverTime,
      appointmentsByStatus,
      customerActivity,
      messagesByHour,
      avgResponseTime,
      activeAppointments,
      messagesByAgent,
      overallConversion,
      batchEngagement,
    ] = await Promise.all([
      this.getPipelineFunnelData(companyId),
      this.getMessagesOverTimeData(companyId, currentStart, daysCount),
      this.getAppointmentsOverTimeData(companyId, currentStart, daysCount),
      this.getAppointmentsByStatusData(companyId),
      this.getCustomerActivityData(companyId),
      this.getMessagesByHourData(companyId, currentStart, currentEnd),
      this.getAvgResponseTimeData(companyId, currentStart, currentEnd, previousStart, previousEnd),
      this.getActiveAppointmentsData(companyId, currentStart, currentEnd, previousStart, previousEnd),
      this.getMessagesByAgentData(companyId, currentStart, currentEnd),
      this.getOverallConversionData(companyId, currentStart, currentEnd),
      this.getBatchEngagementData(companyId, currentStart, currentEnd),
    ]);

    return {
      pipelineFunnel,
      messagesOverTime,
      appointmentsOverTime,
      appointmentsByStatus,
      customerActivity,
      messagesByHour,
      avgResponseTime,
      activeAppointments,
      messagesByAgent,
      overallConversion,
      batchEngagement,
    };
  }

  private async getPipelineFunnelData(companyId: string): Promise<PipelineFunnelData[]> {
    const stages = await prisma.pipelineStage.findMany({
      where: { companyId },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    // Busca clientes sem estágio e atribui ao primeiro estágio automaticamente
    const customersWithoutStage = await prisma.customer.findMany({
      where: {
        companyId,
        pipelineStageId: null,
      },
      select: { id: true },
    });

    if (customersWithoutStage.length > 0) {
      const firstStage = stages[0];
      if (firstStage) {
        // Atualiza clientes sem estágio para o primeiro estágio
        await prisma.customer.updateMany({
          where: {
            companyId,
            pipelineStageId: null,
          },
          data: {
            pipelineStageId: firstStage.id,
          },
        });

        // Adiciona a contagem ao primeiro estágio
        if (stages[0]) {
          stages[0]._count.customers += customersWithoutStage.length;
        }
      }
    }

    const result: PipelineFunnelData[] = stages.map((stage) => ({
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color,
      count: stage._count.customers,
      order: stage.order,
    }));

    return result;
  }

  private async getMessagesOverTimeData(
    companyId: string,
    startDate: Date,
    daysCount: number
  ): Promise<MessagesOverTimeData[]> {
    const endDate = new Date(startDate.getTime() + daysCount * 24 * 60 * 60 * 1000);

    const messages = await prisma.message.findMany({
      where: {
        customer: { companyId },
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        timestamp: true,
        direction: true,
        senderType: true,
      },
    });


    const dataMap = new Map<string, MessagesOverTimeData>();

    for (let i = 0; i <= daysCount; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dataMap.set(dateStr, {
        date: dateStr,
        inbound: 0,
        outbound: 0,
        aiResponses: 0,
      });
    }

    messages.forEach((msg) => {
      const dateStr = msg.timestamp.toISOString().split("T")[0];
      const data = dataMap.get(dateStr);
      if (data) {
        if (msg.direction === MessageDirection.INBOUND) {
          data.inbound++;
        } else {
          data.outbound++;
          if (msg.senderType === "AI") {
            data.aiResponses++;
          }
        }
      }
    });

    const result = Array.from(dataMap.values());

    return result;
  }

  private async getAppointmentsOverTimeData(
    companyId: string,
    startDate: Date,
    daysCount: number
  ): Promise<AppointmentsOverTimeData[]> {
    const endDate = new Date(startDate.getTime() + daysCount * 24 * 60 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        companyId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        startTime: true,
        status: true,
      },
    });

    const dataMap = new Map<string, AppointmentsOverTimeData>();

    for (let i = 0; i < daysCount; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dataMap.set(dateStr, {
        date: dateStr,
        scheduled: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
      });
    }

    appointments.forEach((apt) => {
      const dateStr = apt.startTime.toISOString().split("T")[0];
      const data = dataMap.get(dateStr);
      if (data) {
        switch (apt.status) {
          case AppointmentStatus.SCHEDULED:
            data.scheduled++;
            break;
          case AppointmentStatus.CONFIRMED:
            data.confirmed++;
            break;
          case AppointmentStatus.COMPLETED:
            data.completed++;
            break;
          case AppointmentStatus.CANCELLED:
          case AppointmentStatus.NO_SHOW:
            data.cancelled++;
            break;
        }
      }
    });

    return Array.from(dataMap.values());
  }

  private async getAppointmentsByStatusData(companyId: string): Promise<AppointmentsByStatusData[]> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const appointments = await prisma.appointment.groupBy({
      by: ["status"],
      where: {
        companyId,
        startTime: { gte: thirtyDaysAgo },
      },
      _count: {
        status: true,
      },
    });

    return Object.values(AppointmentStatus).map((status) => {
      const found = appointments.find((a) => a.status === status);
      return {
        status,
        count: found?._count.status || 0,
        label: APPOINTMENT_STATUS_LABELS[status],
        color: APPOINTMENT_STATUS_COLORS[status],
      };
    });
  }

  private async getCustomerActivityData(companyId: string): Promise<CustomerActivityData> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalCustomers, activeCustomerIds] = await Promise.all([
      prisma.customer.count({
        where: { companyId },
      }),
      prisma.message.groupBy({
        by: ["customerId"],
        where: {
          customer: { companyId },
          timestamp: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const activeCount = activeCustomerIds.length;

    return {
      active: activeCount,
      inactive: totalCustomers - activeCount,
      total: totalCustomers,
    };
  }

  private async getAvgResponseTimeData(
    companyId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<AvgResponseTimeData> {
    const calcAvg = async (start: Date, end: Date): Promise<number> => {
      // Get inbound messages in the period
      const inboundMessages = await prisma.message.findMany({
        where: {
          customer: { companyId },
          direction: MessageDirection.INBOUND,
          timestamp: { gte: start, lte: end },
        },
        select: { customerId: true, timestamp: true },
        orderBy: { timestamp: "asc" },
      });

      if (inboundMessages.length === 0) return 0;

      // For each inbound, find the next outbound for same customer
      let totalSeconds = 0;
      let count = 0;

      for (const inMsg of inboundMessages) {
        const nextOutbound = await prisma.message.findFirst({
          where: {
            customerId: inMsg.customerId,
            direction: MessageDirection.OUTBOUND,
            timestamp: { gt: inMsg.timestamp },
          },
          select: { timestamp: true },
          orderBy: { timestamp: "asc" },
        });

        if (nextOutbound) {
          const diffSeconds = (nextOutbound.timestamp.getTime() - inMsg.timestamp.getTime()) / 1000;
          // Only count if response was within 24h (ignore abandoned conversations)
          if (diffSeconds < 86400) {
            totalSeconds += diffSeconds;
            count++;
          }
        }
      }

      return count > 0 ? Math.round(totalSeconds / count) : 0;
    };

    // Limit to last 100 inbound messages for performance
    const currentAvg = await calcAvg(currentStart, currentEnd);
    const previousAvg = await calcAvg(previousStart, previousEnd);

    return {
      avgSeconds: currentAvg,
      percentageChange: this.calculatePercentageChange(
        previousAvg, // inverted: lower is better
        currentAvg
      ),
    };
  }

  private async getActiveAppointmentsData(
    companyId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<ActiveAppointmentsData> {
    const now = new Date();

    const [activeCount, previousActiveCount, completedAppointments, completedCount] = await Promise.all([
      prisma.appointment.count({
        where: {
          companyId,
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          startTime: { gte: now },
        },
      }),
      prisma.appointment.count({
        where: {
          companyId,
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          startTime: { gte: previousStart, lte: previousEnd },
        },
      }),
      prisma.appointment.findMany({
        where: {
          companyId,
          status: AppointmentStatus.COMPLETED,
          startTime: { gte: currentStart, lte: currentEnd },
        },
        select: { startTime: true, endTime: true },
      }),
      prisma.appointment.count({
        where: {
          companyId,
          status: AppointmentStatus.COMPLETED,
          startTime: { gte: currentStart, lte: currentEnd },
        },
      }),
    ]);

    // Calculate average duration of completed appointments
    let avgDurationMinutes = 0;
    if (completedAppointments.length > 0) {
      const totalMinutes = completedAppointments.reduce((acc, apt) => {
        return acc + (apt.endTime.getTime() - apt.startTime.getTime()) / 60000;
      }, 0);
      avgDurationMinutes = Math.round(totalMinutes / completedAppointments.length);
    }

    return {
      active: activeCount,
      percentageChange: this.calculatePercentageChange(activeCount, previousActiveCount),
      avgDurationMinutes,
      completed: completedCount,
    };
  }

  private async getMessagesByAgentData(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AgentStatsData[]> {
    // Get AI message count
    const aiCount = await prisma.message.count({
      where: {
        customer: { companyId },
        direction: MessageDirection.OUTBOUND,
        senderType: "AI",
        timestamp: { gte: startDate, lte: endDate },
      },
    });

    // Get human messages grouped by assigned agent
    const conversations = await prisma.conversation.findMany({
      where: { companyId },
      select: {
        id: true,
        customerId: true,
        assignedTo: { select: { name: true } },
      },
    });

    const agentMap = new Map<string, number>();

    for (const conv of conversations) {
      if (!conv.assignedTo) continue;

      const msgCount = await prisma.message.count({
        where: {
          customerId: conv.customerId,
          direction: MessageDirection.OUTBOUND,
          senderType: "HUMAN",
          timestamp: { gte: startDate, lte: endDate },
        },
      });

      if (msgCount > 0) {
        const current = agentMap.get(conv.assignedTo.name) || 0;
        agentMap.set(conv.assignedTo.name, current + msgCount);
      }
    }

    const result: AgentStatsData[] = [];

    // Add AI as first entry
    if (aiCount > 0) {
      result.push({ agentName: "IA", humanCount: 0, aiCount });
    }

    // Add human agents
    for (const [agentName, humanCount] of agentMap) {
      result.push({ agentName, humanCount, aiCount: 0 });
    }

    // Sort by total count descending
    result.sort((a, b) => (b.humanCount + b.aiCount) - (a.humanCount + a.aiCount));

    return result;
  }

  private async getMessagesByHourData(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<HourlyMessageData[]> {
    // Busca mensagens INBOUND no período
    const messages = await prisma.message.findMany({
      where: {
        customer: { companyId },
        direction: MessageDirection.INBOUND,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        timestamp: true,
      },
    });

    // Inicializa o mapa de horas (00 a 23)
    const hourMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, 0);
    }

    // Conta mensagens por hora (ajustando para o timezone se necessário, 
    // mas aqui usaremos a hora local do servidor/banco)
    messages.forEach((msg) => {
      const hour = msg.timestamp.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    // Converte para o formato do gráfico
    return Array.from(hourMap.entries()).map(([hour, count]) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      count,
    }));
  }

  private async getOverallConversionData(companyId: string, startDate: Date, endDate: Date): Promise<OverallConversionData> {
    const lastStage = await prisma.pipelineStage.findFirst({
      where: { companyId },
      orderBy: { order: "desc" },
      select: { id: true }
    });

    const totalLeads = await prisma.customer.count({
      where: { companyId, createdAt: { gte: startDate, lte: endDate } }
    });

    let convertedLeads = 0;
    if (lastStage) {
      convertedLeads = await prisma.customer.count({
        where: { companyId, pipelineStageId: lastStage.id, createdAt: { gte: startDate, lte: endDate } }
      });
    }

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
    
    return {
      totalLeads,
      convertedLeads,
      conversionRate: Math.round(conversionRate * 10) / 10
    };
  }

  private async getBatchEngagementData(companyId: string, startDate: Date, endDate: Date): Promise<BatchEngagementData> {
    const flows = await (prisma as any).flow.findMany({
      where: { companyId },
      select: { id: true }
    });
    const flowIds = flows.map((f: any) => f.id);

    if (flowIds.length === 0) return { hasBatchExecutions: false, totalCalls: 0, attemptedCalls: 0, replies: 0, responseRate: 0 };

    const executions = await (prisma as any).flowExecution.findMany({
      where: {
        flowId: { in: flowIds },
        startedAt: { gte: startDate, lte: endDate },
      },
      select: {
        contactPhone: true,
        status: true,
        variables: true
      }
    });

    const batchExecs = executions.filter((e: any) => e.variables && typeof e.variables === 'object' && '_batchId' in (e.variables as any));
    const hasBatchExecutions = batchExecs.length > 0;
    if (!hasBatchExecutions) return { hasBatchExecutions: false, totalCalls: 0, attemptedCalls: 0, replies: 0, responseRate: 0 };

    const totalCalls = batchExecs.length;
    const attemptedCalls = batchExecs.filter((e: any) => e.status !== "FAILED").length;
    
    const uniquePhones = [...new Set(batchExecs.map((e: any) => e.contactPhone))] as string[];
    
    const replyingCustomers = await prisma.message.groupBy({
      by: ['customerId'],
      where: {
        customer: { companyId, phone: { in: uniquePhones } },
        direction: 'INBOUND',
        timestamp: { gte: startDate, lte: new Date(endDate.getTime() + 86400000) }
      }
    });

    const replies = replyingCustomers.length;
    const responseRate = attemptedCalls > 0 ? (replies / attemptedCalls) * 100 : 0;

    return {
      hasBatchExecutions: true,
      totalCalls,
      attemptedCalls,
      replies,
      responseRate: Math.round(responseRate * 10) / 10
    };
  }
}

export default new DashboardService();
