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
}

export const dashboardApi = {
  async getStats(period: 'today' | 'week' | 'month' = 'today'): Promise<DashboardStats> {
    const response = await api.get<{ data: DashboardStats }>('/dashboard/stats', {
      params: { period },
    });
    return response.data.data;
  },
};
