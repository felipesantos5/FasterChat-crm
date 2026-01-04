import { api } from './api';

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

export interface DashboardChartsData {
  pipelineFunnel: PipelineFunnelData[];
  messagesOverTime: MessagesOverTimeData[];
  appointmentsOverTime: AppointmentsOverTimeData[];
  appointmentsByStatus: AppointmentsByStatusData[];
  customerActivity: CustomerActivityData;
}

export const dashboardApi = {
  async getStats(period: 'today' | 'week' | 'month' = 'today'): Promise<DashboardStats> {
    const response = await api.get<{ data: DashboardStats }>('/dashboard/stats', {
      params: { period },
    });
    return response.data.data;
  },

  async getOnboardingStatus(): Promise<OnboardingStatus> {
    const response = await api.get<{ data: OnboardingStatus }>('/dashboard/onboarding');
    return response.data.data;
  },

  async getChartsData(period: 'week' | 'month' | 'quarter' = 'month'): Promise<DashboardChartsData> {
    const response = await api.get<{ data: DashboardChartsData }>('/dashboard/charts', {
      params: { period },
    });
    return response.data.data;
  },
};
