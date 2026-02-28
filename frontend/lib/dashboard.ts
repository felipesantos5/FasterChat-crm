import { api } from './api';
import { DateRange, DateRangePreset } from '@/components/dashboard/date-range-filter';

export interface PeriodStats {
  current: number;
  previous: number;
  percentageChange: number;
}

export interface DashboardStats {
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

export interface OnboardingStatus {
  whatsappConnected: boolean;
  aiConfigured: boolean;
  calendarConnected: boolean;
  customersImported: boolean;
  isComplete: boolean;
}

export interface PipelineFunnelData {
  stageId: string;
  stageName: string;
  stageColor: string;
  count: number;
  order: number;
}

export interface MessagesOverTimeData {
  date: string;
  inbound: number;
  outbound: number;
  aiResponses: number;
}

export interface AppointmentsOverTimeData {
  date: string;
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

export interface AppointmentsByStatusData {
  status: string;
  count: number;
  label: string;
  color: string;
}

export interface CustomerActivityData {
  active: number;
  inactive: number;
  total: number;
}

export interface HourlyMessageData {
  hour: string;
  count: number;
}

export interface AvgResponseTimeData {
  avgSeconds: number;
  percentageChange: number;
}

export interface ActiveAppointmentsData {
  active: number;
  percentageChange: number;
  avgDurationMinutes: number;
  completed: number;
}

export interface AgentStatsData {
  agentName: string;
  humanCount: number;
  aiCount: number;
}

export interface OverallConversionData {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

export interface BatchEngagementData {
  hasBatchExecutions: boolean;
  totalCalls: number;
  attemptedCalls: number;
  replies: number;
  responseRate: number;
}

export interface DashboardChartsData {
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

export const dashboardApi = {
  async getStats(preset: DateRangePreset, customRange?: DateRange): Promise<DashboardStats> {
    const params: Record<string, string> = { preset };

    if (preset === 'custom' && customRange) {
      params.startDate = customRange.from.toISOString();
      params.endDate = customRange.to.toISOString();
    }

    const response = await api.get<{ data: DashboardStats }>('/dashboard/stats', { params });
    return response.data.data;
  },

  async getOnboardingStatus(): Promise<OnboardingStatus> {
    const response = await api.get<{ data: OnboardingStatus }>('/dashboard/onboarding');
    return response.data.data;
  },

  async getChartsData(preset: DateRangePreset, customRange?: DateRange): Promise<DashboardChartsData> {
    const params: Record<string, string> = { preset };

    if (preset === 'custom' && customRange) {
      params.startDate = customRange.from.toISOString();
      params.endDate = customRange.to.toISOString();
    }

    const response = await api.get<{ data: DashboardChartsData }>('/dashboard/charts', { params });
    return response.data.data;
  },
};
