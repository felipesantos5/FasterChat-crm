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

interface DashboardChartsData {
  pipelineFunnel: PipelineFunnelData[];
  messagesOverTime: MessagesOverTimeData[];
  appointmentsOverTime: AppointmentsOverTimeData[];
  appointmentsByStatus: AppointmentsByStatusData[];
  customerActivity: CustomerActivityData;
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

  async getDashboardStats(
    companyId: string,
    period: "today" | "week" | "month" = "today"
  ): Promise<DashboardStats> {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case "today":
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;

      case "week":
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;

      case "month":
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
    }

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
    period: "week" | "month" | "quarter" = "month"
  ): Promise<DashboardChartsData> {
    const now = new Date();
    let startDate: Date;
    let daysCount: number;

    switch (period) {
      case "week":
        daysCount = 7;
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        daysCount = 30;
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        daysCount = 90;
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    const [
      pipelineFunnel,
      messagesOverTime,
      appointmentsOverTime,
      appointmentsByStatus,
      customerActivity,
    ] = await Promise.all([
      this.getPipelineFunnelData(companyId),
      this.getMessagesOverTimeData(companyId, startDate, daysCount),
      this.getAppointmentsOverTimeData(companyId, startDate, daysCount),
      this.getAppointmentsByStatusData(companyId),
      this.getCustomerActivityData(companyId),
    ]);

    return {
      pipelineFunnel,
      messagesOverTime,
      appointmentsOverTime,
      appointmentsByStatus,
      customerActivity,
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

    const customersWithoutStage = await prisma.customer.count({
      where: {
        companyId,
        pipelineStageId: null,
      },
    });

    const result: PipelineFunnelData[] = [];

    if (customersWithoutStage > 0) {
      result.push({
        stageId: "no-stage",
        stageName: "Sem Estágio",
        stageColor: "#9CA3AF",
        count: customersWithoutStage,
        order: -1,
      });
    }

    stages.forEach((stage) => {
      result.push({
        stageId: stage.id,
        stageName: stage.name,
        stageColor: stage.color,
        count: stage._count.customers,
        order: stage.order,
      });
    });

    return result;
  }

  private async getMessagesOverTimeData(
    companyId: string,
    startDate: Date,
    daysCount: number
  ): Promise<MessagesOverTimeData[]> {
    const messages = await prisma.message.findMany({
      where: {
        customer: { companyId },
        timestamp: { gte: startDate },
      },
      select: {
        timestamp: true,
        direction: true,
        senderType: true,
      },
    });

    const dataMap = new Map<string, MessagesOverTimeData>();

    for (let i = 0; i < daysCount; i++) {
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

    return Array.from(dataMap.values());
  }

  private async getAppointmentsOverTimeData(
    companyId: string,
    startDate: Date,
    daysCount: number
  ): Promise<AppointmentsOverTimeData[]> {
    const appointments = await prisma.appointment.findMany({
      where: {
        companyId,
        startTime: { gte: startDate },
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
}

export default new DashboardService();
