import useSWR from 'swr'
import { dashboardApi } from '@/lib/dashboard'

export function useDashboardStats(period: 'today' | 'week' | 'month' = 'week') {
  const { data, error, isLoading, mutate } = useSWR(
    `/dashboard/stats/${period}`,
    () => dashboardApi.getStats(period),
    {
      dedupingInterval: 30000,
      refreshInterval: 60000,
    }
  )

  return {
    stats: data,
    isLoading,
    isError: error,
    mutate,
  }
}
